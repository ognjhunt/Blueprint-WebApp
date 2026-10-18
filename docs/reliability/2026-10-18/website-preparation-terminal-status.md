# Every website capture reaches a state the site is told about

Beta journey L3/L6 (site capture → scene preparation → status and messages).
Observed blocker: a read-only audit on 2026-10-18 found no "cannot build"
signal between the Pipeline and the WebApp. A dead-lettered handoff, the
`website_scene_preparation_budget_exhausted` refusal, a capacity shortage, a
crashed final attempt, an upload the Pipeline never reported on, and a scene
that stopped after hand-off all left the site on "preparing" or "needs more
information" with no end. This extends the source-bound status of
[2026-10-08](../2026-10-08/customer-preparation-status.md); the Pipeline half is
`docs/reliability/website-preparation-terminal-status-2026-10-18.md` in
BlueprintCapturePipeline.

## Contract

The status read now sends `X-Blueprint-Preparation-Status-Version: 2`. A
Pipeline that predates v2 ignores it and keeps answering
`website_preparation_status.v1`; both versions are accepted. v2 adds
`terminal_reason` and two states:

- `capacity_delayed`: the attempt only waits for Blueprint's processing
  capacity. The site is told nothing is needed from it, and no email is sent.
- `failed_terminal`: preparation ended for good, with one of
  `permanent_invalid`, `retry_exhausted`, `budget_exhausted`,
  `capacity_blocked`, `out_of_scope`. A reason must appear exactly when the
  state is terminal, and the code must match the state.

The acceptance returned to the Pipeline names the version read
(`website_preparation_status_acceptance.v1` or `.v2`), so a Pipeline that
predates v2 always receives exactly v1. The same ledger revision may be read in
either version; within one version a revision still cannot change. The status
is written with Firestore `mergeFields`, because `merge: true` deep-merges maps
and would keep a v2-only key under a later v1 receipt.

## What the site sees and receives

- `failed_terminal` shows "Scene preview preparation could not finish, and we
  have stopped trying", one fixed sentence for a known reason, and the
  reference. The `preparation_ended` email says the same, once per terminal
  transition (event id: selectors plus the ending attempt), through the existing
  outbox, recipient check and dispatch-time re-read of the current status. A
  re-driven attempt cancels an unsent ending; a later ending is a new email.
- A website upload starts a preparation watch in the transaction that records
  it (browser publication, or app-bundle completion, supplements included). The
  site is told preparation "is taking longer than it should, and our team has
  been told" when no status arrives within
  `BLUEPRINT_WEBSITE_PREPARATION_FIRST_STATUS_ALERT_MS` (default 2 h) or one
  non-final state lasts `BLUEPRINT_WEBSITE_PREPARATION_STUCK_ALERT_MS`
  (default 24 h). A hand-off or an authority ending clears the watch.
- After hand-off the site's latest `taskEvaluationSceneIntakes` record is read.
  A block the scene cannot leave (the worker's terminal states, or the
  Pipeline's configuration failure, policy-canary block, ended authority or an
  exhausted retry allowance) is stated plainly; any other block reads as
  waiting on our team. No phase, blocker or spend detail reaches the site.

## Operators

The beta ops monitor alerts once per due watch (Slack plus one ops email, ids
and admin links only): no status since upload, one state too long, or an ending.
Captures uploaded before the watch existed get one on the monitor's first passes
(a rotating, bounded scan), dated from their own recorded upload, so a capture
already stuck at deploy time is reported too; a present watch field (including
null after a final status) is never rewritten.
The due index is cleared in the transaction that re-reads it, so a concurrent
status commit with a newer clock wins, and a withdrawn recording is not
reported. It also alerts once per website scene intake that stopped after
hand-off (create-only markers in `opsWebsiteSceneIntakeAlerts`). The new queries
use Firestore's automatic single-field indexes; no index deploy is needed.

## Supplements

Supplement captures are covered by the watch. Their preparation status cannot
reach the site yet: the owner observation is walkthrough-only on both sides, so
the Pipeline refuses a supplement handoff before any ledger exists. The watch
alert is what an operator sees for them until supplement owner observation is
built.

## Deploy order

1. This WebApp change. With the Pipeline before its change, nothing about
   receipts differs; the watch, alerts and post-hand-off messages start.
2. The Pipeline change, which answers v2 to this WebApp.

Either order is safe, and rolling back either side returns both to v1.

## Verification

```bash
npx vitest run server/tests/website-preparation-terminal.test.ts server/tests/website-preparation-watch.test.ts \
  server/tests/website-preparation-status.test.ts server/tests/preparation-notifications.test.ts \
  server/tests/task-preparation-projection.test.ts server/tests/site-task-brief-status.test.ts \
  server/tests/customer-copy-free-beta.test.ts server/tests/site-assessment-queue.test.ts
npm run check
```

The tests run the production verifier, commit, notification and projection
code on the shared Firestore fake, which models `merge` and `mergeFields`.
Owner observation, the Pipeline read, storage, Slack and email are local doubles.
