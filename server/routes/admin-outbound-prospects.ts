/**
 * Running an outbound beta, by hand, on purpose.
 *
 * Record a facility we chose, list what we have, draft the email, send it, and
 * convert a reply into an ordinary inbound request. No discovery crawler, no
 * sequences, no reply classifier, no UI. Twenty facilities can be picked by a
 * person and twenty replies read by a person, and doing it that way first is
 * how you find out what an agent should eventually do. A discovery machine
 * built before anyone has hand-written twenty of these would be automating
 * something nobody has produced once.
 *
 * The send path deliberately goes through `executeAction` rather than calling
 * the mailer, because that is where suppression, the CAN-SPAM footer, content
 * checks, the idempotency ledger and daily caps already live. Outbound gets
 * those by joining the existing lane, not by reimplementing them -- including
 * that lane's approval queue, which is what actually releases the message.
 *
 * `OUTBOUND_PROSPECT_POLICY` never auto-approves. A person reads every cold
 * email in the beta before it leaves.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { hasAnyRole } from "../utils/access-control";
import { executeAction } from "../agents/action-executor";
import { runAgentTask } from "../agents/runtime";
import type {
  OutboundOutreachInput,
  OutboundOutreachOutput,
} from "../agents/tasks/outbound-outreach";
import { OUTBOUND_PROSPECT_POLICY } from "../agents/action-policies";
import {
  buildUnsubscribeUrl,
  normalizeSuppressionEmail,
  recordEmailSuppression,
} from "../utils/email-suppression";
import {
  bindingGateFieldIds,
  isCaptureMode,
  preferredCaptureMode,
} from "../../client/src/data/siteTaskQualification";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import { decideCaptureDispatch, describeCaptureDispatch } from "../utils/captureDispatch";
import {
  convertProspectToRequestPayload,
  guardProspectSend,
  type OutboundProspect,
} from "../utils/outboundProspects";

const router = Router();
const COLLECTION = "outboundProspects";

const observationSchema = z.object({
  claim: z.string().trim().min(1).max(240),
  source: z.string().trim().min(1).max(500),
});

const createSchema = z
  .object({
    facilityName: z.string().trim().min(1).max(200),
    facilityAddress: z.string().trim().min(1).max(300),
    contactEmail: z.string().trim().email().max(254),
    observations: z.array(observationSchema).min(1).max(8),
    hypothesisedTask: z.string().trim().min(1).max(1200),
    inferredGates: z.record(z.string().trim().max(60)).default({}),
    reasonForContact: z.string().trim().min(1).max(400),
  })
  .strict();

const draftSchema = z
  .object({
    subject: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2200),
  })
  .strict();

const closeSchema = z
  .object({
    reason: z.string().trim().min(1).max(400),
  })
  .strict();

const convertSchema = z
  .object({
    statedGates: z.record(z.string().trim().max(60)),
    taskStatement: z.string().trim().min(1).max(4000),
    captureMode: z.enum(["self_capture", "site_visit"]).optional(),
  })
  .strict();

async function requireOps(res: Response) {
  return hasAnyRole(res, ["admin", "ops"]);
}

async function readProspect(prospectId: string): Promise<OutboundProspect | null> {
  if (!db) return null;
  const snapshot = await db.collection(COLLECTION).doc(prospectId).get();
  if (!snapshot.exists) return null;
  return { prospectId: snapshot.id, ...(snapshot.data() as Omit<OutboundProspect, "prospectId">) };
}

/** Record a facility someone chose, with the sources behind the choice. */
router.post("/", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Prospect is invalid", code: "prospect_invalid" });
  }

  const prospectId = randomUUID();
  // Every gate we filled in ourselves is inferred by definition. Recording that
  // here rather than at send time means there is no path where a guess enters
  // the funnel wearing an operator's provenance.
  const gateAnswerSources = Object.fromEntries(
    Object.keys(parsed.data.inferredGates).map((fieldId) => [fieldId, "inferred" as const]),
  );

  const prospect: OutboundProspect = {
    prospectId,
    ...parsed.data,
    contactEmail: normalizeSuppressionEmail(parsed.data.contactEmail),
    gateAnswerSources,
    stage: "drafted",
    createdAtIso: new Date().toISOString(),
    contactedAtIso: null,
  };

  const { prospectId: _id, ...stored } = prospect;
  await db.collection(COLLECTION).doc(prospectId).set(stored);
  return res.status(201).json({ ok: true, prospect });
});

