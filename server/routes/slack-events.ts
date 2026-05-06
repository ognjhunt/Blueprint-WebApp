import crypto from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";

import { logger } from "../logger";
import { evaluateSlackHumanReplySurface } from "../utils/human-reply-slack";
import { ingestHumanReplyPayload } from "../utils/human-reply-worker";
import { buildSlackThreadCorrelationId } from "../utils/human-reply-routing";

const router = Router();

type SlackEventRequest = Request & {
  rawBody?: string;
};

const slackEnvelopeSchema = z.object({
  type: z.string().trim().min(1),
  token: z.string().optional(),
  challenge: z.string().optional(),
  team_id: z.string().optional(),
  api_app_id: z.string().optional(),
  event: z.record(z.string(), z.unknown()).optional(),
  event_id: z.string().optional(),
  event_time: z.number().optional(),
});

function timingSafeEqualString(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifySlackSignature(req: SlackEventRequest) {
  const signingSecret = String(process.env.SLACK_SIGNING_SECRET || "").trim();
  if (!signingSecret) {
    return { ok: true, reason: null };
  }

  const timestamp = String(req.header("x-slack-request-timestamp") || "").trim();
  const signature = String(req.header("x-slack-signature") || "").trim();
  const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body ?? {});

  if (!timestamp || !signature || !rawBody) {
    return { ok: false, reason: "Missing Slack signature headers or raw body." };
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) {
    return { ok: false, reason: "Slack request timestamp is outside the allowed window." };
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  if (!timingSafeEqualString(expected, signature)) {
    return { ok: false, reason: "Slack request signature did not match." };
  }

  return { ok: true, reason: null };
}

function isHumanReplyCandidate(event: Record<string, unknown>) {
  const type = String(event.type || "").trim();
  const subtype = String(event.subtype || "").trim();
  const text = String(event.text || "").trim();
  const user = String(event.user || "").trim();

  if (type !== "message") {
    return false;
  }
  if (subtype || !text || !user) {
    return false;
  }
  return true;
}

async function maybeIngestSlackReply(
  envelope: z.infer<typeof slackEnvelopeSchema>,
) {
  const event = envelope.event;
  if (!event || !isHumanReplyCandidate(event)) {
    return { ingested: false, reason: "ignored_event_type" as const };
  }

  const text = String(event.text || "");
  const channel = String(event.channel || "").trim();
  const channelType = String(event.channel_type || "").trim() || null;
  const ts = String(event.ts || "").trim();
  const threadTs = String(event.thread_ts || "").trim();
  const user = String(event.user || "").trim();

  if (!channel || !ts || !text) {
    return { ingested: false, reason: "missing_message_fields" as const };
  }

  const surface = evaluateSlackHumanReplySurface({
    channel,
    channelType,
    threadTs: threadTs || null,
  });
  if (!surface.accepted) {
    return { ingested: false, reason: surface.reason };
  }

  const ingestResult = await ingestHumanReplyPayload({
    channel: "slack",
    external_message_id: ts,
    external_thread_id: buildSlackThreadCorrelationId(channel, threadTs || ts),
    sender: user,
    recipient: channel,
    subject: null,
    body: text,
    received_at:
      typeof envelope.event_time === "number"
        ? new Date(envelope.event_time * 1000).toISOString()
        : new Date().toISOString(),
  });

  return {
    ingested: Boolean(ingestResult.processed),
    reason: ingestResult.processed ? "processed" : ingestResult.reason,
  };
}

router.post("/events", async (req: SlackEventRequest, res: Response) => {
  const verification = verifySlackSignature(req);
  if (!verification.ok) {
    return res.status(401).json({ error: verification.reason || "Unauthorized" });
  }

  const parsed = slackEnvelopeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Slack event payload" });
  }

  const payload = parsed.data;
  if (payload.type === "url_verification" && payload.challenge) {
    return res.status(200).type("text/plain").send(payload.challenge);
  }

  if (payload.type === "event_callback") {
    try {
      const result = await maybeIngestSlackReply(payload);
      logger.info(
        {
          slackEventId: payload.event_id || null,
          slackEventType: payload.event?.type || null,
          ingested: result.ingested,
          reason: result.reason,
        },
        "Processed Slack event callback",
      );
      return res.status(200).json({ ok: true });
    } catch (error) {
      logger.error({ err: error }, "Failed to process Slack event callback");
      return res.status(500).json({ error: "Failed to process Slack event callback" });
    }
  }

  return res.status(200).json({ ok: true, ignored: true });
});

export default router;
