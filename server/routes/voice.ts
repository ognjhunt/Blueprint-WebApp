import { Request, Response, Router } from "express";
import crypto from "node:crypto";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import {
  getElevenLabsConfig,
  getElevenLabsSignedUrl,
  synthesizeElevenLabsSpeech,
} from "../utils/elevenlabs";
import { getConfiguredEnvValue } from "../config/env";

const router = Router();

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function mirrorVoiceConversationToSupportQueue(params: {
  conversationId: string;
  message: string;
  responseText: string;
  category: string;
  handoffRequired: boolean;
  bookingUrl: string;
  supportEmail: string;
  pageContext: string | null;
  requestSource?: string | null;
  phone?: string | null;
}) {
  if (!db) {
    return;
  }

  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const supportRequestRef = db.collection("contactRequests").doc(params.conversationId);
  const existingSupportRequest = await supportRequestRef.get();

  await supportRequestRef.set(
    {
      name: "Voice concierge",
      email: "",
      company: "",
      city: "",
      state: "",
      companyWebsite: "",
      requestSource: params.requestSource || "voice_concierge",
      phone: params.phone || "",
      pageContext: params.pageContext,
      message: params.message,
      summary: params.responseText,
      voice_concierge: {
        conversation_id: params.conversationId,
        category: params.category,
        handoff_required: params.handoffRequired,
        booking_url: params.bookingUrl,
        support_email: params.supportEmail,
        last_user_message: params.message,
        last_response_text: params.responseText,
        page_context: params.pageContext,
      },
      ops_automation: {
        status: "pending",
        queue: "support_triage",
        intent: "support_triage",
        next_action: "triage voice concierge request",
        recommended_path: params.category,
        confidence: null,
        requires_human_review: params.handoffRequired || params.category === "booking",
        provider: null,
        runtime: null,
        model: null,
        tool_mode: null,
        execution_id: null,
        session_key: `support:${params.conversationId}`,
        last_error: null,
        last_attempt_at: null,
        processed_at: null,
      },
      human_review_required: params.handoffRequired || params.category === "booking",
      automation_confidence: null,
      updatedAt: timestamp,
      ...(existingSupportRequest.exists ? {} : { createdAt: timestamp }),
    },
    { merge: true },
  );
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function requestOrigin(req: Request) {
  const forwardedProto = normalizeText(req.header("x-forwarded-proto"));
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = normalizeText(req.header("x-forwarded-host")) || normalizeText(req.header("host"));
  return host ? `${protocol}://${host}` : getConfiguredEnvValue("VITE_PUBLIC_APP_URL") || "https://www.tryblueprint.io";
}

function validateTwilioSignature(req: Request) {
  const authToken = getConfiguredEnvValue("TWILIO_AUTH_TOKEN");
  if (!authToken) {
    return true;
  }

  const signature = normalizeText(req.header("x-twilio-signature"));
  if (!signature) {
    return false;
  }

  const baseUrl = `${requestOrigin(req)}${req.originalUrl.split("?")[0]}`;
  const params =
    req.body && typeof req.body === "object"
      ? Object.entries(req.body as Record<string, unknown>)
          .filter(([, value]) => typeof value === "string" || typeof value === "number")
          .sort(([left], [right]) => left.localeCompare(right))
      : [];
  const payload = `${baseUrl}${params.map(([key, value]) => `${key}${String(value)}`).join("")}`;
  const computed = crypto.createHmac("sha1", authToken).update(payload).digest("base64");

  const signatureBuffer = Buffer.from(signature);
  const computedBuffer = Buffer.from(computed);
  return (
    signatureBuffer.length === computedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, computedBuffer)
  );
}

