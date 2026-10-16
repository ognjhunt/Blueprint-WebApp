import { PREVIOUS_PRIVACY_VERSION, PRIVACY_VERSION, legalEffectiveAtMs } from "../../client/src/lib/legalAcceptance";

/**
 * Capture preservation is not permission to extend a site's retention terms.
 * Keep this review record with the capture; later account acceptance must never
 * replace the policy applicable when existing footage was first collected.
 * This projection neither authorizes deletion nor asserts counsel approval.
 */
export function websiteCaptureRetention(firstReceivedAtIso: string | null) {
  const receivedAtMs = firstReceivedAtIso === null ? NaN : Date.parse(firstReceivedAtIso);
  const beforeAnnouncedPolicy = Number.isFinite(receivedAtMs) && receivedAtMs < legalEffectiveAtMs(PRIVACY_VERSION);
  return {
    policy_id: "website_capture_retention_review.v1",
    first_received_at_iso: Number.isFinite(receivedAtMs) ? firstReceivedAtIso : null,
    announced_privacy_version: PRIVACY_VERSION,
    prior_privacy_version: PREVIOUS_PRIVACY_VERSION,
    received_before_announced_effective_date: Number.isFinite(receivedAtMs) ? beforeAnnouncedPolicy : null,
    // A post-effective collection date alone proves neither the applicable
    // notice nor the legal basis for changing an existing site's terms.
    prior_policy_may_apply: true,
    prior_policy_window_days_after_job_close: 180,
    collection_policy_version: null,
    collection_policy_verification_required: true,
    extension_authorized: false,
    review_required: true,
    review_reason: "verify_original_collection_terms_and_job_close_before_retention_change",
    routine_delete_rule_present: false,
    minimum_retention_floor_days_if_delete_is_ever_introduced: null,
    account_reacceptance_extends_existing_recordings: false,
    raw_truth_preserved: true,
    live_enforcement_proven_by_bundle: false,
  };
}
