// @vitest-environment node
/**
 * One lane on a different provider from the rest.
 *
 * The model was already per-lane; the provider was not. Every structured task
 * called `getStructuredAutomationProvider()` with no argument, so
 * `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER` moved every lane at once. Each
 * lane now resolves its own provider (`BLUEPRINT_<LANE>_PROVIDER`), and the
 * data-class gate refuses any setting that names a provider the Privacy Policy
 * does not name for the lane's data. The first look's text lanes all carry the
 * site's own job text, so a global Anthropic setting is refused on each of them
 * under the strictest table.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER",
  "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
  "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS",
  "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER",
  "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS",
  "BLUEPRINT_ROBOT_FIT_RANKING_PROVIDER",
  "BLUEPRINT_ROBOT_FIT_RANKING_PROVIDERS",
  "OPENAI_DEFAULT_MODEL",
  "OPENAI_SITE_TASK_FOLLOW_UP_MODEL",
  "CODEX_LOCAL_AVAILABLE",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ACP_HARNESS_URL",
  "OPENCLAW_BASE_URL",
];

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
  vi.resetModules();
  // Deterministic: this machine may have a real ~/.codex/auth.json.
  process.env.CODEX_LOCAL_AVAILABLE = "0";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Global preference on Anthropic, the follow-up picker pinned to OpenAI. */
function followUpOnOpenAiOnly() {
  process.env.ANTHROPIC_API_KEY = "anthropic-key";
  process.env.OPENAI_API_KEY = "openai-key";
  process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
  process.env.BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER = "openai_responses";
  vi.resetModules();
}

const refusedGlobal = (blocked: string[]) => ({ env_key: "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER",
  requested: "anthropic_agent_sdk", reason: "privacy_not_permitted", blocked_by: blocked });

describe("per-lane provider override", () => {
  it("moves one lane by its own setting and refuses the global setting on lanes whose data the gate keeps from it", async () => {
    followUpOnOpenAiOnly();
    const { getStructuredAutomationProvider, describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(getStructuredAutomationProvider("site_task_follow_up")).toBe("openai_responses");
    // A lane with no default and no setting of its own: the site's job text may not go to Anthropic.
    expect(describeStructuredAutomationProvider("site_task_brief_reading")).toMatchObject({ provider: "openai_responses",
      refused_settings: [refusedGlobal(["site_job_text"])] });
    expect(describeStructuredAutomationProvider("robot_fit_ranking")).toMatchObject({ provider: "openai_responses",
      refused_settings: [refusedGlobal(["site_job_text", "job_records"])] });
    expect(getStructuredAutomationProvider()).toBe("anthropic_agent_sdk");
  });

  it("pairs the moved lane with that provider's own model", async () => {
    followUpOnOpenAiOnly();
    const { getStructuredAutomationProvider, getTaskModelByProvider } = await import("../agents/provider-config");

    const provider = getStructuredAutomationProvider("site_task_follow_up");
    expect(getTaskModelByProvider("site_task_follow_up")[provider]).toBe("gpt-6-luna");
  });

  it("sends the lanes with a default to OpenAI by default, and a lane without one to the first permitted provider", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    for (const lane of ["robot_fit_ranking", "site_task_follow_up"] as const) {
      expect(describeStructuredAutomationProvider(lane)).toMatchObject({ provider: "openai_responses", reason: "lane_default" });
    }
    expect(describeStructuredAutomationProvider("site_task_brief_reading")).toMatchObject({ provider: "openai_responses",
      reason: "global_selection" });
  });

  it("fails a lane closed when OpenAI has no key: Anthropic may not receive the site's job text", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("robot_fit_ranking")).toMatchObject({
      provider: "openai_responses",
      lane_request_honored: false,
      reason: "lane_default_not_configured",
      fails_closed: "permitted_provider_not_configured",
    });
  });

  it("fails the lane closed when the override names a provider with no key and no other permitted provider has one", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER = "openai_responses";
    vi.resetModules();
    const { getStructuredAutomationProvider } = await import("../agents/provider-config");

    // Not by moving its data to a provider the Privacy Policy does not name for
    // it: without an OpenAI key the lane fails closed and sends nothing.
    expect(getStructuredAutomationProvider("site_task_follow_up")).toBe("openai_responses");
  });

  it("says the override was not honoured rather than falling back silently", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER = "openai_responses";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("site_task_follow_up")).toEqual({
      provider: "openai_responses",
      lane_env_key: "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER",
      lane_request: "openai_responses",
      lane_request_honored: false,
      lane_setting_names_removed_provider: false,
      reason: "lane_request_not_configured",
      refused_settings: [refusedGlobal(["site_job_text"])],
      fails_closed: "permitted_provider_not_configured",
      anthropic_model_not_supported: null,
      provider_list: null,
    });
  });

  it("reports a honoured override as honoured", async () => {
    followUpOnOpenAiOnly();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("site_task_follow_up")).toMatchObject({
      provider: "openai_responses",
      lane_request: "openai_responses",
      lane_request_honored: true,
      reason: "lane_override",
    });
  });

  it("ignores a provider name that is not a provider", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER = "luna";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("site_task_follow_up")).toMatchObject({
      provider: "openai_responses",
      fails_closed: "permitted_provider_not_configured",
      lane_request: "luna",
      lane_request_honored: false,
      reason: "lane_request_unrecognized",
    });
  });

  it("keeps the fallback provider distinct from the lane's own provider, and never one the gate refuses", async () => {
    followUpOnOpenAiOnly();
    const { getStructuredAutomationFallbackProvider } = await import("../agents/provider-config");

    // Anthropic may not receive these lanes' data under the strictest table, so they have no fallback.
    expect(getStructuredAutomationFallbackProvider("site_task_follow_up")).toBeNull();
    expect(getStructuredAutomationFallbackProvider("robot_fit_ranking")).toBeNull();
  });
});

describe("task definitions", () => {
  it("wires the follow-up picker to its own lane provider and model", async () => {
    followUpOnOpenAiOnly();
    const { siteTaskFollowUpTask } = await import("../agents/tasks/site-task-follow-up");

    expect(siteTaskFollowUpTask.default_provider).toBe("openai_responses");
    expect(siteTaskFollowUpTask.model_by_provider?.openai_responses).toBe("gpt-6-luna");
  });

  it("keeps the ranking and the brief reading on OpenAI when the global setting names Anthropic", async () => {
    followUpOnOpenAiOnly();
    const { robotFitRankingTask } = await import("../agents/tasks/robot-fit-ranking");
    const { siteTaskBriefReadingTask } = await import("../agents/tasks/site-task-brief-reading");

    expect(robotFitRankingTask.default_provider).toBe("openai_responses");
    // No default of its own: the gate refuses the global setting for the site's job text.
    expect(siteTaskBriefReadingTask.default_provider).toBe("openai_responses");
  });
});

describe("documented env keys", () => {
  /**
   * The key name is derived from the lane's model suffix, so it is easy to
   * document one spelling and ship another. An operator who sets a misspelled
   * variable on Render gets silence, not an error.
   */
  it("documents the real key for every lane whose provider is resolved here", async () => {
    const fs = await import("node:fs");
    const example = fs.readFileSync("render.optional.env.example", "utf8");
    const { getLaneProviderEnvKey } = await import("../agents/provider-config");

    for (const lane of ["robot_fit_ranking", "site_task_follow_up"] as const) {
      const key = getLaneProviderEnvKey(lane);
      expect(key, `${lane} should have a lane provider key`).toBeTruthy();
      expect(example, `${key} should appear in render.optional.env.example`).toContain(key!);
    }
  });
});