router.get("/", async (_req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const snapshot = await db.collection(COLLECTION).limit(200).get();
  const prospects = snapshot.docs.map((doc) => ({ prospectId: doc.id, ...doc.data() }));
  return res.json({ ok: true, prospects });
});

/**
 * Draft the email, without sending it.
 *
 * Separate from `/send` on purpose. The agent proposes; a person reads, edits
 * and then approves that exact text by posting it back. One route that drafted
 * and sent would mean nobody ever saw what went out, which is the failure mode
 * an outbound beta exists to avoid.
 */
router.post("/:prospectId/draft", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  // Checked before spending a model call: a prospect with no sourced
  // observations has nothing specific to say, and a generic cold email is
  // worse than none -- it burns the address and teaches nothing.
  const guard = await guardProspectSend(prospect);
  if (!guard.send && guard.blocker !== "already_contacted") {
    return res.status(409).json({ ok: false, blocker: guard.blocker, detail: guard.detail });
  }

  try {
    const result = await runAgentTask<OutboundOutreachInput, OutboundOutreachOutput>({
      kind: "outbound_outreach",
      input: {
        prospectId,
        facilityName: prospect.facilityName,
        facilityAddress: prospect.facilityAddress,
        observations: prospect.observations,
        hypothesisedTask: prospect.hypothesisedTask,
        inferredGates: prospect.inferredGates,
      },
      session_key: `outbound:${prospectId}`,
      metadata: { prospect_id: prospectId },
    });

    if (result.status !== "completed" || !result.output) {
      return res.status(502).json({ error: result.error || "Draft could not be written" });
    }

    return res.json({
      ok: true,
      draft: result.output,
      note: "Read this before sending. Every factual claim should trace to one of the observations.",
    });
  } catch (error) {
    logger.error({ error, prospectId }, "Outbound outreach draft failed");
    return res.status(502).json({ error: "Draft could not be written" });
  }
});

/**
 * Send the approved draft.
 *
 * The draft arrives in the request body rather than being generated here: a
 * person has read it, possibly edited it, and is now approving that exact text.
 * Generating and sending in one call would mean nobody ever saw what went out.
 *
 * Note that this **queues**. `OUTBOUND_PROSPECT_POLICY.alwaysHumanReview` puts
 * every send at tier 3, so `executeAction` writes a ledger entry and returns
 * `pending_approval`; the mailer is not called until someone releases it at
 * `/api/admin/leads/action-queue/:ledgerId/approve`. The response says so
 * outright, because an operator who reads a 202 as "sent" would conclude that
 * twenty facilities ignored them when in fact nothing was ever sent.
 */
router.post("/:prospectId/send", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Draft is invalid", code: "draft_invalid" });
  }

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  const guard = await guardProspectSend(prospect);
  if (!guard.send) {
    // A refusal is a real outcome worth reading, not a transport error.
    return res.status(409).json({ ok: false, blocker: guard.blocker, detail: guard.detail });
  }

  const unsubscribeUrl = buildUnsubscribeUrl({
    email: guard.email,
    scope: "growth_campaign",
    campaignId: `outbound_prospect_${prospectId}`,
  });

  try {
    const action = await executeAction({
      sourceCollection: COLLECTION,
      sourceDocId: prospectId,
      actionType: "send_email",
      actionPayload: {
        type: "send_email",
        to: guard.email,
        subject: parsed.data.subject,
        body: parsed.data.body,
        commercialEmail: true,
        emailSuppressionScope: "growth_campaign",
        unsubscribeUrl,
        sendGridCategories: ["blueprint_outbound_prospect"],
      },
      safetyPolicy: OUTBOUND_PROSPECT_POLICY,
      draftOutput: {
        recommendation: "outbound_prospect_touch",
        confidence: 0.5,
        // Always true for this lane. Stated here as well so the record of why
        // it needed a person survives independently of the policy object.
        requires_human_review: true,
        category: "outbound_prospect",
        facility_name: prospect.facilityName,
        reason_for_contact: prospect.reasonForContact,
      },
      idempotencyKey: `outbound_prospect_send:${prospectId}`,
    });

    if (db) {
      await db.collection(COLLECTION).doc(prospectId).set(
        { stage: "contacted", contactedAtIso: new Date().toISOString() },
        { merge: true },
      );
    }

    // `alwaysHumanReview` means this is queued, not sent. Saying so in the
    // response -- with the exact route that releases it -- is the difference
    // between a beta that sent twenty emails and one where the operator
    // believed they had. A 202 alone reads like "sent".
    const pending = action.state === "pending_approval";

    return res.status(202).json({
      ok: true,
      action,
      sent: !pending,
      ...(pending
        ? {
            nextStep: `Not sent yet. Release it with POST /api/admin/leads/action-queue/${action.ledgerDocId}/approve (admin role required).`,
          }
        : {}),
    });
  } catch (error) {
    logger.error({ error, prospectId }, "Outbound prospect send failed");
    return res.status(502).json({ error: "The send did not complete" });
  }
});

