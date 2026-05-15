# Blueprint AutoAgent Lab

This directory is the repo-local seed for Blueprint's AutoAgent lab.

Purpose:

- build Harbor-style eval datasets for narrow automation lanes
- optimize harnesses offline
- port only proven prompt/tool/orchestration improvements back into production

Production Hermes/Paperclip runtime remains the source of truth for live work.
The lab is an offline eval surface by default: it must be useful without Firestore,
ACP, provider credentials, or live exports.

## Pilot Lanes

1. `waitlist_triage`
2. `support_triage`
3. `preview_diagnosis`

## Offline Run

Default local run:

```bash
npm run autoagent:run -- --sample 3
```

This command:

- skips live Firestore export unless `--export-live` is passed
- seeds any missing canonical cases for the three pilot lanes
- builds Harbor-style task directories from local fixtures
- validates expected outputs against the production task schemas
- scores local canonical candidates and runs negative controls so bad queue,
  retry, or unsafe auto-clear decisions fail

Useful output should include nonzero case counts for all three lanes, pass/fail
counts, reward summaries, and `negative_controls_blocked` counts.

Live historical export remains a separate opt-in path:

```bash
npm run autoagent:run -- --export-live --sample 3
npm run autoagent:export
```

Only use live export when Firebase Admin credentials are intentionally available.

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
