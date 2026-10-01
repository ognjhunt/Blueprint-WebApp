// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { FounderGmailConsent, FOUNDER_OAUTH_CALLBACK, type FounderConsentPorts } from "../agents/communications-oauth";
import { FOUNDER_GMAIL_READ_SCOPE } from "../agents/communications-connection";

import { consentFixture } from "./fixtures/communications-oauth";

describe("founder-only owner-controlled Google consent", () => {
  it("uses fixed Google origin, readonly scope, offline consent, S256 PKCE and separate browser state", async () => {
    const f = consentFixture(), flow = await f.start(), url = new URL(flow.authorizationUrl);
    expect(url.origin).toBe("https://accounts.google.com"); expect(url.searchParams.get("redirect_uri")).toBe(FOUNDER_OAUTH_CALLBACK);
    expect(url.searchParams.get("scope")).toBe(FOUNDER_GMAIL_READ_SCOPE); expect(url.searchParams.get("include_granted_scopes")).toBe("false");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("login_hint")).toBe("nijel@tryblueprint.io");
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    await f.consent.finish(f.identity, flow.cookie);
    const exchange = vi.mocked(f.ports.exchange).mock.calls[0][0];
    expect(createHash("sha256").update(exchange.verifier).digest("base64url")).toBe(url.searchParams.get("code_challenge"));
    const records = JSON.stringify([...f.records.values()]);
    for (const secret of ["PRIVATE_CODE", "PRIVATE_REFRESH", "PRIVATE_ACCESS", exchange.verifier, flow.state, flow.cookie]) expect(records).not.toContain(secret);
    expect(f.ports.save).toHaveBeenCalledWith(expect.objectContaining({ binding: "communications-founder-gmail", mailbox: "nijel@tryblueprint.io",
      scopes: [FOUNDER_GMAIL_READ_SCOPE], grantMode: "temporary_testing", usableUntil: 605800 }), expect.any(String));
    expect(await f.consent.status(f.identity, flow.cookie)).toEqual({ state: "connected_readonly" });
  });
  it("blocks missing secure storage before obtaining a Google grant", async () => {
    const f = consentFixture(); f.setReady(false);
    await expect(f.start()).rejects.toMatchObject({ code: "founder_oauth_secure_storage_unavailable" });
    expect(f.records.size).toBe(0); expect(f.ports.exchange).not.toHaveBeenCalled();
  });
  it.each([{ uid: "other", tenantId: null, authTime: 900 }, { uid: "owner-uid", tenantId: "other", authTime: 900 },
    { uid: "owner-uid", tenantId: null, authTime: NaN }])("requires the reviewed fresh owner identity: %s", async identity => {
    const f = consentFixture(); await expect(f.consent.start(identity)).rejects.toMatchObject({ code: "founder_oauth_owner_required" });
    expect(f.records.size).toBe(0);
  });
  it("rejects unregistered redirects/configuration and cannot widen scope", () => {
    const f = consentFixture(); expect(() => new FounderGmailConsent({ ...f.config, callback: "https://attacker.example" as any }, f.ports)).toThrow("founder_oauth_configuration_unverified");
  });
  it("rejects wrong state/browser, expired state and replay without token exchange", async () => {
    const f = consentFixture(), flow = await f.start();
    await expect(f.consent.callback({ state: "a".repeat(43), code: "code" }, flow.cookie)).rejects.toThrow("founder_oauth_state_invalid");
    await expect(f.consent.callback({ state: flow.state, code: "code" }, flow.state + "." + "a".repeat(43))).rejects.toThrow("founder_oauth_flow_invalid");
    await f.consent.callback({ state: flow.state, code: "code" }, flow.cookie);
    await expect(f.consent.callback({ state: flow.state, code: "code" }, flow.cookie)).rejects.toThrow("founder_oauth_state_consumed");
    f.setClock(1600); await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_flow_invalid");
    expect(f.ports.exchange).not.toHaveBeenCalled();
  });
  it("consumes denial with no token exchange/storage", async () => {
    const f = consentFixture(), flow = await f.start(); await f.consent.callback({ state: flow.state, denied: true }, flow.cookie);
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_exchange_already_claimed");
    expect(f.ports.exchange).not.toHaveBeenCalled(); expect(f.ports.save).not.toHaveBeenCalled();
  });
  it("one concurrent finish wins; callbacks and token POSTs are not repeated", async () => {
    const f = consentFixture(), flow = await f.start();
    const callbacks = await Promise.allSettled([1, 2].map(() => f.consent.callback({ state: flow.state, code: "code" }, flow.cookie)));
    expect(callbacks.filter(result => result.status === "fulfilled")).toHaveLength(1);
    await Promise.allSettled([1, 2].map(() => f.consent.finish(f.identity, flow.cookie)));
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.save).toHaveBeenCalledTimes(1);
  });
  it.each(["scope", "refresh", "mailbox", "sender", "ack"])("fails closed on %s and never auto-revokes or retries", async failure => {
    const f = consentFixture(), flow = await f.start(); await f.consent.callback({ state: flow.state, code: "code" }, flow.cookie);
    if (failure === "scope") vi.mocked(f.ports.exchange).mockResolvedValue({ accessToken: "PRIVATE_ACCESS", refreshToken: "PRIVATE_REFRESH", scopes: [FOUNDER_GMAIL_READ_SCOPE, "https://www.googleapis.com/auth/gmail.send"] });
    if (failure === "refresh") vi.mocked(f.ports.exchange).mockResolvedValue({ accessToken: "PRIVATE_ACCESS", refreshToken: "", scopes: [FOUNDER_GMAIL_READ_SCOPE] });
    if (failure === "mailbox") vi.mocked(f.ports.verify).mockResolvedValue({ mailbox: "ohstnhunt@gmail.com", sender: "nijel@tryblueprint.io" });
    if (failure === "sender") vi.mocked(f.ports.verify).mockResolvedValue({ mailbox: "nijel@tryblueprint.io", sender: "hello@tryblueprint.io" });
    if (failure === "ack") vi.mocked(f.ports.exchange).mockRejectedValue(new Error("sensitive PRIVATE_REFRESH PRIVATE_CODE"));
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_exchange_failed_requires_new_owner_consent");
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_exchange_already_claimed");
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.save).not.toHaveBeenCalled();
  });
  it("requires the same tenant/login and checks owner revocation again before persistence", async () => {
    const f = consentFixture(), flow = await f.start(); await f.consent.callback({ state: flow.state, code: "code" }, flow.cookie);
    await expect(f.consent.finish({ ...f.identity, authTime: 800 }, flow.cookie)).rejects.toThrow("founder_oauth_owner_required");
    vi.mocked(f.ports.verify).mockImplementation(async () => { f.setOwner(false); return { mailbox: "nijel@tryblueprint.io", sender: "nijel@tryblueprint.io" }; });
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_exchange_failed_requires_new_owner_consent");
    expect(f.ports.save).not.toHaveBeenCalled();
  });
  it.each(["secret_open", "token_exchange", "token_validation", "mailbox_verification", "owner_recheck",
    "storage_readiness", "credential_persistence", "connection_acknowledgement"])("reports only the allowlisted %s failure stage and never retries", async failureStage => {
    const f = consentFixture(), flow = await f.start();
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    const sensitive = new Error("PRIVATE_CODE PRIVATE_ACCESS PRIVATE_REFRESH provider details");
    if (failureStage === "secret_open") vi.spyOn(f.ports, "open").mockRejectedValueOnce(sensitive);
    if (failureStage === "token_exchange") vi.mocked(f.ports.exchange).mockRejectedValueOnce(sensitive);
    if (failureStage === "token_validation") vi.mocked(f.ports.exchange).mockResolvedValueOnce({ accessToken: "PRIVATE_ACCESS", refreshToken: "PRIVATE_REFRESH", scopes: [FOUNDER_GMAIL_READ_SCOPE, "gmail.send"] });
    if (failureStage === "mailbox_verification") vi.mocked(f.ports.verify).mockRejectedValueOnce(sensitive);
    if (failureStage === "owner_recheck") vi.mocked(f.ports.verify).mockImplementationOnce(async () => { f.setOwner(false); return { mailbox: "nijel@tryblueprint.io", sender: "nijel@tryblueprint.io" }; });
    if (failureStage === "storage_readiness") vi.mocked(f.ports.verify).mockImplementationOnce(async () => { f.setReady(false); return { mailbox: "nijel@tryblueprint.io", sender: "nijel@tryblueprint.io" }; });
    if (failureStage === "credential_persistence") vi.mocked(f.ports.save).mockRejectedValueOnce(sensitive);
    if (failureStage === "connection_acknowledgement") {
      const set = f.ports.flows.set.bind(f.ports.flows);
      vi.spyOn(f.ports.flows, "set").mockImplementation(async (id, row) => {
        if (row.phase === "connected_readonly") throw sensitive;
        return set(id, row);
      });
    }
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toMatchObject({
      code: "founder_oauth_exchange_failed_requires_new_owner_consent", status: 503, failureStage,
    });
    f.setOwner(true); f.setReady(true);
    const status = await f.consent.status(f.identity, flow.cookie);
    expect(status).toEqual({ state: "failed_requires_new_owner_consent", failureStage });
    expect(JSON.stringify(status)).not.toMatch(/PRIVATE_|provider details/);
    const record = [...f.records.values()][0];
    expect(record.secrets).toBeNull(); expect(JSON.stringify(record)).not.toMatch(/PRIVATE_|provider details/);
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_exchange_already_claimed");
    expect(f.ports.exchange).toHaveBeenCalledTimes(failureStage === "secret_open" ? 0 : 1);
    expect(f.ports.save).toHaveBeenCalledTimes(["credential_persistence", "connection_acknowledgement"].includes(failureStage) ? 1 : 0);
  });
  it("omits unknown persisted failure metadata from status", async () => {
    const f = consentFixture(), flow = await f.start();
    const id = createHash("sha256").update(flow.state).digest("hex");
    f.records.set(id, { ...f.records.get(id), phase: "failed_requires_new_owner_consent", secrets: null, failureStage: "PRIVATE_ACCESS" });
    expect(await f.consent.status(f.identity, flow.cookie)).toEqual({ state: "failed_requires_new_owner_consent" });
  });
});
