/**
 * A job shared with approved deployment companies under the rule of 2026-11-12 (package E, E2): recording statement v4
 * granted, the listing record `job-shared-2026-11-12`, and the video past the privacy screen. The site's brief (its
 * sentence) is a separate document: `siteTaskBriefs/{id}` with a real `summary`.
 */
import { anonymizedOpportunityDraft } from "../../../client/src/types/taskBrowse";

export const SHARED_AT_ISO = "2026-11-12T10:00:00.000Z";
export const SHARING_RECORDING_VERSION = "2026-11-12.v4";

export function sharedRecordingGrant(atIso = SHARED_AT_ISO) {
  return { granted: true, statement_version: SHARING_RECORDING_VERSION, recorded_at_iso: atIso };
}

export function sharedJobListing(taskStatement = "Stack cartons onto the pallet", atIso = SHARED_AT_ISO) {
  return { enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: atIso, wentLiveIso: atIso,
    approvedBy: "recording_statement", recordingStatementVersion: SHARING_RECORDING_VERSION,
    details: anonymizedOpportunityDraft(taskStatement), thumbnailDigest: null, reviewRequired: false };
}

export function passedPrivacyScreen(requestId: string, atIso = SHARED_AT_ISO) {
  return { capture_id: `walkthrough-${requestId}`, outcome: "proceed", eligibility: "eligible", retryable: false, proceeded: true,
    screened_at_iso: atIso };
}

/** The record fields that make a site's job listed, merged over `request` as given. */
export function sharedJobFields(requestId: string, request: Record<string, unknown> = {}, taskStatement?: string) {
  return {
    request: { buyerType: "site_operator", ...request, consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing(taskStatement),
    capture_privacy_screen: passedPrivacyScreen(requestId),
  };
}

/** An approved company's acceptance of the CURRENT Terms and Privacy Policy, as `buildLegalAcceptanceRecord` writes it. */
export function currentTermsAcceptance(atIso = SHARED_AT_ISO) {
  return { accepted_terms: true, terms_version: "2026-11-12.1", privacy_version: "2026-11-12.1", terms_url: "/terms",
    privacy_url: "/privacy", accepted_at: atIso, accepted_from_ip_hash: null };
}
/** A company access record that has accepted the current Terms (the check is never weakened: the record carries it). */
export function withCurrentTerms<T extends Record<string, unknown>>(record: T): T & { termsAcceptance: ReturnType<typeof currentTermsAcceptance> } {
  return { ...record, termsAcceptance: currentTermsAcceptance() };
}
