import { google, type gmail_v1 } from "googleapis";
import { createHash } from "node:crypto";
import { extractHeader, extractPlainTextBody } from "../utils/human-reply-gmail";
import { FOUNDER_MAILBOX, CUSTOMER_JOB_MAILBOX, type VerifiedThread, type ThreadMessage, FOUNDER_THREAD_MESSAGE_LIMIT } from "./communications-contract";
import { readFounderCredential, requireFounderSendCapability } from "./communications-oauth-store";
import { FOUNDER_GMAIL_BINDING_KEYS } from "./communications-connection";

export async function existingFounderGmail(): Promise<gmail_v1.Gmail> {
  const [clientId, clientSecret, environmentToken] = FOUNDER_GMAIL_BINDING_KEYS.map(key => process.env[key]?.trim());
  if (!clientId || !clientSecret) throw new Error("founder_gmail_binding_missing");
  const refreshToken = environmentToken || (await readFounderCredential()).refreshToken;
  // Only owner-installed founder credentials. No ops binding fallback, browser
  // access, client creation or ops credential copying. The private reader only
  // uses the separate binding after explicit owner consent; it never writes.
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

export async function verifyFounderMailbox(gmail?: gmail_v1.Gmail) {
  gmail ??= await existingFounderGmail();
  const profile = await gmail.users.getProfile({ userId: "me" });
  if (profile.data.emailAddress?.trim().toLowerCase() !== FOUNDER_MAILBOX) {
    throw new Error("founder_gmail_wrong_mailbox");
  }
  const sendAs = await gmail.users.settings.sendAs.list({ userId: "me" });
  // Google reports verificationStatus for custom From aliases only. After the
  // exact profile check, the matching primary address needs no alias status.
  if (!sendAs.data.sendAs?.some((entry) => entry.sendAsEmail?.toLowerCase() === FOUNDER_MAILBOX
    && (entry.isPrimary === true || entry.verificationStatus === "accepted"))) {
    throw new Error("founder_sender_unverified_or_permission_missing");
  }
  return { mailbox: FOUNDER_MAILBOX, sender: FOUNDER_MAILBOX };
}

export type BlueprintMessageSender = typeof FOUNDER_MAILBOX | typeof CUSTOMER_JOB_MAILBOX;
function messageSender(value?: BlueprintMessageSender): BlueprintMessageSender {
  if (value === undefined || value === FOUNDER_MAILBOX) return FOUNDER_MAILBOX;
  if (value === CUSTOMER_JOB_MAILBOX) return CUSTOMER_JOB_MAILBOX;
  throw new Error("blueprint_sender_not_allowed");
}
/** Existing owner inbox only. An allowed alias is not verification evidence. */
export async function verifyCustomerJobSender(gmail?: gmail_v1.Gmail) {
  gmail ??= await existingFounderGmail();
  await verifyFounderMailbox(gmail);
  const aliases = await gmail.users.settings.sendAs.list({ userId: "me" });
  if (!aliases.data.sendAs?.some(entry => entry.sendAsEmail?.trim().toLowerCase() === CUSTOMER_JOB_MAILBOX
    && entry.verificationStatus === "accepted")) throw new Error("customer_job_sender_unverified_or_permission_missing");
  return { mailbox: FOUNDER_MAILBOX, sender: CUSTOMER_JOB_MAILBOX };
}

export function addresses(value: string | null): string[] {
  return (value?.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((address) => address.toLowerCase());
}

/** Bounded existence check only: no mailbox content or thread body is read. */
export async function hasFounderPriorContact(email: string, gmail?: gmail_v1.Gmail): Promise<boolean> {
  const address = email.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)) throw new Error("founder_prior_contact_address_invalid");
  gmail ??= await existingFounderGmail();
  await verifyFounderMailbox(gmail);
  const target = JSON.stringify(address);
  const result = await gmail.users.messages.list({ userId: "me", q: `in:anywhere {from:${target} to:${target}}`, maxResults: 1, includeSpamTrash: true });
  const messages = result.data.messages;
  if (messages === undefined || (Array.isArray(messages) && messages.length === 0)) {
    if (result.data.resultSizeEstimate === 0 && [undefined, null, ""].includes(result.data.nextPageToken)) return false;
    throw new Error("founder_prior_contact_result_unverified");
  }
  if (!Array.isArray(messages) || messages.length > 1 || messages.some(message => typeof message.id !== "string" || !message.id.trim())) {
    throw new Error("founder_prior_contact_result_unverified");
  }
  return true;
}

