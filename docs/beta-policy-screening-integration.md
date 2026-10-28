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
Current capture permission, retained brief, task context, source capture and
organization must still match. `site_id` is `site-<job id>`; `source.capture_id` is
the capture's own identity. They are never interchangeable budget keys.

Diagnostic screening may use the exact proposed task retained by a
`scene_preparation` grant before the owner confirms the brief. Confirming or
changing that task changes its context and leaves the earlier screening historical.
Other managed evaluations and commercial proposals still require an agreed brief.
Requested supplementary footage uses the existing verified capture continuation
and its immutable upload generations. Ingestion and workspace projection derive
the same context from that capture's binding; changed lineage, media or permission
makes the retained screening historical.

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

## Automatic continuation to full finalist scoring

Completed screening atomically records no-spend preparation for each completed,
independently scored candidate with a successful episode and no retained blockers.
These intents live beside their parent run in `taskEvaluationPolicyRuns`; stable
IDs bind the campaign, candidate, job, scientific brief and source fingerprint.
Budget-only publication updates do not create another continuation. The existing
launch-forward worker drains them, using the existing Pipeline signing identity:

- `POST /api/live-pipeline/beta-policy-finalists` prepares the exact retained
  candidate and private 200-episode matrix without allocating a provider.
- A bound receipt supplies the immutable plan and actual compute floor. The
  existing operations job panel shows one explicit approval for that plan, its
  Blueprint cap, expiry and single paid attempt. It submits through the existing
  `/api/admin/free-evaluations/:jobId/admit` route with the authenticated approver.
- The durable worker posts that exact authority to
  `/api/live-pipeline/beta-policy-finalists/:finalistId/authorize`, then polls the
  same record. Pipeline independently checks its configured founder authority,
  current source, runtime, spending controls and allocator admission. An operations
  page view or prepared plan cannot authorize execution.
- Full results return through the existing signed screening publication endpoint
  with `purpose: "finalist"`, one 200-episode candidate and its exact
  `finalist_binding`. The consumer requires the retained named approval and cap
  before accepting the result on the same job. Screening keeps its existing $15
  ceiling; finalist spend stays within the separately approved existing $20 cap.

Delivery intent stays pending until the terminal publication is durably accepted.
Lost responses replay the same Pipeline identity; a storage failure cannot drop
an otherwise completed result or authorize another paid attempt. Unsupported
full-evaluation routes retain a specific preparation limitation. The current
full-scoring continuation is diagnostic/development evidence; counts alone do not
create a recommendation, a met owner pass mark, or physical validation.

Selecting a successfully published replacement capture makes the earlier source's
managed and generic evidence historical. Existing scientific request/result bytes
remain immutable. Source metadata on the WebApp's delivery record binds new
questions to the selected recording; proposal attachment rechecks that selection.
