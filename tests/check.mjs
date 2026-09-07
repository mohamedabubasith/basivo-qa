// The one check: the manifest points at files that exist, every agent and
// command has the frontmatter Claude Code needs, the example verdict fits
// the schema, and no user-facing text carries an em-dash.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const fail = (msg) => { console.error("FAIL " + msg); process.exitCode = 1; };

const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
for (const key of ["skills", "agents", "commands"]) {  // default dirs, auto-discovered
  if (!existsSync(join(root, key))) fail(`${key} dir missing`);
}
// The marketplace entry and the plugin manifest are two files nobody
// remembers to bump together. When they disagree, `claude plugin update`
// installs a version the manifest does not claim to be, and the mismatch
// shows up as a plugin that will not load rather than as a version error.
const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
const listed = marketplace.plugins.find((entry) => entry.name === plugin.name);
if (!listed) fail("the marketplace does not list this plugin");
if (listed && listed.version !== plugin.version) {
  fail(`marketplace says ${listed.version}, plugin.json says ${plugin.version}`);
}
if (marketplace.metadata?.version !== plugin.version) {
  fail(`marketplace metadata says ${marketplace.metadata?.version}, plugin.json says ${plugin.version}`);
}

if (!/VERSION = "0\.0\.\d+"/.test(read("bin/playwright-mcp.mjs"))) fail("playwright mcp version must be pinned in the launcher");
if (!read("bin/playwright-mcp.mjs").includes("--secrets")) fail("launcher must wire the secrets file");
if (!read("agents/qa-check.md").includes("QA_USER")) fail("qa-check must explain typing secret names");

const frontmatter = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? Object.fromEntries(m[1].split("\n").filter((l) => /^\w[\w-]*:/.test(l)).map((l) => {
    const i = l.indexOf(":"); return [l.slice(0, i), l.slice(i + 1).trim()];
  })) : null;
};
for (const f of readdirSync(join(root, "agents"))) {
  const fm = frontmatter(read(join("agents", f)));
  if (!fm?.name || !fm?.description) fail(`agents/${f} needs name and description`);
  if (fm?.name !== f.replace(/\.md$/, "")) fail(`agents/${f} name must match filename`);
}
for (const f of readdirSync(join(root, "commands"))) {
  if (!frontmatter(read(join("commands", f)))?.description) fail(`commands/${f} needs description`);
}
if (!frontmatter(read("skills/qa/SKILL.md"))?.name) fail("skill needs name");

// Minimal schema check: required keys, enum, additionalProperties, maxItems.
const schema = JSON.parse(read("schema/verdict.schema.json"));
const verdict = JSON.parse(read("examples/verdict.json"));
const check = (obj, sch, path) => {
  for (const k of sch.required ?? []) if (!(k in obj)) fail(`${path}: missing ${k}`);
  for (const k of Object.keys(obj)) {
    const prop = sch.properties?.[k];
    if (!prop) { if (sch.additionalProperties === false) fail(`${path}: unexpected ${k}`); continue; }
    const v = obj[k];
    if (prop.enum && !prop.enum.includes(v)) fail(`${path}.${k}: ${v} not in enum`);
    if (prop.type === "integer" && !Number.isInteger(v)) fail(`${path}.${k}: not integer`);
    if (prop.type === "string" && typeof v !== "string") fail(`${path}.${k}: not string`);
    if (prop.maxLength && v.length > prop.maxLength) fail(`${path}.${k}: too long`);
    if (prop.type === "array") {
      if (!Array.isArray(v)) fail(`${path}.${k}: not array`);
      else if (prop.maxItems && v.length > prop.maxItems) fail(`${path}.${k}: too many`);
      else if (prop.items?.type === "object") v.forEach((it, i) => check(it, prop.items, `${path}.${k}[${i}]`));
    }
    if (prop.type === "object" && v && typeof v === "object") check(v, prop, `${path}.${k}`);
  }
};
check(verdict, schema, "verdict");

// The example flows file must at least be well-formed enough to have the keys we document.
const flows = read("examples/flows.yaml");
for (const key of ["base_url:", "auth:", "user_secret:", "flows:", "depends_on:"]) if (!flows.includes(key)) fail(`flows.yaml lacks ${key}`);

