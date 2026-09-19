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
import {
  REQUESTED_ITEM_SHOTS,
  deriveItemInventory,
  getItemInventory,
  presentInventory,
  removeItem,
  saveItemInventory,
  upsertItem,
} from "../utils/taskItemInventory";
import { gateFields } from "../../client/src/data/siteTaskQualification";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";
import {
  projectTaskStatus,
  taskStatusInputFrom,
} from "../utils/taskStatusProjection";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { commitTaskUpdate } from "../utils/taskUpdateCommitment";
import { deliverOutbox } from "../utils/captureOutbox";
import { storedCaptureMarkerExists } from "../utils/captureParts";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { sendFilmLinkHandoff } from "../utils/filmLinkHandoff";

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
// Every label is a still thing to point a camera at, never an action to film.
// The reconstruction fuses many frames of a *static* scene; a person or a moving
// object mid-pass becomes a ghost in the result, so the job's motion is settled
// from the brief, not from filming it happening. What to film is where the job
// lives, not the job being done.
const SHOT_LABELS: Record<string, string> = {
  sceneStability: "The equipment and layout, so we can see what is fixed in place",
  taskShape: "Where the job starts and where it ends — the spots, with nothing moving through them",
  objectVariety: "The different items this task handles, if they vary",
  accessWindow: "The space around the station, and how someone gets to it",
  humanProximity: "Where people usually stand or pass — the spots, with no one in frame",
  cycleTime: "The whole stretch the job runs across, end to end, with it stopped",
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

/**
 * What a film-scope link is shown.
 *
 * A film link is a forwardable credential: the owner hands it to whoever is
 * on the floor, and from there we do not control who holds it. The
 * proposed/unresolved lists are our reading of the OPERATOR's screening
 * answers — business facts the filmer has no need of and should not receive
 * just because the link got forwarded. What a filmer needs is the shot list,
 * the mode, and the one-line task. The owner payload keeps everything.
 */
function presentBriefForFilming(brief: SiteTaskBriefRecord) {
  return {
    summary: brief.summary,
    shotList: shotListFor(brief),
    captureMode: brief.captureMode,
  };
}

router.get("/:token", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({
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
    // against, not a button that would 403. The film payload is also filtered:
    // our reading of the operator's answers stays with the owner's link.
    return res.status(200).json({
      ready: true,
      scope: payload.scope,
      brief:
        payload.scope === "owner" ? presentBrief(brief) : presentBriefForFilming(brief),
    });
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
    return res.status(404).json({ error: "That link is not valid any more.", code: "capture_token_invalid" });
  }
  if (payload.scope !== "owner") {
    return res.status(403).json({
      error: "Only the site operator's own link can create a record-only link for someone else.",
      code: "capture_token_film_only",
    });
  }
  return res.status(200).json({ ok: true, filmUrl: captureUploadUrlFor(payload.requestId, "film") });
});

/** An owner link can hand the film link to a few people, not spam a number. */
const MAX_HANDOFF_SENDS = 25;

const filmLinkSendSchema = z
  .object({
    channel: z.enum(["email", "sms"]),
    to: z.string().trim().min(3).max(320),
  })
  .strict();

/**
 * Send the record-only link straight to whoever is doing the filming.
 *
 * The common shape once outreach is involved: the person we reach is a site ops
 * lead at a desk, and the person who can actually walk the floor with a phone is
 * someone else. This turns the manual copy-and-forward into one step — the owner
 * enters a number or an email and we deliver the film-scoped link with a
 * one-line instruction.
 *
 * Owner scope only, like minting the link itself. The message is fixed and
 * carries only the link and the task, so this cannot be driven into sending
 * arbitrary content; a per-request cap bounds how many destinations one link can
 * reach. SMS is best effort: Twilio is not part of this repo's approved primary
 * stack and is unconfigured by default, so when it is off this says so plainly
 * and returns the link to share rather than pretending to have texted it. Email
 * always works.
 */
router.post("/:token/film-link/send", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "That link is not valid any more.", code: "capture_token_invalid" });
  }
  if (payload.scope !== "owner") {
    return res.status(403).json({
      error: "Only the site operator's own link can send a record-only link to someone else.",
      code: "capture_token_film_only",
    });
  }

  const parsed = filmLinkSendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "That request is invalid", code: "film_link_send_invalid" });
  }
  const { channel, to } = parsed.data;

  // Check the relay cap before sending; the counter is incremented only on a
  // successful send below, so a config error or a bad number does not burn a
  // slot. A race could let a few extra through, which is fine: this is a soft
  // abuse bound, not a security control.
  const requestRef = db ? db.collection("inboundRequests").doc(payload.requestId) : null;
  if (requestRef) {
    try {
      const snap = await requestRef.get();
      const sends = Number(
        (snap.data() as { site_capture_handoff_sends?: number } | undefined)?.site_capture_handoff_sends ?? 0,
      );
      if (sends >= MAX_HANDOFF_SENDS) {
        return res.status(429).json({
          error: "This capture has shared its link with a lot of people already. Copy the link and send it directly.",
          code: "handoff_send_limit",
        });
      }
    } catch (error) {
      logger.warn({ error, requestId: payload.requestId }, "Could not read the handoff send counter; sending anyway");
    }
  }

  const requestId = payload.requestId;
  const brief = await getBrief(requestId).catch(() => null);

  let result;
  try {
    result = await sendFilmLinkHandoff({ requestId, channel, to, taskSummary: brief?.summary ?? null });
  } catch (error) {
    logger.error({ error, requestId, channel }, "Could not send the film-link handoff");
    return res.status(502).json({
      ok: false,
      code: "handoff_failed",
      error: "That could not be sent. Copy the link and share it directly.",
      filmUrl: captureUploadUrlFor(requestId, "film"),
    });
  }

  if (result.sent) {
    // Count only a successful send against the relay cap, so a config error or
    // a bad number never burns a slot.
    if (requestRef) {
      try {
        await requestRef.set(
          { site_capture_handoff_sends: admin.firestore.FieldValue.increment(1) },
          { merge: true },
        );
      } catch (error) {
        logger.warn({ error, requestId }, "Could not increment the handoff send counter");
      }
    }
    return res.status(200).json({ ok: true, channel, sent: true });
  }

  // A bad destination or a channel that is off. Bad input is a 400; a channel
  // being unavailable is a 503, and either way the link comes back to share.
  const status =
    result.code === "sms_unavailable" || result.code === "email_unavailable" ? 503 : 400;
  const messages: Record<string, string> = {
    invalid_email: "That does not look like an email address.",
    invalid_number: "Enter the number in full international form, like +15551234567.",
    sms_send_failed: "We could not text that number. Check it, or send it by email instead.",
    sms_unavailable: "Text messaging is not set up here yet. Send it by email, or copy the link and share it.",
    email_unavailable: "We could not send that email right now. Copy the link and share it directly.",
  };
  return res.status(status).json({
    ok: false,
    code: result.code,
    error: messages[result.code ?? ""] || "That could not be sent. Copy the link and share it directly.",
    filmUrl: result.filmUrl,
  });
});

