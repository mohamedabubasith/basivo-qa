# basivo-qa

A Claude Code plugin that tests your web app in a real browser and hands the
result to Claude, so the bug gets fixed in the same session instead of
written into a report someone reads later.

```
/qa http://localhost:5173
```

That runs the flows in `.qa/flows.yaml`, tells you in one line per flow what
passed and what did not, finds the file that owns the failure, proposes the
fix, and reruns the failed flow after you accept it.

## Why this and not a test platform

Test platforms stop at the report. A human reads it, opens a ticket, and a
developer fixes the bug days later. This plugin closes that loop inside the
tool the developer is already sitting in. It runs on localhost, needs no
account, and stores nothing outside your repo.

Flows are written as intents, not selectors:

```yaml
flows:
  - id: login
    steps:
      - open /login
      - log in
      - expect to land inside the app, not on /login
```

The agent works out how to click each step every run, so a moved button does
not break the flow.

## Install

```
claude plugin marketplace add mohamedabubasith/basivo-qa
claude plugin install basivo-qa@basivo
```

The plugin bundles the Playwright MCP server; the first run downloads a
browser, which takes a minute.

## Use

1. Start your app locally.
2. `/qa-explore` once. It walks the app, writes `.qa/flows.yaml`, and shows
   you the file. Edit it if you like; commit it.
3. `/qa` whenever you want to know whether anything broke.

Credentials for flows that log in come from environment variables, by
default `QA_USER` and `QA_PASSWORD`. They are never written to disk by the
plugin.

## What a verdict looks like

One JSON object per flow, written to `.qa/run/verdicts.json`. The schema is
in `schema/verdict.schema.json`; an example is in `examples/verdict.json`.
The shape is deliberately small: the failing step, what was expected, what
happened, the failed requests, console errors, a screenshot path, and the
files most likely to own the bug.

## What it does not do

Cross-browser matrices, device farms, scheduled cloud runs, dashboards,
recorded videos. Those are for QA departments. This is for the person who
just changed the code.

## Layout

```
.claude-plugin/plugin.json   manifest, bundles the Playwright MCP server
skills/qa/SKILL.md           the loop: run, verdict, triage, fix, rerun
agents/qa-check.md           one flow in the browser, one JSON verdict
agents/qa-explore.md         writes .qa/flows.yaml from the running app
agents/qa-triage.md          names the files behind a failure
commands/qa.md               /qa
commands/qa-explore.md       /qa-explore
schema/verdict.schema.json   the contract every verdict follows
examples/                    a flows.yaml and a verdict to copy from
tests/check.mjs              validates the manifest, schema and examples
```

## License

MIT
