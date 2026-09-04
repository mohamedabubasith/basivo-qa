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
- Credentials only from environment variables named in `auth:`. Never read
  them from files, never print them, never write them into a verdict.

## Run

1. Confirm the server answers: navigate to the base URL. If it does not load,
   every flow is `blocked` and the run stops with one line saying so.
2. Resolve `depends_on`. A flow whose dependency failed is `blocked`, not run.
3. For each flow, spawn the `qa-check` agent with the flow's steps, the base
   URL and the auth block. One agent per flow. Flows without dependencies can
   run in parallel; keep it to three at once so the machine stays usable.
4. Collect one verdict per flow. Validate the shape against
   `${CLAUDE_PLUGIN_ROOT}/schema/verdict.schema.json` in your head: the
   required keys are `flow`, `status`, `base_url`, `steps_run`. If an agent
   returns prose instead of JSON, ask it once for the JSON only.
5. Write all verdicts to `.qa/run/verdicts.json` so the next run and the
   user's tooling can read them.

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

## Rules

- Never run flows against a URL that is not localhost or explicitly given by
  the user in this session.
- Never use Bash to work around a browser step. The browser is the test.
- Screenshots live under `.qa/run/`. Add `.qa/run/` to the project's
  `.gitignore` if it is not there; `.qa/flows.yaml` is committed.
- A verdict's `note` is one or two sentences. Everything else is a field.
