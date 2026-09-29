/**
 * Writing down what the upload-time privacy screen saw.
 *
 * A hold that nobody can see is a video sitting in a bucket with no marker and
 * no explanation — indistinguishable, from the outside, from an upload that
 * silently failed. So the reading goes onto the request: what was seen, when,
 * and whether it stopped anything.
 *
 * It is also not free. The narrow privacy decision is stored separately from
 * full site-video evidence so the two cannot masquerade as each other.
 *
 * A source-bound decision must be durable before its completion marker can
 * publish. Older unbound decisions retain their historical best-effort path.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { notifySlackCapturePrivacyEscalation } from "./slack";
import type { PrivacyScreenResult } from "./capturePrivacyScreen";
import { createHash, randomUUID } from "node:crypto";

/** The exact producer/source screened; kinds cannot authorize each other. */
export type CapturePrivacyProducerSource = {
  kind: "browser_pending" | "app_bundle_completion";
  key: string;
};

type CapturePrivacyClaimSource = CapturePrivacyProducerSource | {
  kind: "legacy_browser_claim";
  key: string;
};

/** Legacy has no versioned original, so this key is only a screening mutex. */
export function legacyCapturePrivacyClaimSource(requestId: string, captureId: string,
  sceneId: string): CapturePrivacyClaimSource {
  return { kind: "legacy_browser_claim",
    key: `sha256:${createHash("sha256").update(`${requestId}\0${captureId}\0${sceneId}`).digest("hex")}` };
}

export type CapturePrivacyScreenClaim = {
  schema_version: "capture_privacy_screen_claim.v1";
  request_id: string;
  capture_id: string;
  producer_source: CapturePrivacyClaimSource;
  id: string;
  expires_at_ms: number;
};

const SCREEN_CLAIM_MS = 60 * 60 * 1000;

function validSource(source: CapturePrivacyProducerSource | null | undefined): source is CapturePrivacyProducerSource {
  return (source?.kind === "browser_pending" || source?.kind === "app_bundle_completion")
    && /^sha256:[a-f0-9]{64}$/.test(source.key);
}

function validClaimSource(source: CapturePrivacyClaimSource | null | undefined): source is CapturePrivacyClaimSource {
  return validSource(source?.kind === "legacy_browser_claim" ? null : source)
    || (source?.kind === "legacy_browser_claim" && /^sha256:[a-f0-9]{64}$/.test(source.key));
}

function validClaim(value: unknown): value is CapturePrivacyScreenClaim {
  if (!value || typeof value !== "object") return false;
  const claim = value as Partial<CapturePrivacyScreenClaim>;
  return claim.schema_version === "capture_privacy_screen_claim.v1"
    && typeof claim.request_id === "string" && typeof claim.capture_id === "string"
    && typeof claim.id === "string" && validClaimSource(claim.producer_source)
    && Number.isSafeInteger(claim.expires_at_ms) && (claim.expires_at_ms ?? 0) > 0;
}

/** One active screen per request; a stale claimant cannot save or publish later. */
export async function claimCapturePrivacyScreen(input: { requestId: string; captureId: string;
  producerSource: CapturePrivacyClaimSource }, nowMs = Date.now()): Promise<CapturePrivacyScreenClaim | null> {
  if (!db || !validClaimSource(input.producerSource) || !Number.isSafeInteger(nowMs) || nowMs < 1)
    throw new Error("capture_privacy_claim_unavailable");
  const claim: CapturePrivacyScreenClaim = { schema_version: "capture_privacy_screen_claim.v1",
    request_id: input.requestId, capture_id: input.captureId, producer_source: input.producerSource,
    id: randomUUID(), expires_at_ms: nowMs + SCREEN_CLAIM_MS };
  const ref = db.collection("inboundRequests").doc(input.requestId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("capture_privacy_request_missing");
    const active = snapshot.data()?.capture_privacy_screening_claim;
    if (active != null && !validClaim(active)) throw new Error("capture_privacy_claim_invalid");
    if (active && active.expires_at_ms > nowMs) return null;
    transaction.set(ref, { capture_privacy_screening_claim: claim }, { merge: true });
    return claim;
  });
}

