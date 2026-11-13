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
  LANE_DATA_CLASSES, NON_LANE_SENDS, PAGE_ROWS_WITHOUT_A_ROUTE, PRIVACY_POLICY_PROVIDER_ROWS, PROFILE_DATA_CLASSES, PROVIDER_DESTINATIONS,
  STRICTEST_PRIVACY_TABLE, assertPrivacyTableCoversVersion, privacyDecision, privacyDecisionForClasses, resolvePrivacyVersion,
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
      expect((LEGAL_PAGE_DIGESTS as Record<string, { version: string }>)[entry.page].version, entry.page).toBe(entry.same_text_as ?? version);
    }
    expect(PRIVACY_POLICY_PROVIDER_ROWS[PRIVACY_VERSION].page).toBe("client/src/pages/Privacy.tsx");
    // A provider's policy row exists on the page of every version.
    for (const provider of PROVIDERS) {
      const row = PROVIDER_DESTINATIONS[provider].policy_row;
      if (!row) continue;
      for (const entry of Object.values(PRIVACY_POLICY_PROVIDER_ROWS)) expect(entry.rows[row], `${provider} ${entry.page}`).toBeDefined();
    }
  });

  it("keeps a page row no website provider routes to only by a named exception, and it permits nothing", () => {
    const routed = new Set(PROVIDERS.map((provider) => PROVIDER_DESTINATIONS[provider].policy_row).filter(Boolean));
    for (const [version, entry] of Object.entries(PRIVACY_POLICY_PROVIDER_ROWS)) {
      for (const [row, value] of Object.entries(entry.rows)) {
        if (routed.has(row)) continue;
        expect(PAGE_ROWS_WITHOUT_A_ROUTE[row], `${version} ${row}: a row with no route needs a named exception`).toBeDefined();
        expect(value.classes, `${version} ${row}`).toEqual([]);
      }
    }
    // The DeepSeek row of 2026-11-13.1 is the row of 2026-11-12.2, word for word.
    expect(PRIVACY_POLICY_PROVIDER_ROWS[PRIVACY_VERSION].rows.DeepSeek)
      .toEqual(PRIVACY_POLICY_PROVIDER_ROWS["2026-11-12.2"].rows.DeepSeek);
    for (const provider of PROVIDERS) expect(PROVIDER_DESTINATIONS[provider].policy_row, provider).not.toBe("DeepSeek");
  });

  it("applies the version recorded on the data when known, and the strictest table when it is absent or unknown", () => {
    expect(resolvePrivacyVersion("2026-11-02.1")).toBe("2026-11-02.1");
    expect(resolvePrivacyVersion("not-a-version")).toBe(STRICTEST_PRIVACY_TABLE);
    expect(resolvePrivacyVersion(undefined)).toBe(STRICTEST_PRIVACY_TABLE);
    // The strictest table permits nothing that any known version refuses.
    for (const kind of ALL_KINDS) {
      for (const provider of PROVIDERS) {
        if (privacyDecision(provider, kind, STRICTEST_PRIVACY_TABLE).permitted) {
          for (const version of Object.keys(PRIVACY_POLICY_PROVIDER_ROWS)) {
            expect(privacyDecision(provider, kind, version).permitted, `${kind} ${provider} ${version}`).toBe(true);
          }
        }
      }
    }
  });

  it("fails at start-up, never per request, when the current Privacy version has no rows", () => {
    expect(() => assertPrivacyTableCoversVersion(PRIVACY_POLICY_PROVIDER_ROWS, PRIVACY_VERSION)).not.toThrow();
    expect(() => assertPrivacyTableCoversVersion({ [PRIVACY_VERSION]: {} }, "2099-01-01.1")).toThrow("privacy_table_missing_version: 2099-01-01.1");
  });
});

