# basivo-qa

Claude Code plugin. No runtime code of our own: the manifest bundles the
Playwright MCP server, and everything else is markdown that tells Claude how
to test, judge, triage and fix. Keep it that way until a real need appears.

## Contract

- The verdict schema in `schema/verdict.schema.json` is the product. Agents
  emit it, the skill consumes it, users build on it. Change it deliberately
  and bump the version.
- `qa-check` never reads source and never fixes. `qa-triage` never touches
  the browser. The skill is the only thing that proposes edits, and it does
  so through the normal Claude edit flow so the user sees every diff.
- Credentials come from environment variables named in `flows.yaml`. Nothing
  in this repo may write, print or log a credential value.
- Flows are intents, never selectors. If a flow needs a selector to work, the
  step is written wrong or the app has an accessibility gap worth reporting.
- Only localhost, or a URL the user gave in the session. Never a guessed
  production host.

## Text a user reads

Plain prose. No em-dashes, no arrows, no decorative tables. Commands, paths
and error strings go in code spans or blocks.

## Check before committing

```
node tests/check.mjs
```
