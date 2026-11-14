// @vitest-environment node
/**
 * Every OpenAI client in the web and worker process sends to OpenAI's own
 * host. A left-over OPENAI_BASE_URL naming another host makes OpenAI not
 * configured: no client is built and nothing is sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructed = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const created = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    constructor(options: Record<string, unknown>) { constructed.push(options); }
    responses = { create: created };
    embeddings = { create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.5] }] }) };
  },
}));

const OTHER = "https://compat.other-company.example/v1";

beforeEach(() => {
  constructed.length = 0;
  created.mockReset();
  created.mockResolvedValue({ output_text: "{\"question_ids\":[]}" });
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.stubEnv("OPENAI_BASE_URL", "");
  vi.resetModules();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("OpenAI host pin", () => {
  it("reports why OpenAI is not usable, never the value", async () => {
    const host = await import("../utils/openaiApiHost");
    expect(host.getOpenAiConfigurationIssue()).toBeNull();
    vi.stubEnv("OPENAI_BASE_URL", OTHER);
    expect(host.getOpenAiConfigurationIssue()).toBe("openai_base_url_names_another_host");
    expect(host.getUsableOpenAiApiKey()).toBeNull();
    vi.stubEnv("OPENAI_BASE_URL", "http://api.openai.com/v1");
    expect(host.getOpenAiConfigurationIssue()).toBe("openai_base_url_names_another_host");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    expect(host.getOpenAiConfigurationIssue()).toBeNull();
  });

  it("the agent adapter builds no client and sends nothing under another host; pins OpenAI's host otherwise", async () => {
    vi.stubEnv("OPENAI_BASE_URL", OTHER);
    const elsewhere = await import("../agents/adapters/openai-responses");
    expect(constructed).toEqual([]);
    const result = await elsewhere.runOpenAIResponsesTask({ kind: "support_triage", provider: "openai_responses",
      runtime: "openai_responses", model: "gpt-6-luna", input: {}, tool_policy: { mode: "api" } } as never);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("openai_base_url_names_another_host");
    expect(JSON.stringify(result)).not.toContain("other-company");
    expect(created).not.toHaveBeenCalled();
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.resetModules();
    await import("../agents/adapters/openai-responses");
    expect(constructed.at(-1)).toMatchObject({ baseURL: "https://api.openai.com/v1" });
  });

  it("embeddings build no client under another host, and pin the host otherwise", async () => {
    vi.stubEnv("OPENAI_BASE_URL", OTHER);
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(constructed).toEqual([]);
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.resetModules();
    await (await import("../retrieval/embeddings")).embedTexts(["a"]);
    expect(constructed.length).toBe(1);
    expect(constructed[0]).toMatchObject({ baseURL: "https://api.openai.com/v1" });
    // The follow-up picker builds no client of its own: it goes through the runtime's pinned adapter.
    const source = (await import("node:fs")).readFileSync(new URL("../utils/siteTaskFollowUp.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/new OpenAI\(/);
  });

});
