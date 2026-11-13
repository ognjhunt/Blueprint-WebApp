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
 * preference, local Codex, the ACP harness, OpenAI, the configured fallback,
 * Anthropic, OpenClaw, and local Codex when nothing is keyed.
 *
 * The lanes are read from the task registry, not copied here: a lane added
 * later is covered, and a lane pinned to one provider must be listed with its
 * pin below.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { taskDefinitions } from "../agents/tasks";
import type { AgentTaskKind } from "../agents/types";

const KEYS = ["OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ACP_HARNESS_URL",
  "OPENCLAW_BASE_URL", "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
  "BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER",
  // Keys of the removed providers that a deployment may still hold.
  "DEEPSEEK_API_KEY", "ZAI_API_KEY", "OPENROUTER_API_KEY"];

/** Lanes pinned to one provider in their task definition (checked against the registry below). */
const { PINNED_TASK_PROVIDERS: PINNED } = await import("../agents/provider-config");
const ALL_KINDS = Object.keys(taskDefinitions) as AgentTaskKind[];
const RESOLVED_LANES = ALL_KINDS.filter((kind) => !(kind in PINNED));

let laneKeys: string[] = [];

beforeEach(async () => {
  vi.resetModules();
  laneKeys = (await import("../agents/provider-config")).listProviderSettingKeys();
  for (const key of [...KEYS, ...laneKeys]) vi.stubEnv(key, "");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function config() {
  vi.resetModules();
  return import("../agents/provider-config");
}

async function lanesWithDefault() {
  const { getLaneDefaultProvider } = await config();
  return RESOLVED_LANES.filter((lane) => getLaneDefaultProvider(lane) === "openai_responses");
}

async function resolveAll(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { getStructuredAutomationProvider } = await config();
  return Object.fromEntries([...RESOLVED_LANES, undefined].map((lane) => [lane ?? "global", getStructuredAutomationProvider(lane)]));
}

type Keys = { openai?: boolean; anthropic?: boolean };
/**
 * name, keys, then what a lane resolves to: a lane whose data only OpenAI may
 * receive (a site's job text, job records, personal information), the one
 * lane of public material (OpenAI or Anthropic may receive it), and the staff
 * lane, whose data the current Privacy Policy names for no provider (it is
 * reported on the chain's answer and the runtime gate refuses every call).
 * Without a usable key for a permitted provider the lane reports that
 * provider and sends nothing.
 */
const cases: Array<[string, Keys, string, string, string]> = [
  ["only an OpenAI key", { openai: true }, "openai_responses", "openai_responses", "openai_responses"],
  ["only an Anthropic key", { anthropic: true }, "openai_responses", "anthropic_agent_sdk", "anthropic_agent_sdk"],
  ["both keys", { openai: true, anthropic: true }, "openai_responses", "openai_responses", "openai_responses"],
  ["no key", {}, "openai_responses", "openai_responses", "codex_local"],
];
const PUBLIC_LANES: AgentTaskKind[] = ["robot_capability_extraction", "runtime_smoke_test"];
const STAFF_LANES: AgentTaskKind[] = ["operator_thread"];

function keyEnv(keys: Keys, leftOver: boolean): Record<string, string> {
  return {
    ...(keys.openai ? { OPENAI_API_KEY: "offline-fixture" } : {}),
    ...(keys.anthropic ? { ANTHROPIC_API_KEY: "offline-fixture" } : {}),
    ...(leftOver ? { DEEPSEEK_API_KEY: "left-over", ZAI_API_KEY: "left-over", OPENROUTER_API_KEY: "left-over" } : {}),
  };
}

describe("provider resolution after the removal", () => {
  it("every lane in the task registry is either pinned (listed with its pin) or resolved per lane", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    const { getStructuredAutomationProvider } = await config();
    const { taskDefinitions: fresh } = await import("../agents/tasks");
    for (const kind of ALL_KINDS) {
      const definition = fresh[kind];
      if (kind in PINNED) expect(definition.default_provider, kind).toBe(PINNED[kind]);
      else expect(definition.default_provider, kind).toBe(getStructuredAutomationProvider(kind));
    }
    expect(RESOLVED_LANES.length).toBeGreaterThanOrEqual(11);
  });

  it.each(cases)("with %s, every lane resolves to a provider the gate permits, or to its fail-closed report", async (_name, keys, restricted, publicLane, staff) => {
    const resolved = await resolveAll(keyEnv(keys, false));
    for (const lane of RESOLVED_LANES) {
      expect(resolved[lane], lane).toBe(PUBLIC_LANES.includes(lane) ? publicLane : STAFF_LANES.includes(lane) ? staff : restricted);
    }
  });

  it.each(cases)("with %s and the removed providers' keys still set, nothing changes", async (_name, keys) => {
    const without = await resolveAll(keyEnv(keys, false));
    expect(await resolveAll(keyEnv(keys, true))).toEqual(without);
  });

  it("a setting naming a removed provider is the same as no setting, in every lane setting and the global ones", async () => {
    const base = { OPENAI_API_KEY: "offline-fixture", ANTHROPIC_API_KEY: "offline-fixture", ACP_HARNESS_URL: "http://harness.invalid" };
    for (const removed of ["deepseek_chat", "zai_glm", "openrouter"]) {
      for (const key of laneKeys) {
        vi.unstubAllEnvs();
        for (const clear of [...KEYS, ...laneKeys]) vi.stubEnv(clear, "");
        vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
        const unset = await resolveAll(base);
        const set = await resolveAll({ ...base, [key]: removed });
        expect(set, `${key}=${removed}`).toEqual(unset);
      }
    }
  });

  it("the review's three lane-setting cases resolve exactly as with the setting unset", async () => {
    const probes: Array<[Record<string, string>, string, AgentTaskKind]> = [
      [{ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x", BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER: "anthropic_agent_sdk" },
        "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER", "inbound_qualification"],
      [{ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x", DEEPSEEK_API_KEY: "x", BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER: "anthropic_agent_sdk" },
        "BLUEPRINT_SUPPORT_TRIAGE_PROVIDER", "support_triage"],
      [{ OPENAI_API_KEY: "x", ACP_HARNESS_URL: "http://harness.invalid" }, "BLUEPRINT_OUTBOUND_OUTREACH_PROVIDER", "outbound_outreach"],
    ];
    for (const [env, key, lane] of probes) {
      vi.unstubAllEnvs();
      for (const clear of [...KEYS, ...laneKeys]) vi.stubEnv(clear, "");
      vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
      const unset = await resolveAll(env);
      const set = await resolveAll({ ...env, [key]: key.includes("OUTBOUND") ? "zai_glm" : "deepseek_chat" });
      expect(set[lane], key).toBe("openai_responses");
      expect(set).toEqual(unset);
      const { describeStructuredAutomationProvider } = await config();
      expect(describeStructuredAutomationProvider(lane)).toMatchObject({ lane_request: null,
        lane_setting_names_removed_provider: true, reason: "lane_default" });
    }
  });

  it("the fallback setting never goes ahead of OpenAI, and is refused where the gate does not permit it", async () => {
    const fallbackOnly = await resolveAll({ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x",
      BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER: "anthropic_agent_sdk" });
    for (const [lane, provider] of Object.entries(fallbackOnly)) expect(provider, lane).toBe("openai_responses");
    vi.unstubAllEnvs();
    for (const clear of [...KEYS, ...laneKeys]) vi.stubEnv(clear, "");
    vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
    const deepSeekEra = await resolveAll({ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x", DEEPSEEK_API_KEY: "x",
      BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER: "deepseek_chat", BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER: "anthropic_agent_sdk" });
    for (const [lane, provider] of Object.entries(deepSeekEra)) expect(provider, lane).toBe("openai_responses");
    const { getStructuredAutomationFallbackProvider, describeStructuredAutomationProvider } = await config();
    expect(getStructuredAutomationFallbackProvider("preview_diagnosis")).toBeNull();
    expect(getStructuredAutomationFallbackProvider("robot_capability_extraction")).toBe("anthropic_agent_sdk");
    expect(describeStructuredAutomationProvider("site_task_brief_reading").refused_settings).toEqual([
      { env_key: "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", requested: "anthropic_agent_sdk",
        reason: "privacy_not_permitted", blocked_by: ["site_job_text"] }]);
  });

  it("never puts Anthropic ahead of OpenAI in the default order, for the lane or for its fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
    const { describeStructuredAutomationProvider, getStructuredAutomationFallbackProvider } = await config();
    for (const lane of [...RESOLVED_LANES, undefined]) {
      expect(describeStructuredAutomationProvider(lane).provider, String(lane)).toBe("openai_responses");
      // Anthropic is the next provider, never the first, and only where the gate permits it.
      expect(getStructuredAutomationFallbackProvider(lane), String(lane))
        .toBe(lane === undefined || PUBLIC_LANES.includes(lane) ? "anthropic_agent_sdk" : null);
    }
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata).toMatchObject({ provider: "openai_responses", fallback_provider: "anthropic_agent_sdk" });
    expect(Object.values(metadata.task_providers).every((provider) => provider === "openai_responses")).toBe(true);
  });

  it("an OPENAI_BASE_URL naming another host makes OpenAI not configured; OpenAI's own host does not", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("OPENAI_BASE_URL", "https://compat.other-company.example/v1");
    const elsewhere = await config();
    expect(elsewhere.isProviderConfigured("openai_responses")).toBe(false);
    // The lane does not move: OpenAI is the only provider for its data, so it fails closed.
    expect(elsewhere.describeStructuredAutomationProvider("inbound_qualification")).toMatchObject({
      provider: "openai_responses", fails_closed: "permitted_provider_not_configured" });
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata.openai_not_configured_reason).toBe("openai_base_url_names_another_host");
    expect(JSON.stringify(metadata)).not.toContain("other-company");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    expect((await config()).isProviderConfigured("openai_responses")).toBe(true);
  });

  it("lists left-over provider settings by name in the connectivity view, never their values", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER", "deepseek_chat");
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "zai_glm");
    vi.resetModules();
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata.removed_provider_settings).toEqual(["BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER"]);
    expect(metadata.unhonored_lane_providers).toEqual([]);
  });
});

