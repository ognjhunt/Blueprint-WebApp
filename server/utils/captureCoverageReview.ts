/**
 * Running the coverage read, and writing what it found where readers look.
 *
 * ## What this makes true
 *
 * `EvidenceOnFile.coversScene` and `.missingCoverage` were inferred from
 * adjacent facts: a scene exists, therefore coverage was sufficient. Sound at
 * the two call sites that used it, and useless for the case in between —
 * footage uploaded, nothing reconstructed, and an operator who could add one
 * more view in thirty seconds if we could tell them which.
 *
 * The capture page says "we check next whether it covers the work area well
 * enough... including if one more view would finish the job". This is what
 * makes that a mechanism rather than a promise.
 *
 * ## Structured exactly like the footage reviewer, on purpose
 *
 * `buildCaptureFootageReviewer` signs a short-lived read URL, loads the
 * operator's own context, and hands back a callable. Same shape here, and the
 * same two meanings for null: a null *builder* means no review is possible and
 * the caller proceeds without one; a null result from the *reviewer* means the
 * review was attempted and failed. Conflating those is how a switched-off lane
 * starts looking like a clean bill of health.
 *
 * ## It can withhold and never grant
 *
 * `coversScene: false` with named missing views is actionable. `true` does not
 * authorise anything on its own: `shouldSpendOnReconstruction` still requires a
 * confirmed brief and every binding gate answered, so a model that likes the
 * footage cannot move money. Same one-way door as the rest of the funnel.
 */

import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { runAgentTask } from "../agents/runtime";
import {
  captureCoverageTask,
  type CaptureCoverageInput,
  type CaptureCoverageOutput,
} from "../agents/tasks/capture-coverage";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { selfCaptureObjectPath } from "./captureUploadToken";
import { getBrief } from "./siteTaskBrief";
import { commitTaskUpdate } from "./taskUpdateCommitment";
import { deliverOutbox } from "./captureOutbox";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";

/** Long enough for a model to fetch the video, short enough not to be a handle. */
const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

const WALKTHROUGH_EXTENSIONS = ["mp4", "mov"] as const;

function storageBucketName(): string {
  return (
    process.env.BLUEPRINT_CAPTURE_BUCKET
    || process.env.FIREBASE_STORAGE_BUCKET
    || ""
  );
}

async function signWalkthroughUrl(params: {
  sceneId: string;
  captureId: string;
}): Promise<string | null> {
  if (!storageAdmin) return null;
  const bucket = storageAdmin.bucket(storageBucketName());

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
export async function reviewCaptureCoverage(params: {
  requestId: string;
  sceneId: string;
  captureId: string;
}): Promise<CoverageFinding | null> {
  if (!isSiteVideoEvidenceEnabled()) return null;

  let videoUrl: string | null = null;
  try {
    videoUrl = await signWalkthroughUrl(params);
  } catch (error) {
    logger.warn({ error, ...params }, "Could not sign walkthrough URL for coverage review");
    return null;
  }
  if (!videoUrl) return null;

  // The shot list is what coverage is measured against. Without a brief there
  // is no list, and a coverage verdict against an invented standard would fail
  // every real capture -- so this declines rather than guessing at one.
  const brief = await getBrief(params.requestId).catch(() => null);
  if (!brief) {
    logger.info(params, "No task brief yet, so no shot list to measure coverage against");
    return null;
  }

  const requestedViews = [
    { id: "work-area", label: "The whole work area, from a few steps back" },
    ...brief.proposed.map((answer) => ({ id: answer.fieldId, label: answer.reading })),
  ];

  let output: CaptureCoverageOutput | null = null;
  try {
    const result = await runAgentTask<CaptureCoverageInput, CaptureCoverageOutput>({
      ...captureCoverageTask,
      input: {
        videoUrl,
        taskSummary: brief.summary,
        requestedViews,
      },
    } as never);
    output = (result?.output as CaptureCoverageOutput) ?? null;
  } catch (error) {
    logger.warn({ error, ...params }, "Coverage review failed");
    return null;
  }

  if (!output) return null;

  const finding: CoverageFinding = {
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

  await recordCoverageFinding(params.requestId, params.captureId, finding);

  // A named shortfall is the one coverage outcome worth an email: it is a
  // specific, cheap thing the operator can do. "Covers the scene" needs no
  // message -- the assessment simply proceeds -- and an unnamed shortfall is
  // nothing they could act on. Queued through the outbox so it survives a crash.
  if (!finding.coversScene && finding.missingCoverage.length) {
    try {
      const snap = await db?.collection("inboundRequests").doc(params.requestId).get();
      const contact = (snap?.data()?.contact as { email?: string; firstName?: string } | undefined) ?? undefined;
      if (contact?.email) {
        await commitTaskUpdate({
          requestId: params.requestId,
          to: contact.email,
          kind: "coverage_shortfall",
          subject: "Blueprint — one more view would finish your capture",
          body:
            `${emailGreeting(contact.firstName)}\n\n`
            + (finding.supplementWouldFinish
              ? "Your footage shows the task clearly. To finish the scene we just need a little more:\n\n"
              : "Your footage needs more coverage before we can build the scene:\n\n")
            + finding.missingCoverage.map((view) => `- ${view}`).join("\n")
            + "\n\nYou can add these from the same capture link — no need to film it all again.\n\n"
            + EMAIL_SIGN_OFF,
        });
        await deliverOutbox({ limit: 5 }).catch(() => undefined);
      }
    } catch (error) {
      logger.warn({ error, requestId: params.requestId }, "Could not queue a coverage-shortfall email");
    }
  }

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
): Promise<void> {
  if (!db) return;
  try {
    await db
      .collection("inboundRequests")
      .doc(requestId)
      .set(
        {
          capture_coverage: {
            capture_id: captureId,
            covers_scene: finding.coversScene,
            missing_coverage: finding.missingCoverage,
            supplement_would_finish: finding.supplementWouldFinish,
            unreadable_reasons: finding.unreadableReasons,
            confidence: finding.confidence,
            reviewed_at_iso: new Date().toISOString(),
            reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
  } catch (error) {
    logger.warn({ error, requestId }, "Could not record a coverage finding");
  }
}

/**
 * The stored finding, as the readiness model wants it.
 *
 * `assessReadiness` takes an `EvidenceOnFile`, and until now every caller built
 * one from adjacent facts. This is the reader that makes those two call sites
 * report what was measured instead of what was assumed.
 *
 * Absent is not `coversScene: false`. A submission nobody has reviewed for
 * coverage is one we do not know about, and the caller decides what to do with
 * that -- which for the supply query means falling back to "a scene exists,
 * therefore coverage sufficed", and for the operator means saying nothing yet
 * rather than naming views we never looked for.
 */
export function coverageEvidenceFrom(request: {
  capture_coverage?: {
    covers_scene?: boolean | null;
    missing_coverage?: string[] | null;
    supplement_would_finish?: boolean | null;
  } | null;
}): { coversScene: boolean; missingCoverage: string[] } | null {
  const stored = request.capture_coverage;
  if (!stored || typeof stored.covers_scene !== "boolean") return null;
  return {
    coversScene: stored.covers_scene,
    missingCoverage: Array.isArray(stored.missing_coverage) ? stored.missing_coverage : [],
  };
}
