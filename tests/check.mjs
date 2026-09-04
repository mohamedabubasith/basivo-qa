// The one check: the manifest points at files that exist, every agent and
// command has the frontmatter Claude Code needs, the example verdict fits
// the schema, and no user-facing text carries an em-dash.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const fail = (msg) => { console.error("FAIL " + msg); process.exitCode = 1; };

const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
for (const key of ["skills", "agents", "commands"]) {
  if (!existsSync(join(root, plugin[key]))) fail(`${key} dir missing: ${plugin[key]}`);
}
if (!plugin.mcpServers?.playwright?.args?.some((a) => a.startsWith("@playwright/mcp@")))
  fail("playwright mcp server must be pinned");

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
for (const key of ["base_url:", "auth:", "flows:", "depends_on:"]) if (!flows.includes(key)) fail(`flows.yaml lacks ${key}`);

for (const f of ["README.md", "CLAUDE.md", "skills/qa/SKILL.md", ...readdirSync(join(root, "agents")).map((a) => "agents/" + a), ...readdirSync(join(root, "commands")).map((c) => "commands/" + c)]) {
  if (read(f).includes("—")) fail(`${f}: em-dash in user-facing text`);
}

if (!process.exitCode) console.log("ok");