// Hooks: the flows reader, glob matching, and both hook scripts end to end
// against a scratch project.
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { readFlows, affectedFlows, globToRegExp } from "../hooks/flows.mjs";

const proj = mkdtempSync(join(tmpdir(), "qa-hooks-"));
mkdirSync(join(proj, ".qa"));
writeFileSync(join(proj, ".qa", "flows.yaml"), read("examples/flows.yaml"));
const cfg = readFlows(proj);
if (cfg.watch.join() !== "apps/web/src/**") fail("top-level watch not read: " + cfg.watch);
if (cfg.flows.map((f) => f.id).join() !== "signup,login,create-flow,rename-and-save") fail("flow ids: " + cfg.flows.map((f) => f.id));
if (cfg.flows[1].watch.length !== 2) fail("login watch list not read");
if (!globToRegExp("apps/web/src/**").test("apps/web/src/a/b.tsx")) fail("** glob");
if (globToRegExp("apps/web/src/**").test("apps/api/x.py")) fail("glob too loose");
if (!globToRegExp("apps/web/src/lib/auth*").test("apps/web/src/lib/auth.ts")) fail("* glob");
if (affectedFlows(cfg, "apps/web/src/routes/auth/Login.tsx").join() !== "login") fail("own watch should win: " + affectedFlows(cfg, "apps/web/src/routes/auth/Login.tsx"));
if (affectedFlows(cfg, "apps/web/src/routes/app/Builder.tsx").length !== 4) fail("top-level watch should select every flow");
if (affectedFlows(cfg, "apps/api/main.py").length !== 0) fail("unwatched file should select nothing");

const hook = (name, event) => execFileSync("node", [join(root, "hooks", name)], { input: JSON.stringify(event), encoding: "utf8" });
const edit = hook("after-edit.mjs", { cwd: proj, tool_name: "Edit", tool_input: { file_path: join(proj, "apps/web/src/routes/auth/Login.tsx") } });
if (!edit.includes("login")) fail("after-edit should name the flow: " + edit);
if (!existsSync(join(proj, ".qa/run/pending.json"))) fail("pending file not written");
if (hook("after-edit.mjs", { cwd: proj, tool_input: { file_path: join(proj, "apps/api/main.py") } }) !== "") fail("unwatched edit should be silent");
const stop = JSON.parse(hook("before-stop.mjs", { cwd: proj }));
if (stop.decision !== "block" || !stop.reason.includes("login")) fail("stop should block with the flow named: " + JSON.stringify(stop));
if (hook("before-stop.mjs", { cwd: proj, stop_hook_active: true }) !== "") fail("stop must not loop");
// A verdicts file newer than the edit settles the pending list.
writeFileSync(join(proj, ".qa/run/verdicts.json"), "[]");
const later = new Date(Date.now() + 5000); utimesSync(join(proj, ".qa/run/verdicts.json"), later, later);
if (hook("before-stop.mjs", { cwd: proj }) !== "") fail("stop should pass once verdicts are fresh");
if (JSON.parse(readFileSync(join(proj, ".qa/run/pending.json"), "utf8")).flows.length) fail("pending should be cleared");
if (hook("before-stop.mjs", { cwd: mkdtempSync(join(tmpdir(), "noqa-")) }) !== "") fail("no flows.yaml means inert");
// A pending list from yesterday must not block today's work.
writeFileSync(join(proj, ".qa/run/pending.json"), JSON.stringify({ flows: ["login"], since: Date.now() - 25 * 3600 * 1000 }));
if (hook("before-stop.mjs", { cwd: proj }) !== "") fail("stale pending should not block");

for (const f of ["README.md", "CLAUDE.md", "skills/qa/SKILL.md", ...readdirSync(join(root, "agents")).map((a) => "agents/" + a), ...readdirSync(join(root, "commands")).map((c) => "commands/" + c), ...readdirSync(join(root, "hooks")).map((h) => "hooks/" + h)]) {
  if (read(f).includes("—")) fail(`${f}: em-dash in user-facing text`);
}

if (!process.exitCode) console.log("ok");

