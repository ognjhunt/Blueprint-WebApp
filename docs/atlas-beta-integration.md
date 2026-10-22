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