/** Our outbound subject is UTF-8 RFC2047 B; Gmail may return that raw header.
 * Shared with founder-sent observation so subject hashes match thread reads. */
export function subjectText(value: string | null) {
  return (value ?? "").replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/gi,
    (_, encoded: string) => Buffer.from(encoded, "base64").toString("utf8"));
}

export async function readFounderThread(threadId: string, gmail?: gmail_v1.Gmail): Promise<VerifiedThread> {
  gmail ??= await existingFounderGmail();
  await verifyFounderMailbox(gmail);
  const response = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  if (response.data.id !== threadId || !response.data.messages?.length || response.data.messages.length > FOUNDER_THREAD_MESSAGE_LIMIT) {
    throw new Error("thread_missing_or_context_limit_exceeded");
  }
  const messages: ThreadMessage[] = response.data.messages.map((message) => {
    const headers = message.payload?.headers;
    const from = addresses(extractHeader(headers, "From"));
    const to = addresses(extractHeader(headers, "To"));
    const rfcMessageId = extractHeader(headers, "Message-ID");
    const body = extractPlainTextBody(message.payload);
    if (!message.id || message.threadId !== threadId || from.length !== 1 || !to.length || !rfcMessageId
      || !message.internalDate || body.length > 12000) throw new Error("thread_message_context_invalid");
    return {
      gmailMessageId: message.id, gmailThreadId: threadId, rfcMessageId,
      from: from[0], to, subject: subjectText(extractHeader(headers, "Subject")), body,
      receivedAt: new Date(Number(message.internalDate)).toISOString(),
      inReplyTo: extractHeader(headers, "In-Reply-To"),
      references: extractHeader(headers, "References")?.match(/<[^<>]+>/g) ?? [],
    };
  });
  messages.sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  return { mailbox: FOUNDER_MAILBOX, threadId, messages, fetchedAt: new Date().toISOString() };
}

export async function findFounderSentMessage(messageId: string, expected: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string }, gmail?: gmail_v1.Gmail) {
  gmail ??= await existingFounderGmail();
  await verifyFounderMailbox(gmail);
  const result = await gmail.users.messages.list({ userId: "me", q: `in:sent rfc822msgid:${messageId}`, maxResults: 2 });
  if ((result.data.messages?.length ?? 0) > 1) throw new Error("multiple_send_receipts_require_reconciliation");
  const found = result.data.messages?.[0];
  if (!found?.id) return null;
  const message = (await gmail.users.messages.get({ userId: "me", id: found.id, format: "full" })).data;
  const headers = message.payload?.headers;
  const normalize = (body: string) => body.replace(/\r\n/g, "\n");
  if (!message.threadId || !message.labelIds?.includes("SENT")
    || extractHeader(headers, "Message-ID") !== messageId
    || addresses(extractHeader(headers, "From")).join() !== FOUNDER_MAILBOX
    || addresses(extractHeader(headers, "To")).join() !== expected.to
    || subjectText(extractHeader(headers, "Subject")) !== expected.subject
    || normalize(extractPlainTextBody(message.payload)) !== normalize(expected.body)
    || (expected.threadId && message.threadId !== expected.threadId)
    || (expected.inReplyTo && extractHeader(headers, "In-Reply-To") !== expected.inReplyTo)) throw new Error("gmail_send_receipt_content_mismatch");
  return { id: message.id!, threadId: message.threadId };
}

export type FounderSendAcknowledgement = { messageId: string; threadId: string; requestedRfcMessageId: string };
export class FounderSendReadbackError extends Error {
  constructor(readonly acknowledgement: FounderSendAcknowledgement) { super("gmail_send_acknowledged_readback_unverified"); }
}

/** Read only the provider-acknowledged message, never search or resend. RFC IDs
 * may be rewritten by Gmail; the reviewed MIME content and provider IDs cannot. */
