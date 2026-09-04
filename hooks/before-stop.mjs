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
  // Settled by a fresh verdicts file, or too old to be about this work.
  const stale = Date.now() - pending.since > 24 * 60 * 60 * 1000;
  if (settled(root, pending) || stale) { writePending(root, { flows: [], since: 0 }); return; }
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `Files you edited affect these qa flows: ${pending.flows.join(", ")}. Run the qa skill for exactly those flows now, base URL from .qa/flows.yaml. When done, write every verdict as a JSON array to .qa/run/verdicts.json with the Write tool; that file is what clears this reminder. Then report one line per flow and finish. If the app is not running, say so in one line and finish without writing anything.`,
  }));
});
