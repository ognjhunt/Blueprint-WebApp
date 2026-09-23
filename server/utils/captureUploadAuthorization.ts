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
 */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decideDispatchForRequest } from "../agents/workflows";
import type { InboundRequest } from "../types/inbound-request";
import type { CaptureDispatchDecision } from "./captureDispatch";

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
}

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
      "We cannot check this link right now. Try again shortly — nothing is lost.",
    );
  }

  let request: InboundRequest | null = null;
  try {
    const snapshot = await db.collection("inboundRequests").doc(requestId).get();
    request = snapshot.exists ? (snapshot.data() as InboundRequest) : null;
  } catch {
    return held(
      "store_unavailable",
      "We cannot check this link right now. Try again shortly — nothing is lost.",
    );
  }

  if (!request) {
    return held("request_missing", "This link does not point at a submission we hold.");
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

  return {
    allowed: true,
    holdReason: null,
    detail: null,
    blockers: [],
    openQuestions: [],
    captureMode: request.request?.capture_mode ?? null,
  };
}
