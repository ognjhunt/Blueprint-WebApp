import { google } from "googleapis";

import {
  APPROVED_HUMAN_REPLY_EMAIL,
  DISALLOWED_HUMAN_REPLY_EMAIL,
  type HumanReplyChannel,
} from "./human-reply-routing";

type GmailReplyWatchStatus = {
  enabled: boolean;
  configured: boolean;
  approved_identity: string;
  mailbox_email: string | null;
  reason: string | null;
};

export type GmailReplyMessage = {
  channel: HumanReplyChannel;
  external_message_id: string;
  external_thread_id: string | null;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  body: string;
  received_at: string;
};

function trimValue(value: string | null | undefined) {
  return String(value || "").trim();
}

function getGmailOAuthConfig() {
  return {
    clientId: trimValue(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID),
    clientSecret: trimValue(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET),
    refreshToken: trimValue(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN),
    approvedEmail:
      trimValue(process.env.BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL) || APPROVED_HUMAN_REPLY_EMAIL,
  };
}

function getGmailOAuthClient() {
  const config = getGmailOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    return null;
  }

  const client = new google.auth.OAuth2(config.clientId, config.clientSecret);
  client.setCredentials({ refresh_token: config.refreshToken });
  return client;
}

function decodeBase64Url(value: string | null | undefined) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized) {
    return "";
  }
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | null | undefined,
  name: string,
) {
  const target = name.toLowerCase();
  return (
    headers?.find((entry) => String(entry.name || "").toLowerCase() === target)?.value?.trim()
    || null
  );
}

function extractPlainTextBody(
  payload: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: Array<any> | null;
  } | null | undefined,
): string {
  if (!payload) {
    return "";
  }

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const extracted = extractPlainTextBody(part);
      if (extracted) {
        return extracted;
      }
    }
  }

  return payload.body?.data ? decodeBase64Url(payload.body.data).trim() : "";
}

export async function getHumanReplyGmailStatus(): Promise<GmailReplyWatchStatus> {
  const config = getGmailOAuthConfig();
  if (config.approvedEmail.toLowerCase() === DISALLOWED_HUMAN_REPLY_EMAIL.toLowerCase()) {
    return {
      enabled: false,
      configured: false,
      approved_identity: config.approvedEmail,
      mailbox_email: null,
      reason: `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL cannot be set to ${DISALLOWED_HUMAN_REPLY_EMAIL}.`,
    };
  }
  const client = getGmailOAuthClient();
  if (!client) {
    return {
      enabled: false,
      configured: false,
      approved_identity: config.approvedEmail,
      mailbox_email: null,
      reason:
        "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID, BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET, and BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN are required.",
    };
  }

  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const mailboxEmail = trimValue(profile.data.emailAddress) || null;

  if (!mailboxEmail) {
    return {
      enabled: true,
      configured: false,
      approved_identity: config.approvedEmail,
      mailbox_email: null,
      reason: "Gmail profile lookup returned no mailbox email.",
    };
  }

  if (mailboxEmail.toLowerCase() !== config.approvedEmail.toLowerCase()) {
    return {
      enabled: true,
      configured: false,
      approved_identity: config.approvedEmail,
      mailbox_email: mailboxEmail,
      reason: `Authenticated Gmail mailbox ${mailboxEmail} does not match approved identity ${config.approvedEmail}.`,
    };
  }

  return {
    enabled: true,
    configured: true,
    approved_identity: config.approvedEmail,
    mailbox_email: mailboxEmail,
    reason: null,
  };
}

export async function listHumanReplyGmailMessages(params?: {
  limit?: number;
  query?: string;
}) {
  const client = getGmailOAuthClient();
  if (!client) {
    throw new Error("Gmail reply watcher is not configured.");
  }

  const gmail = google.gmail({ version: "v1", auth: client });
  const result = await gmail.users.messages.list({
    userId: "me",
    q:
      trimValue(params?.query)
      || trimValue(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_QUERY)
      || "newer_than:14d",
    maxResults: Math.max(1, Math.min(params?.limit ?? 25, 100)),
  });

  const messages = result.data.messages || [];
  const details = await Promise.all(
    messages.map(async (message) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: message.id || "",
        format: "full",
      });
      const payload = full.data.payload || null;
      const headers = payload?.headers || [];
      return {
        channel: "email" as const,
        external_message_id: trimValue(full.data.id),
        external_thread_id: trimValue(full.data.threadId) || null,
        sender: extractHeader(headers, "From"),
        recipient: extractHeader(headers, "To"),
        subject: extractHeader(headers, "Subject"),
        body: extractPlainTextBody(payload),
        received_at: full.data.internalDate
          ? new Date(Number(full.data.internalDate)).toISOString()
          : new Date().toISOString(),
      };
    }),
  );

  return details.filter((message) => message.external_message_id);
}
