# Atlas beta preparation control

ADP-040 / Day 28: admit a source-bound development reconstruction through the
existing Pipeline allocator. Atlas is a task API, separate from Marble's world
API. The API key stays in the canonical secret integration. Never set
`WORLDLABS_DEFAULT_MODEL=atlas`; the Marble adapter continues to refuse it.

`TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON` now accepts `world_labs_atlas` with
its independently reviewed terms digest, label, and HTTPS reference. This does
not admit uploads by itself.

`BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON` is an array of explicit owner
authorizations. Each `website_atlas_authorization.v1` row binds `request_id`,
`capture_id`, `task_context_digest`, `source_video_digest`,
`provider_terms_reference`, `accepted_by`, `approval_reference`,
`private_processing_authorized: true`, `provider_training_authorized`,
`provider_retention`, `maximum_cost_usd`, `maximum_requests`,
`expires_at_epoch`, and `claim_scope: development_only`.

The signer must be the retained Blueprint sponsor. The terms reference is for
Atlas's beta, including its account retention/training settings; it cannot be
inherited from Marble. The owner must actually accept disclosure of this source.
Never infer that consent from an API key. Consent revocation and changed source
or current task context refuse before reservation. Multiple matching grants
also refuse. The provider-retention values are `account_does_not_retain` and
`project_library_retention_approved`.

The signed `preparation-spend` request adds `source_video_digest` for Atlas.
Reservations retain their exact command and authorization digest, are
transactional, and are granted for one dispatch. Atlas has its own newly
approved allowance; older Atlas reservations remain counted when configuration
changes. The separate allowance neither renews an expired native/Marble grant
nor replenishes their budgets. All other providers keep their existing caps.

Atlas's documented operation response carries no actual bill, so a hold settles
from the Pipeline's retained outcome for that attempt, over the signed
`preparation-settlement` route (`provider: "world_labs_atlas"`, `outcome`,
`operation_id`, `outcome_receipt_digest`). A `completed` operation settles at the
reviewed price it was reserved at; a `failed` operation or a `refused`
submission bought nothing and settles at zero, which releases its hold. An
attempt whose outcome is unknown (a send that may have bought an operation, or
an operation that can no longer be found) reports nothing and stays fully held.
Settlement is idempotent; a different outcome for the same hold is refused as
`idempotency_conflict`. Read the Developer Usage page for actual billed usage.

## One dollar ceiling per job (owner decision 2026-10-30)

Every WebApp admission of new spend for a website job (`preparation-spend`, and
a new `prepared-scene` intake's native allowance) counts all of the job's
ledgers against one ceiling, each at its settled cost where known, otherwise
its held maximum:

- every row of `website_preparation_reservations`: the Atlas allowance and the
  preparation-only sponsorship's upstream rows;
- each sponsored scene intake's native allowance (`request.execution.max_total_spend_usd`,
  or a recorded extension), held in full until the intake closes, then what its
  attempts reserved;
- the beta-screening site ledger, from its latest published snapshot
  (`committed_upper_bound_usd`); a run without a readable publication counts the
  whole $15 screening site limit.

The ceiling is the Atlas authorization the admission is made under, else the
job's stored Atlas grant for that capture, else
`BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON.maximum_cost_usd`, else the owner
default of $40 (`WEBSITE_JOB_CEILING_DEFAULT_USD`). Over it, admission refuses
`website_scene_preparation_budget_exhausted`, which the Pipeline already holds as
`budget_exhausted`. The per-ledger caps still apply inside it; no reservation,
grant or settlement is rewritten. The non-creating `atlas-configuration` read
adds a `job_ceiling` summary; its other figures stay Atlas-only.

Pipeline retains the input selection, original frame hashes, normalized RGB,
camera, linear-depth EXR, confidence maps, provider asset IDs, and operation
receipt. Preserve these in company storage for cloud continuity; provider read
URLs expire and are not canonical artifacts. Estimated provider geometry and
generated hidden regions never establish measured scale, collision, dynamics,
articulation, or physical evidence.

