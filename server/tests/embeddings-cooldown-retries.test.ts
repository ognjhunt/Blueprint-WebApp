// @vitest-environment node
/**
 * Embeddings through the real OpenAI SDK with a stubbed fetch (no network):
 * the first "no funds" answer is retried by the client's default setting and
 * still marks the provider; during the cool-down one request is sent and the
 * search falls back at once; a plain rate limit outside it is retried as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchStub = vi.fn();
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "retry-after-ms": "1" } });
const noFunds = () => reply(429, { error: { type: "insufficient_quota", code: "insufficient_quota", message: "x" } });

beforeEach(async () => {
  fetchStub.mockReset();
  vi.stubGlobal("fetch", fetchStub);
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.stubEnv("OPENAI_BASE_URL", "");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("embeddings retries and the no-funds cool-down", () => {
  it("retries the first no-funds answer with the client's default (3 requests), marks the provider, then sends once", async () => {
    fetchStub.mockImplementation(async () => noFunds());
    const { embedTexts } = await import("../retrieval/embeddings");
    const funds = await import("../agents/provider-funds");
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(fetchStub).toHaveBeenCalledTimes(3);
    expect(funds.isProviderCoolingDown("openai_responses")).toBe(true);
    fetchStub.mockClear();
    const started = Date.now();
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("still retries a plain rate limit outside the cool-down", async () => {
    fetchStub.mockImplementationOnce(async () => reply(429, { error: { type: "requests", code: "rate_limit_exceeded", message: "x" } }))
      .mockImplementation(async () => reply(200, { object: "list", data: [{ object: "embedding", index: 0,
        // The SDK asks for base64 and decodes it: one float32, 0.5.
        embedding: Buffer.from(new Float32Array([0.5]).buffer).toString("base64") }],
        model: "m", usage: { prompt_tokens: 1, total_tokens: 1 } }));
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[0.5]]);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
