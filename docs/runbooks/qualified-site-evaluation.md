# Qualified site evaluation: receipt to inspected result

This procedure supports beta step L5, a robot team's simulator-scored evaluation
of one captured site task, and L6, an evidence-backed recommendation. A qualified
result remains a bounded simulation estimate. Physical-performance claims and
ADP qualified-evidence eligibility remain false.

The 2026-10-18 repair work implements this path. Local tests and synthetic
fixtures do not establish a qualified real site, a live 200-episode evaluation,
or a completed deployment. Record those observations separately in the release
and run evidence. The companion producer runbook is
`BlueprintCapturePipeline/docs/beta-site-task-simulation-qualification.md`.

## 1. Retain the real task, sources and authority

Use the existing site intake, capture-consent and task-approval records. The job
must remain open for the team's evaluation, its rights must permit the intended
use, and the team must have approved access and a supported authenticated policy
endpoint. Keep the site's success-rate and any cycle-time target frozen before
the evaluation request.

Qualification consumes retained evidence. It does not generate measurements,
approve a reviewer, choose tolerances or infer model compatibility. Prepare:

| Evidence | Required binding or content |
| --- | --- |
| Capture | Valid `capture_intake_envelope.v1` and every original file it names; retain and verify their bytes, sizes and hashes. |
| Testbed | Current `maintained_site_task_testbed.v1`, exact approved task, source intake ID, envelope digest, capture authority profile and capture digest. |
| Scene and task | Actual prepared `native_task_arena_scene_plan.v1.json`, scored task specification and validated task-success contract. |
| Robot | The team's declared model artifact and manifest, with the exact verified model bytes used for execution. |
| Measurements | Independent source measurements and simulator measurements, each bound to the same site, task, capture, testbed, scene, robot and policy interface. |
| Criteria and review | Frozen task-specific fidelity criteria, an authorized independent review, and its review/expiry timestamps. |

The two measurement documents use
`blueprint.site_task_measurement_samples.v1`. For every frozen check, they must
carry the same unique sample IDs, dimension and units, with finite numeric
values. The producer recomputes maximum absolute error and RMS error against the
frozen limits. All six dimensions must pass:

| Receipt | Dimensions |
| --- | --- |
| `registration_receipt` | `scale`, `registration`, `collision` |
| `fidelity_review_receipt` | `task_state`, `observation`, `task_dynamics` |

For cohort 1 the site produced the source measurements (founder decision,
2026-10-19): optional tape-measure readings on its job page, which WebApp keeps
in `siteTaskMeasurements/{requestId}`. Since 2026-10-20 the site sends its video
and nothing else (founder direction), so its job page no longer asks for
readings. Readings already on file still export as below. Who produces the
source measurements for a new job is an open founder decision (Blueprint
filming visits are retired, 2026-11-11). The video reader's `job_estimates` are never
source measurements: they come from the same footage the scene is built from,
so they cannot check it. Open **Site measurements**
in the admin job console, or call
`POST /api/admin/jobs/:requestId/site-measurements/source-document`, with
three inputs:

- the qualification request's exact `binding`, whose `scene_request_id` must
  be this job;
- the producer identity `site_job:<requestId>`;
- any readings that set the scene's metric scale, which the export leaves out
  of every check.

The response is the document's exact bytes, their sha256 and size, and which
checks the readings can fill. Retain those bytes unchanged as the request's
`measurement` artifact. A `site_job:` producer must name this job, and every
earlier save of the readings stays in `siteTaskMeasurements/{requestId}/revisions`.
WebApp also keeps each export immutably at
`siteTaskMeasurements/{requestId}/exports/{sha256 hex}`, with its binding,
producer, calibration readings and revision. If a download is lost, recover
the exact bytes from the console's retained-export list or
`GET /api/admin/jobs/:requestId/site-measurements/exports/:digest`. Once the
site withdraws recording consent, the export is refused. The Pipeline's
`site_task_fidelity_profile_templates` coverage command reports any check the
readings cannot fill. Its profile command stays refused until the founder has
reviewed the templates' thresholds. A Pipeline service identity produces the
simulator measurements, and the founder reviews.

The measurement producer, simulator producer and reviewer must be distinct
authorized identities. Measurements precede review. The existing protected
operator registry pins the exact request, fidelity profile and review digests,
authorized identities and company-storage prefixes. Its explicit capture
profile owns `site_task_qualification`; customer JSON and scene-derived profiles
cannot select that authority. Follow the Pipeline runbook for its exact fields.

The current qualified path requires a declared, verified robot model. The
default DROID provider assets lack retained model-byte proof at this boundary
and remain diagnostic. This evidence requirement does not restrict which robot
forms may apply or replace the existing artwork and embodiment examples.

## 2. Produce and retain the receipt locally

From the Pipeline checkout, with its existing authorized
`BLUEPRINT_TEAM_CANDIDATE_QUICK10_REGISTRY` configured, inspect the command:

```bash
PYTHONPATH=src python3 -m blueprint_pipeline.site_task_simulation_qualification --help
```

Generate a receipt for the existing capture profile:

```bash
PYTHONPATH=src python3 -m blueprint_pipeline.site_task_simulation_qualification \
  --capture-root /absolute/retained/capture \
  --out /absolute/retained/qualification/receipt.json
```

