import { humanDecisionDigest } from "./human-reply-admission";
import { classifyProviderFailure, type ProviderOutage } from "./providerOutage";
import { validateCaptureSupplement } from "./captureSupplement";
import { browserPendingDecisionKey, loadBrowserPending } from "./websiteBrowserPending";
import { hydrateAgentEvidence } from "../agents/private-evidence";
/**
 * Running the coverage read, and writing what it found where readers look.
 *
 * Source-bound observations stay available to Blueprint's reconstruction and
 * recovery work. Missing views do not automatically become a customer request.
 *
 * `buildCaptureFootageReviewer` signs a short-lived read URL, loads the
 * operator's own context, and hands back a callable. Same shape here, and the
 * same two meanings for null: a null *builder* means no review is possible and
 * the caller proceeds without one; a null result from the *reviewer* means the
 * review was attempted and failed. Conflating those is how a switched-off lane
 * starts looking like a clean bill of health.
 *
 * A favorable coverage finding grants neither source rights nor spending
 * authority; those remain with the existing admission controls.
 */

import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import { runAgentTask } from "../agents/runtime";
import {
  captureCoverageTask,
  captureCoverageOutputSchema,
  type CaptureCoverageInput,
  type CaptureCoverageOutput,
} from "../agents/tasks/capture-coverage";
import type { SiteVideoJobEstimatesOutput } from "../agents/tasks/site-video-evidence";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { selfCaptureObjectPath } from "./captureUploadToken";
import { getBrief, isPlaceholderSummary, nameUnnamedTask } from "./siteTaskBrief";
import { namesAnAction, screenTaskScope } from "./siteTaskScope";

/** Long enough for a model to fetch the video, short enough not to be a handle. */
const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

const WALKTHROUGH_EXTENSIONS = ["mp4", "mov"] as const;

function storageBucketName(): string {
  return (
    process.env.BLUEPRINT_CAPTURE_BUCKET
    || process.env.FIREBASE_STORAGE_BUCKET
    || "blueprint-8c1ca.appspot.com"
  );
}

async function signWalkthroughUrl(params: {
  sceneId: string;
  captureId: string;
  binding?: { source: unknown };
}): Promise<string | null> {
  if (!storageAdmin) return null;
  const bucket = storageAdmin.bucket(storageBucketName());
  const source = params.binding?.source as { kind?: string; key?: string } | undefined;
  if (source?.kind === "browser_pending") {
    const pending = await loadBrowserPending(params.captureId);
    if (!pending || pending.scene_id !== params.sceneId || browserPendingDecisionKey(pending) !== source.key) throw new Error("coverage_source_changed");
    const file = bucket.file(pending.video.object_name, { generation: pending.video.generation });
    const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + SIGNED_URL_TTL_MS,
      queryParams: { generation: pending.video.generation } });
    return url;
  }

  for (const extension of WALKTHROUGH_EXTENSIONS) {
    const objectPath = selfCaptureObjectPath({
      sceneId: params.sceneId,
      captureId: params.captureId,
      extension,
    });
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) continue;
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
    return url;
  }
  return null;
}

export interface CoverageFinding {
  sourceCaptures?: Array<{ capture_id: string; bundle_digest: string | null }>;
  coversScene: boolean;
  /** Phrased so somebody in the room could act on them. */
  missingCoverage: string[];
  /** True when one more clip finishes it, rather than a re-shoot. */
  supplementWouldFinish: boolean;
  unreadableReasons: string[];
  confidence: number;
}

/**
 * Read the stored walkthrough for coverage.
 *
 * Returns null when no read was possible — no lane, no video, no brief to take
 * a shot list from. A caller treats that as "we do not know", which is
 * different from "it does not cover the scene" and very different from "it
 * does".
 */
/**
 * The reviewer's proposed job, when it names one, whatever its kind: an action on the site (a towel picked up is a
 * job as a vase is), or a move the screen reads with no verb ("Cartons from a conveyor onto a pallet"). A
 * description of the room names no action and is not a job.
 */
export function draftedTaskStatement(output: { proposed_task_statement?: string | null; unreadable_reasons?: readonly string[] }) {
  const statement = output.proposed_task_statement?.trim().slice(0, 300);
  if (!statement || output.unreadable_reasons?.length || isPlaceholderSummary(statement)) return null;
  return namesAnAction(statement) || screenTaskScope({ summary: statement }).supported ? statement : null;
}

/**
 * Why a read waited rather than failed: something it needs is not there yet. Another call for the same capture holds
 * its one-at-a-time budget, or a retained read is still running; the stored walkthrough is not in storage yet (a
 * legacy upload still finishing); the job's brief is not on file yet. None of these is a failed read.
 */
