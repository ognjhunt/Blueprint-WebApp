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
import { captureUploadUrlFor, verifyCaptureUploadToken } from "../utils/captureUploadToken";
import {
  confirmBrief,
  getBrief,
  type SiteTaskBriefRecord,
} from "../utils/siteTaskBrief";
import { gateFields } from "../../client/src/data/siteTaskQualification";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";
import {
  projectTaskStatus,
  taskStatusInputFrom,
} from "../utils/taskStatusProjection";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { commitTaskUpdate } from "../utils/taskUpdateCommitment";
import { deliverOutbox } from "../utils/captureOutbox";

const router = Router();

/** Just the fields status needs, so this route does not decrypt a whole lead. */
async function readRequestForStatus(requestId: string): Promise<{
  siteTaskGates?: Record<string, string> | null;
  site_task_brief_confirmed_at?: unknown;
  capture_coverage?: {
    covers_scene?: boolean | null;
    missing_coverage?: string[] | null;
    supplement_would_finish?: boolean | null;
  } | null;
  site_task_next_update_iso?: string | null;
  contactEmail?: string | null;
  contactFirstName?: string | null;
} | null> {
  if (!db) return null;
  const snap = await db.collection("inboundRequests").doc(requestId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  const contact = data.contact as { email?: string; firstName?: string } | undefined;
  return {
    siteTaskGates: (data.request as { siteTaskGates?: Record<string, string> } | undefined)?.siteTaskGates ?? null,
    site_task_brief_confirmed_at: data.site_task_brief_confirmed_at,
    capture_coverage: (data.capture_coverage as never) ?? null,
    site_task_next_update_iso: (data.site_task_next_update_iso as string | null) ?? null,
    contactEmail: typeof contact?.email === "string" ? contact.email : null,
    contactFirstName: typeof contact?.firstName === "string" ? contact.firstName : null,
  };
}

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
 * What to film, in the operator's terms.
 *
 * Derived from the gates the footage can actually settle (`settledByFootage`)
 * rather than from the whole gate list, because a shot list that included "when
 * would you want a robot running" would be asking somebody to point a camera at
 * a business decision.
 *
 * The first item is unconditional: every reconstruction needs the work area
 * whatever the gates say, and a list that could come back empty would leave the
 * camera screen with no instruction at all.
 */
function shotListFor(brief: SiteTaskBriefRecord): { id: string; label: string }[] {
  const items = [{ id: "work-area", label: "The whole work area, from a few steps back" }];

  for (const field of gateFields) {
    if (!field.settledByFootage) continue;
    const label = SHOT_LABELS[field.id];
    if (label) items.push({ id: field.id, label });
  }

  return items;
}

/**
 * One line per gate, phrased as a thing to point a camera at.
 *
 * Separate from the gate's own `question`, which is phrased for someone reading
 * a form. "Between shifts, how much does this work area change?" is not an
 * instruction anybody can act on while filming.
 */
const SHOT_LABELS: Record<string, string> = {
  sceneStability: "The equipment and layout, so we can see what is fixed in place",
  taskShape: "One complete cycle of the job, start to finish",
  objectVariety: "The different items this task handles, if they vary",
  accessWindow: "The space around the station, and how someone gets to it",
  humanProximity: "Where people stand or pass while the job runs",
  cycleTime: "The job at its normal pace, not sped up or demonstrated",
  lighting: "The area under its normal lighting",
};

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
    shotList: shotListFor(brief),
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
        scope: payload.scope,
        note: "We have not finished reading what you sent. This page will have a draft shortly.",
      });
    }
    // The scope travels with the brief so the client shows the confirm UI only
    // for an owner link -- a film-only colleague sees the shot list to record
    // against, not a button that would 403.
    return res.status(200).json({ ready: true, scope: payload.scope, brief: presentBrief(brief) });
  } catch (error) {
    logger.error({ error, requestId: payload.requestId }, "Could not load a task brief");
    return res.status(503).json({
      error: "The brief could not be loaded",
      code: "task_brief_unavailable",
    });
  }
});

/**
 * Mint a record-only link for a colleague, from an owner link.
 *
 * The least-privilege path the audit asked for: an owner who is handing the
 * filming to someone else gets a film-scoped link that can record, upload and
 * check status but cannot confirm the brief. Only an owner token can mint one --
 * a film link cannot widen itself or spawn more.
 *
 * The film token points at the same request and the same storage prefix, so a
 * colleague's upload lands exactly where the owner's would. What it lacks is the
 * attestation capability, and nothing else.
 */
