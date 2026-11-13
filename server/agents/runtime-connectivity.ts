import { runAgentTask } from "./runtime";
import type { AgentTaskKind } from "./types";
import {
  describeStructuredAutomationProvider,
  getStructuredAutomationFallbackProvider,
  getAnthropicConfigurationIssue,
  getAnthropicTimeoutMs,
  getOpenAiTimeoutMs,
  getStructuredAutomationProvider,
  getTaskModelByProvider,
  isProviderConfigured,
  listRemovedProviderSettings,
  describeAutoAgentShadowProvider,
  PINNED_TASK_PROVIDERS,
  type ProviderSettingRefusal,
  type StructuredProvider,
} from "./provider-config";
import { ENABLED_BY, LANE_DATA_CLASSES, NON_LANE_SENDS, PROVIDER_DESTINATIONS, privacyDecision, privacyDecisionForClasses } from "./provider-privacy";
import type { AgentProvider } from "./types";
import { listBuiltInAgentProfiles } from "./agent-profiles";
import { getOpenAiConfigurationIssue } from "../utils/openaiApiHost";

/**
 * The lanes this metadata speaks for.
 *
 * Provider is now resolved per lane, so reporting one global provider and
 * pairing every lane's model with it would describe a routing that does not
 * exist. Each lane is resolved on its own and reported with the provider that
 * will actually serve it.
 */
const CONNECTIVITY_TASK_KINDS = [
  "waitlist_triage",
  "inbound_qualification",
  "post_signup_scheduling",
  "operator_thread",
  "support_triage",
  "preview_diagnosis",
  "outbound_outreach",
] as const satisfies readonly AgentTaskKind[];

type ConnectivityTaskKind = (typeof CONNECTIVITY_TASK_KINDS)[number];

/** The smoke test's model: the one its fixed-text lane resolves to. */
function runtimeDefaultModel() {
  const provider = getStructuredAutomationProvider("runtime_smoke_test");
  return getTaskModelByProvider("runtime_smoke_test")[provider] || "gpt-5.4";
}

/** What would let a lane that fails closed run, in words. */
function enabledBy(lane: { pinned: boolean; provider: AgentProvider; data_classes: readonly string[]; permitted_providers: AgentProvider[] }) {
  if (lane.pinned && !PROVIDER_DESTINATIONS[lane.provider]?.policy_row) {
    return `a Privacy Policy version that names the destination of its pinned provider (${lane.provider})`;
  }
  const named = lane.data_classes.map((dataClass) => ENABLED_BY[dataClass as keyof typeof ENABLED_BY]).filter(Boolean);
  return named[0] ?? "a Privacy Policy version that names one provider for all of this lane's data";
}

