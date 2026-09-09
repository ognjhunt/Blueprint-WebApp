// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Response } from "express";
import { BlueprintWorkOAuth, admittedWorkRedirect, WORK_SCOPES } from "../utils/blueprintWorkOAuth";

import { MemoryWorkStore } from "./helpers/work-memory-store";

const identity = { uid: "operator-1", tenantId: null, authTime: 1000 };
const redirect = "https://chatgpt.com/connector/oauth/test-client";
const verifier = "a".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");
async function fixture(scopes = WORK_SCOPES) {
  const store = new MemoryWorkStore(); let now = 1000, allowed = true;
  const provider = new BlueprintWorkOAuth(store, "https://tryblueprint.io", async () => allowed, () => now);
  const client = await provider.clientsStore.registerClient({ redirect_uris: [redirect], token_endpoint_auth_method: "none" });
  let location = "";
  await provider.authorize(client, { redirectUri: redirect, codeChallenge: challenge, state: "state-1", scopes, resource: new URL(provider.resource) }, { redirect: (url: string) => { location = url; } } as Response);
  const flow = new URL(location).searchParams.get("flow")!;
  const approved = new URL(await provider.approve(flow, identity, true));
  const code = approved.searchParams.get("code")!;
  const exchange = () => provider.exchangeAuthorizationCode(client, code, verifier, redirect, new URL(provider.resource));
  return { store, provider, client, code, flow, approved, exchange, expire: () => { now += 3600; }, removeAccess: () => { allowed = false; } };
}

describe("Blueprint Work OAuth authority", () => {
  it("binds consent, client, PKCE and audience; stores only hashes of bearer credentials", async () => {
    const f = await fixture();
    expect(f.approved.searchParams.get("state")).toBe("state-1");
    const tokens = await f.exchange();
    expect(await f.provider.verifyAccessToken(tokens.access_token)).toMatchObject({ scopes: WORK_SCOPES, extra: { identity } });
    const serialized = JSON.stringify([...f.store.rows]);
    expect(serialized).not.toContain(tokens.access_token);
    expect(serialized).not.toContain(tokens.refresh_token);
    expect(serialized).not.toContain(f.code);
    expect(serialized).not.toContain(f.flow);
    await expect(f.exchange()).rejects.toThrow();
  });
  it.each(["https://evil.example/callback", "https://chatgpt.com.evil.example/connector/oauth/x", "https://chatgpt.com/connector/oauth/x?next=https://evil.example", "http://chatgpt.com/connector/oauth/x", "https://chatgpt.com@evil.example/connector/oauth/x", "https://chatgpt.com/anything"])("rejects an unsafe redirect %s", url => {
    expect(admittedWorkRedirect(url)).toBe(false);
  });
  it("allows exactly one code exchange under concurrent requests", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([f.exchange(), f.exchange()]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects wrong verifier, resource, redirect and client without consuming the valid code", async () => {
    const f = await fixture();
    await expect(f.provider.exchangeAuthorizationCode(f.client, f.code, "b".repeat(64), redirect, new URL(f.provider.resource))).rejects.toThrow();
    await expect(f.provider.exchangeAuthorizationCode(f.client, f.code, verifier, redirect, new URL("https://evil.example"))).rejects.toThrow();
    await expect(f.provider.exchangeAuthorizationCode(f.client, f.code, verifier, "https://chatgpt.com/connector/oauth/other", new URL(f.provider.resource))).rejects.toThrow();
    await expect(f.provider.exchangeAuthorizationCode({ ...f.client, client_id: "other" }, f.code, verifier, redirect, new URL(f.provider.resource))).rejects.toThrow();
    await expect(f.exchange()).resolves.toHaveProperty("access_token");
  });
  it("refreshes with narrowed scopes and revokes the whole connection on refresh-token replay", async () => {
    const f = await fixture(); const first = await f.exchange();
    const next = await f.provider.exchangeRefreshToken(f.client, first.refresh_token!, [WORK_SCOPES[0]], new URL(f.provider.resource));
    expect((await f.provider.verifyAccessToken(next.access_token)).scopes).toEqual([WORK_SCOPES[0]]);
    await expect(f.provider.exchangeRefreshToken(f.client, next.refresh_token!, WORK_SCOPES, new URL(f.provider.resource))).rejects.toThrow();
    await expect(f.provider.exchangeRefreshToken(f.client, first.refresh_token!, undefined, new URL(f.provider.resource))).rejects.toThrow();
    await expect(f.provider.verifyAccessToken(next.access_token)).rejects.toThrow();
    await expect(f.provider.verifyAccessToken(first.access_token)).rejects.toThrow();
  });
  it("rejects expired and role-revoked tokens and supports explicit connection revocation", async () => {
    const f = await fixture(); const tokens = await f.exchange(); f.removeAccess();
    await expect(f.provider.verifyAccessToken(tokens.access_token)).rejects.toThrow();
    await expect(f.provider.exchangeRefreshToken(f.client, tokens.refresh_token!, undefined, new URL(f.provider.resource))).rejects.toThrow();
    const g = await fixture(); const t = await g.exchange(); g.expire();
    await expect(g.provider.verifyAccessToken(t.access_token)).rejects.toThrow();
    const refreshed = await g.provider.exchangeRefreshToken(g.client, t.refresh_token!, undefined, new URL(g.provider.resource));
    await g.provider.revokeToken(g.client, { token: refreshed.access_token });
    await expect(g.provider.verifyAccessToken(refreshed.access_token)).rejects.toThrow();
  });
});
