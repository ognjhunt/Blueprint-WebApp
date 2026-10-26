# Beta policy screening results

Owner instruction, October 26, 2026: configure dozens of candidates, coordinate
screening under one $15/site ceiling, and reuse RoboLab where possible. Pipeline
owns planning, runtime dispatch, independent scoring, reservations and recovery.
WebApp accepts diagnostic progress on the existing job and never promotes a
screening run into a qualified pilot recommendation.

`POST /api/internal/pipeline/beta-policy-screening-runs` accepts the strict
`beta_policy_screening_publication.v1` object. Authentication is the existing
`PIPELINE_SYNC_TOKEN` HMAC over `timestamp + "." + rawBody`, with
`X-Blueprint-Pipeline-Timestamp` and `X-Blueprint-Pipeline-Signature`. No new token,
provider endpoint, service, queue or report database is introduced.

The consumer resolves exactly one existing scene intake by its retained
`receipt.intent_id`. It verifies the immutable request/receipt, the completed
`scene_prepared` status digest, and the configured scene revision digest in
`pipeline_status.result_reference`. The intake supplies the website job identity.
Current capture permission, agreed brief, task context, source capture and
organization must still match. `site_id` is `site-<job id>`; `source.capture_id` is
the capture's own identity. They are never interchangeable budget keys.

Campaign source, plan, catalog, scenario plan, candidate configurations and episode
counts remain fixed. Monotonic revisions make retries idempotent and obsolete
deliveries harmless. A terminal candidate's evidence cannot change. Later site
activity may refresh a terminal campaign's shared budget snapshot without changing
its scientific result. Amounts are decimal strings with at most six fractional
digits; spent plus reserved must equal committed, with committed at most $15.
Outcome counts are accepted only for completed, independently scored sessions.

Accepted progress is stored atomically in the existing `taskEvaluationPolicyRuns`
and `captureTaskEvaluationRuns` collections. The existing job evidence projection
shows all candidate progress and outcomes in the site and operations workspaces.
Operations also sees the conservative shared budget. Only observed execution marks
the scene as testing; preparation alone does not. No new emails are sent.

The producer fixture in
`server/tests/fixtures/pipeline-beta-policy-screening-publication.v1.json` comes
from Pipeline's actual coordinator and sealed native result path. Consumer tests
check cross-runtime digests, source/permission refusal, exact retries, progress
ordering, fractional scores, budget accounting and the diagnostic claim ceiling.
The existing v4 two-candidate canary contract is unchanged.

Deploy through the existing exact-SHA CI-gated Render workflow. Deploy this
consumer before enabling producer publication. A green website deployment proves
the consumer is present; it does not prove a RoboLab GPU run completed.
