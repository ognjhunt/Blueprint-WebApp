# Blueprint AutoAgent Lab

This directory is the repo-local seed for Blueprint's AutoAgent lab.

Purpose:

- build Harbor-style eval datasets for narrow automation lanes
- optimize harnesses offline
- port only proven prompt/tool/orchestration improvements back into production

Production Hermes/Paperclip runtime remains the source of truth for live work.

## Pilot Lanes

1. `waitlist_triage`
2. `support_triage`
3. `preview_diagnosis`

## Structure

```text
labs/autoagent/
  README.md
  program.md
  tasks/
    README.md
    waitlist-triage/
      CASE_FORMAT.md
    support-triage/
      CASE_FORMAT.md
    preview-diagnosis/
      CASE_FORMAT.md
```

## Intended Future Split

If the lab proves valuable, move this directory into a standalone repo such as:

`/Users/nijelhunt_1/workspace/Blueprint-AgentLab`

Until then, this scaffold keeps the data contracts close to the production task contracts they optimize.
