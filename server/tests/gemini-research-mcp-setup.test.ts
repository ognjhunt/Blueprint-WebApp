// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { MemoryWorkStore } from "./helpers/work-memory-store";
import { BlueprintWorkOAuth } from "../utils/blueprintWorkOAuth";
import { setupGeminiResearchCredential, type ResearchCredentialMetadata } from "../utils/geminiResearchMcpSetup";
import { executeGeminiResearchTool, type ResearchArtifacts } from "../utils/geminiResearchMcp";
const identity = { uid: "operator-1", tenantId: null, authTime: 1000 };
const now = 1000;
const control = { enabled: true, actorUid: identity.uid, tenantId: null, scopeRef: "retained-scope", budgetRef: "retained-budget",
  expiresAt: new Date((now + 7200) * 1000).toISOString(), dailySoftTargetMicros: 10000000, reservationMicros: 5000000 };
async function fixture() {
  const auth = new MemoryWorkStore(), store = new MemoryWorkStore(); await store.set("control", control);
  let allowed = true;
  const provider = new BlueprintWorkOAuth(auth, "https://tryblueprint.io", async id => allowed && id.uid === identity.uid, () => now, store);
  const artifacts: ResearchArtifacts = { retain: vi.fn(async value => {
    expect(JSON.stringify(value)).not.toContain("access_token"); expect(JSON.stringify(value)).not.toContain("refresh_token");
    return { artifactRef: "gs://company/private.json", sha256: "a".repeat(64), bytes: 123, generation: "1" };
  }), read: async () => ({}) };
  return { auth, store, provider, artifacts, clock: () => new Date(now * 1000), revokeRole: () => { allowed = false; } };
}
describe("trusted research-only MCP credential setup", () => {
  it("reuses hashed OAuth grants and rotating refresh without callbacks, clamped to actual owner expiry and role/control", async () => {
    const f = await fixture();
    const grant = await f.provider.mintResearchOperatorGrant(identity, { setupKey: "one", expiresAt: new Date((now + 300) * 1000).toISOString() });
    expect(grant.expiresAt).toBe(now + 300); expect(grant.tokens.expires_in).toBe(300);
    expect(grant.client).toMatchObject({ redirect_uris: [], token_endpoint_auth_method: "none", grant_types: ["refresh_token"] });
    expect((await f.provider.verifyAccessToken(grant.tokens.access_token)).scopes).toEqual(["blueprint:research:read", "blueprint:research:start"]);
    expect(JSON.stringify([...f.auth.rows])).not.toContain(grant.tokens.access_token);
    expect(JSON.stringify([...f.auth.rows])).not.toContain(grant.tokens.refresh_token);
    await expect(f.provider.exchangeRefreshToken(grant.client, grant.tokens.refresh_token!, ["blueprint:runs:launch"], new URL(f.provider.resource))).rejects.toThrow();
    const refreshed = await f.provider.exchangeRefreshToken(grant.client, grant.tokens.refresh_token!, undefined, new URL(f.provider.resource));
    expect(refreshed.expires_in).toBe(300);
    await f.store.set("control", { ...control, budgetRef: "different" });
    await expect(f.provider.verifyAccessToken(refreshed.access_token)).rejects.toThrow();
    await expect(f.provider.exchangeRefreshToken(grant.client, refreshed.refresh_token!, undefined, new URL(f.provider.resource))).rejects.toThrow();
  });
  it("does not mint for an unverified role, another actor, disabled authority or missing explicit expiry", async () => {
    const f = await fixture(); const input = { setupKey: "one", expiresAt: control.expiresAt };
    await expect(f.provider.mintResearchOperatorGrant({ ...identity, uid: "different" }, input)).rejects.toThrow();
    await expect(f.provider.mintResearchOperatorGrant(identity, { ...input, expiresAt: "" })).rejects.toThrow();
    await f.store.set("control", { ...control, enabled: false });
    await expect(f.provider.mintResearchOperatorGrant(identity, input)).rejects.toThrow();
    expect(f.auth.rows.size).toBe(0);
    await f.store.set("control", control); f.revokeRole();
    await expect(f.provider.mintResearchOperatorGrant(identity, input)).rejects.toThrow();
    expect(f.auth.rows.size).toBe(0);
  });
  it("keeps existing-token and refreshed reads usable after admission closes without creating another request", async () => {
    const f = await fixture();
    const grant = await f.provider.mintResearchOperatorGrant(identity, { setupKey: "one", expiresAt: control.expiresAt });
    const output = { id: "research-original", status: "completed", outputs: [{ text: "Exact retained report\n" }] };
    const create = vi.fn(async () => output), get = vi.fn(async () => output);
    const deps = { ...f, create, get, ready: () => {}, artifacts: { ...f.artifacts, read: vi.fn(async () => output) } };
    const question = { request_key: "original", question: "The original approved question" };
    const initial = await f.provider.verifyAccessToken(grant.tokens.access_token);
    await executeGeminiResearchTool("start_gemini_deep_research", question, initial.extra.identity, initial.scopes, deps);
    await f.store.set("control", { ...control, enabled: false });
    const closedRows = structuredClone([...f.store.rows]);
    const existing = await f.provider.verifyAccessToken(grant.tokens.access_token);
    expect(await executeGeminiResearchTool("get_gemini_deep_research", { request_key: question.request_key },
      existing.extra.identity, existing.scopes, deps)).toMatchObject({ provider_id: output.id, report: "Exact retained report\n" });
    const refreshed = await f.provider.exchangeRefreshToken(grant.client, grant.tokens.refresh_token!, undefined, new URL(f.provider.resource));
    const refreshedAccess = await f.provider.verifyAccessToken(refreshed.access_token);
    expect(await executeGeminiResearchTool("get_gemini_deep_research", { request_key: question.request_key },
      refreshedAccess.extra.identity, refreshedAccess.scopes, deps)).toMatchObject({ provider_id: output.id, report: "Exact retained report\n" });
    expect(await executeGeminiResearchTool("start_gemini_deep_research", question,
      refreshedAccess.extra.identity, refreshedAccess.scopes, deps)).toMatchObject({ provider_id: output.id, status: "completed" });
    await expect(executeGeminiResearchTool("start_gemini_deep_research", { ...question, request_key: "new-request" },
      refreshedAccess.extra.identity, refreshedAccess.scopes, deps)).rejects.toThrow("research_admission_disabled_or_expired");
    expect(create).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
    expect([...f.store.rows]).toEqual(closedRows);
    f.revokeRole();
    await expect(f.provider.verifyAccessToken(refreshed.access_token)).rejects.toThrow();
    await expect(f.provider.exchangeRefreshToken(grant.client, refreshed.refresh_token!, undefined, new URL(f.provider.resource))).rejects.toThrow();
  });
  it("recovers a credential registration lost ACK by exact singleton metadata without reminting or another registration", async () => {
    const f = await fixture(); let credentials: ResearchCredentialMetadata[] = [];
    const inventory = vi.fn(async () => ({ vaultId: "vault_existing", object: "vault", complete: true, credentials }));
    let access = "", refresh = "";
    const register = vi.fn(async (vaultId: string, body: any): Promise<ResearchCredentialMetadata> => {
      access = body.auth.access_token; refresh = body.auth.refresh.refresh_token;
      expect(body.auth.refresh).toMatchObject({ token_endpoint_auth: { type: "none" }, resource: f.provider.resource,
        scope: "blueprint:research:read blueprint:research:start" });
      credentials = [{ id: "credential_original", vault_id: vaultId, metadata: body.metadata,
        auth: { type: "mcp_oauth", mcp_server_url: body.auth.mcp_server_url } }];
      throw new Error("lost response after accepted register");
    });
    const input = { setupKey: "one", vaultId: "vault_existing", expiresAt: control.expiresAt };
    const deps = { ...f, inventory, register };
    expect(await setupGeminiResearchCredential(input, identity, deps)).toMatchObject({ state: "credential_ack_unknown" });
    expect(await setupGeminiResearchCredential(input, identity, deps)).toMatchObject({ state: "credential_readback_verified", credential_id: "credential_original", authenticated_tool_use_proven: false });
    expect(register).toHaveBeenCalledTimes(1);
    const records = JSON.stringify([...f.auth.rows, ...f.store.rows]);
    expect(records).not.toContain(access); expect(records).not.toContain(refresh);
    expect(f.artifacts.retain).toHaveBeenCalledOnce();
    await expect(setupGeminiResearchCredential({ ...input, expiresAt: new Date((now + 60) * 1000).toISOString() }, identity, deps)).rejects.toThrow("original_claim_changed");
  });
  it("accepts an actual SDK-shaped existing vault with object/id and no invented status field", async () => {
    const f = await fixture();
    const sdkVault = { id: "vault_existing", created_at: 1791028800, metadata: {}, name: "Owner research", object: "vault" };
    expect(sdkVault).not.toHaveProperty("status");
    let credentials: ResearchCredentialMetadata[] = [];
    const inventory = async () => ({ vaultId: sdkVault.id, object: sdkVault.object, complete: true, credentials });
    const register = vi.fn(async (vaultId: string, body: any) => {
      const credential = { id: "credential_sdk_one", vault_id: vaultId, metadata: body.metadata,
        auth: { type: "mcp_oauth", mcp_server_url: body.auth.mcp_server_url } };
      credentials = [credential]; return credential;
    });
    expect(await setupGeminiResearchCredential({ setupKey: "sdk-shaped", vaultId: sdkVault.id, expiresAt: control.expiresAt },
      identity, { ...f, inventory, register })).toMatchObject({ state: "credential_readback_verified", credential_id: "credential_sdk_one" });
    expect(register).toHaveBeenCalledOnce();
    const g = await fixture();
    await expect(setupGeminiResearchCredential({ setupKey: "wrong-object", vaultId: sdkVault.id, expiresAt: control.expiresAt },
      identity, { ...g, register, inventory: async () => ({ vaultId: sdkVault.id, object: "not-a-vault", complete: true, credentials: [] }) }))
      .rejects.toThrow("dedicated_vault_required");
    expect(register).toHaveBeenCalledOnce(); expect(g.auth.rows.size).toBe(0);
  });
  it("refuses unrelated or incomplete vault contents before minting tokens or registration", async () => {
    const f = await fixture(); const register = vi.fn();
    const input = { setupKey: "one", vaultId: "vault_existing", expiresAt: control.expiresAt };
    const unrelated = { id: "credential_unrelated", vault_id: "vault_existing", metadata: {}, auth: { type: "static_bearer" } };
    await expect(setupGeminiResearchCredential(input, identity, { ...f, register,
      inventory: async () => ({ vaultId: "vault_existing", object: "vault", complete: true, credentials: [unrelated] }) })).rejects.toThrow("unrelated");
    await expect(setupGeminiResearchCredential(input, identity, { ...f, register,
      inventory: async () => ({ vaultId: "vault_existing", object: "vault", complete: false, credentials: [] }) })).rejects.toThrow("dedicated");
    expect(f.auth.rows.size).toBe(0); expect(register).not.toHaveBeenCalled();
  });
});
