// The little of .qa/flows.yaml the hooks need: flow ids and their watch
// globs. Deliberately not a YAML parser; the file's shape is fixed by
// examples/flows.yaml and this reads exactly that shape.
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function readFlows(root) {
  const file = join(root, ".qa", "flows.yaml");
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, "utf8").split("\n");
  const top = [];
  const flows = [];
  let section = "";
  let current = null;
  let list = null;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const text = line.trim();
    if (indent === 0) {
      section = text.replace(/:.*$/, "");
      current = null;
      list = section === "watch" ? top : null;
      continue;
    }
    if (section === "flows") {
      if (text.startsWith("- id:")) { current = { id: text.slice(5).trim(), watch: [] }; flows.push(current); list = null; continue; }
      if (text.startsWith("id:") && current) { current.id = text.slice(3).trim(); continue; }
      if (text.startsWith("watch:") && current) { list = current.watch; continue; }
      if (text.startsWith("steps:") || text.startsWith("depends_on:")) { list = null; continue; }
    }
    if (list && text.startsWith("- ")) list.push(text.slice(2).trim().replace(/^["']|["']$/g, ""));
  }
  return { watch: top, flows };
}

// Enough glob for watch lists: ** any depth, * within a segment, {a,b}.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*"; i += glob[i + 2] === "/" ? 2 : 1; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") { const end = glob.indexOf("}", i); re += "(?:" + glob.slice(i + 1, end).split(",").map(escape).join("|") + ")"; i = end; }
    else re += escape(c);
  }
  return new RegExp("^" + re + "$");
}
const escape = (s) => s.replace(/[.+^$()|[\]\\]/g, "\\$&");

export function affectedFlows(config, relPath) {
  const hit = (globs) => globs.some((g) => globToRegExp(g).test(relPath));
  const own = config.flows.filter((f) => f.watch.length && hit(f.watch)).map((f) => f.id);
  if (own.length) return own;
  if (config.watch.length && hit(config.watch)) return config.flows.map((f) => f.id);
  return [];
}

export const pendingFile = (root) => join(root, ".qa", "run", "pending.json");
export const verdictsFile = (root) => join(root, ".qa", "run", "verdicts.json");

export function readPending(root) {
  try { return JSON.parse(readFileSync(pendingFile(root), "utf8")); } catch { return { flows: [], since: 0 }; }
}
export function writePending(root, pending) {
  mkdirSync(join(root, ".qa", "run"), { recursive: true });
  writeFileSync(pendingFile(root), JSON.stringify(pending));
}
// Pending flows are settled once a verdicts file newer than the edits exists.
export function settled(root, pending) {
  try { return statSync(verdictsFile(root)).mtimeMs >= pending.since; } catch { return false; }
}