export async function readFounderSentReceipt(acknowledgement: FounderSendAcknowledgement,
  expected: { to: string; subject: string; body: string; html?: string; inReplyTo?: string; sender?: BlueprintMessageSender }, gmail?: gmail_v1.Gmail) {
  gmail ??= await existingFounderGmail();
  const sender = messageSender(expected.sender);
  if (sender === CUSTOMER_JOB_MAILBOX) await verifyCustomerJobSender(gmail);
  else await verifyFounderMailbox(gmail);
  const message = (await gmail.users.messages.get({ userId: "me", id: acknowledgement.messageId, format: "full" })).data;
  const headers = message.payload?.headers, rfcMessageId = extractHeader(headers, "Message-ID");
  const parts = (payload: gmail_v1.Schema$MessagePart | undefined | null, kind: string): string[] => !payload ? []
    : [...(payload.mimeType === kind && payload.body?.data ? [Buffer.from(payload.body.data, "base64url").toString("utf8")] : []),
      ...(payload.parts ?? []).flatMap(part => parts(part, kind))];
  const plain = parts(message.payload, "text/plain"), html = parts(message.payload, "text/html");
  const normalize = (value: string) => value.replace(/\r\n/g, "\n");
  if (message.id !== acknowledgement.messageId || message.threadId !== acknowledgement.threadId || !message.labelIds?.includes("SENT")
    || !rfcMessageId || !/^<[^<>\s]+>$/.test(rfcMessageId)
    || addresses(extractHeader(headers, "From")).join() !== sender
    || (sender === CUSTOMER_JOB_MAILBOX && addresses(extractHeader(headers, "Reply-To")).join() !== sender)
    || addresses(extractHeader(headers, "To")).join() !== expected.to
    || extractHeader(headers, "Cc") || extractHeader(headers, "Bcc")
    || subjectText(extractHeader(headers, "Subject")) !== expected.subject
    || plain.length !== 1 || normalize(plain[0]) !== normalize(expected.body)
    || (expected.html !== undefined ? html.length !== 1 || normalize(html[0]) !== normalize(expected.html) : html.length !== 0)
    || (extractHeader(headers, "In-Reply-To") ?? null) !== (expected.inReplyTo ?? null)) throw new Error("gmail_send_receipt_content_mismatch");
  return { messageId: message.id, threadId: message.threadId, rfcMessageId, requestedRfcMessageId: acknowledgement.requestedRfcMessageId };
}

export async function sendFounderMessage(params: {
  to: string; subject: string; body: string; html?: string; messageId: string; threadId?: string; inReplyTo?: string;
  assertSendAllowed?: () => void;
  verifySentReceipt?: boolean;
  sender?: BlueprintMessageSender;
}, gmail?: gmail_v1.Gmail) {
  if (!gmail) await requireFounderSendCapability();
  gmail ??= await existingFounderGmail();
  const sender = messageSender(params.sender);
  if (sender === CUSTOMER_JOB_MAILBOX) await verifyCustomerJobSender(gmail);
  else await verifyFounderMailbox(gmail);
  for (const header of [params.to, params.subject, params.messageId, params.inReplyTo ?? ""]) {
    if (/[\r\n]/.test(header)) throw new Error("email_header_injection");
  }
  const boundary = `blueprint-${createHash("sha256").update(params.messageId).digest("hex")}`;
  const headers = [
    `From: ${sender === CUSTOMER_JOB_MAILBOX ? "Blueprint" : "Nijel Hunt"} <${sender}>`, `To: ${params.to}`, `Reply-To: ${sender}`,
    `Message-ID: ${params.messageId}`, `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    ...(params.html !== undefined ? [`Content-Type: multipart/alternative; boundary="${boundary}"`]
      : ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64"]),
    ...(params.inReplyTo ? [`In-Reply-To: ${params.inReplyTo}`, `References: ${params.inReplyTo}`] : []),
  ];
  const part = (kind: "plain" | "html", body: string) => `--${boundary}\r\nContent-Type: text/${kind}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(body).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""}\r\n`;
  const content = params.html !== undefined ? `${part("plain", params.body)}${part("html", params.html)}--${boundary}--\r\n`
    : Buffer.from(params.body).toString("base64");
  const raw = Buffer.from(headers.join("\r\n") + "\r\n\r\n" + content).toString("base64url");
  // Caller authority can expire during credential and mailbox reads. The
  // selected customer-job path checks it again at the actual send boundary.
  params.assertSendAllowed?.();
  const response = await gmail.users.messages.send({
    userId: "me", requestBody: { raw, ...(params.threadId ? { threadId: params.threadId } : {}) },
  });
  if (!response.data.id || !response.data.threadId) throw new Error("gmail_send_receipt_missing");
  if (params.verifySentReceipt) {
    const acknowledgement = { messageId: response.data.id, threadId: response.data.threadId, requestedRfcMessageId: params.messageId };
    try {
      if (params.threadId && response.data.threadId !== params.threadId) throw new Error("gmail_reply_thread_receipt_mismatch");
      return await readFounderSentReceipt(acknowledgement, params, gmail);
    } catch { throw new FounderSendReadbackError(acknowledgement); }
  }
  if (params.threadId && response.data.threadId !== params.threadId) throw new Error("gmail_reply_thread_receipt_mismatch");
  return { messageId: response.data.id, threadId: response.data.threadId, rfcMessageId: params.messageId };
}
