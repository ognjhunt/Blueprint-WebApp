/**
 * The immutable upload identity of a capture-link bundle.
 *
 * Same shape and same validator as `POST /v1/creator/captures`
 * (`captureUploadIdentity`): `sha256:`-prefixed bundle and marker digests, the
 * `gs://` manifest URI, and `verification_status:
 * pending_pipeline_storage_readback` until Pipeline reads the bytes back.
 *
 * Keyed on `captureUploadSessions/<captureId>`, the website capture's own
 * record — where its scene preview already lives, and where the storage
 * readback (`internal-capture-reconstruction`) looks when a capture has no
 * creator registration. A site capture has no creator and must never appear in
 * `creatorCaptures`, whose records feed creator payout handling.
 *
 * Create-only in effect: once recorded, the identity is never replaced. A retry
 * with the same identity is a replay; a different one is a conflict.
 */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadIdentity } from "./captureUploadIdentity";
import type { BundleClient, BundleTarget } from "./siteCaptureBundle";
import { captureStorageBucketName } from "./siteCaptureBundleStorage";

export const SITE_CAPTURE_SESSIONS_COLLECTION = "captureUploadSessions";

export async function recordSiteCaptureUploadIdentity(params: {
  requestId: string;
  target: BundleTarget;
  identity: { raw_bundle_digest: string; raw_manifest_uri: string; upload_completion_digest: string };
  planDigest: string;
  client: BundleClient;
}): Promise<"recorded" | "conflict"> {
  if (!db) throw new Error("capture_store_unavailable");
  const validated = captureUploadIdentity(
    { ...params.identity },
    { bucket: captureStorageBucketName() },
  );
  if (!validated.value) throw new Error(validated.error || "invalid_immutable_upload_identity");
  const identity = validated.value;
  const store = db;
  const ref = store.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(params.target.captureId);
  return store.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists
      ? (snapshot.data()?.immutable_upload_identity as Record<string, unknown> | undefined)
      : undefined;
    if (existing) {
      const same = existing.raw_bundle_digest === identity.raw_bundle_digest
        && existing.raw_manifest_uri === identity.raw_manifest_uri
        && existing.upload_completion_digest === identity.upload_completion_digest;
      return same ? "recorded" : "conflict";
    }
    transaction.set(
      ref,
      {
        immutable_upload_identity: identity,
        site_capture_bundle: {
          schema_version: "site_capture_bundle_session.v1",
          request_id: params.requestId,
          scene_id: params.target.sceneId,
          capture_id: params.target.captureId,
          raw_prefix: params.target.rawPrefix,
          plan_digest: params.planDigest,
          client: params.client,
          recorded_at_iso: new Date().toISOString(),
        },
      },
      { merge: true },
    );
    return "recorded";
  });
}

/**
 * Claim a capture's prefix for an app bundle, before the plan is written.
 *
 * The claim is what the browser recorder checks before it writes: the browser
 * path overwrites its own video, manifest and marker by design, and an app
 * bundle's raw files are immutable. Recorded on the same session document,
 * atomically; the same plan re-claims, a different one conflicts.
 */
export async function claimSiteCaptureBundle(params: {
  requestId: string;
  target: BundleTarget;
  planDigest: string;
  client: BundleClient;
}): Promise<"claimed" | "conflict"> {
  if (!db) throw new Error("capture_store_unavailable");
  const store = db;
  const ref = store.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(params.target.captureId);
  return store.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists
      ? (snapshot.data()?.site_capture_bundle_claim as Record<string, unknown> | undefined)
      : undefined;
    if (existing) return existing.plan_digest === params.planDigest ? "claimed" : "conflict";
    transaction.set(
      ref,
      {
        site_capture_bundle_claim: {
          schema_version: "site_capture_bundle_claim.v1",
          request_id: params.requestId,
          capture_id: params.target.captureId,
          raw_prefix: params.target.rawPrefix,
          plan_digest: params.planDigest,
          client: params.client,
          claimed_at_iso: new Date().toISOString(),
        },
      },
      { merge: true },
    );
    return "claimed";
  });
}

/** Whether an app bundle has claimed this capture. Throws when the store cannot answer. */
export async function siteCaptureBundleClaimed(captureId: string): Promise<boolean> {
  if (!db) throw new Error("capture_store_unavailable");
  const snapshot = await db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(captureId).get();
  return Boolean(snapshot.exists && snapshot.data()?.site_capture_bundle_claim);
}