export type CoverageWaitReason = "coverage_budget_call_in_flight" | "coverage_call_running" | "coverage_video_not_stored"
  | "coverage_brief_missing";

/**
 * Why a read failed: the adapter's code (`video_fetch_failed`, `audio_strip_unavailable`, `non_json_response`, ...),
 * or one of these. `coverage_budget_job_cap_reached` means the job's $40 cap leaves no room for another paid read;
 * `provider_failed_after_paid_answer` means the provider answered the paid video analysis and then refused or failed
 * a later call of the same read, so the read used its attempt (it is not an outage that is retried for free).
 */
export type CoverageFailureReason = string;
export const COVERAGE_JOB_CAP_REACHED = "coverage_budget_job_cap_reached";
export const COVERAGE_FAILED_AFTER_PAID_ANSWER = "provider_failed_after_paid_answer";

/** The code at the head of a failed run's error text (`<code>: <message>`), or a plain fallback. */
function failureCode(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  // The budget's own refusals are named inside the adapter's generic code (`gemini_video_failed: coverage_budget_...`).
  const budget = /\b(coverage_budget_[a-z_]+)/.exec(text)?.[1];
  if (budget) return budget;
  const code = /^([a-z0-9_]{3,80})(?::|$)/.exec(text.trim())?.[1];
  return code ?? "coverage_review_failed";
}

