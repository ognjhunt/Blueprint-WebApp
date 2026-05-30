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
  retry, unsafe auto-clear, no-change churn, hosted-session proof drift, and
  public-copy proof drift decisions fail

Useful output should include nonzero case counts for all three lanes, pass/fail
counts, reward summaries, and `negative_controls_blocked` counts.

## Prompt-Policy Promotion Gate

Use the promotion gate before marking an AutoAgent prompt, policy, or
orchestration change promotable for Paperclip/Hermes:

```bash
npm run autoagent:promotion-gate -- --candidate labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json --sample 3
```

The gate is repo-local and offline-only. It writes a packet under
`output/autoagent/prompt-policy-promotion/latest/promotion-packet.md` with a
`promote`, `hold`, or `reject` decision, exact local command outputs, and a
rollback condition. It does not mutate live Paperclip.

## Recursive Improvement Patch Proposals

`npm run autoagent:recursive-improve -- --dry-run` writes a patch-proposal
status report when the loop reaches the post-fixture promotion gate:

- `output/autoagent/recursive-improvement/latest/proposed_patch_summary.json`
- `output/autoagent/recursive-improvement/latest/proposed_patch_report.md`

By default the status is `not_proposed`. If `--ai-patch-proposal` is used with
a configured local proposer, the proposal is accepted only when it stays inside
low-risk AutoAgent fixture/evaluator/recursive-loop/docs scope and the offline
eval plus promotion gate have already passed. The loop never applies the patch;
unsafe scopes such as payments, payouts, providers, live Paperclip mutation,
city launch, rights/privacy/legal, hosted-session fulfillment, customer claims,
and production deployment config are rejected with an exact reason.

Live historical export remains a separate opt-in path:

```bash
npm run autoagent:run -- --export-live --sample 3
npm run autoagent:export
```

Only use live export when Firebase Admin credentials are intentionally available.

## Paperclip/Hermes Failure Fixture Queue

Read-only Paperclip run-failure sweeps can be saved as JSON and passed into the
recursive improvement loop without allowing fixture generation to mutate live
state:

```bash
npm run paperclip:sweep:run-failures -- --live-host --json --limit 250 > output/autoagent/paperclip-failures.json
npm run autoagent:recursive-improve -- --dry-run --paperclip-failure-sweep output/autoagent/paperclip-failures.json
```

The loop writes `paperclip-failure-fixture-queue.json` and `.md` under the
recursive-improvement output directory, normalizes repeated failures,
no-change churn, fake progress, unsupported proof, copy/proof drift, retry
loops, and blocked-lane overreach, then feeds accepted fixture drafts through
the same offline evaluator and Harbor task builder. Suppressed recovered runs
are recorded in the source summary but are not queued for fixture drafting.

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
