// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { founderGoogleConsent } from "../agents/communications-oauth-google";
import { FOUNDER_OAUTH_CALLBACK } from "../agents/communications-oauth";
import { FOUNDER_GMAIL_READ_SCOPE } from "../agents/communications-connection";
const input = { clientId: "client", callback: FOUNDER_OAUTH_CALLBACK, code: "PRIVATE_CODE", verifier: "PRIVATE_VERIFIER" };
describe("bounded standard Google token exchange", () => {
  it("binds code/verifier to fixed client/callback and never requests broader scope", async () => {
    const fetcher = vi.fn(async () => Response.json({ token_type: "Bearer", access_token: "PRIVATE_ACCESS", refresh_token: "PRIVATE_REFRESH", scope: FOUNDER_GMAIL_READ_SCOPE }));
    const adapter = founderGoogleConsent("client", "PRIVATE_CLIENT_SECRET", fetcher as any);
    expect(await adapter.exchange(input)).toMatchObject({ scopes: [FOUNDER_GMAIL_READ_SCOPE] });
    const [url, request] = fetcher.mock.calls[0] as any;
    expect(url).toBe("https://oauth2.googleapis.com/token"); expect(request).toMatchObject({ method: "POST", redirect: "error" });
    expect(Object.fromEntries(request.body.entries())).toEqual({ grant_type: "authorization_code", client_id: "client", client_secret: "PRIVATE_CLIENT_SECRET", redirect_uri: FOUNDER_OAUTH_CALLBACK, code: "PRIVATE_CODE", code_verifier: "PRIVATE_VERIFIER" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not retry token POST or leak provider failures", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: "PRIVATE_CODE PRIVATE_REFRESH" }, { status: 503 }));
    await expect(founderGoogleConsent("client", "private", fetcher as any).exchange(input)).rejects.toThrow("founder_oauth_token_exchange_refused");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized responses and client mismatches", async () => {
    const fetcher = vi.fn(async () => new Response("a".repeat(16385)));
    const adapter = founderGoogleConsent("client", "private", fetcher as any);
    await expect(adapter.exchange({ ...input, clientId: "wrong" })).rejects.toThrow("founder_oauth_client_mismatch"); expect(fetcher).not.toHaveBeenCalled();
    await expect(adapter.exchange(input)).rejects.toThrow("founder_oauth_token_response_too_large");
  });
});
