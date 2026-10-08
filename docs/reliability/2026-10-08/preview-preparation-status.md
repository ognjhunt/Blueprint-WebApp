# Persisted scene preview preparation failure

This P2 repair makes an existing stored preview-preparation failure visible in both
customer status handlers. On exact base `d78b73f7661593fd12fd63ae9fbcfc3a739f6219`,
a confirmed, covered task with `world_reconstruction.state: failed` still returned
`assessing` and said Blueprint was preparing it. The two minimized regressions
exercise the actual signed-link and authenticated workspace HTTP handlers with
disposable database, storage and notification fakes. Both failed before the repair.

The shared projection now receives only a boolean derived from the current
reconstruction state. The safe headline says scene preview preparation could not
finish, needs team review, and asks the operator to keep the original recording.
It uses the existing `footage_received` decision, with no operator retry action.
Private provider blockers, failure reasons and stale preview assets are not exposed.
The signed-link processing-hold fallback does not overwrite this headline.

Withdrawal remains first. Existing coverage shortfalls, brief confirmation,
reported/no-result/queued screening, disposition and account requirements keep
their precedence. A qualified, unclaimed task still requires saving the account;
its failure-aware copy no longer promises to start building a scene. A newer
current `ready` state wins even if old private failure fields remain in the stored
object. No historical reconstruction selector, capture-generation scheme or retry
API is introduced.

## Producer and scope limitation

`server/routes/internal-capture-worlds.ts:persistReconstruction` writes the current
`captureUploadSessions/{captureId}.world_reconstruction` record. Legacy/operations
reconstruction can persist `failed`. The normal website path is Pipeline-owned:
the legacy reconstruction endpoint refuses walkthrough/supplement capture IDs,
and the existing website `visual-scene` callback accepts only a ready preview
after task-context, capture-binding and rights checks. This change handles an
existing persisted failure; it does not deliver a normal Pipeline blocked state,
prove that this dishwasher has such a record, or complete normal assessment.

Both readers retain their existing identity boundaries: the signed capture token
selects its request/capture; the workspace requires ownership and uses the task's
walkthrough capture. The repair adds no writes, notifications or provider calls.

## Actual customer result owner

| Stage | Existing contract |
| --- | --- |
| Private AI assessment | `site_assessment.v2` is an admin advisory packet. Its private writer/admin reader are separate from customer task status. |
| Native run result writer | Pipeline-authorized `POST /api/internal/pipeline/agent-run-results` validates episode counts and, when present, the claimed execution admission/pipeline-run binding. |
| Stored run result | `server/utils/agentRunResults.ts:recordRunResult` requires an existing `evaluationRuns` record, retains observed episodes, and rejects conflicting repeat evidence. It can enqueue actual result notifications; it was inspected, not invoked here. |
| Customer result selector | `loadSceneScreening` and `listRunsForScene` select site-shareable runs by scene ID. Private/unknown sharing modes do not become site results; reported observed episodes, concluded no-result runs, and queued/running runs remain distinct. |
| Customer readers | Signed-link status reads screening counts. Authenticated workspace also projects individual runs as simulation results. `TaskDetail` displays the shared readiness headline/action, and `SelfCaptureUpload`/`CaptureLiveStatus` consume signed-link status. |

An advisory packet, visual preview or blocked preparation record cannot stand in
for executed robot episodes. This slice does not connect the private advisory to
customer qualification/results or fabricate native authoring, run or publication
evidence.

## Verification

Retained local receipts are beneath `output/dishwasher-status/` (ignored; no real
video/provider packet is included in this change). Matched base receipt
`baseline-tests.json` has two failures and 71 unselected tests, SHA256
`cef5584cb14bd3ce788531ae1a543aa3acfae572343abfe52be83f733b328eef`.
The initial candidate's five relevant suites passed 129 assertions, receipt
`final-tests.json`, SHA256
`b2577bcc38f67af8980c9ac6ed3ab5b846c78ac2cf6913259731434fa3906077`.
Final candidate receipt `reviewed-tests.json` passes **131/131**, SHA256
`4c355ba144a0d28d88f19b191ba0f403e8b4086fd88170c775ae757e90406b4e`.
Durable neighboring route controls additionally exercise failed-to-ready replacement
and existing real run precedence. These checks overlap the reliability program
and are not new independent customer or perception coverage.

`npm run check`, `git diff --check`, and the required offline Graphify refresh pass.
The mounted consumer review checks the failure headline and absence of a customer
retry action; existing local held/processing-pending upload states retain their
saved-video wording. This is offline handler/UI evidence, not a live database,
provider analysis, native publication or full customer journey proof. No numeric
backlog/day gate was supplied; none is invented. Independent review and required
CI precede integration through the coordinated release owner.