/**
 * A reply, turned into an ordinary inbound request.
 *
 * Only the gates the operator actually addressed become `operator_stated`.
 * Everything they did not mention stays inferred and continues to hold capture
 * dispatch, so a warm reply cannot silently ratify five guesses.
 */
router.post("/:prospectId/convert", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const parsed = convertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Conversion is invalid", code: "conversion_invalid" });
  }

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  const payload = convertProspectToRequestPayload({
    prospect,
    statedGates: parsed.data.statedGates,
    taskStatement: parsed.data.taskStatement,
    captureMode: parsed.data.captureMode ?? null,
  });

  // Run the real decision rather than describing it. The operator's next move
  // is a follow-up email, and what that email should ask is exactly the hold
  // reason: "still resting on sceneStability, accessWindow" is two questions,
  // where "some gates remain inferred" is a shrug. Same functions the inbound
  // path uses, so the preview cannot disagree with the eventual dispatch.
  const captureMode = isCaptureMode(payload.captureMode) ? payload.captureMode : preferredCaptureMode;
  const triage = triageGateAnswers(payload.siteTaskGates, undefined, captureMode);
  const dispatch = decideCaptureDispatch({
    disposition: triage.disposition,
    captureMode,
    unanswered: triage.unanswered,
    bindingFieldIds: bindingGateFieldIds(captureMode),
    gateAnswerSources: payload.gateAnswerSources,
  });

  await db.collection(COLLECTION).doc(prospectId).set({ stage: "converted" }, { merge: true });

  // Returned rather than posted onward: during the beta a person carries this
  // into the intake so the conversion is observed at least twenty times before
  // anything does it unattended.
  return res.status(200).json({
    ok: true,
    requestPayload: payload,
    dispatch,
    dispatchSummary: describeCaptureDispatch(dispatch),
    note: "Gates the operator did not state remain inferred and will hold capture dispatch.",
  });
});

/**
 * They asked us to stop.
 *
 * The one route an outbound program cannot be run without. A footer
 * unsubscribe link handles the person who clicks it; almost nobody does. What
 * actually arrives is a one-line reply saying take us off your list, read by a
 * person, and without somewhere to put it that request lives in someone's
 * memory until it does not.
 *
 * So closing writes the suppression entry, not just the stage. Suppression is
 * scoped to `growth_campaign`, which is the promise being made: we will not
 * approach you again. If this facility later becomes a customer, the lifecycle
 * mail it has asked for is a different scope and is untouched.
 */
router.post("/:prospectId/close", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A reason is required to close a prospect", code: "close_invalid" });
  }

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  // Suppression first. If the stage write succeeded and this failed, the
  // prospect would look handled while still being sendable, which is the one
  // ordering that can produce a second email to someone who declined.
  const suppression = await recordEmailSuppression({
    email: prospect.contactEmail,
    scope: "growth_campaign",
    reason: parsed.data.reason,
    source: "outbound_prospect_close",
    campaignId: `outbound_prospect_${prospectId}`,
  });

  if (!suppression.persisted) {
    return res.status(503).json({
      error: "The opt-out could not be recorded, so the prospect stays open rather than looking handled.",
      code: "suppression_unavailable",
    });
  }

  await db.collection(COLLECTION).doc(prospectId).set(
    { stage: "closed", closedReason: parsed.data.reason, closedAtIso: new Date().toISOString() },
    { merge: true },
  );

  return res.json({ ok: true, stage: "closed", suppressedEmail: suppression.email });
});

export default router;
