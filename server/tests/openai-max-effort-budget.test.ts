/**
 * The same failure as #579, one provider over.
 *
 * `inbound_qualification` runs at reasoning effort "max", and on the Responses
 * API reasoning tokens are spent out of `max_output_tokens` — the identical
 * arithmetic that made DeepSeek return a successful, empty response until the
 * ceiling went from 2,000 to 16,000. The OpenAI adapter shipped a 4,000-token
 * ceiling and a 20-second timeout, both fine for a short chat turn and neither
 * survivable by the lane that reads a site's prose against its own dropdowns at
 * max effort. Routing that lane to Luna without moving these two numbers just
 * reproduces the empty-response bug on a different bill.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { inboundQualificationOutputSchema } from "../agents/tasks/inbound-qualification";

const ENV_KEYS = [
  "BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS",
  "OPENAI_TIMEOUT_MS",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "CODEX_LOCAL_AVAILABLE",
  "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER",
];

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.resetModules();
  process.env.CODEX_LOCAL_AVAILABLE = "0";
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.resetModules();
});

// The qualification schema's declared maxima sum to ~8,573 characters of JSON,
// which is roughly 2,150 tokens before a single reasoning token is spent.
const APPROX_SCHEMA_CONTENT_TOKENS = 8573 / 4;

describe("OpenAI output budget", () => {
  it("leaves room for the largest schema's output after max-effort reasoning", async () => {
    const { getOpenAiMaxOutputTokens } = await import("../agents/provider-config");
    expect(getOpenAiMaxOutputTokens()).toBeGreaterThan(APPROX_SCHEMA_CONTENT_TOKENS * 2);
  });

  it("still describes the shape that made the budget large", () => {
    // Same guard the DeepSeek test carries: if the schema moves a lot, the
    // ceiling deserves rechecking rather than silently drifting.
    const shape = inboundQualificationOutputSchema.shape;
    expect(shape.buyer_follow_up).toBeDefined();
    expect(shape.internal_summary).toBeDefined();
    expect(shape.missing_information).toBeDefined();
  });

  it("honours an explicit ceiling", async () => {
    process.env.BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS = "8000";
    vi.resetModules();
    const { getOpenAiMaxOutputTokens } = await import("../agents/provider-config");
    expect(getOpenAiMaxOutputTokens()).toBe(8000);
  });

  it("refuses a ceiling the API would reject", async () => {
    process.env.BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS = "999999999";
    vi.resetModules();
    const { getOpenAiMaxOutputTokens } = await import("../agents/provider-config");
    expect(getOpenAiMaxOutputTokens()).toBe(128_000);
  });
});

describe("OpenAI timeout", () => {
  it("gives a reasoning lane as long as the DeepSeek lane already gets", async () => {
    const { getOpenAiTimeoutMs } = await import("../agents/provider-config");
    expect(getOpenAiTimeoutMs()).toBeGreaterThanOrEqual(120_000);
  });

  it("honours an explicit timeout", async () => {
    process.env.OPENAI_TIMEOUT_MS = "45000";
    vi.resetModules();
    const { getOpenAiTimeoutMs } = await import("../agents/provider-config");
    expect(getOpenAiTimeoutMs()).toBe(45_000);
  });

  it("reports to ops the timeout the client will actually use", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "openai_responses";
    vi.resetModules();
    const { getOpenAiTimeoutMs } = await import("../agents/provider-config");
    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata().timeout_ms).toBe(getOpenAiTimeoutMs());
  });
});

describe("adapter wiring", () => {
  it("takes both numbers from the shared config rather than its own constants", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("server/agents/adapters/openai-responses.ts", "utf8");

    expect(source).toContain("getOpenAiMaxOutputTokens");
    expect(source).toContain("getOpenAiTimeoutMs");
    // The old locally-declared defaults are what made the shared value a lie.
    expect(source).not.toMatch(/process\.env\.OPENAI_TIMEOUT_MS/);
    expect(source).not.toMatch(/process\.env\.BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS/);
  });
});
