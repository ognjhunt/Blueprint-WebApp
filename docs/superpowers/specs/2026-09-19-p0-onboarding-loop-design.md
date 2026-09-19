# P0 onboarding loop: design (2026-09-19)

Review status: the initial P0 implementation below was amended before merge. See
[the P0 review and P1 integration record](../../design/onboarding-p0-review-2026-09-19.md) for the reviewed payment, evidence, concurrency and executor requirements.


Bare-bones implementation of the three P0 findings in
`docs/onboarding-time-to-value-audit-2026-09-19.md`, amended by the review
discussion (browse-before-checkpoint and "no invented measurements" are kept as
constraints; nothing beyond P0 is built here).

Decisions were made under the session goal directive without a blocking review
round. Alternatives considered are listed so the choice can be reversed.

## P0-1. Purchased runs must go somewhere

Problem: `POST /api/agent-team/runs` reserves money and writes an
`evaluationRuns` record. Nothing in this repo or the Pipeline repo reads it.

Alternatives:

1. Push each run into the Pipeline's `robot_eval_job_request.v1` intake. Rejected
   for now: that contract needs a testbed identity, decision claims and
   entitlement proof per run, and the mapping cannot be verified from this repo.
2. Pull seam: the Pipeline lists queued runs and reports start, result and
   settlement. Chosen. The result and settlement half already exists; only the
   list and the start marker are missing.

Build:

- `listRequestedRuns(limit)` and `markRunStarted(runId, pipelineRunId)` in
  `server/utils/agentEvalRuns.ts`. Starting a run extends its settlement due
  time by one TTL so a run that is executing is not released as abandoned.
- `GET /api/internal/pipeline/agent-runs` (Pipeline-signed) returns queued runs
  joined with the checkpoint (runtime, reference) and the scene (capture id,
  scene id, world manifest URI, evaluation readiness).
- `POST /api/internal/pipeline/agent-runs/:runId/started` marks dispatch.
- `GET /api/agent-team/results` carries `dispatch.startedAtIso` so a team can
  tell queued from running.
- The public plan panel replaces "we will be in touch" with one action:
  fund the plan on Stripe, and on return set the spend policy and confirm the
  runs with the plan token. The key and the plan are stashed in session storage
  across the redirect. The queued state says what happens next and where results
  appear.

## P0-2. The site must see an outcome

Problem: the status ladder stops at `assessing`; the workspace results table
reads a collection the agent path never writes.

Build:

- `loadSceneScreening(sceneId)` counts queued, running and reported runs for a
  scene and the best observed result.
- `projectTaskStatus` gains two rungs after `confirm_brief`: `screening` when
  runs are queued or running, `results` when at least one reported. Headlines
  name the team count and the best observed episodes.
- The account-free status route passes screening in and, when a run exists and
  no account owns the site, returns a `claimUrl` minted from the request id.
  The capture page renders it as "Claim your site to see the results."
- The workspace task page adds agent-run results to the results table through
  `projectAgentRunResult`, using the existing anonymised team alias and the
  "Simulation" evidence label. No pilot invite for these rows in this change.

## P0-3. The brief must be read, not echoed

Problem: `draftBrief` copies the task statement and re-asks every gate.

Constraint kept from the review: proposals rest on a stated basis and nothing
is invented. Description proposals need a verbatim quote from the operator's
text; footage proposals need a timestamped observation at or above the
existing contradiction confidence floor. Assumptions are stored as questions.

Build:

- `mergeBriefProposals` in `siteTaskBrief.ts`: per gate, the higher basis wins
  (measurement > observation > description > assumption), ties keep what is
  there, a confirmed brief is never touched, `unresolved` is recomputed with
  capture-blocking gates first.
- A new text task `site_task_brief_reading` that reads the task statement and
  "what goes wrong" into per-gate proposals with `basis`, `quote`, `reading`
  and `confidence`. Called fire-and-forget after submit, behind the automation
  lane flag `BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED`.
- The footage reader's observation schema gains an optional `implied_value`
  (the option value the footage supports). After a capture clears the privacy
  screen, observations become `observation` proposals in the brief.
- The brief review UI is unchanged: it already labels each proposal with its
  basis and lets the operator correct or say "not sure".

## Not built

Executing runs inside the Pipeline, pilot invitations for agent runs, the
browse-before-checkpoint catalog, committed next-update times, design-system
consolidation. These are P1 and later.

## Testing

Pure functions first (projection rungs, result projection, merge precedence,
proposal validation), then the two internal routes against the fake Firestore,
then the client panel and capture page with mocked fetch.
