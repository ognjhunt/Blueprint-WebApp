// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { communicationsPreflight } from "./communications-preflight.mjs";
import { COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT, FOUNDER_MAILBOX } from "../server/agents/communications-contract";
function fixture(email = FOUNDER_MAILBOX) {
  const setCredentials = vi.fn();
  const getProfile = vi.fn(async () => ({ data: { emailAddress: email } }));
  const sendAs = vi.fn(async () => ({ data: { sendAs: [{ sendAsEmail: FOUNDER_MAILBOX, verificationStatus: "accepted" }] } }));
  const googleImpl = { auth: { OAuth2: vi.fn(function () { return { setCredentials }; }) }, gmail: vi.fn(() => ({ users: { getProfile, settings: { sendAs: { list: sendAs } } } })) };
  const fetchImpl = vi.fn(async () => Response.json({ id: COMMUNICATIONS_MODEL }));
  const env = { OPENAI_API_KEY: "MOCK_SECRET_NOT_FOR_OUTPUT", BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID: "mock-client", BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET: "MOCK_CLIENT_SECRET", BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN: "MOCK_REFRESH_TOKEN" };
  return { env, googleImpl, fetchImpl, getProfile, sendAs };
}
describe("in-place read-only communications preflight", () => {
  it("makes no calls when bindings are absent", async () => {
    const f = fixture(); const result = await communicationsPreflight({ ...f, env: {} });
    expect(result.modelDiscovery.reason).toBe("existing_openai_binding_missing"); expect(result.mailbox.reason).toBe("founder_gmail_binding_missing");
    expect(f.fetchImpl).not.toHaveBeenCalled(); expect(f.googleImpl.gmail).not.toHaveBeenCalled();
  });
  it("checks exact model/project and founder identity without claiming inference/send authority", async () => {
    const f = fixture(); const result = await communicationsPreflight(f);
    expect(result).toMatchObject({ requestedModel: COMMUNICATIONS_MODEL, requestedProject: COMMUNICATIONS_PROJECT,
      modelDiscovery: { state: "verified" }, mailbox: { state: "verified", mailbox: FOUNDER_MAILBOX },
      agentsApiLunaInference: "unverified_no_session_created", gmailSendPermission: "unverified_no_send_attempted", paidInferenceAuthorized: false, sendAuthorized: false });
    expect(f.fetchImpl).toHaveBeenCalledTimes(1); expect(f.fetchImpl.mock.calls[0][1].method).toBe("GET");
    for (const secret of Object.values(f.env)) expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("rejects the personal mailbox before sender lookup", async () => {
    const f = fixture("ohstnhunt@gmail.com"); const result = await communicationsPreflight(f);
    expect(result.mailbox.reason).toBe("founder_gmail_wrong_mailbox"); expect(f.sendAs).not.toHaveBeenCalled();
  });
  it("does not substitute another model or print provider error content", async () => {
    const f = fixture(); f.fetchImpl.mockResolvedValueOnce(new Response("PRIVATE_PROVIDER_CONTENT", { status: 403 }));
    expect((await communicationsPreflight(f)).modelDiscovery.reason).toBe("model_discovery_http_403");
    f.fetchImpl.mockResolvedValueOnce(Response.json({ id: "gpt-6-sol" }));
    expect((await communicationsPreflight(f)).modelDiscovery.reason).toBe("requested_luna_model_unavailable");
  });
  it("reports sender permission and refresh-token failure using sanitized codes", async () => {
    const f = fixture(); f.sendAs.mockRejectedValueOnce({ response: { status: 403, data: { error: "PRIVATE" } } });
    expect((await communicationsPreflight(f)).mailbox.reason).toBe("existing_gmail_http_403");
    f.getProfile.mockRejectedValueOnce({ response: { status: 400, data: { error: "invalid_grant", error_description: "PRIVATE_TOKEN" } } });
    expect((await communicationsPreflight(f)).mailbox.reason).toBe("existing_gmail_invalid_grant");
  });
});
