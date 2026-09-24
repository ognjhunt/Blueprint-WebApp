/**
 * Getting the stored walkthrough in front of the footage reader.
 *
 * `captureReviewGate` decides what a reading means. This is the plumbing that
 * produces one: find the video in our bucket, sign a short-lived read URL,
 * fetch the answers the site gave at intake so the model has something to score
 * against, and run the existing `site_video_evidence` task.
 *
 * ## Why this is a separate module
 *
 * `startWorldReconstruction` takes a `reviewCapture` callback rather than doing
 * any of this itself, which keeps the reconstruction path free of Firestore and
 * Storage. That split is what lets the gate be tested against a plain object
 * instead of a mocked bucket, and it is why the iOS path — which passes no
 * reviewer — is provably unaffected.
 *
 * ## When it declines to review
 *
 * Returning `null` from the *builder* means no review is possible and the
 * caller should proceed without one. Returning `null` from the *reviewer it
 * builds* means the review was attempted and failed, which blocks. Those are
 * deliberately different: a deployment with the lane switched off should behave
 * exactly as it did before this existed, while a reviewer that errors must not
 * quietly wave through the footage it was supposed to read.
 */

import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { runAgentTask } from "../agents/runtime";
import {
  siteVideoEvidenceOutputSchema,
  type SiteVideoEvidenceInput,
  type SiteVideoEvidenceOutput,
} from "../agents/tasks/site-video-evidence";
import {
  captureVideoPrivacyOutputSchema,
  type CaptureVideoPrivacyInput,
  type CaptureVideoPrivacyOutput,
} from "../agents/tasks/capture-video-privacy";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { decryptInboundRequestForAdmin } from "./field-encryption";
import { selfCaptureObjectPath } from "./captureUploadToken";
import { gateAnswersOnFile } from "./gateAnswersOnFile";
import {
  bindingGateFieldIds,
  defaultCaptureMode,
  gateFields,
  isCaptureMode,
} from "../../client/src/data/siteTaskQualification";

/** Long enough for a model to fetch the video, short enough not to be a handle. */
const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

/** The containers `self-capture-uploads` accepts and the extractor recognises. */
const WALKTHROUGH_EXTENSIONS = ["mp4", "mov"] as const;

function storageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

/**
 * Find the walkthrough and sign a URL for it.
 *
 * The extension is not recorded anywhere at issue time, so both accepted
 * containers are probed. Two `exists()` calls is cheaper than threading a
 * filename through the trigger, and far cheaper than the generation this is
 * protecting.
 */
async function signWalkthroughUrl(params: {
  sceneId: string;
  captureId: string;
}): Promise<string | null> {
  if (!storageAdmin) return null;
  const bucket = storageAdmin.bucket(storageBucketName());

  for (const extension of WALKTHROUGH_EXTENSIONS) {
    const objectPath = selfCaptureObjectPath({ ...params, extension });
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) continue;

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
    return url;
  }

  return null;
}

/** The gate answers and prose the model scores its observations against. */
async function loadOperatorContext(requestId: string): Promise<{
  operatorAnswers: Record<string, string>;
  taskDescription: string | null;
  whatGoesWrong: string | null;
  bindingFieldIds: readonly string[];
  gateOptions: Record<string, { value: string; label: string }[]>;
} | null> {
  if (!db || !requestId) return null;

  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return null;

  const request = await decryptInboundRequestForAdmin(snapshot.data() as never);
  const captureMode = isCaptureMode(request.request?.capture_mode)
    ? request.request.capture_mode
    : defaultCaptureMode;

  const bindingFieldIds = bindingGateFieldIds(captureMode);
  // The vocabulary the reader may answer in, for the gates footage can settle.
  // Without it an observation can only agree or disagree with an answer the
  // operator gave; with it, an observation can propose one they did not.
  const gateOptions: Record<string, { value: string; label: string }[]> = {};
  for (const field of gateFields) {
    if (!field.settledByFootage || !bindingFieldIds.includes(field.id)) continue;
    gateOptions[field.id] = field.options.map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }

  return {
    operatorAnswers: gateAnswersOnFile(request),
    taskDescription: request.request?.taskDescription ?? null,
    whatGoesWrong: request.request?.whatGoesWrong ?? null,
    bindingFieldIds,
    gateOptions,
  };
}

/**
 * Longer than a review can legitimately take: fetch, Files API upload, file
 * processing and the analysis each carry their own bound in the adapter. A run
 * still marked running past this died with its process.
 */
const REVIEW_IN_FLIGHT_MS = 15 * 60_000;

export type PriorFootageReview =
  | { state: "none" }
  | { state: "running" }
  | { state: "completed"; output: SiteVideoEvidenceOutput };

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const stamp = value as { toMillis?: () => number; _seconds?: number; seconds?: number };
  if (typeof stamp.toMillis === "function") return stamp.toMillis();
  const seconds = stamp._seconds ?? stamp.seconds;
  return typeof seconds === "number" ? seconds * 1000 : null;
}

/**
 * The newest footage review this capture already has, if it is still worth
 * waiting for or already answered.
 *
 * A video review outlives the privacy screen's wait: the screen gives up and
 * holds, but the run keeps going and records its reading. Asking again from
 * scratch threw that reading away, spent an attempt, and started a review that
 * would outlive the next wait too, so a held capture could never clear.
 */