describe("built-in profiles that pinned a removed provider", () => {
  const SEVEN = ["ops-operator", "support-triage-specialist", "preview-diagnosis-specialist", "research-subagent",
    "browser-research-subagent", "launch-qa-subagent", "review-subagent"];

  it("are disabled with a typed reason, pin no removed provider, and are listed as disabled", async () => {
    const { listAgentProfiles } = await import("../agents/agent-profiles");
    const profiles = await listAgentProfiles();
    for (const profile of profiles) {
      expect(["deepseek_chat", "zai_glm"]).not.toContain(profile.default_provider);
      expect(String(profile.default_model ?? "")).not.toMatch(/deepseek|glm/i);
    }
    expect(profiles.filter((profile) => profile.disabled_reason === "agent_profile_provider_removed").map((profile) => profile.key).sort())
      .toEqual([...SEVEN].sort());
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    expect(getAgentRuntimeConnectionMetadata().disabled_agent_profiles.map((profile) => profile.key).sort()).toEqual([...SEVEN].sort());
  });

  it("a stored profile that still names a removed provider is disabled the same way", async () => {
    const { withProfileProviderStatus, assertAgentProfileUsable } = await import("../agents/agent-profiles");
    const stored = withProfileProviderStatus({ id: "p", key: "custom", name: "Custom", task_kind: "support_triage",
      default_provider: "deepseek_chat" as never, created_at: "", updated_at: "" });
    expect(stored).toMatchObject({ disabled_reason: "agent_profile_provider_removed", removed_provider: "deepseek_chat" });
    expect(() => assertAgentProfileUsable(stored)).toThrow("agent_profile_provider_removed");
    expect(() => assertAgentProfileUsable({ ...stored, disabled_reason: undefined, removed_provider: undefined,
      default_provider: "openai_responses" })).not.toThrow();
  });
});