router.get("/:token/film-link", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(401).json({ error: "That link is not valid any more.", code: "capture_token_invalid" });
  }
  if (payload.scope !== "owner") {
    return res.status(403).json({
      error: "Only the site operator's own link can create a record-only link for someone else.",
      code: "capture_token_film_only",
    });
  }
  return res.status(200).json({ ok: true, filmUrl: captureUploadUrlFor(payload.requestId, "film") });
});

router.post("/:token/confirm", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(401).json({
      error: "That link is not valid any more.",
      code: "capture_token_invalid",
    });
  }

  // Confirming the brief is an attestation, and a film-only link does not carry
  // the authority to make one. A colleague sent a narrowed link to record can
  // upload footage; they cannot state operating facts on the operator's behalf.
  if (payload.scope !== "owner") {
    return res.status(403).json({
      error:
        "This link is for recording only. Confirming the task brief has to be done from the "
        + "original link we sent the site's operator.",
      code: "capture_token_film_only",
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

    // A decision was reached, so commit to the next update and queue the email
    // that honours it -- through the outbox, so a crash between here and the
    // send does not lose it. Best-effort read of the contact: a missing email
    // means no message to send, not a failed confirmation.
    void (async () => {
      const request = await readRequestForStatus(payload.requestId).catch(() => null);
      if (!request?.contactEmail) return;
      const firstName = request.contactFirstName || "there";
      const decision = result.readiness.blockingCapture.length
        ? "We need a couple of details before you record."
        : "We can assess this task — a recording of the work area is the next step.";
      await commitTaskUpdate({
        requestId: payload.requestId,
        to: request.contactEmail,
        kind: result.readiness.blockingCapture.length ? "input_needed" : "brief_confirmed",
        subject: "Blueprint — we have your task brief",
        body:
          `Hi ${firstName},\n\n`
          + `Thanks for confirming the task brief. ${decision}\n\n`
          + `${result.readiness.nextAction}\n\n`
          + "You can come back to your task any time from the link we sent you. "
          + "We will email you when there is something new.\n\n"
          + "— The Blueprint Team",
      });
      // Deliver opportunistically on this request's own path, so notifications
      // do not depend on a scheduler being enabled in this deployment.
      await deliverOutbox({ limit: 5 }).catch(() => undefined);
    })();

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

/**
 * Where the task stands, for the account-free operator who filmed it.
 *
 * The signed link is the credential, same as the brief and the camera. This is
 * the status view the workspace cannot serve, because the workspace needs an
 * account and the person who followed a link from an email does not have one.
 *
 * It projects status through the same `projectTaskStatus` the workspace uses,
 * so the two surfaces cannot tell one operator "we can assess this" while
 * telling another "in review" about the same task.
 */
router.get("/:token/status", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(401).json({ error: "That link is not valid any more.", code: "capture_token_invalid" });
  }

  try {
    const [brief, request] = await Promise.all([
      getBrief(payload.requestId),
      readRequestForStatus(payload.requestId),
    ]);

    // The readiness stage, when we can compute it. Absent when there is no
    // brief yet, which `projectTaskStatus` reads as "received".
    let stage: ReturnType<typeof assessReadiness>["stage"] | null = null;
    if (brief) {
      const gates = (request?.siteTaskGates as Record<string, string> | null) ?? {};
      stage = assessReadiness({
        answers: gates,
        captureMode: brief.captureMode,
        briefDrafted: true,
        briefConfirmed: Boolean(request?.site_task_brief_confirmed_at),
        evidence: {
          hasAny: true,
          hasVisual: Boolean(request?.capture_coverage),
          explainsTask: true,
          coversScene: request?.capture_coverage?.covers_scene ?? false,
          missingCoverage: request?.capture_coverage?.missing_coverage ?? undefined,
        },
        reconstructed: false,
      }).stage;
    }

    const status = projectTaskStatus(
      taskStatusInputFrom({
        site_task_brief_confirmed_at: request?.site_task_brief_confirmed_at,
        capture_coverage: request?.capture_coverage ?? null,
        site_task_next_update_iso: request?.site_task_next_update_iso ?? null,
        briefDrafted: Boolean(brief),
        stage,
      }),
    );

    // Piggyback delivery on this poll, so a deployment with no scheduler still
    // sends. Never blocks or fails the status read.
    void deliverOutbox({ limit: 5 }).catch(() => undefined);

    return res.status(200).json({ ok: true, scope: payload.scope, status, summary: brief?.summary ?? null });
  } catch (error) {
    logger.error({ error, requestId: payload.requestId }, "Could not load task status");
    return res.status(503).json({ error: "The status could not be loaded", code: "task_status_unavailable" });
  }
});

export default router;