export async function reviewCaptureCoverage(params: {
  /** Compatibility input; coverage findings no longer request customer action. */
  notifyOwner?: boolean;
  binding?: { source: unknown; brief_digest: string; capture_id: string };
  reviewId?: string;
  claimToken?: string;
  requestId: string;
  sceneId: string;
  captureId: string;
  /**
   * Told when the read did not happen because another model call for the same capture is in flight (its budget
   * record allows one at a time) or a retained read is still running. That is a wait, not a failed attempt: the
   * queue does not count it against the retry limit.
   */
  onWaiting?: (reason: CoverageWaitReason) => void;
  /**
   * Told when the provider refused or did not answer the call (`providerOutage.ts`). That is an outage, not a reading
   * that went wrong: the queue gives the attempt back and tries again on a back-off.
   */
  onProviderOutage?: (outage: ProviderOutage) => void;
  /** Told when the read was tried and failed, with the reason. Only this counts against the retry limit. */
  onFailed?: (reason: CoverageFailureReason) => void;
}): Promise<CoverageFinding | null> {
  if (!isSiteVideoEvidenceEnabled()) return null;

  let videoUrl: string | null = null;
  try {
    videoUrl = await signWalkthroughUrl(params);
  } catch (error) {
    // The upload this reading was bound to changed or is gone: it can never be read under this binding.
    logger.warn({ error, ...params }, "Could not sign walkthrough URL for coverage review");
    params.onFailed?.("coverage_source_changed");
    return null;
  }
  if (!videoUrl) {
    logger.info(params, "Coverage review waits: the walkthrough is not in storage yet");
    params.onWaiting?.("coverage_video_not_stored");
    return null;
  }

  // The shot list is what coverage is measured against. Without a brief there
  // is no list, and a coverage verdict against an invented standard would fail
  // every real capture -- so this declines rather than guessing at one.
  const brief = await getBrief(params.requestId).catch(() => null);
  if (!brief) {
    logger.info(params, "No task brief yet, so no shot list to measure coverage against");
    params.onWaiting?.("coverage_brief_missing");
    return null;
  }

  if (params.binding && humanDecisionDigest(brief) !== params.binding.brief_digest) throw new Error("coverage_brief_changed");

  const supplement = db ? (await db.collection("captureSupplements").doc(params.captureId).get()).data() : null;
  if (supplement) await validateCaptureSupplement({ ...params, supplement: supplement.supplement });
  const additive = supplement?.recording_scope !== "complete_walkthrough" && supplement?.parent_coverage?.supplement_would_finish === true
    && supplement?.parent_coverage?.binding?.brief_digest === humanDecisionDigest(brief);
  const requestedViews = additive ? supplement.parent_coverage.missing_coverage.map((label: string, index: number) => ({ id: `additional-${index}`, label })) : [
    { id: "work-area", label: "The whole work area, from a few steps back" },
    ...brief.proposed.map((answer) => ({ id: answer.fieldId, label: answer.reading })),
  ];
  // Only the site's own walkthrough drafts the job, and only while nothing names it.
  const draftTask = !additive && params.captureId === `walkthrough-${params.requestId}` && isPlaceholderSummary(brief.summary);

  let output: CaptureCoverageOutput | null = null;
  try {
    if (params.reviewId && db) {
      const retained = await db.collection("agentRuns").where("session_key", "==", `capture_coverage:${params.reviewId}`).get();
      // Prefer any completed result over starting another paid video traversal.
      for (const row of retained.docs) {
        if (row.data().task_kind !== "capture_coverage") continue;
        if (row.data().status === "completed") {
          const evidence = await hydrateAgentEvidence(row.data(), { collection: "agentRuns", id: row.id });
          const parsed = captureCoverageOutputSchema.safeParse(evidence.output);
          if (parsed.success) { output = parsed.data; break; }
        }
      }
      if (!output && retained.docs.some(row => row.data().task_kind === "capture_coverage" && row.data().status === "running")) {
        params.onWaiting?.("coverage_call_running");
        return null;
      }
    }
    if (!output) {
    const result = await runAgentTask<CaptureCoverageInput, CaptureCoverageOutput>({
      kind: captureCoverageTask.kind,
      session_key: `capture_coverage:${params.reviewId || params.captureId}`,
      metadata: { capture_id: params.captureId, review_id: params.reviewId || null, coverage_claim_token: params.claimToken || null },
      input: {
        videoUrl,
        supplementaryViewsOnly: additive,
        taskSummary: brief.summary,
        requestedViews,
        ...(draftTask ? { draftTaskStatement: true } : {}),
      },
    });
    output = (result?.output as CaptureCoverageOutput) ?? null;
    if (!output) {
      // The video adapter catches its own errors and returns them as a failed result (`gemini-video.ts`), so a
      // budget refusal arrives here as text, not as a thrown error.
      const error = result?.error ?? null;
      if (/coverage_budget_call_in_flight/.test(String(error ?? ""))) {
        logger.info({ ...params }, "Coverage review waits: another model call for this capture is in flight");
        params.onWaiting?.("coverage_budget_call_in_flight");
        return null;
      }
      const outage = result?.status === "failed" ? classifyProviderFailure("gemini", error) : null;
      const samples = (result?.artifacts as Record<string, unknown> | undefined)?.usage_samples;
      // A paid answer was received in this read (the video analysis answered): a later refusal is not retried for free.
      const paidAnswer = Array.isArray(samples) && samples.length > 0;
      if (outage && !paidAnswer) {
        logger.warn({ ...params, provider: outage.provider, cause: outage.cause }, "Coverage review waits: the video model refused or did not answer");
        params.onProviderOutage?.(outage);
        return null;
      }
      const reason = outage ? COVERAGE_FAILED_AFTER_PAID_ANSWER : failureCode(error ?? `coverage_${result?.status ?? "no"}_output`);
      logger.warn({ ...params, reason }, "Coverage review failed");
      params.onFailed?.(reason);
      return null;
    }
    }
  } catch (error) {
    if (/coverage_budget_call_in_flight/.test(String((error as Error)?.message ?? error))) {
      logger.info({ ...params }, "Coverage review waits: another model call for this capture is in flight");
      params.onWaiting?.("coverage_budget_call_in_flight");
      return null;
    }
    const outage = classifyProviderFailure("gemini", error);
    if (outage) {
      logger.warn({ ...params, provider: outage.provider, cause: outage.cause }, "Coverage review waits: the video model refused or did not answer");
      params.onProviderOutage?.(outage);
      return null;
    }
    logger.warn({ error, ...params }, "Coverage review failed");
    params.onFailed?.(failureCode(error));
    return null;
  }

  if (!output) return null;

  const finding: CoverageFinding = {
    ...(additive ? { sourceCaptures: [{ capture_id: params.captureId, bundle_digest: null },
      { capture_id: supplement.supplement.parent_capture_id, bundle_digest: supplement.supplement.parent_bundle_digest }] } : {}),
    coversScene: Boolean(output.covers_scene),
    missingCoverage: output.missing_views ?? [],
    supplementWouldFinish: Boolean(output.supplement_would_finish),
    unreadableReasons: output.unreadable_reasons ?? [],
    confidence: output.confidence ?? 0,
  };

  // Refused rather than trusted: "covers the scene" with a list of missing
  // views is a contradiction, and the safe reading of a contradiction is the
  // one that does not authorise a spend.
  if (finding.coversScene && finding.missingCoverage.length) {
    logger.warn(
      { ...params, missing: finding.missingCoverage },
      "Coverage review said covered and also named missing views; taking the cautious reading",
    );
    finding.coversScene = false;
  }
  if (finding.coversScene && (finding.unreadableReasons.length || finding.confidence < 0.6
    || requestedViews.some((view: { id: string }) => !output!.views.some(observed => observed.id === view.id
      && observed.status === "seen" && observed.timestamp_seconds != null)))) finding.coversScene = false;

  // The site's own walkthrough is the one recording read on every website job, so its
  // estimates are what robot fit infers the job from. Never an unreadable clip's, and
  // never a supplement's, which shows only part of the work.
  const estimates = params.captureId === `walkthrough-${params.requestId}` && !finding.unreadableReasons.length
    ? output.job_estimates ?? null : null;
  await recordCoverageFinding(params.requestId, params.captureId, finding, params.binding, estimates);

  // Owner decision 2026-10-29: the job is drafted from the video; the site is asked
  // for one line only when the footage shows none. A failed draft never fails the review.
  if (draftTask && db) {
    try {
      const statement = draftedTaskStatement(output);
      const named = statement ? await nameUnnamedTask({ requestId: params.requestId, summary: statement }) : null;
      // Naming the job changes the brief this review was bound to. Record which brief the review's own
      // draft produced, from which, so the queue keeps this review as current for it rather than paying
      // to read the same video again. A later change by the site makes another brief and a fresh review.
      const store = db;
      await store.runTransaction(async tx => {
        const drafted = named && params.binding
          ? humanDecisionDigest((await tx.get(store.collection("siteTaskBriefs").doc(params.requestId))).data()) : null;
        tx.set(store.collection("inboundRequests").doc(params.requestId), { capture_task_statement_draft: {
          capture_id: params.captureId, state: named ? "drafted" : "none_seen", reviewed_at_iso: new Date().toISOString(),
          ...(drafted ? { from_brief_digest: params.binding!.brief_digest, drafted_brief_digest: drafted } : {}),
        } }, { merge: true });
      });
    } catch (error) {
      logger.warn({ error, ...params }, "Could not draft the job from the coverage review");
    }
  }

  // Retain missing observations for Blueprint's recovery work. They do not
  // automatically become a request for the customer to record more footage.

  return finding;
}