describe("the gate's decisions under every version", () => {
  const versions = Object.keys(PRIVACY_POLICY_PROVIDER_ROWS);
  const restricted = ["site_job_text", "job_records", "personal_info", "staff_tools", "site_frames", "site_video"] as const;

  it("never lets a provider whose destination the policy does not name receive restricted data, nor Anthropic under an older version", () => {
    for (const version of [...versions, STRICTEST_PRIVACY_TABLE]) {
      for (const kind of ALL_KINDS) {
        const sendsRestricted = LANE_DATA_CLASSES[kind].classes.some((dataClass) => (restricted as readonly string[]).includes(dataClass));
        const providers = version === PRIVACY_VERSION ? ["acp_harness", "openclaw", "codex_local"] as const
          : ["anthropic_agent_sdk", "acp_harness", "openclaw", "codex_local"] as const;
        for (const provider of providers) {
          if (sendsRestricted) expect(privacyDecision(provider, kind, version).permitted, `${version} ${kind} ${provider}`).toBe(false);
        }
      }
    }
  });

  it("under 2026-11-13.1, Anthropic may receive what OpenAI may for site data, and still not the staff thread or footage", () => {
    expect(PRIVACY_VERSION).toBe("2026-11-13.1");
    for (const kind of ALL_KINDS) {
      const openAi = privacyDecision("openai_responses", kind, PRIVACY_VERSION).permitted;
      expect(privacyDecision("anthropic_agent_sdk", kind, PRIVACY_VERSION).permitted, kind).toBe(openAi);
    }
    expect(privacyDecision("anthropic_agent_sdk", "operator_thread", PRIVACY_VERSION).permitted).toBe(false);
    expect(privacyDecision("anthropic_agent_sdk", "site_video_evidence", PRIVACY_VERSION).permitted).toBe(false);
    // Lane resolution and failover run on the strictest table: Anthropic is not chosen for site data by a setting.
    expect(privacyDecision("anthropic_agent_sdk", "site_task_brief_reading").permitted).toBe(false);
  });

  it("does not break a lane whose provider today is one the policy permits for its data", () => {
    const today: Partial<Record<AgentTaskKind, AgentProvider>> = {
      waitlist_triage: "openai_responses", inbound_qualification: "openai_responses", post_signup_scheduling: "openai_responses",
      support_triage: "openai_responses", outbound_outreach: "openai_responses", robot_fit_ranking: "openai_responses",
      site_task_brief_reading: "openai_responses", capture_dispatch: "openai_responses", preview_diagnosis: "openai_responses",
      robot_capability_extraction: "openai_responses", adp_run_operator: "openai_agents_api",
      site_video_evidence: "gemini_video", capture_video_privacy: "gemini_video", capture_coverage: "gemini_video",
    };
    for (const version of versions) {
      for (const [kind, provider] of Object.entries(today) as Array<[AgentTaskKind, AgentProvider]>) {
        expect(privacyDecision(provider, kind, version).permitted, `${version} ${kind} ${provider}`).toBe(true);
      }
    }
    expect(privacyDecision("anthropic_agent_sdk", "robot_capability_extraction").permitted).toBe(true);
  });

  it("lets the fixed-text smoke test run on a named provider, OpenAI first, and nowhere unnamed", () => {
    expect(PROVIDERS.filter((provider) => privacyDecision(provider, "runtime_smoke_test").permitted))
      .toEqual(["openai_responses", "openai_agents_api", "openai_agents_sdk", "anthropic_agent_sdk"]);
  });

  it("refuses the document reading through the OpenClaw gateway under every version", () => {
    for (const version of versions) {
      const send = NON_LANE_SENDS.ops_document_extraction;
      expect(privacyDecisionForClasses(send.provider, send.classes, version).permitted, version).toBe(false);
    }
  });

  it("names no provider for a staff thread whose tools read jobs and company history", () => {
    for (const kind of ["operator_thread", "external_harness_thread"] as const) {
      expect(PROVIDERS.filter((provider) => privacyDecision(provider, kind).permitted), kind).toEqual([]);
    }
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
        if (kind === "robot_capability_extraction" || kind === "runtime_smoke_test") {
          expect(resolution.provider, kind).toBe("anthropic_agent_sdk"); continue;
        }
        if (kind === "operator_thread") { expect(resolution.fails_closed, kind).toBe("no_permitted_provider"); continue; }
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
    expect(metadata.lanes_failing_closed.find((lane) => lane.task_kind === "operator_thread")?.enabled_by)
      .toBe("a Privacy Policy version that names a provider for internal staff work");
    expect(metadata.lanes_failing_closed.find((lane) => lane.task_kind === "external_harness_thread")?.enabled_by)
      .toContain("names the destination of its pinned provider (acp_harness)");
    expect(metadata.non_lane_sends).toEqual([
      { name: "retrieval_embeddings", provider: "openai_responses", permitted: true, blocked_by: [] },
      { name: "ops_document_extraction", provider: "openclaw", permitted: false, blocked_by: ["site_job_text", "job_records", "personal_info"] }]);
    expect(Object.fromEntries(metadata.lanes_failing_closed.map((lane) => [lane.task_kind, lane.reason]))).toEqual({
      operator_thread: "no_permitted_provider",
      external_harness_thread: "no_permitted_provider",
      // Retired (2026-11-11): no one provider is named for footage together with the job's records.
      site_assessment: "no_permitted_provider",
    });
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
      refused: { reason: "privacy_not_permitted", blocked_by: ["personal_info", "job_records", "site_job_text"] } });
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
