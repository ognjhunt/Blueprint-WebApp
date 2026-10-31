// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertWithinWebsiteJobCeiling, WEBSITE_JOB_CEILING_DEFAULT_USD, websiteJobCeiling, websiteJobCeilingSummary,
  websiteJobSpend, type WebsiteJobLedgerReader } from "../utils/websiteJobCeiling";
import { screeningFixture, sealScreening } from "./fixtures/beta-policy-screening";

const policy = { schema_version: "website_atlas_grant_policy.v1", maximum_cost_usd: 40, maximum_requests: 32,
  validity_seconds: 3600, provider_retention: "account_does_not_retain", approval_reference: "owner", approved_by: "owner" };
const reader = (intakes: Record<string, any>[] = [],
  runs: Array<{ run: Record<string, any>; result: Record<string, any> | null }> = []): WebsiteJobLedgerReader =>
  ({ sceneIntakes: async () => intakes, screeningRuns: async () => runs });
const held = (maximum: number, settled?: number) => ({ admission: { maximum_cost_usd: maximum },
  ...(settled === undefined ? {} : { settlement: { actual_cost_usd: settled, status: "settled" } }) });
const screening = (committed: string, generatedAt: string, revision = 1) => ({ run: { run_kind: "beta_policy_screening" },
  result: { publication: sealScreening({ ...screeningFixture().publication, revision, generated_at: generatedAt,
    budget: { currency: "USD", limit_usd: "15.00", committed_upper_bound_usd: committed,
      spent_upper_bound_usd: "0", reserved_usd: committed } }) } });

afterEach(() => vi.unstubAllEnvs());

describe("where the job's ceiling comes from", () => {
  it("uses the admitted Atlas authorization, then the job's stored grant, then the grant policy, then the owner default", () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
    const record = { website_atlas_grants: { "capture-a": { maximum_cost_usd: 25 } } };
    expect(websiteJobCeiling({ record, captureId: "capture-a", atlas: { maximum_cost_usd: 40 } }))
      .toEqual({ maximum_cost_usd: 40, source: "atlas_authorization" });
    expect(websiteJobCeiling({ record, captureId: "capture-a" })).toEqual({ maximum_cost_usd: 25, source: "retained_atlas_grant" });
    expect(websiteJobCeiling({ record, captureId: "capture-b" }))
      .toEqual({ maximum_cost_usd: WEBSITE_JOB_CEILING_DEFAULT_USD, source: "owner_default" });
    expect(WEBSITE_JOB_CEILING_DEFAULT_USD).toBe(40);
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({ ...policy, maximum_cost_usd: 30 }));
    expect(websiteJobCeiling({ record, captureId: "capture-b" })).toEqual({ maximum_cost_usd: 30, source: "atlas_grant_policy" });
  });
});

