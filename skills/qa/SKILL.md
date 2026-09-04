---
name: qa
description: >
  Test a running web app in a real browser and return a verdict Claude acts on
  in the same session. Use when the user says /qa, "test the app", "check the
  login flow", "does signup still work", "smoke test", "run the flows", or
  after a frontend change when they ask whether anything broke. Not for
  writing Playwright test files; this skill exercises the app and reports.
---

# QA: browser test, verdict, fix

The point is the loop, not the report. Run the flows, get a verdict per flow,
fix what failed, rerun only that flow, stop when green.

## Inputs

- `.qa/flows.yaml` in the project root. Intents per flow, see
  `${CLAUDE_PLUGIN_ROOT}/examples/flows.yaml`. If it is missing, run the
  `qa-explore` agent first to write one, then show it to the user before
  running anything.
- A base URL. Order: argument to the command, then `base_url` in flows.yaml,
  then a dev server detected on localhost. Never guess a production URL.
- Credentials only from `.qa/secrets.env` (dotenv, gitignored). The browser
  tool reads that file; the agents type the secret names given in `auth:` and
  the tool substitutes the values and redacts them from every response. Never
  read that file, never print a value, never write one into a verdict. If it
  is missing the entries a flow needs, the flow is `blocked` and the summary
  says which entries to add. Make sure `.qa/secrets.env` and `.qa/run/` are in
  the project's `.gitignore`; add them if not.

## Run

1. Confirm the server answers: navigate to the base URL. If it does not load,
   every flow is `blocked` and the run stops with one line saying so. If the
   browser itself fails to start with a message about a missing executable,
   run `npx playwright install chromium` once, in Bash, and try again. That
   is the only Bash this skill ever runs.
2. Resolve `depends_on`. A flow whose dependency failed is `blocked`, not run.
3. For each flow, in order, spawn the `qa-check` agent with the flow's steps,
   the base URL and the auth block. One agent per flow, one flow at a time.
   Never run two in parallel: every agent drives the same browser through
   the same Playwright MCP process, and two agents clicking in one browser
   fail each other in ways that look like real bugs.
4. Collect one verdict per flow. Validate the shape against
   `${CLAUDE_PLUGIN_ROOT}/schema/verdict.schema.json` in your head: the
   required keys are `flow`, `status`, `base_url`, `steps_run`. If an agent
   returns prose instead of JSON, ask it once for the JSON only.
5. Write all verdicts to `.qa/run/verdicts.json` as a JSON array, overwriting
   the previous run. The plugin's Stop hook reads that file's timestamp to
   know the pending flows have been re-run, so write it even when every flow
   passed, and write it before you summarise.

## After the run

Summarise in at most one line per flow: id, status, and for failures the
`failed_step.actual`. No tables of passes.

For each failure, before proposing anything, run the `qa-triage` agent with
the verdict and let it name suspect files. Then propose the fix as you would
for any bug: show the diff, wait for the user. After the user accepts an
edit, rerun only the flows that failed, not the whole file.

Stop when every flow that was run is `pass`, or the user says stop, or the
same flow has failed three times in a row with different fixes. In the last
case say so plainly and hand over.

## Runs you did not start

The plugin installs two hooks. After an edit to a file matched by a `watch`
list in flows.yaml, the affected flow ids are recorded under
`.qa/run/pending.json`. When you try to finish the turn with pending flows,
the Stop hook asks you to run them first. Run exactly those flows, write the
verdicts file, report in one line per flow, then finish. If the app is not
running, say so in one line and finish; do not start servers to satisfy the
hook. Both hooks are inert in a project with no `.qa/flows.yaml`.

## Rules

- Never run flows against a URL that is not localhost or explicitly given by
  the user in this session.
- Never use Bash to work around a browser step. The browser is the test.
- Screenshots live under `.qa/run/`. Add `.qa/run/` to the project's
  `.gitignore` if it is not there; `.qa/flows.yaml` is committed.
- A verdict's `note` is one or two sentences. Everything else is a field.
