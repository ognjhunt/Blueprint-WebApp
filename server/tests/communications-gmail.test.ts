// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("googleapis", () => ({ google: { auth: { OAuth2: vi.fn(function () {
  const client: any = { credentials: {}, setCredentials: vi.fn((value) => { client.credentials = value; }) };
  return client;
}) }, gmail: vi.fn() } }));
import { google } from "googleapis";
import { verifyFounderMailbox, readFounderThread, sendFounderMessage, findFounderSentMessage, existingFounderGmail } from "../agents/communications-gmail";
import { FOUNDER_GMAIL_BINDING_KEYS } from "../agents/communications-connection";
import { getHumanReplyGmailStatus } from "../utils/human-reply-gmail";
const mailbox = "nijel@tryblueprint.io";
function gmailFixture() {
  const headers = [{ name: "From", value: "Nijel <nijel@tryblueprint.io>" }, { name: "To", value: "ops@facility.example" },
    { name: "Subject", value: "Packing question" }, { name: "Message-ID", value: "<test@tryblueprint.io>" }];
  const message = { id: "gmail-message-1", threadId: "gmail-thread-1", labelIds: ["SENT"], internalDate: "1790809200000", payload: { headers, mimeType: "text/plain", body: { data: Buffer.from("Synthetic body").toString("base64url") } } };
  const gmail: any = { users: { getProfile: vi.fn(async () => ({ data: { emailAddress: mailbox } })), settings: { sendAs: { list: vi.fn(async () => ({ data: { sendAs: [{ sendAsEmail: mailbox, verificationStatus: "accepted" }] } })) } },
    threads: { get: vi.fn(async () => ({ data: { id: "gmail-thread-1", messages: [message] } })) }, messages: { list: vi.fn(async () => ({ data: { messages: [{ id: message.id, threadId: message.threadId }] } })),
      get: vi.fn(async () => ({ data: message })), send: vi.fn(async () => ({ data: { id: "sent-1", threadId: "thread-1" } })) } } };
  return { gmail, message };
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of FOUNDER_GMAIL_BINDING_KEYS) vi.stubEnv(key, "");
});
describe("existing founder Gmail binding (mocked)", () => {
  it("requires existing OAuth and never accepts browser login as API binding", () => {
    expect(() => existingFounderGmail()).toThrow("founder_gmail_binding_missing");
  });
  it("never substitutes a complete ops binding for an absent or partial founder binding", () => {
    for (const key of ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"]) vi.stubEnv(`BLUEPRINT_HUMAN_REPLY_GMAIL_${key}`, `MOCK_OPS_${key}`);
    expect(() => existingFounderGmail()).toThrow("founder_gmail_binding_missing");
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[0], "MOCK_FOUNDER_CLIENT");
    expect(() => existingFounderGmail()).toThrow("founder_gmail_binding_missing");
    expect(google.auth.OAuth2).not.toHaveBeenCalled();
  });
  it("keeps founder and human-blocker OAuth credentials and mailbox checks independent", async () => {
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[0], "MOCK_FOUNDER_CLIENT");
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[1], "MOCK_FOUNDER_SECRET");
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[2], "MOCK_FOUNDER_TOKEN");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "MOCK_OPS_CLIENT");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "MOCK_OPS_SECRET");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "MOCK_OPS_TOKEN");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL", "ohstnhunt@gmail.com");
    vi.mocked(google.gmail).mockImplementation(({ auth }: any) => ({ users: {
      getProfile: vi.fn(async () => ({ data: { emailAddress: auth.credentials.refresh_token === "MOCK_OPS_TOKEN" ? "ohstnhunt@gmail.com" : mailbox } })),
      settings: { sendAs: { list: vi.fn(async () => ({ data: { sendAs: [{ sendAsEmail: mailbox, verificationStatus: "accepted" }] } })) } },
    } }) as any);
    expect(await verifyFounderMailbox()).toEqual({ mailbox, sender: mailbox });
    expect(await getHumanReplyGmailStatus()).toMatchObject({ configured: true, mailbox_email: "ohstnhunt@gmail.com" });
    expect(google.auth.OAuth2).toHaveBeenNthCalledWith(1, "MOCK_FOUNDER_CLIENT", "MOCK_FOUNDER_SECRET");
    expect(google.auth.OAuth2).toHaveBeenNthCalledWith(2, "MOCK_OPS_CLIENT", "MOCK_OPS_SECRET");
    expect(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN).toBe("MOCK_OPS_TOKEN");
  });
  it("verifies founder mailbox and accepted sender with read-only API calls", async () => {
    const { gmail } = gmailFixture(); expect(await verifyFounderMailbox(gmail)).toEqual({ mailbox, sender: mailbox });
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
  it.each(["ohstnhunt@gmail.com", "hello@tryblueprint.io"])("rejects %s as the authenticated mailbox", async (email) => {
    const { gmail } = gmailFixture(); gmail.users.getProfile.mockResolvedValueOnce({ data: { emailAddress: email } });
    await expect(verifyFounderMailbox(gmail)).rejects.toThrow("founder_gmail_wrong_mailbox");
    expect(gmail.users.settings.sendAs.list).not.toHaveBeenCalled();
  });
  it("fails closed when sender verification or existing permission is missing", async () => {
    const { gmail } = gmailFixture(); gmail.users.settings.sendAs.list.mockResolvedValueOnce({ data: { sendAs: [] } });
    await expect(verifyFounderMailbox(gmail)).rejects.toThrow("founder_sender_unverified_or_permission_missing");
  });
  it("reads only the requested actual thread with provider and RFC references", async () => {
    const { gmail } = gmailFixture(); const result = await readFounderThread("gmail-thread-1", gmail);
    expect(result.messages[0]).toMatchObject({ gmailMessageId: "gmail-message-1", rfcMessageId: "<test@tryblueprint.io>", body: "Synthetic body" });
    expect(gmail.users.threads.get).toHaveBeenCalledWith({ userId: "me", id: "gmail-thread-1", format: "full" });
  });
  it("rejects context overflow instead of discarding relevant earlier messages", async () => {
    const { gmail, message } = gmailFixture(); gmail.users.threads.get.mockResolvedValueOnce({ data: { id: "gmail-thread-1", messages: Array(21).fill(message) } });
    await expect(readFounderThread("gmail-thread-1", gmail)).rejects.toThrow("thread_missing_or_context_limit_exceeded");
  });
  it("validates the exact sent content for acknowledgement recovery", async () => {
    const { gmail, message } = gmailFixture(); const expected = { to: "ops@facility.example", subject: "Packing question", body: "Synthetic body", threadId: "gmail-thread-1" };
    expect(await findFounderSentMessage("<test@tryblueprint.io>", expected, gmail)).toMatchObject({ id: message.id });
    message.payload.headers.find(header => header.name === "Subject")!.value = `=?UTF-8?B?${Buffer.from(expected.subject).toString("base64")}?=`;
    expect(await findFounderSentMessage("<test@tryblueprint.io>", expected, gmail)).toMatchObject({ id: message.id });
    message.payload.body.data = Buffer.from("tampered").toString("base64url");
    await expect(findFounderSentMessage("<test@tryblueprint.io>", expected, gmail)).rejects.toThrow("gmail_send_receipt_content_mismatch");
  });
  it("refuses header injection and requires actual Gmail send IDs", async () => {
    const { gmail } = gmailFixture();
    await expect(sendFounderMessage({ to: "ops@facility.example", subject: "Subject\nBcc: another@example.com", body: "Synthetic", messageId: "<x@tryblueprint.io>" }, gmail)).rejects.toThrow("email_header_injection");
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
    gmail.users.messages.send.mockResolvedValueOnce({ data: {} });
    await expect(sendFounderMessage({ to: "ops@facility.example", subject: "Packing", body: "Synthetic", messageId: "<x@tryblueprint.io>" }, gmail)).rejects.toThrow("gmail_send_receipt_missing");
  });
});
