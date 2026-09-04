---
description: Test the running app in a browser and fix what fails, in this session
argument-hint: [base-url] [flow-id ...]
---

Use the qa skill. Arguments: $ARGUMENTS

The first argument, if it looks like a URL, is the base URL. Any remaining
arguments are flow ids to run; with none, run every flow in .qa/flows.yaml.
If there is no .qa/flows.yaml, run qa-explore first and show the user the
file before running anything.