export async function findPriorFootageReview(
  captureId: string,
  now: number = Date.now(),
): Promise<PriorFootageReview> {
  if (!db) return { state: "none" };
  const snapshot = await db.collection("agentRuns").where("metadata.capture_id", "==", captureId).get();
  let latest: { at: number; run: Record<string, unknown> } | null = null;
  for (const doc of snapshot.docs) {
    const run = doc.data() as Record<string, unknown>;
    if (run.task_kind !== "site_video_evidence") continue;
    const at = toMillis(run.started_at) ?? toMillis(run.created_at) ?? 0;
    if (!latest || at > latest.at) latest = { at, run };
  }
  if (!latest) return { state: "none" };
  if (latest.run.status === "running" && now - latest.at < REVIEW_IN_FLIGHT_MS) return { state: "running" };
  if (latest.run.status === "completed") {
    const parsed = siteVideoEvidenceOutputSchema.safeParse(latest.run.output);
    if (parsed.success) return { state: "completed", output: parsed.data };
  }
  return { state: "none" };
}

/** A later privacy-only reading can settle an upload whose first wait timed out. */
export async function findPriorPrivacyReview(
  captureId: string,
  now: number = Date.now(),
): Promise<{ state: "none" } | { state: "running" } |
  { state: "completed"; output: CaptureVideoPrivacyOutput }> {
  if (!db) return { state: "none" };
  const snapshot = await db.collection("agentRuns").where("metadata.capture_id", "==", captureId).get();
  let latest: { at: number; run: Record<string, unknown> } | null = null;
  for (const doc of snapshot.docs) {
    const run = doc.data() as Record<string, unknown>;
    if (run.task_kind !== "capture_video_privacy") continue;
    const at = toMillis(run.started_at) ?? toMillis(run.created_at) ?? 0;
    if (!latest || at > latest.at) latest = { at, run };
  }
  if (!latest) return { state: "none" };
  if (latest.run.status === "running" && now - latest.at < REVIEW_IN_FLIGHT_MS) return { state: "running" };
  if (latest.run.status === "completed") {
    const parsed = captureVideoPrivacyOutputSchema.safeParse(latest.run.output);
    if (parsed.success) return { state: "completed", output: parsed.data };
  }
  return { state: "none" };
}

/** The upload gate avoids navigation and seven unrelated site-quality questions. */
export async function buildCapturePrivacyReviewer(params: {
  requestId: string; sceneId: string; captureId: string;
}): Promise<{ review: () => Promise<CaptureVideoPrivacyOutput | null> } | null> {
  if (!isSiteVideoEvidenceEnabled()) return null;
  const videoUrl = await signWalkthroughUrl(params);
  if (!videoUrl) return null;
  return {
    review: async () => {
      const result = await runAgentTask<CaptureVideoPrivacyInput, CaptureVideoPrivacyOutput>({
        kind: "capture_video_privacy",
        input: { taskVideoUrl: videoUrl },
        session_key: `capture_privacy:${params.captureId}`,
        metadata: { capture_id: params.captureId, scene_id: params.sceneId },
      });
      if (result.status !== "completed" || !result.output) {
        logger.warn({ captureId: params.captureId, error: result.error }, "Privacy-only video review did not complete");
        return null;
      }
      return result.output;
    },
  };
}

export interface CaptureFootageReviewer {
  review: () => Promise<SiteVideoEvidenceOutput | null>;
  bindingFieldIds: readonly string[];
}

/**
 * Build a reviewer for this capture, or return null if one is not possible.
 *
 * Null here means "proceed without review": the lane is off, the video is not
 * where we expect it, or storage cannot sign. Each of those is logged with the
 * reason, because a gate that silently stops existing is worse than one that is
 * plainly switched off.
 */
export async function buildCaptureFootageReviewer(params: {
  requestId: string;
  sceneId: string;
  captureId: string;
}): Promise<CaptureFootageReviewer | null> {
  if (!isSiteVideoEvidenceEnabled()) return null;

  let videoUrl: string | null = null;
  try {
    videoUrl = await signWalkthroughUrl(params);
  } catch (error) {
    logger.warn({ error, ...params }, "Could not sign walkthrough URL for footage review");
    return null;
  }

  if (!videoUrl) {
    logger.warn(params, "No walkthrough object found to review; reconstructing without one");
    return null;
  }

  const context = await loadOperatorContext(params.requestId).catch((error) => {
    logger.warn({ error, ...params }, "Could not load operator answers for footage review");
    return null;
  });

  if (!context) return null;

  return {
    bindingFieldIds: context.bindingFieldIds,
    review: async () => {
      const result = await runAgentTask<SiteVideoEvidenceInput, SiteVideoEvidenceOutput>({
        kind: "site_video_evidence",
        input: {
          requestId: params.requestId,
          taskVideoUrl: videoUrl,
          taskDescription: context.taskDescription,
          whatGoesWrong: context.whatGoesWrong,
          operatorAnswers: context.operatorAnswers,
          gateOptions: context.gateOptions,
        },
        session_key: `capture_review:${params.captureId}`,
        metadata: { capture_id: params.captureId, scene_id: params.sceneId },
      });

      // A task that did not complete is not an abstention. The gate treats null
      // as a block precisely so an unread video never reaches a paid
      // reconstruction on the strength of nothing.
      if (result.status !== "completed" || !result.output) {
        logger.warn(
          { captureId: params.captureId, error: result.error },
          "Footage review did not complete",
        );
        return null;
      }

      return result.output;
    },
  };
}