/**
 * Store it where the readiness model and an operator can both see it.
 *
 * On the request rather than in its own collection, because every other
 * capture verdict lives there and a reader assembling "what do we know about
 * this submission" should not have to know about a second place.
 */
export async function recordCoverageFinding(
  requestId: string,
  captureId: string,
  finding: CoverageFinding,
  binding?: { source: unknown; brief_digest: string; capture_id: string },
  /** The walkthrough's job estimates, kept beside the finding for robot fit; only with the walkthrough's own finding. */
  jobEstimates?: SiteVideoJobEstimatesOutput | null,
): Promise<void> {
  if (!db) throw new Error("coverage_store_unavailable");
  const ref = db.collection("inboundRequests").doc(requestId);
  await db.runTransaction(async tx => {
    const [request, brief] = await Promise.all([tx.get(ref), tx.get(db!.collection("siteTaskBriefs").doc(requestId))]);
    const value = request.data();
    const privacy = value?.capture_privacy_source_bound_decision || value?.capture_privacy_screen;
    if (value?.active_capture_id && value.active_capture_id !== captureId) throw new Error("coverage_source_superseded");
    if (!hasCurrentRecordingConsent(value?.request?.consent_attestation)) throw new Error("coverage_recording_consent_required");
    if (binding && (humanDecisionDigest(brief.data()) !== binding.brief_digest
      || humanDecisionDigest(privacy?.producer_source || null) !== humanDecisionDigest(binding.source)
      || privacy?.capture_id !== captureId || !privacy?.proceeded)) throw new Error("coverage_source_changed");
    tx.set(ref, { capture_coverage: {
      capture_id: captureId, covers_scene: finding.coversScene, missing_coverage: finding.missingCoverage,
      supplement_would_finish: finding.supplementWouldFinish, unreadable_reasons: finding.unreadableReasons,
      confidence: finding.confidence, reviewed_at_iso: new Date().toISOString(),
      ...(finding.sourceCaptures ? { source_captures: finding.sourceCaptures } : {}),
      reviewed_at: admin.firestore.FieldValue.serverTimestamp(), ...(binding ? { binding } : {}),
    } }, { merge: true });
    // Replaced whole, under the same consent and source checks as the finding it came with.
    if (jobEstimates) tx.set(ref, { walkthrough_job_estimates: { capture_id: captureId, job_estimates: jobEstimates,
      reviewed_at_iso: new Date().toISOString() } }, { mergeFields: ["walkthrough_job_estimates"] });
  });
}

/** Kept in a dependency-free module so readiness readers do not load this review pipeline. */
export { coverageEvidenceFrom } from "./captureCoverageEvidence";