describe("what counts against it", () => {
  it("counts each preparation row at its settlement, else its full hold, rounded up per row", async () => {
    const record = { website_preparation_reservations: { a: held(1.0000001), b: held(5, 0), c: held(2, 1.25) } };
    expect(await websiteJobSpend({ record, reader: reader() })).toMatchObject({
      preparation_micros: 1_000_001 + 0 + 1_250_000, native_construction_micros: 0, screening_micros: 0 });
  });

  it("holds a scene intake's whole native allowance until it closes, then counts its attempts", async () => {
    const intake = (value: Record<string, any>) => ({ request: { execution: { max_total_spend_usd: 20 } }, ...value });
    const spend = async (value: Record<string, any>) =>
      (await websiteJobSpend({ record: {}, reader: reader([intake(value)]) })).native_construction_micros;
    expect(await spend({ state: "forward_pending" })).toBe(20_000_000);
    expect(await spend({ state: "accepted", pipeline_status: { attempts: [{ maximum_spend_usd: 4 }] } })).toBe(20_000_000);
    // An owner-approved extension raises what the intake may spend.
    expect(await spend({ state: "accepted", pipeline_status: { attempts: [],
      effective_execution_budget: { max_total_spend_usd: 24 } } })).toBe(24_000_000);
    expect(await spend({ state: "completed", pipeline_status: { attempts: [{ maximum_spend_usd: 4 }, { maximum_spend_usd: 4 }] } }))
      .toBe(8_000_000);
    expect(await spend({ state: "closeout_pending", pipeline_status: { attempts: [{ maximum_spend_usd: 4 }] } })).toBe(20_000_000);
    expect(await spend({ state: "revoked", closeout_complete: true, receipt: {}, pipeline_status: { attempts: [] } })).toBe(0);
    // A cancellation that was never forwarded bought nothing.
    expect(await spend({ state: "revoked" })).toBe(0);
  });

  it("keeps the whole native allowance once a delivery may have reached the Pipeline, until the Pipeline confirms it ended", async () => {
    const intake = (value: Record<string, any>) => ({ request: { execution: { max_total_spend_usd: 20 } }, ...value });
    const spend = async (value: Record<string, any>) =>
      (await websiteJobSpend({ record: {}, reader: reader([intake(value)]) })).native_construction_micros;
    // Every delivery's response was lost, so retries ran out with no receipt: the Pipeline may be running it.
    const lost = { forwarding_started: true, forward_attempt_count: 20 };
    expect(await spend({ ...lost, state: "blocked", blocker: "transport_retry_cap_exhausted" })).toBe(20_000_000);
    expect(await spend({ ...lost, state: "blocked", blocker: "consent_expired" })).toBe(20_000_000);
    // A local cancellation or expiry of that delivery closes it here, not downstream.
    expect(await spend({ ...lost, state: "revoked", closeout_complete: true, revocation_receipt: {} })).toBe(20_000_000);
    expect(await spend({ ...lost, state: "expired", closeout_complete: true })).toBe(20_000_000);
    // Closeout polls that ran out without the Pipeline showing the intent can start nothing more.
    const accepted = { forwarding_started: true, receipt: {}, state: "blocked", blocker: "terminal_closeout_poll_cap_exhausted" };
    expect(await spend(accepted)).toBe(20_000_000);
    expect(await spend({ ...accepted, pipeline_status: { status: "running", phase: null, blockers: [],
      attempts: [{ maximum_spend_usd: 4 }] } })).toBe(20_000_000);
    // Released on a positive signal: nothing was ever sent ...
    expect(await spend({ state: "blocked", blocker: "consent_expired", forward_attempt_count: 0 })).toBe(0);
    expect(await spend({ state: "blocked", blocker: "revocation_requested_before_delivery", forward_attempt_count: 1 })).toBe(0);
    // ... or the Pipeline's own status shows it ended, counted at its attempts' reservations.
    expect(await spend({ ...accepted, pipeline_status: { status: "expired", phase: "authority",
      blockers: ["scene_intake_authority_expired"], attempts: [{ maximum_spend_usd: 4 }] } })).toBe(4_000_000);
    expect(await spend({ ...accepted, blocker: null, pipeline_status: { status: "blocked", phase: "policy_canary_blocked",
      blockers: [], attempts: [{ maximum_spend_usd: 3 }] } })).toBe(3_000_000);
  });

  it("counts the screening site ledger once, from its latest snapshot, and an unreadable one at the site limit", async () => {
    const spend = async (runs: Parameters<typeof reader>[1]) =>
      (await websiteJobSpend({ record: {}, reader: reader([], runs) })).screening_micros;
    expect(await spend([])).toBe(0);
    expect(await spend([screening("3.5", "2026-10-30T10:00:00Z"), screening("1.25", "2026-10-30T11:00:00Z")])).toBe(1_250_000);
    expect(await spend([screening("3.5", "2026-10-30T11:00:00Z", 2), screening("1.25", "2026-10-30T11:00:00Z")])).toBe(3_500_000);
    expect(await spend([screening("1.25", "2026-10-30T11:00:00Z"), { run: { run_kind: "beta_policy_screening" }, result: null }]))
      .toBe(15_000_000);
  });
});

describe("admission", () => {
  it("admits spend that fits exactly and refuses a micro-dollar more, the same way for every ledger", async () => {
    const record = { website_preparation_reservations: { a: held(30) } };
    const intakes = [{ state: "accepted", request: { execution: { max_total_spend_usd: 5 } } }];
    const input = { record, captureId: "capture-a", atlas: { maximum_cost_usd: 40 },
      reader: reader(intakes, [screening("4", "2026-10-30T11:00:00Z")]) };
    const { ceiling, spend } = await assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1 });
    expect(websiteJobCeilingSummary(ceiling, spend)).toEqual({ schema_version: "website_job_ceiling.v1",
      maximum_cost_usd: 40, source: "atlas_authorization", preparation_cost_usd: 30, native_construction_cost_usd: 5,
      screening_cost_usd: 4, reserved_or_settled_cost_usd: 39, remaining_cost_usd: 1 });
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1.000001 }))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
  });

  it("treats an unreadable hold as unbounded: it refuses rather than guessing, and reports nothing remaining", async () => {
    const input = { record: { website_preparation_reservations: { a: { admission: {} } } }, captureId: "capture-a",
      reader: reader() };
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: .01 }))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
    const spend = await websiteJobSpend(input);
    expect(websiteJobCeilingSummary(websiteJobCeiling(input), spend)).toMatchObject({ remaining_cost_usd: 0 });
  });

  it("puts a capture-447ae4f4-shaped job back under its $40 ceiling once the uncharged failed splat is released", async () => {
    // Atlas holds near the $40 allowance plus upstream rows: about $44 across the job's ledgers.
    const record = { website_preparation_reservations: { pose: held(30), splat: held(5), review: held(1),
      upstream: held(4), planner: held(4, 4) } };
    const input = { record, captureId: "capture-447ae4f4", atlas: { maximum_cost_usd: 40 }, reader: reader() };
    expect((await websiteJobSpend(input)).total_micros).toBe(44_000_000);
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: .5 })).rejects.toThrow("budget_exhausted");
    record.website_preparation_reservations.splat = held(5, 0);
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1 })).resolves.toBeDefined();
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1.01 })).rejects.toThrow("budget_exhausted");
  });
});
