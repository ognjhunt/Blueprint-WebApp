/**
 * The brief an operator reads, and the confirmation that makes it binding.
 *
 * ## Why the signed capture link is the credential here too
 *
 * There is no account, deliberately. The same signed link that opens the camera
 * opens the brief, because they are two things the same person does about the
 * same submission, and a password between them would be a toll on someone who
 * has already proved they hold the link we sent to their address.
 *
 * That is also why this route never takes a request id directly: the token
 * names the submission, and a caller cannot ask about one they were not sent.
 *
 * ## What a confirmation is
 *
 * An attestation. `confirmBrief` writes the gate answers as `operator_stated`,
 * which is the provenance that lets a verdict stand — so this is the one call
 * on the site side that can move a submission from "our reading of your
 * evidence" to "your answers". It is the replacement for the six-question
 * screen, and it is a smaller act because we did the reading first.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { logger } from "../logger";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import {
  confirmBrief,
  getBrief,
  type SiteTaskBriefRecord,
} from "../utils/siteTaskBrief";
import { gateFields } from "../../client/src/data/siteTaskQualification";

const router = Router();

/** The gate ids a client is allowed to answer. Anything else is ignored. */
const GATE_IDS = new Set(gateFields.map((field) => field.id));

const confirmSchema = z
  .object({
    /** Who is confirming. An attestation with nobody behind it is not one. */
    confirmedBy: z.string().trim().min(1).max(200),
    /** Corrections, keyed by gate id. */
    answers: z.record(z.string().trim().max(200)).optional(),
    /** Gates they do not know. Recorded as outstanding, never looped on. */
    unknown: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
  })
  .strict();

/**
 * What the operator is shown.
 *
 * Deliberately omits nothing about our own reasoning: each proposed answer
 * carries what it rests on and why we read it that way, because an answer the
 * operator cannot see the basis of is one they cannot meaningfully correct.
 */
function presentBrief(brief: SiteTaskBriefRecord) {
  return {
    summary: brief.summary,
    captureMode: brief.captureMode,
    proposed: brief.proposed.map((answer) => ({
      fieldId: answer.fieldId,
      value: answer.value,
      basis: answer.basis,
      reading: answer.reading,
    })),
    unresolved: brief.unresolved,
    draftedFrom: brief.draftedFrom,
    confirmedAtIso: brief.confirmedAtIso,
  };
}

router.get("/:token", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(401).json({
      error: "That link is not valid any more.",
      code: "capture_token_invalid",
    });
  }

  try {
    const brief = await getBrief(payload.requestId);
    if (!brief) {
      // Not an error. It means we have not read the submission yet, and saying
      // so beats a 404 that reads as "your submission is gone".
      return res.status(200).json({
        ready: false,
        note: "We have not finished reading what you sent. This page will have a draft shortly.",
      });
    }
    return res.status(200).json({ ready: true, brief: presentBrief(brief) });
  } catch (error) {
    logger.error({ error, requestId: payload.requestId }, "Could not load a task brief");
    return res.status(503).json({
      error: "The brief could not be loaded",
      code: "task_brief_unavailable",
    });
  }
});

router.post("/:token/confirm", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(401).json({
      error: "That link is not valid any more.",
      code: "capture_token_invalid",
    });
  }

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "That confirmation could not be read.",
      code: "task_brief_confirmation_invalid",
    });
  }

  // Unknown gate ids are dropped rather than rejected. A client sending a field
  // we retired should not fail a confirmation over it, and `confirmBrief`
  // ignores them anyway -- this just keeps the stored record honest about what
  // was actually accepted.
  const answers: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(parsed.data.answers ?? {})) {
    if (GATE_IDS.has(fieldId) && value) answers[fieldId] = value;
  }

  try {
    const result = await confirmBrief({
      requestId: payload.requestId,
      confirmedBy: parsed.data.confirmedBy,
      operatorAnswers: answers,
      operatorUnknown: (parsed.data.unknown ?? []).filter((id) => GATE_IDS.has(id)),
    });

    if (!result) {
      return res.status(404).json({
        error: "There is no brief to confirm for that submission yet.",
        code: "task_brief_missing",
      });
    }

    return res.status(200).json({
      ok: true,
      // The verdict, and what it means for them next. Both, because a
      // disposition on its own tells an operator nothing they can act on.
      disposition: result.disposition,
      stage: result.readiness.stage,
      nextAction: result.readiness.nextAction,
      stillNeeded: result.readiness.blockingEvaluation,
      beforeRecording: result.readiness.blockingCapture,
    });
  } catch (error) {
    logger.error(
      { error, requestId: payload.requestId },
      "Could not confirm a task brief",
    );
    return res.status(503).json({
      error: "The confirmation could not be recorded",
      code: "task_brief_confirm_unavailable",
    });
  }
});

export default router;
