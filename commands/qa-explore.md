---
description: Walk the running app and write .qa/flows.yaml with its critical flows
argument-hint: [base-url]
---

Spawn the qa-explore agent against the base URL in $ARGUMENTS, or the
base_url in .qa/flows.yaml, or a dev server found on localhost. Never guess a
production URL. When it finishes, show the user the file and stop. Do not run
the flows.
