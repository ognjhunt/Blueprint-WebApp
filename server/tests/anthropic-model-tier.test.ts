// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function config() {
  return import("../agents/provider-config");
}

beforeEach(() => {
  vi.resetModules();
  for (const key of ["ANTHROPIC_DEFAULT_MODEL", "OPENAI_DEFAULT_MODEL", "OPENAI_ROBOT_FIT_RANKING_MODEL",
    "ANTHROPIC_ROBOT_FIT_RANKING_MODEL", "ANTHROPIC_TIMEOUT_MS", "BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS",
    "ANTHROPIC_EFFORT"]) vi.stubEnv(key, "");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Anthropic model at the same level as the lane's OpenAI model", () => {
  it("maps the small model to the small one and the top model to the top one", async () => {
    const { anthropicModelForOpenAiModel } = await config();
    expect(anthropicModelForOpenAiModel("gpt-6-luna")).toBe("claude-haiku-5-5");
    expect(anthropicModelForOpenAiModel("gpt-6.1-sol")).toBe("claude-opus-5-5");
    expect(anthropicModelForOpenAiModel("a-model-the-table-does-not-know")).toBe("claude-opus-5-5");
  });

  it("follows the lane's OpenAI model, and each override wins in order", async () => {
    const { getTaskModelByProvider } = await config();
    expect(getTaskModelByProvider("robot_fit_ranking").anthropic_agent_sdk).toBe("claude-haiku-5-5");
    vi.stubEnv("OPENAI_ROBOT_FIT_RANKING_MODEL", "gpt-6.1-sol");
    expect(getTaskModelByProvider("robot_fit_ranking").anthropic_agent_sdk).toBe("claude-opus-5-5");
    vi.stubEnv("ANTHROPIC_DEFAULT_MODEL", "claude-opus-5-5");
    vi.stubEnv("OPENAI_ROBOT_FIT_RANKING_MODEL", "");
    expect(getTaskModelByProvider("robot_fit_ranking").anthropic_agent_sdk).toBe("claude-opus-5-5");
    vi.stubEnv("ANTHROPIC_ROBOT_FIT_RANKING_MODEL", "claude-haiku-5-5");
    expect(getTaskModelByProvider("robot_fit_ranking").anthropic_agent_sdk).toBe("claude-haiku-5-5");
  });

  it("gives a lane with no model setting the default lane's level", async () => {
    const { getDefaultAnthropicModel } = await config();
    expect(getDefaultAnthropicModel()).toBe("claude-haiku-5-5");
  });
});

describe("Anthropic limits and effort", () => {
  it("has room for thinking plus the reply and a deadline long enough to stream it", async () => {
    const { getAnthropicMaxOutputTokens, getAnthropicTimeoutMs } = await config();
    expect(getAnthropicMaxOutputTokens()).toBe(64_000);
    expect(getAnthropicTimeoutMs()).toBe(300_000);
    vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "999999");
    vi.stubEnv("ANTHROPIC_TIMEOUT_MS", "20000");
    expect(getAnthropicMaxOutputTokens()).toBe(128_000);
    expect(getAnthropicTimeoutMs()).toBe(20_000);
  });

});
