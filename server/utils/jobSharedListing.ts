/**
 * Sharing is the service (owner, 2026-11-12; PACKAGE_D D1.1). A job is shared with the deployment companies Blueprint
 * has approved if, and only if, its site accepted recording statement `2026-11-12.v4` or later, or sent the job without
 * a video under description statement `2026-11-12.v5` (whose sentence says the same) and has no recording grant. There
 * is no other switch: no share box, no "Share my job", no Share settings, no pause.
 *
 * When v4 is accepted (at submission with a video, or later on the job's page), or v5 at submission, the listing record
 * below is written. It has no text of its own: it records the statement the job is shared under. The details are the
 * category-only draft (`anonymizedOpportunityDraft`), never the site's own words, name or address.
 */
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";
import { RECORDING_RIGHTS_STATEMENT_V4_VERSION, isSharingRecordingStatementVersion } from "../../client/src/lib/recordingRightsStatement";
import { isSharingDescriptionAuthorityVersion } from "../../client/src/lib/siteSubmissionAuthority";
import { hasCurrentDescriptionAuthority } from "./descriptionAuthority";
import { buildLegalAcceptanceRecord } from "../../client/src/lib/legalAcceptance";

import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";
export { JOB_SHARED_LISTING_VERSION };

export interface JobSharedListing {
  enabled: true;
  details: ReturnType<typeof anonymizedOpportunityDraft>;
  consentVersion: typeof JOB_SHARED_LISTING_VERSION;
  approvedAtIso: string;
  wentLiveIso: string;
  approvedBy: "recording_statement" | "description_statement";
  /** The recording statement the job is shared under, or null for a job shared by its description statement (v5). */
  recordingStatementVersion: string | null;
  /** Only for a job sent without a video: the description statement (v5) it is shared under. */
  descriptionStatementVersion?: string;
  thumbnailDigest: null;
  reviewRequired: false;
}

export function buildJobSharedListing(params: { taskStatement: string | null | undefined; atIso: string;
  recordingStatementVersion?: string; descriptionStatementVersion?: string }): JobSharedListing {
  const byDescription = Boolean(params.descriptionStatementVersion) && !params.recordingStatementVersion;
  return {
    enabled: true,
    details: anonymizedOpportunityDraft(params.taskStatement ?? ""),
    consentVersion: JOB_SHARED_LISTING_VERSION,
    approvedAtIso: params.atIso,
    wentLiveIso: params.atIso,
    ...(byDescription
      ? { approvedBy: "description_statement" as const, recordingStatementVersion: null,
        descriptionStatementVersion: params.descriptionStatementVersion }
      : { approvedBy: "recording_statement" as const,
        recordingStatementVersion: params.recordingStatementVersion ?? RECORDING_RIGHTS_STATEMENT_V4_VERSION }),
    thumbnailDigest: null,
    reviewRequired: false,
  };
}

/** The job's listing record is the one written under recording v4 (not an older card or share). */
export function isJobSharedListing(record: unknown): boolean {
  const listing = (record as { public_task_listing?: Record<string, unknown> } | null)?.public_task_listing;
  return Boolean(listing) && listing!.consentVersion === JOB_SHARED_LISTING_VERSION && listing!.enabled === true;
}

/** The site accepted a sharing recording statement (v4 or later), granted and not withdrawn. */
export function recordingStatementShares(record: unknown): boolean {
  const attestation = (record as { request?: { consent_attestation?: Record<string, unknown> } } | null)?.request?.consent_attestation;
  return Boolean(attestation) && attestation!.granted === true && isSharingRecordingStatementVersion(attestation!.statement_version)
    && !attestation!.revoked_at_iso && !attestation!.withdrawn_at_iso;
}

/**
 * A job sent without a video under a sharing description statement (v5), granted and not withdrawn, that holds no
 * recording grant at all. A job that later records under an older recording statement is not shared by this.
 */
export function descriptionStatementShares(record: unknown): boolean {
  const request = (record as { request?: Record<string, any> } | null)?.request;
  return request?.buyerType === "site_operator" && request.consent_attestation == null
    && hasCurrentDescriptionAuthority(request.description_authority)
    && isSharingDescriptionAuthorityVersion(request.description_authority.statement_version);
}

