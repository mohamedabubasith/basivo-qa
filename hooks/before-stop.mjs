// Stop: if edits this session touched flows that have not been re-run, do
// not let Claude finish yet; tell it to run them. stop_hook_active means we
// already said so once this turn, so we step aside and avoid a loop.
import { readFlows, readPending, settled, writePending } from "./flows.mjs";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let event;
  try { event = JSON.parse(input); } catch { return; }
  if (event.stop_hook_active) return;
  const root = event.cwd || process.cwd();
  if (!readFlows(root)) return;
  const pending = readPending(root);
  if (!pending.flows.length) return;
  if (settled(root, pending)) { writePending(root, { flows: [], since: 0 }); return; }
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `Files you edited affect these qa flows: ${pending.flows.join(", ")}. Run the qa skill for exactly those flows now (base URL from .qa/flows.yaml; if the app is not running, say so in one line and stop instead). Report the verdicts, then finish.`,
  }));
});
