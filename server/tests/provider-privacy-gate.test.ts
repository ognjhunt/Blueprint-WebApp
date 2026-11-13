// @vitest-environment node
/**
 * The always-on data-class gate (provider-privacy.ts): its three tables, the
 * drift check against the Privacy Policy's own provider rows, and the gate at
 * every place a provider is chosen.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_PAGE_DIGESTS, PRIVACY_VERSION } from "../../client/src/lib/legalAcceptance";
import {
  LANE_DATA_CLASSES, PRIVACY_POLICY_PROVIDER_ROWS, PRIVACY_STATUS_QUO_EXCEPTIONS, PROFILE_DATA_CLASSES, PROVIDER_DESTINATIONS,
  privacyDecision, resolvePrivacyVersion,
} from "../agents/provider-privacy";
import { taskDefinitions } from "../agents/tasks";
import type { AgentProvider, AgentTaskKind } from "../agents/types";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const ALL_KINDS = Object.keys(taskDefinitions) as AgentTaskKind[];
const PROVIDERS = Object.keys(PROVIDER_DESTINATIONS) as AgentProvider[];

/** The provider rows of "AI, 3D processing and compute" as a legal page's source states them. */
function aiRowsOnPage(relativePath: string): Array<[string, string]> {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  const start = source.indexOf('category: "AI, 3D processing and compute"');
  expect(start, relativePath).toBeGreaterThan(-1);
  const end = source.indexOf("],\n  },", start);
  return [...source.slice(start, end).matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map((match) => [match[1], match[2]]);
}

describe("the gate's tables", () => {
  it("has a data row for every lane in the task registry and every built-in profile", async () => {
    expect(Object.keys(LANE_DATA_CLASSES).sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) expect(LANE_DATA_CLASSES[kind].classes.length, kind).toBeGreaterThan(0);
    const { listBuiltInAgentProfiles } = await import("../agents/agent-profiles");
    const profiles = listBuiltInAgentProfiles();
    expect(Object.keys(PROFILE_DATA_CLASSES).sort()).toEqual(profiles.map((profile) => profile.key).sort());
    // A profile sends at least its lane's data.
    for (const profile of profiles) {
      for (const dataClass of LANE_DATA_CLASSES[profile.task_kind].classes) {
        expect(PROFILE_DATA_CLASSES[profile.key].classes, `${profile.key} ${dataClass}`).toContain(dataClass);
      }
    }
  });

  it("names a receiving company for every provider id, and a policy row only for the named ones", () => {
    for (const provider of PROVIDERS) expect(PROVIDER_DESTINATIONS[provider].company.length, provider).toBeGreaterThan(0);
    expect(PROVIDERS.filter((provider) => PROVIDER_DESTINATIONS[provider].policy_row === null).sort())
      .toEqual(["acp_harness", "codex_local", "openclaw"]);
  });

  it("matches, word for word, the provider rows of every Privacy Policy version data can be held under", () => {
    for (const [version, entry] of Object.entries(PRIVACY_POLICY_PROVIDER_ROWS)) {
      const onPage = aiRowsOnPage(entry.page);
      expect(onPage.length, entry.page).toBeGreaterThan(0);
      expect(Object.fromEntries(onPage), `${version} ${entry.page}`)
        .toEqual(Object.fromEntries(Object.entries(entry.rows).map(([row, value]) => [row, value.words])));
      expect((LEGAL_PAGE_DIGESTS as Record<string, { version: string }>)[entry.page].version, entry.page).toBe(version);
    }
    expect(PRIVACY_POLICY_PROVIDER_ROWS[PRIVACY_VERSION].page).toBe("client/src/pages/Privacy.tsx");
    // A provider's policy row exists on the page of every version.
    for (const provider of PROVIDERS) {
      const row = PROVIDER_DESTINATIONS[provider].policy_row;
      if (!row) continue;
      for (const entry of Object.values(PRIVACY_POLICY_PROVIDER_ROWS)) expect(entry.rows[row], `${provider} ${entry.page}`).toBeDefined();
    }
  });

  it("applies the version recorded on the data when known, and the current version otherwise", () => {
    expect(resolvePrivacyVersion("2026-11-02.1")).toBe("2026-11-02.1");
    expect(resolvePrivacyVersion("not-a-version")).toBe(PRIVACY_VERSION);
    expect(resolvePrivacyVersion(undefined)).toBe(PRIVACY_VERSION);
  });
});

describe("the gate's decisions under every version", () => {
  const versions = Object.keys(PRIVACY_POLICY_PROVIDER_ROWS);
  const restricted = ["site_job_text", "job_records", "personal_info", "staff_tools", "site_frames", "site_video"] as const;

  it("never lets Anthropic, or a provider whose destination the policy does not name, receive restricted data", () => {
    for (const version of versions) {
      for (const kind of ALL_KINDS) {
        const sendsRestricted = LANE_DATA_CLASSES[kind].classes.some((dataClass) => (restricted as readonly string[]).includes(dataClass));
        for (const provider of ["anthropic_agent_sdk", "acp_harness", "openclaw", "codex_local"] as const) {
          // The one named status-quo exception, tested below.
          if (kind === "external_harness_thread" && provider === "acp_harness") continue;
          if (sendsRestricted) expect(privacyDecision(provider, kind, version).permitted, `${version} ${kind} ${provider}`).toBe(false);
        }
      }
    }
  });

  it("does not break a lane whose provider today is one the policy permits for its data", () => {
    const today: Partial<Record<AgentTaskKind, AgentProvider>> = {
      waitlist_triage: "openai_responses", inbound_qualification: "openai_responses", post_signup_scheduling: "openai_responses",
      support_triage: "openai_responses", outbound_outreach: "openai_responses", robot_fit_ranking: "openai_responses",
      site_task_brief_reading: "openai_responses", capture_dispatch: "openai_responses", preview_diagnosis: "openai_responses",
      robot_capability_extraction: "openai_responses", adp_run_operator: "openai_agents_api",
      operator_thread: "openai_responses", external_harness_thread: "acp_harness",
      site_video_evidence: "gemini_video", capture_video_privacy: "gemini_video", capture_coverage: "gemini_video",
    };
    for (const version of versions) {
      for (const [kind, provider] of Object.entries(today) as Array<[AgentTaskKind, AgentProvider]>) {
        expect(privacyDecision(provider, kind, version).permitted, `${version} ${kind} ${provider}`).toBe(true);
      }
    }
    expect(privacyDecision("anthropic_agent_sdk", "robot_capability_extraction").permitted).toBe(true);
  });

  it("permits the staff thread on OpenAI only, and the harness lane on its pinned harness only (a named exception)", () => {
    for (const version of versions) {
      // OpenAI's row, through any OpenAI provider id.
      expect(PROVIDERS.filter((provider) => privacyDecision(provider, "operator_thread", version).permitted))
        .toEqual(["openai_responses", "openai_agents_api", "openai_agents_sdk"]);
      expect(PROVIDERS.filter((provider) => privacyDecision(provider, "external_harness_thread", version).permitted)).toEqual(["acp_harness"]);
      expect(privacyDecision("acp_harness", "external_harness_thread", version).status_quo_exception)
        .toMatchObject({ status: "status_quo_exception", code: "privacy_destination_not_named" });
      // Exactly one exception, and only for that lane.
      expect(PRIVACY_STATUS_QUO_EXCEPTIONS[version].map((entry) => `${entry.task_kind}:${entry.provider}`))
        .toEqual(["external_harness_thread:acp_harness"]);
      // No other lane may use the harness for restricted data.
      for (const kind of ALL_KINDS.filter((entry) => entry !== "external_harness_thread" && entry !== "robot_capability_extraction")) {
        expect(privacyDecision("acp_harness", kind, version).permitted, `${version} ${kind}`).toBe(false);
      }
    }
    // The exception is not a policy row: the harness has none, and the drift test ties every row to the page.
    expect(PROVIDER_DESTINATIONS.acp_harness.policy_row).toBeNull();
  });
});

const KEYS = ["OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ACP_HARNESS_URL", "OPENCLAW_BASE_URL",
  "DEEPSEEK_API_KEY", "ZAI_API_KEY", "OPENROUTER_API_KEY"];

describe("the gate wherever a provider is chosen for a lane", () => {
  let settingKeys: string[] = [];
  beforeEach(async () => {
    vi.resetModules();
    settingKeys = (await import("../agents/provider-config")).listProviderSettingKeys();
    for (const key of [...KEYS, ...settingKeys]) vi.stubEnv(key, "");
    vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
    vi.resetModules();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  async function lanes(env: Record<string, string>) {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.resetModules();
    const config = await import("../agents/provider-config");
    return { config, resolved: Object.fromEntries((Object.keys(LANE_DATA_CLASSES) as AgentTaskKind[])
      .filter((kind) => !(kind in config.PINNED_TASK_PROVIDERS))
      .map((kind) => [kind, config.describeStructuredAutomationProvider(kind)])) };
  }

  it("a left-over removed key, Anthropic and no OpenAI key: no lane carrying site or personal data resolves to Anthropic", async () => {
    for (const leftOver of ["ZAI_API_KEY", "DEEPSEEK_API_KEY"]) {
      vi.unstubAllEnvs();
      for (const key of [...KEYS, ...settingKeys]) vi.stubEnv(key, "");
      vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
      const { resolved } = await lanes({ ANTHROPIC_API_KEY: "x", [leftOver]: "x" });
      for (const [kind, resolution] of Object.entries(resolved)) {
        if (kind === "robot_capability_extraction") { expect(resolution.provider).toBe("anthropic_agent_sdk"); continue; }
        expect(resolution, `${leftOver} ${kind}`).toMatchObject({ provider: "openai_responses",
          fails_closed: "permitted_provider_not_configured" });
      }
    }
  });

  it("refuses every setting that names a provider the lane's data may not go to, and says why", async () => {
    const { resolved } = await lanes({ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x", ACP_HARNESS_URL: "http://harness.invalid",
      BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER: "acp_harness",
      BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER: "anthropic_agent_sdk",
      BLUEPRINT_CAPTURE_DISPATCH_PROVIDER: "anthropic_agent_sdk", BLUEPRINT_SUPPORT_TRIAGE_PROVIDER: "openclaw" });
    expect(resolved.capture_dispatch).toMatchObject({ provider: "openai_responses", reason: "lane_request_not_permitted",
      fails_closed: null });
    expect(resolved.capture_dispatch.refused_settings.map((refusal: { env_key: string }) => refusal.env_key).sort()).toEqual([
      "BLUEPRINT_CAPTURE_DISPATCH_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
      "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER"]);
    // The site's own task text: both global settings are refused and it stays on OpenAI.
    expect(resolved.site_task_brief_reading).toMatchObject({ provider: "openai_responses", reason: "global_selection" });
    expect(resolved.site_task_brief_reading.refused_settings).toHaveLength(2);
    // OPENCLAW_BASE_URL is unset: a setting naming an unconfigured provider is not honoured, and it is refused too.
    expect(resolved.support_triage).toMatchObject({ provider: "openai_responses", reason: "lane_request_not_permitted" });
    // Public material does not go to the ACP harness either: the policy does not name its destination.
    expect(resolved.robot_capability_extraction.provider).toBe("openai_responses");
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata.refused_provider_settings.some((refusal) => refusal.task_kind === "capture_dispatch"
      && refusal.env_key === "BLUEPRINT_CAPTURE_DISPATCH_PROVIDER" && refusal.blocked_by.includes("site_job_text"))).toBe(true);
    expect(Object.fromEntries(metadata.lanes_failing_closed.map((lane) => [lane.task_kind, lane.reason]))).toEqual({
      // Retired (2026-11-11): no one provider is named for footage together with the job's records.
      site_assessment: "no_permitted_provider",
    });
    expect(metadata.lanes.find((lane) => lane.task_kind === "operator_thread")).toMatchObject({ provider: "openai_responses",
      fails_closed: null });
    // The harness lane is configured here: the view warns that its destination is not named, and does not refuse it.
    expect(metadata.privacy_warnings).toEqual([{ code: "privacy_destination_not_named", task_kind: "external_harness_thread",
      provider: "acp_harness", detail: expect.any(String) }]);
    expect(metadata.lanes.find((lane) => lane.task_kind === "external_harness_thread")?.fails_closed).toBeNull();
  });

  it("the pre-existing order (local Codex and the ACP harness ahead of OpenAI) can no longer take a site's job text", async () => {
    const { resolved } = await lanes({ OPENAI_API_KEY: "x", ACP_HARNESS_URL: "http://harness.invalid", CODEX_LOCAL_AVAILABLE: "1" });
    for (const kind of ["site_task_brief_reading", "capture_dispatch", "preview_diagnosis", "robot_fit_ranking"]) {
      expect(resolved[kind].provider, kind).toBe("openai_responses");
    }
  });

  it("skips the shadow comparison when its provider may not receive the lane's data, and reports it", async () => {
    const { config } = await lanes({ OPENAI_API_KEY: "x", ACP_HARNESS_URL: "http://harness.invalid" });
    expect(config.describeAutoAgentShadowProvider("support_triage")).toMatchObject({ provider: "acp_harness",
      refused: { reason: "privacy_not_permitted", blocked_by: ["personal_info"] } });
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "deepseek_chat");
    vi.resetModules();
    const removed = (await import("../agents/provider-config")).describeAutoAgentShadowProvider("waitlist_triage");
    expect(removed).toMatchObject({ provider: "acp_harness", setting_names_removed_provider: true,
      refused: { reason: "privacy_not_permitted" } });
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "openai_responses");
    vi.resetModules();
    expect((await import("../agents/provider-config")).describeAutoAgentShadowProvider("preview_diagnosis").refused).toBeNull();
  });
});