/** The site accepted a statement that shares the job: recording v4 or later, or description v5 with no video. */
export function sharingStatementAccepted(record: unknown): boolean {
  return recordingStatementShares(record) || descriptionStatementShares(record);
}

/** The job is shared under the current rule: a sharing statement accepted and its listing record written. */
export function jobIsShared(record: unknown): boolean {
  return sharingStatementAccepted(record) && isJobSharedListing(record);
}

/**
 * What accepting a recording statement on the job page does to a stored job (`POST /api/self-capture/uploads/:token/recording-consent`).
 * - `granted`: the job had no recording grant; it now holds this one (and, under v4, is shared).
 * - `upgraded`: the job held an older grant, not withdrawn; v4 replaces it as the current grant, the older one is kept in
 *   `consent_attestation_earlier`, and the job is shared.
 * - `existing`: nothing to change (or, under v4, only a missing listing record is written).
 * - `held`: the job cannot take this grant (withdrawn, or no description authority to fill an absent grant).
 *
 * `request` is merged into the stored `request`; `listing` holds top-level fields written with `update`, so the listing
 * record replaces any older card whole and no older card detail survives inside it. The v4 sentence begins "By sending,
 * you agree to our Terms and Privacy Policy", so accepting it records the current Terms and Privacy versions on the job
 * (`terms_acceptance`), keeping the earlier acceptance in `terms_acceptance_earlier`.
 */
export type RecordingConsentWrite =
  | { outcome: "granted" | "upgraded" | "existing"; request: Record<string, unknown> | null; listing: Record<string, unknown> | null;
      /** A site-set pause from before sharing was the service (`workspace_task.paused`) is lifted with v4 (never for a withdrawn job). */
      unpause: boolean }
  | { outcome: "held" };

export function recordingConsentWrite(params: {
  record: Record<string, any>;
  statementVersion: string;
  atIso: string;
  taskStatement: string | null;
  /** Whether the stored grant is current (closed set, granted, not revoked). */
  hasCurrentGrant: boolean;
  /** Whether an absent grant may be filled (`canGrantInitialRecordingConsent`). */
  canGrantInitial: boolean;
  /** Whether the job's rights are withdrawn. */
  revoked: boolean;
}): RecordingConsentWrite {
  const { record, statementVersion, atIso } = params;
  if (record?.request?.buyerType !== "site_operator" || params.revoked) return { outcome: "held" };
  const sharing = isSharingRecordingStatementVersion(statementVersion);
  const attestation = { granted: true, statement_version: statementVersion, recorded_at_iso: atIso, recorded_by: "signed_owner_link" };
  const unpause = sharing && record.workspace_task?.paused === true;
  const earlierTerms = Array.isArray(record.terms_acceptance_earlier) ? record.terms_acceptance_earlier : [];
  const listing = sharing && !isJobSharedListing(record)
    ? { public_task_listing: buildJobSharedListing({ taskStatement: params.taskStatement, atIso, recordingStatementVersion: statementVersion }),
      summary_shared_notice: { owed: true },
      terms_acceptance: buildLegalAcceptanceRecord({ acceptedAt: atIso }),
      ...(record.terms_acceptance ? { terms_acceptance_earlier: [...earlierTerms, record.terms_acceptance] } : {}) } : null;
  if (params.hasCurrentGrant) {
    const stored = record.request.consent_attestation as Record<string, unknown>;
    // Not a sharing statement, or already under one: no second grant (a missing listing record is still written).
    if (!sharing || isSharingRecordingStatementVersion(stored.statement_version)) return { outcome: "existing", request: null, listing, unpause: unpause && listing !== null };
    const earlier = Array.isArray(record.request.consent_attestation_earlier) ? record.request.consent_attestation_earlier : [];
    return { outcome: "upgraded", request: { consent_attestation: attestation, consent_attestation_earlier: [...earlier, stored] }, listing, unpause };
  }
  if (!params.canGrantInitial) return { outcome: "held" };
  return { outcome: "granted", request: { consent_attestation: attestation }, listing, unpause };
}
