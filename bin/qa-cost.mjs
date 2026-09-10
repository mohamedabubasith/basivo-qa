#!/usr/bin/env node
// What the last runs cost, in the only unit that matters here: page
// descriptions read into a model's context.
//
// Browser testing with an agent is cheap or ruinous depending on one habit,
// and the habit is invisible without a number. A snapshot of a real
// application is two to four thousand tokens; a flow that takes one per step
// spends more context describing the page than testing it, and nobody notices
// because every individual call looks small.
//
// So this counts what is on disk in .qa/run and says it plainly. Run it after
// a run: `node bin/qa-cost.mjs` (or point it at another project's root).
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

//: Characters per token, near enough for YAML and English prose. The point is
//: the order of magnitude, not a billing statement.
const CHARS_PER_TOKEN = 3.6;

const root = process.argv[2] ?? process.cwd();
const dir = join(root, ".qa", "run");

let files;
try {
  files = readdirSync(dir);
} catch {
  console.log(`No .qa/run in ${root}. Run the qa skill first.`);
  process.exit(0);
}

const snapshots = files
  .filter((name) => name.startsWith("page-") && name.endsWith(".yml"))
  .map((name) => ({ name, bytes: statSync(join(dir, name)).size }))
  .sort((a, b) => a.bytes - b.bytes);

const screenshots = files.filter((name) => name.endsWith(".jpeg") || name.endsWith(".png"));

if (snapshots.length === 0) {
  console.log("No page snapshots saved yet.");
  process.exit(0);
}

const tokens = (bytes) => Math.round(bytes / CHARS_PER_TOKEN);
const at = (fraction) => snapshots[Math.min(snapshots.length - 1, Math.floor(snapshots.length * fraction))].bytes;
const total = snapshots.reduce((sum, item) => sum + item.bytes, 0);

console.log(`snapshots saved   ${snapshots.length}`);
console.log(`median            ${tokens(at(0.5)).toLocaleString()} tokens`);
console.log(`worst tenth       ${tokens(at(0.9)).toLocaleString()} tokens`);
console.log(`largest           ${tokens(snapshots[snapshots.length - 1].bytes).toLocaleString()} tokens  (${snapshots[snapshots.length - 1].name})`);
console.log(`all of them       ${tokens(total).toLocaleString()} tokens`);
console.log(`screenshots       ${screenshots.length} (files, not context)`);

// The run directory keeps every run ever, so the totals above are a history
// rather than a bill. What a person actually wants to know is what the LAST
// run cost, and the honest boundary for that is the verdicts file: everything
// written in the window that ends when the verdicts were.
const verdicts = join(dir, "verdicts.json");
try {
  const rows = JSON.parse(readFileSync(verdicts, "utf8"));
  const wrote = statSync(verdicts).mtimeMs;
  const window = Number(process.argv[3] ?? 60) * 60_000;
  const recent = snapshots.filter(
    (item) => statSync(join(dir, item.name)).mtimeMs > wrote - window,
  );
  const spent = recent.reduce((sum, item) => sum + item.bytes, 0);
  const per = recent.length / Math.max(1, rows.length);

  console.log(`\nlast run          ${rows.length} flows, ${recent.length} snapshots`);
  console.log(`                  ${tokens(spent).toLocaleString()} tokens of pages, ${per.toFixed(1)} a flow`);
  if (per > 6) {
    console.log("                  more than six a flow means the checker is describing");
    console.log("                  pages rather than testing them: prefer find and verify.");
  }
} catch {
  // No verdicts yet, or an older run. The snapshot numbers stand on their own.
}
