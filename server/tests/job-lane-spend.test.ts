// @vitest-environment node
/**
 * What a model lane holds against the job's one $40 cap before its call (`server/utils/jobLaneSpend.ts`): the most the
 * call can cost on every model it may reach, a "no funds" switch and Anthropic's in-request fallback included; the
 * per-run cap for a lane that may send correction rounds; and a hold taken, refused at the cap, and settled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});

const JOB = "job-lanes-1";
const lanes = () => [...state.docs.entries()].filter(([key]) => key.startsWith(`inboundRequests/${JOB}/modelLaneReservations/`))
  .map(([, value]) => value as Record<string, any>);

beforeEach(() => {
  state.docs.clear();
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture"); vi.stubEnv("ANTHROPIC_BASE_URL", "");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("the most a lane's call can cost", () => {
  it("prices the provider a switch after \"no funds\" may go to for a job under a later Privacy version", async () => {
    const { laneModels } = await import("../utils/jobLaneSpend");
    const { getStructuredProviderOrder } = await import("../agents/provider-config");
    // The strictest table alone names OpenAI only; a job started under 2026-11-13.1 may switch to Anthropic.
    expect(getStructuredProviderOrder("site_task_follow_up")).toEqual(["openai_responses"]);
    expect(getStructuredProviderOrder("site_task_follow_up", "2026-11-13.1")).toContain("anthropic_agent_sdk");
    expect(await laneModels("site_task_follow_up")).toEqual({ openai_responses: "gpt-6-luna", anthropic_agent_sdk: "claude-haiku-5-5" });
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await laneModels("site_task_follow_up")).toEqual({ openai_responses: "gpt-6-luna" });
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await laneModels("site_task_follow_up")).toBeNull();
  });

  it("adds the fallback model Anthropic may move a request to, as the adapter reserves it", async () => {
    const { laneCallMaximumUsd } = await import("../utils/jobLaneSpend");
    const { anthropicWorstCaseRequestUsd } = await import("../utils/anthropicPricing");
    const tokens = 2_000 + 4_096;
    const opus = laneCallMaximumUsd({ promptBytes: 2_000, outputTokenCeiling: 600, models: { anthropic_agent_sdk: "claude-opus-5-5" } });
    expect(opus).toBe(Math.ceil((anthropicWorstCaseRequestUsd("claude-opus-5-5", tokens, 600)!
      + anthropicWorstCaseRequestUsd("claude-opus-4-8", tokens, 600)!) * 1e6) / 1e6);
    // A model with no fallback is priced alone; one with no request shape is never sent.
    expect(laneCallMaximumUsd({ promptBytes: 2_000, outputTokenCeiling: 600, models: { anthropic_agent_sdk: "claude-haiku-5-5" } }))
      .toBe(Math.ceil(anthropicWorstCaseRequestUsd("claude-haiku-5-5", tokens, 600)! * 1e6) / 1e6);
    expect(laneCallMaximumUsd({ promptBytes: 2_000, outputTokenCeiling: 600, models: { anthropic_agent_sdk: "claude-unknown" } }))
      .toBeNull();
  });

  it("holds a one-request lane at its prompt's bound, and a lane with correction rounds at the per-run cap", async () => {
    const { laneCallMaximumUsd, laneModels, laneRunMaximumUsd } = await import("../utils/jobLaneSpend");
    const models = (await laneModels("site_task_follow_up"))!;
    expect(await laneRunMaximumUsd("site_task_follow_up", 3_000))
      .toBe(laneCallMaximumUsd({ promptBytes: 3_000, outputTokenCeiling: 600, models }));
    expect(await laneRunMaximumUsd("site_task_follow_up", 3_000)).toBeLessThan(0.01);
    // No own output ceiling and up to five corrections: every adapter it may reach refuses a request past $5 a run.
    expect(await laneRunMaximumUsd("robot_fit_ranking", 3_000)).toBe(5);
    expect(await laneRunMaximumUsd("site_task_brief_reading", 3_000)).toBe(5);
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "2.5");
    expect(await laneRunMaximumUsd("robot_fit_ranking", 3_000)).toBe(2.5);
    vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await laneRunMaximumUsd("robot_fit_ranking", 3_000)).toBeNull();
    expect(await laneRunMaximumUsd("robot_fit_ranking", 3_000, { scripted: true })).toBe(2.5);
  });
});

describe("a hold taken outside any other transaction", () => {
  it("holds a call that fits, refuses one the job's cap leaves no room for, and writes nothing then", async () => {
    const { holdJobLaneSpend } = await import("../utils/jobLaneSpend");
    expect(await holdJobLaneSpend(JOB, "site_task_follow_up", 0.002)).toEqual({ state: "no_job" });
    expect(await holdJobLaneSpend("a/b", "site_task_follow_up", 0.002)).toEqual({ state: "unavailable" });
    state.docs.set(`inboundRequests/${JOB}`, { requestId: JOB,
      website_preparation_reservations: { a: { admission: { maximum_cost_usd: 39.999 } } } });
    const held = await holdJobLaneSpend(JOB, "site_task_follow_up", 0.001);
    expect(held).toMatchObject({ state: "held", reservationId: expect.stringMatching(/^site_task_follow_up-/) });
    expect(lanes()).toEqual([expect.objectContaining({ lane: "site_task_follow_up", request_id: JOB,
      admission: expect.objectContaining({ maximum_cost_usd: 0.001 }) })]);
    // The job's every ledger counted, this hold included: nothing is left.
    expect(await holdJobLaneSpend(JOB, "robot_fit_ranking", 0.000001)).toEqual({ state: "cap" });
    expect(lanes()).toHaveLength(1);
  });

  it("settles at the cost the run reports, at 0 when no request was made, and whole when it cannot be told", async () => {
    const { holdJobLaneSpend, settleJobLaneRun } = await import("../utils/jobLaneSpend");
    state.docs.set(`inboundRequests/${JOB}`, { requestId: JOB });
    const row = async (artifacts: Record<string, unknown> | null) => {
      const held = await holdJobLaneSpend(JOB, "robot_fit_ranking", 5);
      if (held.state !== "held") throw new Error(held.state);
      await settleJobLaneRun(JOB, held.reservationId, artifacts === null ? null : { artifacts });
      return state.docs.get(`inboundRequests/${JOB}/modelLaneReservations/${held.reservationId}`) as Record<string, any>;
    };
    expect((await row({ inference_reservation: { reconciled_cost_usd: 0.0123 } })).settlement)
      .toMatchObject({ actual_cost_usd: 0.0123, basis: "reported_usage" });
    expect((await row({ inference_not_invoked: true })).settlement).toMatchObject({ actual_cost_usd: 0, basis: "no_provider_request" });
    expect((await row(null)).settlement).toMatchObject({ actual_cost_usd: 5, basis: "unknown_counts_in_full" });
    expect((await row({})).settlement).toMatchObject({ actual_cost_usd: 5, basis: "unknown_counts_in_full" });
  });
});