/** An ordinary failed call releases only its own claim; process death uses expiry. */
export async function releaseCapturePrivacyScreenClaim(claim: CapturePrivacyScreenClaim): Promise<void> {
  if (!db || !validClaim(claim)) return;
  const ref = db.collection("inboundRequests").doc(claim.request_id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const active = snapshot.data()?.capture_privacy_screening_claim;
    if (validClaim(active) && active.id === claim.id
        && active.request_id === claim.request_id && active.capture_id === claim.capture_id
        && active.producer_source.kind === claim.producer_source.kind
        && active.producer_source.key === claim.producer_source.key) {
      transaction.set(ref, { capture_privacy_screening_claim: null }, { merge: true });
    }
  });
}

export async function recordCapturePrivacyScreen(params: {
  requestId: string;
  captureId: string;
  result: PrivacyScreenResult;
  producerSource?: CapturePrivacyProducerSource | null;
  claim?: CapturePrivacyScreenClaim | null;
  /**
   * How many times we have asked, including this one.
   *
   * Stored because the retry budget has to survive a restart: a counter held
   * in memory would reset and a held capture could be retried forever without
   * ever reaching a person.
   */
  attempts?: number;
}): Promise<void> {
  if (!db) {
    if (params.producerSource || params.claim) throw new Error("capture_privacy_record_unavailable");
    return;
  }

  try {
    const update = {
          capture_privacy_screen: {
            capture_id: params.captureId,
            outcome: params.result.outcome,
            // What the upload may be used for, which is a different question
            // from whether it arrived. `proceeded` answers the old, conflated
            // one and is kept so existing readers do not break.
            eligibility: params.result.eligibility,
            retryable: params.result.retryable ?? false,
            proceeded: params.result.proceed,
            producer_source: params.producerSource ?? null,
            detail: params.result.detail,
            attempts: params.attempts ?? 1,
            // Set once and never overwritten, because the age of the hold is
            // measured from when it started rather than from the last attempt.
            ...(params.result.eligibility === "pending" && (params.attempts ?? 1) <= 1
              ? { first_held_at_iso: new Date().toISOString() }
              : {}),
            screened_at_iso: new Date().toISOString(),
            screened_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          // Only when there was a real reading. An absent evidence block means
          // nothing was watched, which must not read as "watched and found
          // nothing". Full footage interpretation has its own record.
          ...(params.result.evidence
            ? { capture_privacy_evidence: params.result.evidence }
            : {}),
        };
    const ref = db.collection("inboundRequests").doc(params.requestId);
    if (params.producerSource || params.claim) {
      if ((params.producerSource && !validSource(params.producerSource)) || !validClaim(params.claim)
          || params.claim.request_id !== params.requestId || params.claim.capture_id !== params.captureId
          || (params.producerSource
            ? params.claim.producer_source.kind !== params.producerSource.kind
              || params.claim.producer_source.key !== params.producerSource.key
            : params.claim.producer_source.kind !== "legacy_browser_claim"))
        throw new Error("capture_privacy_claim_invalid");
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const active = snapshot.data()?.capture_privacy_screening_claim;
        if (!validClaim(active) || active.id !== params.claim!.id
            || active.request_id !== params.requestId || active.capture_id !== params.captureId
            || active.producer_source.kind !== params.claim!.producer_source.kind
            || active.producer_source.key !== params.claim!.producer_source.key
            || active.expires_at_ms <= Date.now())
          throw new Error("capture_privacy_claim_changed");
        transaction.set(ref, { ...update,
          // Old deployed writers can merge into capture_privacy_screen but do
          // not know this independent authority field. Modern completion
          // reads only this copy, so old leaves cannot launder a clearance.
          ...(params.producerSource ? { capture_privacy_source_bound_decision: update.capture_privacy_screen } : {}),
          capture_privacy_screening_claim: null }, { merge: true });
      });
    } else {
      await ref.set(update, { merge: true });
    }

    // A rejected reading never retries, so without a bell it waits for
    // nobody: the flag had zero consumers. Fire-and-forget with a logged
    // catch — the record above is the source of truth, and a Slack hiccup
    // must not fail an upload that already succeeded.
    if (params.result.eligibility === "rejected") {
      notifySlackCapturePrivacyEscalation({
        requestId: params.requestId,
        reason: params.result.detail || "The privacy review held this capture for a person.",
        attempts: params.attempts,
      }).catch((error) =>
        logger.error(
          { error, requestId: params.requestId },
          "Privacy-hold Slack notification failed",
        ),
      );
    }
  } catch (error) {
    logger.warn(
      { error, requestId: params.requestId, captureId: params.captureId },
      "Could not record the capture privacy screen; source-bound completion stays held",
    );
    if (params.producerSource || params.claim) throw new Error("capture_privacy_record_unavailable");
  }
}
