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
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION } from "../../client/src/lib/siteSubmissionAuthority";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { isInternalTestJob } from "./internalTestJob";
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

/**
 * The backfill (owner approval, 2026-11-19): a job sent with its description only under v5 before submission wrote its
 * listing record gets the record a new v5 submission writes, once. Due only for a job that a v5 submission would list
 * today: v5 granted and standing, no recording grant, no withdrawal, and no listing record of any kind (an existing
 * one, older or switched off, is never overwritten).
 */
export function descriptionListingBackfillDue(record: Record<string, any> | null | undefined): boolean {
  return Boolean(record) && descriptionStatementShares(record) && record!.public_task_listing == null
    && !record!.capture_withdrawal && !projectWebsiteCaptureRights(record!).consent_revoked && !isInternalTestJob(record!);
}

/** Where the backfill stopped, and when it finished: a job submitted since writes its own record. */
export const DESCRIPTION_LISTING_BACKFILL_DOC = "automationState/descriptionListingBackfill";

/**
 * One page of the backfill, run from the automatic send's sweep (so a job it lists is sent in the same pass). Each write
 * re-reads the job in its own transaction and writes only while it is still due, so a re-run, or two at once, changes
 * nothing. Once a pass reaches the end it is marked finished and later runs read only that marker.
 */
export async function backfillDescriptionSharedListings(pageSize = 100): Promise<{ examined: number; written: number; finished: boolean }> {
  if (!db) return { examined: 0, written: 0, finished: false };
  const store = db;
  const stateRef = store.doc(DESCRIPTION_LISTING_BACKFILL_DOC);
  const state = (await stateRef.get()).data();
  if (state?.finishedAtIso) return { examined: 0, written: 0, finished: true };
  let query = store.collection("inboundRequests")
    .where("request.description_authority.statement_version", "==", DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION)
    .orderBy("__name__").limit(pageSize);
  if (typeof state?.after === "string" && state.after) query = query.startAfter(state.after);
  const snapshot = await query.get();
  const due = snapshot.docs.filter(doc => descriptionListingBackfillDue(doc.data()));
  let written = 0;
  for (const doc of due) {
    // The category of the site's own sentence, as at submission; a sentence that cannot be read gets the neutral one.
    const stored = doc.data()?.request?.taskStatement;
    // Intake stores it encrypted (an EncryptedField object); older records may hold a plain string. Both decrypt here.
    const taskStatement = await import("./field-encryption").then(({ decryptFieldValue, isEncryptedField }) =>
      (typeof stored === "string" && stored) || isEncryptedField(stored) ? decryptFieldValue(stored).then(String) : "")
      .catch(() => "");
    const wrote = await store.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (!descriptionListingBackfillDue(current)) return false;
      const authority = current!.request.description_authority as { recorded_at_iso: string; statement_version: string };
      tx.set(doc.ref, { public_task_listing: buildJobSharedListing({ taskStatement, atIso: authority.recorded_at_iso,
        descriptionStatementVersion: authority.statement_version }), summary_shared_notice: { owed: true } }, { merge: true });
      return true;
    });
    if (wrote) written += 1;
  }
  const finished = snapshot.docs.length < pageSize;
  await stateRef.set(finished ? { after: null, finishedAtIso: new Date().toISOString() }
    : { after: snapshot.docs[snapshot.docs.length - 1].id, updatedAtIso: new Date().toISOString() }, { merge: true });
  if (written || finished) logger.info({ examined: snapshot.docs.length, written, finished },
    "Backfilled listing records for jobs sent with their description only");
  return { examined: snapshot.docs.length, written, finished };
}