export function getAgentRuntimeConnectionMetadata() {
  const provider = getStructuredAutomationProvider();
  const fallbackProvider = getStructuredAutomationFallbackProvider();

  const taskProviders = {} as Record<ConnectivityTaskKind, StructuredProvider>;
  const taskModels = {} as Record<ConnectivityTaskKind, string | null>;
  const unhonoredLaneProviders: Array<{
    task_kind: ConnectivityTaskKind;
    env_key: string;
    requested: string;
    using: StructuredProvider;
    reason: string;
  }> = [];

  for (const taskKind of CONNECTIVITY_TASK_KINDS) {
    const resolution = describeStructuredAutomationProvider(taskKind);
    taskProviders[taskKind] = resolution.provider;
    taskModels[taskKind] = getTaskModelByProvider(taskKind)[resolution.provider] || null;
    if (!resolution.lane_request_honored && resolution.lane_env_key && resolution.lane_request) {
      unhonoredLaneProviders.push({
        task_kind: taskKind,
        env_key: resolution.lane_env_key,
        requested: resolution.lane_request,
        using: resolution.provider,
        reason: resolution.reason,
      });
    }
  }

  // Every lane with a per-lane resolution, with what the data-class gate did.
  const lanes = (Object.keys(LANE_DATA_CLASSES) as AgentTaskKind[]).map((taskKind) => {
    const pinned = PINNED_TASK_PROVIDERS[taskKind] ?? null;
    const resolution = pinned ? null : describeStructuredAutomationProvider(taskKind);
    const lanePermitted = (Object.keys(PROVIDER_DESTINATIONS) as AgentProvider[])
      .filter((candidate) => privacyDecision(candidate, taskKind).permitted);
    const laneProvider: AgentProvider = pinned ?? resolution!.provider;
    return {
      task_kind: taskKind,
      provider: laneProvider,
      pinned: Boolean(pinned),
      data_classes: LANE_DATA_CLASSES[taskKind].classes,
      permitted_providers: lanePermitted,
      fails_closed: resolution ? resolution.fails_closed
        : lanePermitted.includes(laneProvider) ? null
        : lanePermitted.length ? "pinned_provider_not_permitted" as const : "no_permitted_provider" as const,
      refused_settings: resolution?.refused_settings ?? [],
    };
  });
  const refusedProviderSettings: Array<ProviderSettingRefusal & { task_kind: AgentTaskKind }> = lanes
    .flatMap((lane) => lane.refused_settings.map((refusal) => ({ ...refusal, task_kind: lane.task_kind })));
  const shadowLanes = (["waitlist_triage", "support_triage", "preview_diagnosis"] as const).map((taskKind) => {
    const shadow = describeAutoAgentShadowProvider(taskKind);
    return { task_kind: taskKind, provider: shadow.provider, skipped: shadow.refused };
  });

  return {
    provider,
    fallback_provider: fallbackProvider,
    configured: isProviderConfigured(provider),
    auth_configured: isProviderConfigured(provider),
    timeout_ms: Number(
      provider === "anthropic_agent_sdk"
        ? getAnthropicTimeoutMs()
        : provider === "codex_local"
          ? process.env.CODEX_TIMEOUT_MS ?? 120_000
        : provider === "openclaw"
          ? process.env.OPENCLAW_TIMEOUT_MS ?? 20_000
          : getOpenAiTimeoutMs(),
    ),
    default_model: runtimeDefaultModel(),
    task_providers: taskProviders,
    task_models: taskModels,
    unhonored_lane_providers: unhonoredLaneProviders,
    // Why Anthropic is not available, when it is not (the reason, never a value).
    anthropic_not_configured_reason: getAnthropicConfigurationIssue(),
    // Why OpenAI is not available, when it is not (the reason, never a value).
    openai_not_configured_reason: getOpenAiConfigurationIssue(),
    // Settings that still name a removed provider, by name only; each is treated as no setting.
    removed_provider_settings: listRemovedProviderSettings(),
    // The data-class gate, per lane: what it sends, who may receive it, what was refused.
    lanes,
    refused_provider_settings: refusedProviderSettings,
    lanes_failing_closed: lanes.filter((lane) => lane.fails_closed)
      .map((lane) => ({ task_kind: lane.task_kind, reason: lane.fails_closed!, enabled_by: enabledBy(lane) })),
    shadow_lanes: shadowLanes,
    // Sends that are not lanes, through the same gate (for example document reading through OpenClaw).
    non_lane_sends: Object.entries(NON_LANE_SENDS).map(([name, send]) => {
      const decision = privacyDecisionForClasses(send.provider, send.classes);
      return { name, provider: send.provider, permitted: decision.permitted, blocked_by: decision.blocked_by };
    }),
    // Built-in profiles that start nothing, with the reason.
    disabled_agent_profiles: listBuiltInAgentProfiles()
      .filter((profile) => profile.disabled_reason)
      .map((profile) => ({ id: profile.id, key: profile.key, name: profile.name, task_kind: profile.task_kind,
        reason: profile.disabled_reason!, removed_provider: profile.removed_provider ?? null })),
  };
}

export async function runAgentRuntimeSmokeTest(params?: {
  model?: string;
}) {
  const startedAt = Date.now();
  // Its own lane of fixed text (tasks/runtime-smoke-test.ts), resolved through
  // the data-class gate on the default order: OpenAI first.
  const lane = describeStructuredAutomationProvider("runtime_smoke_test");
  const connectivity = { provider: lane.provider };

  if (lane.fails_closed || !isProviderConfigured(lane.provider)) {
    throw new Error(`Agent runtime provider ${lane.provider} is not configured for the smoke test`
      + (lane.fails_closed ? ` (${lane.fails_closed})` : ""));
  }

  const result = await runAgentTask<
    Record<string, never>,
    {
      reply: string;
      summary: string;
      suggested_actions: string[];
      requires_human_review: boolean;
    }
  >({
    kind: "runtime_smoke_test",
    provider: connectivity.provider,
    runtime: connectivity.provider,
    model: params?.model?.trim() || runtimeDefaultModel(),
    input: {},
  });

  return {
    ok: result.status === "completed" && Boolean(result.output),
    duration_ms: Date.now() - startedAt,
    final: {
      status: result.status,
      provider: result.provider,
      runtime: result.runtime,
      model: result.model,
      error: result.error || null,
      result: result.output || null,
    },
  };
}
