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

The first implementation keeps each full reservation charged because Atlas's
documented operation response carries no actual bill. A rate-card estimate is
not settlement. Read the Developer Usage page for actual billed usage.

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

`maximum_cost_usd` is above 0 and at most 5, `maximum_requests` 1 to 32 and
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
