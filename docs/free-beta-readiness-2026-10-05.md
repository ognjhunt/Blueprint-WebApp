# Free beta implementation and release evidence

This change addresses the owner-requested beta audit of 5 October 2026. It is
not a launch approval. ADP context: development evaluation admission, rights,
bounded execution, and inspectable evidence; existing scenes remain
`development_only`. No physical or partner qualification is inferred.

## Implemented in this branch

- Paid plan, run, spend-enable, and balance top-up entrypoints refuse before
  financial or execution effects. Existing balances and historical settlement
  remain readable. Private queued runs cannot start. The site's separately
  authorized $2,500 matching fee is unchanged.
- `POST /api/admin/free-evaluations/:requestId/admit` requires the existing
  Firebase authentication, CSRF, and execution role. It binds the workspace
  owner's saved setup, team checkpoint, actual task/testbed/rights admission,
  expiry, one attempt, and explicit sponsor cap to one atomic run/handoff.
  It reuses canonical request preparation when `executionRequestId` is absent.
  The customer quote is zero; the sponsor limit is separate. A request or a
  prepared record alone cannot start execution.
- Recording consent is checked before multipart parsing, storage admission,
  upload targets, and completion. Production upload/review signing refuses
  missing secrets. A browser upload withdrawn during its write deletes only
  its newly written generation. Owner withdrawal durably stops new uploads,
  pauses the task, and requests queued-run cancellation.
- Confidence bands use Wilson 95% lower bounds of 90%, 95%, 99%, and strictly
  above 99%. Read-time annotations correct old result labels without rewriting
  immutable observations. Old unversioned registry claims no longer promote
  matching confidence. Development results do not promote team capabilities.
- Brief/coverage reviews have persisted leases, source binding and at most
  three attempts. Result and no-result notification intents survive restart;
  site/team outbox acceptance is tracked independently. Unknown external
  notification outcomes remain unresolved rather than being blindly resent.
- Unauthenticated/mismatched reply identities cannot resume work. Natural
  language approval alone cannot authorize an action ledger or city spending.

The companion Pipeline change retains unresolved terminal sponsor exposure and
refuses paid, expired, or cancelled work when claiming or resuming journals.
Historical terminal receipts continue to reconcile.

## Approval request shape

The operator supplies `teamId`, `checkpointId`, `episodes`, `sponsorCapUsd`,
`expiresAtIso`, `maxAttempts: 1`, and `evidenceScope: "development_only"`.
`executionRequestId` is optional. The cap must be positive and at most $20,
the existing development provider ceiling; that ceiling is not permission to
spend. Expiry must be within the existing reservation TTL. Missing compatible
execution offers, rights, ownership, policy or testbed evidence remain blockers.
Repeated identical approval returns the same run; changed approval conflicts.

## Verification

- `npm run check`: passed.
- Full `npm run test:coverage`: 6,361 passed, 1 skipped, one stale public-copy
  assertion failed. Corrected assertion passed separately with all 42 browser
  capture route tests, including missing consent before storage and withdrawal
  during storage. Other corrected focused tests include real canonical free
  preparation/admission, handoff retries, audience recovery, and UI controls.
- Final affected WebApp suite: 630 tests across 44 files passed.
- Workspace handoff/result projection follow-up: 80 tests passed, including
  built-page, scheduler, and source-authority race checks; a completed free
  run appears on its original request, is shown once to the site, and cannot
  expose another owner's run. Admission rechecks scene and team revisions in
  the committing transaction, preventing withdrawal/ownership races. Development simulations do not assert target qualification.
- Graphify architecture refresh, asset audit, and portable-storage static audit passed.
- Pipeline impacted selection: 206 passed, 5 skipped. Changed Python Ruff
  checks passed. No paid provider execution was performed.
- Local Firebase client build variables are absent. Compile-only output using
  `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1` passed compilation; it cannot
  prove sign-in or serve as a deployable release.

Historical paid lifecycle suites use explicit test-only release overrides;
production release constants cannot be enabled by environment variables.
Free-beta guard and account route suites test the actual refusal behavior.

## Still required before launch

1. Deploy the reviewed WebApp and Pipeline changes together and verify the
   installed revisions, Firebase build variables, signing secrets, recurring
   workers, indexes, stop behavior, and rollback. Source tests do not prove
   those live conditions.
2. Choose an approved team, new compatible policy, task revision, explicit
   Blueprint spend limit and one-attempt authority. The live dispatcher has a
   founder stop with `require_explicit_release: true`; its nominal review
   deadline does not release it. Do not resume it implicitly.
3. Execute the actual development journey and retain independent scoring,
   permitted site/team result and media/download checks, provider usage,
   teardown, and zero-resource receipts. Local tests are not this evidence.
4. Diagnose and repair the public result video. The result page and record
   respond, but the authenticated artifact-ticket probe returns 503,
   `Result artifact registry is unavailable`. The retained registry and offload
   records exist; that fact does not establish that the running service can
   read and serve their bytes. No authorization bypass was introduced.
5. Complete website withdrawal propagation and cleanup with bound Pipeline
   tombstone, cancellation acknowledgement, storage deletion and lifecycle
   receipts. The new API deliberately returns `uploads_stopped_cleanup_pending`,
   `pipelineAcknowledged: false`, `deletionConfirmed: false`. Its pending marker
   is not yet a deletion worker. Previously issued native storage targets also
   need expiry/cleanup proof.
6. Native `add_views` cannot append to an existing bundle. The current email
   directs an app capturer to arrange a new link; a named support owner and a
   rehearsed closure receipt are still needed for that manual path.
7. Reconcile unknown external notices and interrupted human-resume handoffs
   through an owned, auditable process. Generic payload-bound approval/resume
   and Operator Door caller idempotency/accepted-versus-completed repairs are
   not complete in this branch.

Atlas integration, actual provider outputs and captured-room/physical
qualification remain distinct from these beta release requirements.