router.post("/:token/confirm", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({
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
    return res.status(404).json({ error: "That link is not valid any more.", code: "capture_token_invalid" });
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

    // The same object the extractor reads: the one truth about whether a
    // recording landed. Unreadable counts as absent here — the honest answer
    // below it ("film the work area") is wrong only when this said true.
    let hasStoredCapture = false;
    if (storageAdmin) {
      try {
        const bucketName =
          process.env.FIREBASE_STORAGE_BUCKET?.trim() || "blueprint-8c1ca.appspot.com";
        const rawPrefix = `scenes/${payload.sceneId}/captures/${payload.captureId}/raw`;
        hasStoredCapture = await storedCaptureMarkerExists(
          storageAdmin.bucket(bucketName) as never,
          rawPrefix,
        );
      } catch (error) {
        logger.warn(
          { error, requestId: payload.requestId },
          "Could not check for a stored capture; status will not claim one",
        );
      }
    }

    const status = projectTaskStatus(
      taskStatusInputFrom({
        site_task_brief_confirmed_at: request?.site_task_brief_confirmed_at,
        capture_coverage: request?.capture_coverage ?? null,
        site_task_next_update_iso: request?.site_task_next_update_iso ?? null,
        briefDrafted: Boolean(brief),
        hasStoredCapture,
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

/* ------------------------------------------------------- task item inventory */

/**
 * The objects the robot has to handle, so the Pipeline can build sim-ready
 * versions of them rather than only the room.
 *
 * A walkthrough gives us the scene. It does not give us the tote a robot grasps
 * or the cartons it stacks -- and those are frequently filmed clear, because a
 * clear work area is the honest thing to capture. So we list the items and ask
 * for a few example photos of each. We suggest what we can read out of the task
 * description; the operator corrects and completes the list.
 *
 * Declaring an item is an operating statement about the site, so mutations need
 * an owner link -- the same boundary the brief confirmation draws. Reading is
 * open to any valid link, and photographing the items (on the uploads route) is
 * capture a film-only colleague can do.
 */
const itemSchema = z
  .object({
    /** Present when editing an existing item; absent to add a new one. */
    itemId: z.string().trim().max(120).optional(),
    label: z.string().trim().min(1).max(120),
    locationNote: z.string().trim().max(400).optional(),
    quantityHint: z.string().trim().max(120).optional(),
  })
  .strict();

/** The item list, seeded from the brief the first time it is read. */
router.get("/:token/items", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ ready: false, error: "This link is not valid or has expired." });
  }

  try {
    let inventory = await getItemInventory(payload.requestId);
    if (!inventory) {
      // First read: propose items from the drafted brief so the operator starts
      // from a list to correct rather than a blank one to fill. Seeded once so
      // the suggestions are real items that can receive photos.
      const brief = await getBrief(payload.requestId).catch(() => null);
      inventory = deriveItemInventory({
        requestId: payload.requestId,
        taskSummary: brief?.summary ?? null,
      });
      await saveItemInventory(inventory);
    }
    return res.status(200).json({
      ok: true,
      scope: payload.scope,
      requestedShots: REQUESTED_ITEM_SHOTS,
      ...presentInventory(inventory),
    });
  } catch (error) {
    logger.error({ error, requestId: payload.requestId }, "Could not load the task item inventory");
    return res.status(503).json({ error: "The item list could not be loaded", code: "item_inventory_unavailable" });
  }
});

/** Add an item, or edit one. Owner scope: declaring an item is an attestation. */
router.post("/:token/items", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This link is not valid or has expired." });
  }
  if (payload.scope !== "owner") {
    return res.status(403).json({
      error:
        "This is a film-only link. Photographing the items is fine, but only an owner link can " +
        "change the item list.",
      code: "capture_token_film_only",
    });
  }

  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "That item is invalid", code: "item_invalid" });
  }

  try {
    const record = await upsertItem(payload.requestId, parsed.data);
    return res.status(200).json({ ok: true, scope: payload.scope, ...presentInventory(record) });
  } catch (error) {
    logger.error({ error, requestId: payload.requestId }, "Could not save a task item");
    return res.status(503).json({ error: "The item could not be saved", code: "item_inventory_unavailable" });
  }
});

/** Remove an item. Owner scope, same reason. */
router.delete("/:token/items/:itemId", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This link is not valid or has expired." });
  }
  if (payload.scope !== "owner") {
    return res.status(403).json({
      error: "This is a film-only link. Only an owner link can change the item list.",
      code: "capture_token_film_only",
    });
  }

  try {
    const record = await removeItem(payload.requestId, String(req.params.itemId || "").trim());
    return res.status(200).json({ ok: true, scope: payload.scope, ...presentInventory(record) });
  } catch (error) {
    logger.error({ error, requestId: payload.requestId }, "Could not remove a task item");
    return res.status(503).json({ error: "The item could not be removed", code: "item_inventory_unavailable" });
  }
});

export default router;
