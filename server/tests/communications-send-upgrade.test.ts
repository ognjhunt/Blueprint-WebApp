// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { consentFixture, sendUpgradeFixture } from "./fixtures/communications-oauth";
import { FOUNDER_GMAIL_READ_SCOPE as READ, FOUNDER_GMAIL_SEND_SCOPE as SEND } from "../agents/communications-connection";

describe("explicit owner-controlled founder send-capability upgrade", () => {
  it("requires an existing verified private binding before preparing the exact two-scope consent", async () => {
    const absent = consentFixture();
    await expect(absent.consent.start(absent.identity, "send_upgrade")).rejects.toThrow("founder_oauth_secure_storage_unavailable");
    expect(absent.records.size).toBe(0); expect(absent.ports.exchange).not.toHaveBeenCalled();
    const f = sendUpgradeFixture(), original = f.getBinding(), flow = await f.startUpgrade(), url = new URL(flow.authorizationUrl);
    expect(url.searchParams.get("scope")).toBe(`${READ} ${SEND}`);
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(f.getBinding()).toEqual(original); expect(f.ports.save).not.toHaveBeenCalled(); expect(f.ports.saveUpgrade).not.toHaveBeenCalled();
  });
  it("requires the matching explicit completion endpoint and never exchanges on callback or wrong purpose", async () => {
    const f = sendUpgradeFixture(), flow = await f.startUpgrade();
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    f.setReady(true); // Even an initial-connect-ready port cannot cross purposes.
    await expect(f.consent.finish(f.identity, flow.cookie)).rejects.toThrow("founder_oauth_purpose_mismatch");
    expect(f.ports.exchange).not.toHaveBeenCalled(); expect(f.ports.saveUpgrade).not.toHaveBeenCalled();
    expect(await f.consent.status(f.identity, flow.cookie)).toMatchObject({ state: "awaiting_owner", purpose: "send_upgrade", sendUpgradeAvailable: true, sendScopeGranted: false });
  });
  it("validates both scopes regardless of Google ordering and commits only the versioned send upgrade", async () => {
    const f = sendUpgradeFixture(), flow = await f.startUpgrade();
    vi.mocked(f.ports.exchange).mockResolvedValueOnce({ refreshToken: "PRIVATE_NEW_REFRESH", accessToken: "PRIVATE_ACCESS", scopes: [SEND, READ] });
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    expect(await f.consent.finish(f.identity, flow.cookie, "send_upgrade")).toMatchObject({ state: "connected_send_capable", sendScopeGranted: true, sendsEnabled: false, messagePolicyRequired: true });
    expect(f.getSaved()).toMatchObject({ version: "blueprint.founder-gmail-credential.v2", consentPurpose: "send_upgrade", upgradedFromFlowId: "readonly-flow", scopes: [READ, SEND] });
    expect(f.ports.save).not.toHaveBeenCalled(); expect(f.ports.saveUpgrade).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...f.records.values()])).not.toMatch(/PRIVATE_CODE|PRIVATE_ACCESS|PRIVATE_NEW_REFRESH/);
    expect(await f.consent.status(f.identity, "")).toEqual({ state: "connected_send_capable", sendScopeGranted: true, sendUpgradeAvailable: false, draftScopeGranted: false, draftUpgradeAvailable: false });
  });
  it.each([{ scopes: [READ] }, { scopes: [SEND] }, { scopes: [READ, READ] }, { scopes: [READ, SEND, "https://mail.google.com/"] }])("preserves the current binding when the granted scope set is $scopes", async ({ scopes }) => {
    const f = sendUpgradeFixture(), original = f.getBinding(), flow = await f.startUpgrade();
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    vi.mocked(f.ports.exchange).mockResolvedValueOnce({ refreshToken: "PRIVATE_NEW_REFRESH", accessToken: "PRIVATE_ACCESS", scopes });
    await expect(f.consent.finish(f.identity, flow.cookie, "send_upgrade")).rejects.toMatchObject({ failureStage: "token_validation" });
    expect(f.getBinding()).toEqual(original); expect(f.ports.saveUpgrade).not.toHaveBeenCalled();
    await expect(f.consent.finish(f.identity, flow.cookie, "send_upgrade")).rejects.toThrow("founder_oauth_exchange_already_claimed");
    expect(f.ports.exchange).toHaveBeenCalledTimes(1);
  });
  it.each(["exchange", "identity", "storage", "persistence"])("preserves the read-only binding on %s failure and never revokes or retries", async failure => {
    const f = sendUpgradeFixture(), original = f.getBinding(), flow = await f.startUpgrade();
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    if (failure === "exchange") vi.mocked(f.ports.exchange).mockRejectedValueOnce(new Error("PRIVATE_ACCESS provider detail"));
    if (failure === "identity") vi.mocked(f.ports.verify).mockResolvedValueOnce({ mailbox: "other@example.com", sender: "nijel@tryblueprint.io" });
    if (failure === "storage") vi.mocked(f.ports.currentBinding!).mockResolvedValueOnce({ ...original!, revision: "c".repeat(64) });
    if (failure === "persistence") vi.mocked(f.ports.saveUpgrade!).mockRejectedValueOnce(new Error("PRIVATE_NEW_REFRESH provider detail"));
    await expect(f.consent.finish(f.identity, flow.cookie, "send_upgrade")).rejects.toThrow("founder_oauth_exchange_failed_requires_new_owner_consent");
    expect(f.getBinding()).toEqual(original); expect(f.getSaved()).toBeNull();
    expect(JSON.stringify(await f.consent.status(f.identity, flow.cookie))).not.toMatch(/PRIVATE_|provider detail/);
    await expect(f.consent.finish(f.identity, flow.cookie, "send_upgrade")).rejects.toThrow("founder_oauth_exchange_already_claimed");
    expect(f.ports.exchange).toHaveBeenCalledTimes(1);
  });
  it("keeps the original connection after denial and claims concurrent completion only once", async () => {
    const denied = sendUpgradeFixture(), original = denied.getBinding(), denial = await denied.startUpgrade();
    await denied.consent.callback({ state: denial.state, denied: true }, denial.cookie);
    await expect(denied.consent.finish(denied.identity, denial.cookie, "send_upgrade")).rejects.toThrow("founder_oauth_exchange_already_claimed");
    expect(denied.getBinding()).toEqual(original); expect(denied.ports.exchange).not.toHaveBeenCalled();
    const f = sendUpgradeFixture(), flow = await f.startUpgrade();
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    await Promise.allSettled([1, 2].map(() => f.consent.finish(f.identity, flow.cookie, "send_upgrade")));
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.saveUpgrade).toHaveBeenCalledTimes(1);
  });
  it("recovers a committed upgrade acknowledgement without retrying the exchange or marking it failed", async () => {
    const f = sendUpgradeFixture(), flow = await f.startUpgrade(), save = vi.mocked(f.ports.saveUpgrade!).getMockImplementation()!;
    vi.mocked(f.ports.saveUpgrade!).mockImplementationOnce(async (...args) => { await save(...args); throw new Error("mock lost acknowledgement"); });
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    expect(await f.consent.finish(f.identity, flow.cookie, "send_upgrade")).toMatchObject({ state: "connected_send_capable", sendsEnabled: false });
    expect(await f.consent.status(f.identity, flow.cookie)).toMatchObject({ state: "connected_send_capable", sendScopeGranted: true });
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.saveUpgrade).toHaveBeenCalledTimes(1);
  });
});
