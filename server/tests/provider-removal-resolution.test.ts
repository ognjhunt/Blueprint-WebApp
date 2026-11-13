/**
 * DeepSeek, Z.ai and OpenRouter are removed (owner, 2026-11-13). An unpinned
 * lane resolves exactly as it did in a deployment that had none of their keys,
 * and a deployment that still has one of those keys set resolves the same way:
 * a left-over key, or a setting naming a removed provider, selects nothing.
 *
 * The expected table is the chain as it stood without those keys, with one
 * change the owner decided (2026-11-13): OpenAI comes before Anthropic until a
 * paid test run passes. So: the lane's own default (OpenAI for the lanes that
 * write to people and for the ranking), then the global order: the configured
 * preference, the configured fallback, local Codex, the ACP harness, OpenAI,
 * Anthropic, OpenClaw, and local Codex when nothing is keyed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ACP_HARNESS_URL", "OPENCLAW_BASE_URL",
  "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
  "BLUEPRINT_OPERATOR_THREAD_PROVIDER", "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER",
  // Keys of the removed providers that a deployment may still hold.
  "DEEPSEEK_API_KEY", "ZAI_API_KEY", "OPENROUTER_API_KEY"];

beforeEach(() => {
  for (const key of KEYS) vi.stubEnv(key, "");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const DEFAULT_OPENAI_LANES = ["outbound_outreach", "waitlist_triage", "inbound_qualification", "support_triage",
  "post_signup_scheduling", "robot_fit_ranking"] as const;
const UNPINNED_LANES = ["preview_diagnosis", "operator_thread", "robot_capability_extraction", "site_task_brief_reading",
  "capture_dispatch"] as const;

type Keys = { openai?: boolean; anthropic?: boolean };
const cases: Array<[string, Keys, string, string]> = [
  // name, keys, a lane with an OpenAI default, an unpinned lane
  ["only an OpenAI key", { openai: true }, "openai_responses", "openai_responses"],
  ["only an Anthropic key", { anthropic: true }, "anthropic_agent_sdk", "anthropic_agent_sdk"],
  ["both keys", { openai: true, anthropic: true }, "openai_responses", "openai_responses"],
  ["no key", {}, "codex_local", "codex_local"],
];

async function resolve(keys: Keys, leftOver: boolean) {
  if (keys.openai) vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  if (keys.anthropic) vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
  if (leftOver) {
    vi.stubEnv("DEEPSEEK_API_KEY", "left-over");
    vi.stubEnv("ZAI_API_KEY", "left-over");
    vi.stubEnv("OPENROUTER_API_KEY", "left-over");
  }
  vi.resetModules();
  const { getStructuredAutomationProvider } = await import("../agents/provider-config");
  return Object.fromEntries([...DEFAULT_OPENAI_LANES, ...UNPINNED_LANES, undefined]
    .map(lane => [lane ?? "global", getStructuredAutomationProvider(lane)]));
}

describe("provider resolution after the removal", () => {
  it.each(cases)("with %s, every lane resolves as the chain did without the removed keys", async (_name, keys, withDefault, unpinned) => {
    const resolved = await resolve(keys, false);
    for (const lane of DEFAULT_OPENAI_LANES) expect(resolved[lane], lane).toBe(withDefault);
    for (const lane of UNPINNED_LANES) expect(resolved[lane], lane).toBe(unpinned);
    expect(resolved.global).toBe(unpinned);
  });

  it.each(cases)("with %s and the removed providers' keys still set, nothing changes", async (_name, keys) => {
    expect(await resolve(keys, true)).toEqual(await resolve(keys, false));
  });

  it("a setting that still names a removed provider is ignored, never followed", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("DEEPSEEK_API_KEY", "left-over");
    vi.stubEnv("ZAI_API_KEY", "left-over");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "zai_glm");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", "deepseek_chat");
    vi.stubEnv("BLUEPRINT_OPERATOR_THREAD_PROVIDER", "deepseek_chat");
    const { describeStructuredAutomationProvider, getStructuredAutomationFallbackProvider } = await import("../agents/provider-config");
    expect(describeStructuredAutomationProvider("operator_thread")).toMatchObject({
      provider: "openai_responses", lane_request: "deepseek_chat", lane_request_honored: false, reason: "lane_request_unrecognized" });
    expect(describeStructuredAutomationProvider("preview_diagnosis").provider).toBe("openai_responses");
    expect(getStructuredAutomationFallbackProvider("preview_diagnosis")).toBeNull();
  });

  it("never puts Anthropic ahead of OpenAI in the default order, for the lane or for its fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
    const { describeStructuredAutomationProvider, getStructuredAutomationFallbackProvider } = await import("../agents/provider-config");
    for (const lane of [...DEFAULT_OPENAI_LANES, ...UNPINNED_LANES, undefined]) {
      expect(describeStructuredAutomationProvider(lane).provider, String(lane)).toBe("openai_responses");
      // Anthropic is the next provider, never the first.
      expect(getStructuredAutomationFallbackProvider(lane), String(lane)).toBe("anthropic_agent_sdk");
    }
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata).toMatchObject({ provider: "openai_responses", fallback_provider: "anthropic_agent_sdk" });
    expect(Object.values(metadata.task_providers).every((provider) => provider === "openai_responses")).toBe(true);
  });

  it("reaches Anthropic only without an OpenAI key or where a setting names it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
    vi.stubEnv("BLUEPRINT_OPERATOR_THREAD_PROVIDER", "anthropic_agent_sdk");
    const { getStructuredAutomationProvider } = await import("../agents/provider-config");
    expect(getStructuredAutomationProvider("operator_thread")).toBe("anthropic_agent_sdk");
    expect(getStructuredAutomationProvider("preview_diagnosis")).toBe("openai_responses");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "anthropic_agent_sdk");
    vi.resetModules();
    expect((await import("../agents/provider-config")).getStructuredAutomationProvider("site_task_brief_reading")).toBe("anthropic_agent_sdk");
  });

  it("built-in agent profiles pin no removed provider", async () => {
    const { listAgentProfiles } = await import("../agents/agent-profiles");
    for (const profile of await listAgentProfiles()) {
      expect(["deepseek_chat", "zai_glm"]).not.toContain(profile.default_provider);
      expect(String(profile.default_model ?? "")).not.toMatch(/deepseek|glm/i);
    }
  });
});