function twimlResponse(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function buildTelephonyConversationId(callSid: string) {
  return callSid ? `call_${callSid}` : `call_${Date.now()}`;
}

async function persistTelephonyCall(params: {
  callSid: string;
  from: string;
  to: string;
  callerName: string | null;
  callStatus: string | null;
  message: string | null;
  responseText?: string | null;
  category?: string | null;
  handoffRequired?: boolean | null;
  bookingUrl?: string | null;
  supportEmail?: string | null;
}) {
  if (!db) {
    return;
  }

  await db.collection("voice_phone_calls").doc(params.callSid).set(
    {
      call_sid: params.callSid,
      from: params.from,
      to: params.to,
      caller_name: params.callerName,
      call_status: params.callStatus,
      message: params.message,
      response_text: params.responseText || null,
      category: params.category || null,
      handoff_required:
        typeof params.handoffRequired === "boolean" ? params.handoffRequired : null,
      booking_url: params.bookingUrl || null,
      support_email: params.supportEmail || null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function buildGuardrailedResponse(message: string) {
  const normalized = message.toLowerCase();
  const bookingUrl =
    getConfiguredEnvValue("BLUEPRINT_VOICE_BOOKING_URL") ||
    "https://calendly.com/blueprintar/30min";
  const supportEmail =
    getConfiguredEnvValue("BLUEPRINT_SUPPORT_EMAIL") || "hello@tryblueprint.io";

  if (/price|pricing|cost|quote|discount|contract/.test(normalized)) {
    return {
      responseText:
        "I can explain the exact-site hosted review flow, but I cannot quote pricing or commercial terms in voice. I can route you to the team or send you to the booking link.",
      handoffRequired: true,
      bookingUrl,
      supportEmail,
      category: "commercial_handoff",
    };
  }

  if (/privacy|legal|consent|rights|compliance|hipaa|gdpr|security/.test(normalized)) {
    return {
      responseText:
        "That topic needs a human follow-up because Blueprint keeps rights, privacy, and security commitments explicit. I can capture your request and route it for review.",
      handoffRequired: true,
      bookingUrl,
      supportEmail,
      category: "policy_handoff",
    };
  }

  if (/demo|book|schedule|talk|meeting|call/.test(normalized)) {
    return {
      responseText:
        "The clearest next step is to book an exact-site hosted review conversation. I can hand you the booking link now and note what site or workflow you care about.",
      handoffRequired: false,
      bookingUrl,
      supportEmail,
      category: "booking",
    };
  }

  if (/hosted review|hosted evaluation|exact site|world model|site package/.test(normalized)) {
    return {
      responseText:
        "Blueprint sells a grounded exact-site review path. That usually means one real facility, one workflow question, and a package plus hosted review surface tied to that site. If you want, I can send you to the booking step.",
      handoffRequired: false,
      bookingUrl,
      supportEmail,
      category: "product_explainer",
    };
  }

  return {
    responseText:
      "I can help with Blueprint's exact-site hosted review path, demo booking, and support routing. For pricing, legal, privacy, or custom commitments, I will escalate to a human operator.",
    handoffRequired: false,
    bookingUrl,
    supportEmail,
    category: "general",
  };
}

router.get("/agent/signed-url", async (_req, res) => {
  try {
    const result = await getElevenLabsSignedUrl();
    return res.status(HTTP_STATUS.OK).json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to create ElevenLabs signed URL");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create signed URL",
    });
  }
});

router.post("/support/respond", async (req, res) => {
  try {
    const message = normalizeText(req.body?.message);
    if (!message) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Message is required" });
    }

    const conversationId =
      normalizeText(req.body?.conversationId) || `voice_${Date.now()}`;
    const pageContext = normalizeText(req.body?.pageContext);
    const result = buildGuardrailedResponse(message);
    const voice = getElevenLabsConfig();
    let audio: { mimeType: string; audioBase64: string } | null = null;

    if (voice.configured) {
      try {
        audio = await synthesizeElevenLabsSpeech(result.responseText);
      } catch (error) {
        logger.warn({ err: error }, "Voice response generated without ElevenLabs audio");
      }
    }

    if (db) {
      await db.collection("voice_support_conversations").doc(conversationId).set(
        {
          conversation_id: conversationId,
          last_user_message: message,
          last_response_text: result.responseText,
          category: result.category,
          handoff_required: result.handoffRequired,
          booking_url: result.bookingUrl,
          support_email: result.supportEmail,
          page_context: pageContext || null,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      if (result.handoffRequired || result.category === "booking") {
        await db.collection("voice_support_queue").doc(conversationId).set(
          {
            conversation_id: conversationId,
            status: "new",
            category: result.category,
            handoff_required: result.handoffRequired,
            last_user_message: message,
            last_response_text: result.responseText,
            booking_url: result.bookingUrl,
            support_email: result.supportEmail,
            page_context: pageContext || null,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      await mirrorVoiceConversationToSupportQueue({
        conversationId,
        message,
        responseText: result.responseText,
        category: result.category,
        handoffRequired: result.handoffRequired,
        bookingUrl: result.bookingUrl,
        supportEmail: result.supportEmail,
        pageContext: pageContext || null,
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      ok: true,
      conversationId,
      responseText: result.responseText,
      handoffRequired: result.handoffRequired,
      bookingUrl: result.bookingUrl,
      supportEmail: result.supportEmail,
      audio,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to handle voice support response");
    return res
      .status(500)
      .json({ ok: false, error: "Failed to handle voice request" });
  }
});

export async function voiceWebhookHandler(req: Request, res: Response) {
  const configuredSecret = getConfiguredEnvValue("ELEVENLABS_WEBHOOK_SECRET");
  const providedSecret =
    normalizeText(req.header("x-blueprint-voice-secret"))
    || normalizeText(req.query.secret);

  if (configuredSecret && configuredSecret !== providedSecret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    if (db) {
      await db.collection("voice_support_webhooks").add({
        payload: req.body ?? {},
        received_at: admin.firestore.FieldValue.serverTimestamp(),
        source: "elevenlabs",
      });
    }

    return res.status(HTTP_STATUS.ACCEPTED).json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to persist ElevenLabs webhook");
    return res
      .status(500)
      .json({ ok: false, error: "Failed to persist webhook" });
  }
}

export async function telephonyInboundHandler(req: Request, res: Response) {
  if (!validateTwilioSignature(req)) {
    return res.status(401).type("text/plain").send("Unauthorized");
  }

  const callSid = normalizeText(req.body?.CallSid) || `call_${Date.now()}`;
  const from = normalizeText(req.body?.From);
  const to = normalizeText(req.body?.To) || getConfiguredEnvValue("TWILIO_PHONE_NUMBER") || "";
  const callerName = normalizeText(req.body?.CallerName) || null;
  const callStatus = normalizeText(req.body?.CallStatus) || null;
  const digits = normalizeText(req.body?.Digits);
  const speechResult = normalizeText(req.body?.SpeechResult);
  const gatheredMessage =
    digits === "1"
      ? "I want to book an exact-site hosted review."
      : digits === "2"
        ? "I need support for an existing exact-site package."
        : digits === "3"
          ? "I have a pricing or commercial question."
          : speechResult;
  const actionUrl = `${requestOrigin(req)}/api/voice/telephony/inbound`;

  if (!gatheredMessage) {
    await persistTelephonyCall({
      callSid,
      from,
      to,
      callerName,
      callStatus,
      message: null,
    });

    return res
      .type("text/xml")
      .send(
        twimlResponse(
          `<Gather input="speech dtmf" numDigits="1" timeout="4" speechTimeout="auto" action="${xmlEscape(actionUrl)}" method="POST">` +
            `<Say>Thanks for calling Blueprint. Say the exact site question you need help with, or press 1 to book a hosted review, 2 for support, or 3 for pricing and commercial help.</Say>` +
          `</Gather>` +
          `<Say>We did not receive input. Goodbye.</Say>`,
        ),
      );
  }

  const result = buildGuardrailedResponse(gatheredMessage);
  await persistTelephonyCall({
    callSid,
    from,
    to,
    callerName,
    callStatus,
    message: gatheredMessage,
    responseText: result.responseText,
    category: result.category,
    handoffRequired: result.handoffRequired,
    bookingUrl: result.bookingUrl,
    supportEmail: result.supportEmail,
  });
  await mirrorVoiceConversationToSupportQueue({
    conversationId: buildTelephonyConversationId(callSid),
    message: gatheredMessage,
    responseText: result.responseText,
    category: result.category,
    handoffRequired: result.handoffRequired,
    bookingUrl: result.bookingUrl,
    supportEmail: result.supportEmail,
    pageContext: "voice telephony inbound",
    requestSource: "voice_pstn",
    phone: from || null,
  });

  const forwardNumber = getConfiguredEnvValue("BLUEPRINT_VOICE_FORWARD_NUMBER");
  const responseBody =
    result.handoffRequired && forwardNumber
      ? `<Say>${xmlEscape(result.responseText)} Connecting you to a Blueprint operator now.</Say><Dial>${xmlEscape(forwardNumber)}</Dial>`
      : `<Say>${xmlEscape(result.responseText)}</Say><Say>Blueprint has logged this call and will follow up on the same exact-site question.</Say>`;

  return res.type("text/xml").send(twimlResponse(responseBody));
}

export async function telephonyStatusHandler(req: Request, res: Response) {
  if (!validateTwilioSignature(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const callSid = normalizeText(req.body?.CallSid);
  if (db && callSid) {
    await db.collection("voice_phone_call_events").add({
      call_sid: callSid,
      call_status: normalizeText(req.body?.CallStatus) || null,
      call_duration: normalizeText(req.body?.CallDuration) || null,
      recording_url: normalizeText(req.body?.RecordingUrl) || null,
      payload: req.body ?? {},
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return res.status(202).json({ ok: true });
}

export default router;