These paths are placeholders for retained, authorized inputs. The command
defaults to local validation and output. It does not publish, release a policy
credential or start a provider job. Preserve its output JSON and reported
`receipt_digest`, then pin that exact receipt digest in the existing operator
profile through the existing registry maintenance process. Preserve the
registry's ownership, permissions and self-digest.

The output schema is `blueprint.site_task_simulation_qualification.v1`. It
contains the complete binding, both measured receipts, source references,
request/profile/review/authority digests, reviewer and validity window. Its
five-field `qualification` projection alone is insufficient to admit a run.
Re-running the command recomputes the evidence and reuses an identical existing
output; conflicting content is refused. This permits a publication-timeout retry
with the same retained output and identity.

## 3. Publish through the authenticated Pipeline route

After the matching WebApp code is deployed and publication is within the
authorized operating scope, explicit publication uses the existing protected
Pipeline sync token file:

```bash
PYTHONPATH=src python3 -m blueprint_pipeline.site_task_simulation_qualification \
  --capture-root /absolute/retained/capture \
  --out /absolute/retained/qualification/published-receipt.json \
  --publish \
  --webapp-url https://your-existing-blueprint-webapp \
  --token-file /absolute/existing/protected/pipeline-sync-token
```

This is an external write. The CLI requires explicit `--publish` when either
publication argument is supplied. It sends the full receipt through the
existing HMAC-signed transport to
`POST /api/internal/pipeline/site-task-qualifications`. Do not copy credentials
into a receipt, command transcript or handoff.

WebApp verifies the receipt's schema, canonical digests, numeric checks and
cross-record bindings. It creates
`siteTaskQualifications/{receipt_digest_without_sha256_prefix}` with
`{ receipt, publishedAtIso }`. Identical canonical retries return `created:false`;
different retained content is a conflict and is never overwritten. Require an
acknowledgement containing the same `receiptDigest` and a boolean `created`, and
read back that exact document. HMAC establishes the trusted publisher; the
protected Pipeline registry and retained source evidence establish the
qualification authority.

## 4. Admit the exact team request (removed 2026-11-12)

Removed. Robot teams running their own software on a site's job is "later" in
the frame of 2026-11-12: the workspace evaluation request, its free-evaluation
admission route and the admin console's admission form are gone. Runs already on
record still settle and report through the Pipeline's own routes.

## 5. Inspect the result and recommendation evidence

Use the authenticated site/team workspace and
`GET /api/admin/robot-teams/jobs/:requestId/evaluations` for the selected site job.
Retain the run ID, result ID/digest, execution-admission digest, full qualification
receipt and source locations. A signed result cannot introduce a qualification
that was absent from admission or replace the frozen capture, scene or success
contract after execution.

A recommendable result must account for all 200 prescribed hidden cells exactly
once, with at least 190 simulator-scored successes/failures and at most 10
infrastructure voids. Retrying a cell does not add evidence episodes. The
observed success rate must meet the job's frozen pass mark. If the job specifies
a cycle-time target, a finite, positive measured median at or below that target
is required; missing cycle time cannot satisfy it. Wilson confidence intervals
describe uncertainty alongside this rule.

Blocked, incomplete and diagnostic observations remain inspectable. Unknown
execution counts do not establish that nothing ran. These observations cannot
count as a pass. The existing team eligibility and supply agreement, current
site consent and exact result checks still apply. See
[job pass mark and robot fit](pilot-recommendation-evidence.md) for the pass
mark and site-reported physical follow-through. The pilot recommendation and
booking flow is retired.
An accepted historical receipt does not become invalid merely because somebody
views it after its admission window expires.

## Portable evidence and remaining release work

Keep code and instructions in company-owned GitHub, full receipt/admission/run
records in Blueprint's existing database, and standard-format source artifacts
in the existing authorized company object storage. Retain the original capture
files beside their intake envelope in the recoverable package. Export the full
receipt and relevant records as JSON; retain each source URI, byte hash, size,
schema and source/review provenance. Verify authorized read access to the exact
canonical artifacts before claiming recoverability, and preserve local bytes.

Source-artifact `sha256` fields hash actual file bytes. The capture/testbed/task
and scene binding digests retain their existing contract meanings; a capture
digest is not assumed to equal its manifest's byte hash. New qualification JSON
digests use RFC 8785 and exclude only their own digest field. Do not substitute a
provider session ID, tool output or Library reference for these retained records.

The release record must separately close the existing remaining work:

- Exact WebApp and Pipeline release approvals, deployment identities and
  post-deployment verification of this path.
- Approval and execution of the narrowly scoped
  [two-index repair plan](../launch-readiness/2026-10-18-scoped-index-repair.md),
  with READY states and read-only query readback. It is not a broad rules or
  index deployment.
- The existing founder dispatcher hold, spending authority, real team/site
  cohort, rights and operating approvals needed for the chosen run. This
  runbook does not release or expand them.
- A real measured receipt and an actually executed eligible 200-cell run,
  followed by result delivery, recommendation eligibility and provider-zero
  evidence. None is established by the local synthetic fixtures or this repair
  document.