## Automatic consented previews (owner exception 2026-10-22)

The repo owner approved automatic Atlas 3D previews of website uploads as
Blueprint-paid spend within a Blueprint-internal per-capture allowance (see
`AGENTS.md`). The owner chose accuracy over cost: the allowance is a high safety
ceiling against runaway spend (planned $25, schema maximum $100), never a limit
on how many frames or views a preview uses. It is a side lane: the native/Marble sponsorship, its assessment
proposal and its budgets are unchanged and not required.

`BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON` (web service) enables it:

```json
{ "schema_version": "website_atlas_grant_policy.v1", "maximum_cost_usd": 25,
  "maximum_requests": 16, "validity_seconds": 604800,
  "provider_retention": "account_does_not_retain",
  "approval_reference": "...", "approved_by": "..." }
```

`maximum_cost_usd` is above 0 and at most 100, `maximum_requests` 1 to 32 and
`validity_seconds` 3600 to 1209600. Unset or invalid, no automatic grant is
created or honoured, every existing behaviour is unchanged, and nothing else
reads it. Unsetting it is the kill switch for every automatic grant.

Resolution for `atlas-configuration` and Atlas `preparation-spend` is: an exact
env row (unchanged; its signer is still the retained sponsor); else the stored
grant at `inboundRequests/{requestId}.website_atlas_grants[captureId]`; else,
in the configuration transaction only, a new grant. A grant is created once
(first writer wins) when the upload's recording consent allows derived scene
generation, `account_owner_uid` is set, a finalized source video exists, and
both `world_labs_atlas` and `openai` terms digests are configured.

The stored `website_atlas_authorization.v2` grant pins the first call's
`source_video_digest` and the uploaded object's immutable identity (browser
video name, generation, size and CRC32C; or the app bundle's digests). A
different digest or object refuses `website_atlas_source_consent_required`.
It names `accepted_by` = `account_owner_uid` and carries no task context
digest, so a task edit does not change it. Terms changes, expiry
(`website_atlas_consent_expired`) and withdrawn consent (`source_revoked`)
refuse exactly as for env rows. Reservations never create a grant.

The preview's own auxiliary calls, Meta SAM segmentation and Google independent
review (`atlas_auxiliary: true`), are covered by the same upload consent (owner
direction 2026-10-22). When the grant is made, `auxiliary.meta` and
`auxiliary.google` pin each provider's terms digest if it is configured then.
Those reservations need no native sponsorship. They share the grant's cap and
expiry, and refuse `provider_terms_not_configured_or_changed` once the
configured terms differ from the pinned ones. A grant made without them, and
every explicit env row, keeps the native sponsorship's disclosure check for
those providers, as before. Meta work outside an Atlas preview is unchanged.

The Pipeline pushes each capture's preview status to the signed route
`POST /api/internal/pipeline/creator-captures/:captureId/atlas-preview`
(`website_atlas_preview.v1`, verified `preview_digest`). The WebApp stores the
latest revision at `inboundRequests/{requestId}.website_atlas_previews[captureId]`.
A replayed revision with the same digest is accepted again; the same revision
with another digest is `idempotency_conflict`; a lower revision is refused
with 409 `website_atlas_preview_stale`. After withdrawal only `withdrawn` is
accepted.

The signed-in site owner sees "3D preview (beta, unscaled)" on the task page
and downloads a ready bundle through a 15-minute ticket
(`/api/website-atlas-preview-downloads/...`). The download re-reads consent
and readiness, fetches the whole bundle from the Pipeline's signed
`/api/live-pipeline/website-atlas-previews/{captureId}/bundle` read and
verifies its stored digest and size. Withdrawal removes the section and
refuses tickets and downloads at once.

Explicit operator authorizations (`website_atlas_authorization.v1`) accept a cumulative `maximum_requests` of 1–1000, independently of the unchanged cumulative dollar cap. A request is a provider call, not an input-frame limit. Increasing this count preserves every prior reservation and charge; the source allowance never resets between runs. Automatic preview policies retain their configured limits and 32-request schema ceiling.
