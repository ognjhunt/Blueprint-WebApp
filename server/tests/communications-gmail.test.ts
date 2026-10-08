// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("googleapis", () => ({ google: { auth: { OAuth2: vi.fn(function () {
  const client: any = { credentials: {}, setCredentials: vi.fn((value) => { client.credentials = value; }) };
  return client;
}) }, gmail: vi.fn() } }));
vi.mock("../agents/communications-contract", async original => ({ ...await original<any>(), FOUNDER_MAILBOX: "founder@business.example" }));
import { google } from "googleapis";
import { verifyFounderMailbox, readFounderThread, sendFounderMessage, findFounderSentMessage, existingFounderGmail, hasFounderPriorContact } from "../agents/communications-gmail";
import { FOUNDER_GMAIL_BINDING_KEYS } from "../agents/communications-connection";
import { getHumanReplyGmailStatus } from "../utils/human-reply-gmail";
const mailbox = "founder@business.example";
function gmailFixture() {
  const headers = [{ name: "From", value: "Synthetic Founder <founder@business.example>" }, { name: "To", value: "ops@facility.example" },
    { name: "Subject", value: "Packing question" }, { name: "Message-ID", value: "<test@business.example>" }];
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
  it("requires existing OAuth and never accepts browser login as API binding", async () => {
    await expect(existingFounderGmail()).rejects.toThrow("founder_gmail_binding_missing");
  });
  it("never substitutes a complete ops binding for an absent or partial founder binding", async () => {
    for (const key of ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"]) vi.stubEnv(`BLUEPRINT_HUMAN_REPLY_GMAIL_${key}`, `MOCK_OPS_${key}`);
    await expect(existingFounderGmail()).rejects.toThrow("founder_gmail_binding_missing");
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[0], "MOCK_FOUNDER_CLIENT");
    await expect(existingFounderGmail()).rejects.toThrow("founder_gmail_binding_missing");
    expect(google.auth.OAuth2).not.toHaveBeenCalled();
  });
  it("keeps founder and human-blocker OAuth credentials and mailbox checks independent", async () => {
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[0], "MOCK_FOUNDER_CLIENT");
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[1], "MOCK_FOUNDER_SECRET");
    vi.stubEnv(FOUNDER_GMAIL_BINDING_KEYS[2], "MOCK_FOUNDER_TOKEN");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "MOCK_OPS_CLIENT");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "MOCK_OPS_SECRET");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "MOCK_OPS_TOKEN");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL", "ops-owner@example.net");
    vi.mocked(google.gmail).mockImplementation(({ auth }: any) => ({ users: {
      getProfile: vi.fn(async () => ({ data: { emailAddress: auth.credentials.refresh_token === "MOCK_OPS_TOKEN" ? "ops-owner@example.net" : mailbox } })),
      settings: { sendAs: { list: vi.fn(async () => ({ data: { sendAs: [{ sendAsEmail: mailbox, verificationStatus: "accepted" }] } })) } },
    } }) as any);
    expect(await verifyFounderMailbox()).toEqual({ mailbox, sender: mailbox });
    expect(await getHumanReplyGmailStatus()).toMatchObject({ configured: true, mailbox_email: "ops-owner@example.net" });
    expect(google.auth.OAuth2).toHaveBeenNthCalledWith(1, "MOCK_FOUNDER_CLIENT", "MOCK_FOUNDER_SECRET");
    expect(google.auth.OAuth2).toHaveBeenNthCalledWith(2, "MOCK_OPS_CLIENT", "MOCK_OPS_SECRET");
    expect(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN).toBe("MOCK_OPS_TOKEN");
  });
  it("verifies founder mailbox and accepted sender with read-only API calls", async () => {
    const { gmail } = gmailFixture(); expect(await verifyFounderMailbox(gmail)).toEqual({ mailbox, sender: mailbox });
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
  it.each([undefined, "pending"])("accepts the matching primary sender without custom alias status %s", async verificationStatus => {
    const { gmail } = gmailFixture();
    gmail.users.settings.sendAs.list.mockResolvedValueOnce({ data: { sendAs: [{ sendAsEmail: mailbox, isPrimary: true, verificationStatus }] } });
    expect(await verifyFounderMailbox(gmail)).toEqual({ mailbox, sender: mailbox });
    expect(gmail.users.getProfile).toHaveBeenCalledWith({ userId: "me" });
    expect(gmail.users.settings.sendAs.list).toHaveBeenCalledWith({ userId: "me" });
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
  it.each([undefined, "pending", "unrecognized"])("rejects a custom sender with status %s even when another primary exists", async verificationStatus => {
    const { gmail } = gmailFixture();
    gmail.users.settings.sendAs.list.mockResolvedValueOnce({ data: { sendAs: [
      { sendAsEmail: "other@business.example", isPrimary: true },
      { sendAsEmail: mailbox, isPrimary: false, verificationStatus },
    ] } });
    await expect(verifyFounderMailbox(gmail)).rejects.toThrow("founder_sender_unverified_or_permission_missing");
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
  it("still requires accepted verification for the matching custom sender", async () => {
    const { gmail } = gmailFixture();
    gmail.users.settings.sendAs.list.mockResolvedValueOnce({ data: { sendAs: [{ sendAsEmail: mailbox, isPrimary: false, verificationStatus: "accepted" }] } });
    expect(await verifyFounderMailbox(gmail)).toEqual({ mailbox, sender: mailbox });
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
  it.each(["ops-owner@example.net", "hello@business.example"])("rejects %s as the authenticated mailbox", async (email) => {
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
    expect(result.messages[0]).toMatchObject({ gmailMessageId: "gmail-message-1", rfcMessageId: "<test@business.example>", body: "Synthetic body" });
    expect(gmail.users.threads.get).toHaveBeenCalledWith({ userId: "me", id: "gmail-thread-1", format: "full" });
  });
  it("rejects context overflow instead of discarding relevant earlier messages", async () => {
    const { gmail, message } = gmailFixture(); gmail.users.threads.get.mockResolvedValueOnce({ data: { id: "gmail-thread-1", messages: Array(21).fill(message) } });
    await expect(readFounderThread("gmail-thread-1", gmail)).rejects.toThrow("thread_missing_or_context_limit_exceeded");
  });
  it("validates the exact sent content for acknowledgement recovery", async () => {
    const { gmail, message } = gmailFixture(); const expected = { to: "ops@facility.example", subject: "Packing question", body: "Synthetic body", threadId: "gmail-thread-1" };
    expect(await findFounderSentMessage("<test@business.example>", expected, gmail)).toMatchObject({ id: message.id });
    message.payload.headers.find(header => header.name === "Subject")!.value = `=?UTF-8?B?${Buffer.from(expected.subject).toString("base64")}?=`;
    expect(await findFounderSentMessage("<test@business.example>", expected, gmail)).toMatchObject({ id: message.id });
    message.payload.body.data = Buffer.from("tampered").toString("base64url");
    await expect(findFounderSentMessage("<test@business.example>", expected, gmail)).rejects.toThrow("gmail_send_receipt_content_mismatch");
  });
  it("refuses header injection and requires actual Gmail send IDs", async () => {
    const { gmail } = gmailFixture();
    await expect(sendFounderMessage({ to: "ops@facility.example", subject: "Subject\nBcc: another@example.com", body: "Synthetic", messageId: "<x@business.example>" }, gmail)).rejects.toThrow("email_header_injection");
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
    gmail.users.messages.send.mockResolvedValueOnce({ data: {} });
    await expect(sendFounderMessage({ to: "ops@facility.example", subject: "Packing", body: "Synthetic", messageId: "<x@business.example>" }, gmail)).rejects.toThrow("gmail_send_receipt_missing");
  });
  it("sends branded HTML and the exact plain reply evidence as MIME alternatives with the existing reply mailbox", async () => {
    const { gmail } = gmailFixture();
    const body = "Hi,\n\nWhat final state defines success?\n\n— The Blueprint team", html = "<html><body><p>What final state defines success?</p></body></html>";
    await sendFounderMessage({ to: "ops@facility.example", subject: "A question about your Blueprint job", body, html, messageId: "<brand@business.example>", inReplyTo: "<incoming@facility.example>" }, gmail);
    const raw = Buffer.from(gmail.users.messages.send.mock.calls[0][0].requestBody.raw, "base64url").toString();
    expect(raw).toContain(`Reply-To: ${mailbox}`);
    expect(raw).toContain("In-Reply-To: <incoming@facility.example>");
    expect(raw).toContain("Content-Type: multipart/alternative;");
    const parts = [...raw.matchAll(/Content-Type: text\/(plain|html); charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/g)];
    expect(parts.map(part => [part[1], Buffer.from(part[2], "base64").toString()])).toEqual([["plain", body], ["html", html]]);
    expect(gmail.users.messages.send).toHaveBeenCalledTimes(1);
  });
  it("refuses an unverified environment-token sending fallback before constructing an API client", async () => {
    for (const key of FOUNDER_GMAIL_BINDING_KEYS) vi.stubEnv(key, "MOCK_ENVIRONMENT_BINDING");
    await expect(sendFounderMessage({ to: "ops@facility.example", subject: "Packing", body: "Synthetic", messageId: "<x@business.example>" })).rejects.toThrow("founder_send_scope_unverified");
    expect(google.auth.OAuth2).not.toHaveBeenCalled(); expect(google.gmail).not.toHaveBeenCalled();
  });
  it("checks prior contact in either direction using only one message reference and no content or send", async () => {
    const { gmail } = gmailFixture();
    expect(await hasFounderPriorContact("OPS@facility.example", gmail)).toBe(true);
    expect(gmail.users.messages.list).toHaveBeenCalledWith({ userId: "me", q: 'in:anywhere {from:"ops@facility.example" to:"ops@facility.example"}', maxResults: 1, includeSpamTrash: true });
    expect(gmail.users.messages.get).not.toHaveBeenCalled(); expect(gmail.users.threads.get).not.toHaveBeenCalled(); expect(gmail.users.messages.send).not.toHaveBeenCalled();
    gmail.users.messages.list.mockResolvedValueOnce({ data: { resultSizeEstimate: 0 } });
    expect(await hasFounderPriorContact("ops@facility.example", gmail)).toBe(false);
  });
  it("fails closed for invalid address or unverified prior-contact readback", async () => {
    const { gmail } = gmailFixture();
    await expect(hasFounderPriorContact('bad@example.com" OR in:sent', gmail)).rejects.toThrow("founder_prior_contact_address_invalid");
    expect(gmail.users.getProfile).not.toHaveBeenCalled();
    gmail.users.messages.list.mockResolvedValueOnce({ data: {} });
    await expect(hasFounderPriorContact("ops@facility.example", gmail)).rejects.toThrow("founder_prior_contact_result_unverified");
    expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
  it.each([
    { messages: [], resultSizeEstimate: 1 }, { messages: [] },
    { messages: [], resultSizeEstimate: 0, nextPageToken: "more" },
    { resultSizeEstimate: 0, nextPageToken: "more" },
    { messages: [{ id: 42 }] }, { messages: [{ id: " " }] },
  ])("rejects inconclusive or malformed prior-contact metadata %j", async data => {
    const { gmail } = gmailFixture(); gmail.users.messages.list.mockResolvedValueOnce({ data });
    await expect(hasFounderPriorContact("ops@facility.example", gmail)).rejects.toThrow("founder_prior_contact_result_unverified");
    expect(gmail.users.messages.get).not.toHaveBeenCalled(); expect(gmail.users.messages.send).not.toHaveBeenCalled();
  });
});
