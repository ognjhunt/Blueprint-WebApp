/**
 * Whether the person holding a capture link may upload *right now*.
 *
 * ## The token names a place, not a permission
 *
 * Until now a capture token was only ever minted for a request that had already
 * cleared the screen and been dispatched, so holding a valid token was the same
 * thing as being allowed to use it. That let the link be issued late — after the
 * verdict, in an email — which meant a site that already knew it had passed
 * still had to go and find an inbox.
 *
 * Issuing the link at submit to everyone breaks that equivalence, and this is
 * what replaces it: the token still names exactly one storage destination, and
 * whether writing there is allowed is re-read from the request every single
 * time. A link is a capability to a place; permission is a fact about the
 * request, and facts change.
 *
 * ## Which is also the feature
 *
 * Because permission is read live, a link issued to a site that did not clear
 * the screen is not dead — it is a status page that becomes an upload page the
 * moment the thing blocking it resolves. A call that settles a marginal answer,
 * an operator correcting a gate, footage evidence landing: any of them turn the
 * same URL live, with nobody sending a second email. That is the difference
 * between handing someone a handle and promising to come back to them.
 *
 * ## One rule, not a second opinion
 *
 * The decision is `decideCaptureDispatch`, the same function that decides
 * whether a capture is dispatched at all. This module does not re-derive it,
 * soften it, or add a case. If the rule says hold, the upload is refused with
 * the rule's own reason — so the sentence a site reads on the page and the
 * sentence in our logs are the same sentence, and there is no way for the two
 * to drift apart.
 *
 * ## Footage waits for a saved job
 *
 * Two preconditions sit beside the rule: the current recording grant, and an
 * account that owns the job. A walkthrough is born in the Pipeline with the
 * job's owner at that moment; a video sent before the job was saved to an
 * account is born with none, and saving the job afterwards is an owner change
 * the Pipeline refuses for that capture for good (owner decision 2026-10-18).
 * So bytes are accepted only for a saved job, on every upload route, and the
 * hold says so in the one sentence the page and the logs share. A job whose
 * video already arrived before its account is held too: sending it again
 * cannot be used either, so the link says that rather than take it.
 */

import { hasCurrentRecordingConsent } from "./recordingConsent";
import { canGrantInitialRecordingConsent } from "./descriptionAuthority";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decideDispatchForRequest } from "../agents/workflows";
import type { InboundRequest } from "../types/inbound-request";
import type { CaptureDispatchDecision } from "./captureDispatch";
import { footageArrivedBeforeAccount } from "./siteWalkthrough";

export interface CaptureUploadAuthorization {
  /** Whether bytes may be written for this request right now. */
  allowed: boolean;
  /** Machine-readable hold reason, straight from the dispatch rule. */
  holdReason: string | null;
  /** The hold in a sentence a site can act on. */
  detail: string | null;
  /**
   * What the site itself told us that is standing in the way, in its own
   * words, each already carrying what would flip it. Empty when the hold is
   * not about a gate answer.
   */
  blockers: string[];
  /** Marginal answers a form could not settle — the agenda for a call. */
  openQuestions: string[];
  /** What the site chose at intake, when known; a visit can be switched to self-capture. */
  captureMode?: string | null;
  /** Only an owner of a new prose-only job may make its first recording grant. */
  recordingConsentAvailable?: boolean;
}

/** The hold for footage sent before its job is saved to an account. */
export const SITE_ACCOUNT_REQUIRED = "site_account_required";
export const SITE_ACCOUNT_REQUIRED_DETAIL = "Save this job to your account before you send its video. "
  + "Robot teams can evaluate a job only if its video is sent after the job is saved to an account.";
/** The hold for a job whose video arrived before it was saved to an account. */
export const FOOTAGE_BEFORE_ACCOUNT = "footage_before_account";
export const FOOTAGE_BEFORE_ACCOUNT_DETAIL = "Your video arrived before this job was saved to an account, so we can't "
  + "use it to build your scene yet. You don't need to send it again; we email you when that changes.";

function held(
  holdReason: string,
  detail: string,
  request?: InboundRequest | null,
): CaptureUploadAuthorization {
  return {
    allowed: false,
    holdReason,
    detail,
    blockers: request?.site_task_triage?.blockers ?? [],
    openQuestions: request?.site_task_triage?.open_questions ?? [],
    captureMode: request?.request?.capture_mode ?? null,
  };
}

/**
 * Read the live verdict for a request behind a capture link.
 *
 * Fails closed on every path that cannot establish the answer — no store, no
 * request, a read that threw. An upload is a billed reconstruction downstream,
 * so "we could not tell" has to mean no.
 */
export async function authorizeCaptureUpload(
  requestId: string,
): Promise<CaptureUploadAuthorization> {
  if (!db) {
    return held(
      "store_unavailable",
      "We cannot check this link right now. Keep your original video and try again shortly.",
    );
  }

  let request: InboundRequest | null = null;
  try {
    const snapshot = await db.collection("inboundRequests").doc(requestId).get();
    request = snapshot.exists ? (snapshot.data() as InboundRequest) : null;
  } catch {
    return held(
      "store_unavailable",
      "We cannot check this link right now. Keep your original video and try again shortly.",
    );
  }

  if (!request) {
    return held("request_missing", "This link does not point at a submission we hold.");
  }

  if (!hasCurrentRecordingConsent(request.request?.consent_attestation)) {
    return { ...held("recording_consent_required", "The site owner must confirm the current recording permission before uploading.", request),
      recordingConsentAvailable: canGrantInitialRecordingConsent(request) };
  }

  // Before the dispatch rule: what is already true of the footage outranks a
  // hold on sending more. Unreadable is not "yes"; the account rule below holds.
  if (await footageArrivedBeforeAccount(requestId, request) === true) {
    return held(FOOTAGE_BEFORE_ACCOUNT, FOOTAGE_BEFORE_ACCOUNT_DETAIL, request);
  }

  // `requiresHumanReview` is false here on purpose, and it is worth saying why:
  // the flag lives on a qualification result this path does not have. Passing
  // false asks the narrower question — "do the gates and provenance allow a
  // capture" — and a request that a human has parked is held by its stored
  // disposition rather than by a flag we would be inventing.
  const decision: CaptureDispatchDecision = decideDispatchForRequest(request, false);

  if (!decision.dispatch) {
    return held(decision.holdReason, decision.detail, request);
  }

  // A site that was told to expect a capturer must not be able to upload its
  // own footage through the same link: the two produce different manifests and
  // different costs, and the channel was decided once already.
  if (decision.channel !== "self_capture_upload") {
    return held(
      "capturer_visit_scheduled",
      "This site is set up for a capturer visit rather than a self-recorded walkthrough.",
      request,
    );
  }

  if (typeof request.account_owner_uid !== "string" || !request.account_owner_uid) {
    return held(SITE_ACCOUNT_REQUIRED, SITE_ACCOUNT_REQUIRED_DETAIL, request);
  }

  return {
    allowed: true,
    holdReason: null,
    detail: null,
    blockers: [],
    openQuestions: [],
    captureMode: request.request?.capture_mode ?? null,
  };
}
