// PostToolUse on Edit/Write: note which flows the edited file touches, so
// the Stop hook can insist they run before Claude signs off. Silent when the
// project has no .qa/flows.yaml; that file is the opt-in.
import { relative, isAbsolute } from "node:path";
import { readFlows, affectedFlows, readPending, writePending } from "./flows.mjs";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let event;
  try { event = JSON.parse(input); } catch { return; }
  const root = event.cwd || process.cwd();
  const config = readFlows(root);
  if (!config) return;
  const file = event.tool_input?.file_path;
  if (!file) return;
  const rel = isAbsolute(file) ? relative(root, file) : file;
  if (rel.startsWith("..") || rel.startsWith(".qa/")) return;
  const flows = affectedFlows(config, rel);
  if (!flows.length) return;
  const pending = readPending(root);
  const merged = [...new Set([...pending.flows, ...flows])];
  writePending(root, { flows: merged, since: Date.now() });
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `qa: ${rel} affects flows ${merged.join(", ")}. They will run before you finish; keep editing for now.`,
    },
  }));
});
