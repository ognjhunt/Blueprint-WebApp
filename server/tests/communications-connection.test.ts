// @vitest-environment node
import { describe, it, expect } from "vitest";
import { founderMailboxConnectionPlan, FOUNDER_GMAIL_BINDING_KEYS, FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE } from "../agents/communications-connection";

describe("owner-controlled founder connection preparation", () => {
  it("does not treat ops credentials as a founder connection or invent an OAuth callback", () => {
    const plan = founderMailboxConnectionPlan({ BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN: "MOCK_OPS_TOKEN" });
    expect(plan.binding.state).toBe("missing");
    expect(plan.oauth).toMatchObject({ state: "blocked", authorizationUrl: null, callbackUrl: null,
      initialScopes: [FOUNDER_GMAIL_READ_SCOPE], sendScopeAfterSeparateApproval: FOUNDER_GMAIL_SEND_SCOPE });
    expect(plan.secretDestination).toMatchObject({ ownerEntryOnly: true, keys: FOUNDER_GMAIL_BINDING_KEYS,
      services: ["Blueprint-WebApp", "blueprint-webapp-worker"] });
    expect(plan).toMatchObject({ opsBindingPreserved: true, credentialsAccepted: false, grantStarted: false, sendsEnabled: false });
    expect(JSON.stringify(plan)).not.toContain("MOCK_OPS_TOKEN");
  });
  it("reports private field presence without exposing secrets or claiming mailbox verification", () => {
    const env = Object.fromEntries(FOUNDER_GMAIL_BINDING_KEYS.map((key, index) => [key, `MOCK_PRIVATE_${index}`]));
    const plan = founderMailboxConnectionPlan(env);
    expect(plan.binding.state).toBe("configured_unverified");
    expect(plan.oauth.state).toBe("blocked");
    for (const value of Object.values(env)) expect(JSON.stringify(plan)).not.toContain(value);
    env[FOUNDER_GMAIL_BINDING_KEYS[2]] = " ";
    expect(founderMailboxConnectionPlan(env).binding.state).toBe("missing");
  });
});
