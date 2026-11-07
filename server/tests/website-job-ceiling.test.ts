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

// capture-447ae4f4 (2026-11-02): a scene intake is admitted with no Atlas authorization in
// hand, so it fell back to the $40 default and never read the owner's row for the job.
describe("the owner's explicit row for the job", () => {
  const row = (requestId: string, captureId: string, maximum: number, expires = 4_000_000_000) => ({
    schema_version: "website_atlas_authorization.v1", request_id: requestId, capture_id: captureId,
    task_context_digest: `sha256:${"a".repeat(64)}`, source_video_digest: `sha256:${"b".repeat(64)}`,
    provider_terms_reference: `sha256:${"c".repeat(64)}`, accepted_by: "owner", approval_reference: "test",
    private_processing_authorized: true, provider_training_authorized: false,
    provider_retention: "account_does_not_retain", maximum_cost_usd: maximum, maximum_requests: 40,
    expires_at_epoch: expires, claim_scope: "development_only" });

  it("sets the ceiling of every admission for that job that is not made under an Atlas authorization", () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([
      row("job-1", "capture-a", 130), row("job-2", "capture-a", 75)]));
    const record = { website_atlas_grants: { "capture-a": { maximum_cost_usd: 25 } } };
    expect(websiteJobCeiling({ record, captureId: "capture-a", requestId: "job-1" }))
      .toEqual({ maximum_cost_usd: 130, source: "job_authorization_row" });
    // The admission's own Atlas authorization still names its figure.
    expect(websiteJobCeiling({ record, captureId: "capture-a", requestId: "job-1", atlas: { maximum_cost_usd: 40 } }))
      .toEqual({ maximum_cost_usd: 40, source: "atlas_authorization" });
    // Another job, another capture or no request id reads no row.
    expect(websiteJobCeiling({ record, captureId: "capture-b", requestId: "job-1" }).source).toBe("owner_default");
    expect(websiteJobCeiling({ record, captureId: "capture-a" })).toEqual({ maximum_cost_usd: 25, source: "retained_atlas_grant" });
  });

  // capture-447 (2026-11-06): the owner let its $130 row expire at 10:16Z, and the ceiling still counted it.
  it("raises nothing once the row has expired", () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
    const expiry = Date.now() / 1000 + 60;
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([row("job-1", "capture-a", 130, expiry)]));
    const record = { website_atlas_grants: { "capture-a": { maximum_cost_usd: 25 } } };
    expect(websiteJobCeiling({ record, captureId: "capture-a", requestId: "job-1" }).source).toBe("job_authorization_row");
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([row("job-1", "capture-a", 130, expiry - 120)]));
    expect(websiteJobCeiling({ record, captureId: "capture-a", requestId: "job-1" }))
      .toEqual({ maximum_cost_usd: 25, source: "retained_atlas_grant" });
  });

  it("only raises the ceiling, names the smallest of several rows and ignores an unreadable setting", () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([
      row("job-1", "capture-a", 130), row("job-1", "capture-a", 60), row("job-3", "capture-a", 5)]));
    expect(websiteJobCeiling({ record: {}, captureId: "capture-a", requestId: "job-1" }).maximum_cost_usd).toBe(60);
    // A row below today's figure caps only the Atlas allowance it authorizes.
    expect(websiteJobCeiling({ record: {}, captureId: "capture-a", requestId: "job-3" }))
      .toEqual({ maximum_cost_usd: WEBSITE_JOB_CEILING_DEFAULT_USD, source: "owner_default" });
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", "not json");
    expect(websiteJobCeiling({ record: {}, captureId: "capture-a", requestId: "job-1" }))
      .toEqual({ maximum_cost_usd: WEBSITE_JOB_CEILING_DEFAULT_USD, source: "owner_default" });
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

  it("grants a navigation intake no construction allowance: it counts only holds the Pipeline reports", async () => {
    // Owner, 2026-11-07: a scene kept as filmed reserves $0 and needs no construction allowance.
    // The same execution block on a rigid intake is held in full, exactly as before.
    const navigation = (value: Record<string, any>) => ({ request: { task: { strategy: "goal_region_navigation" },
      execution: { max_total_spend_usd: 20 } }, ...value });
    const rigid = (value: Record<string, any>) => ({ request: { task: { strategy: "pick_and_place" },
      execution: { max_total_spend_usd: 20 } }, ...value });
    const spend = async (row: Record<string, any>) =>
      (await websiteJobSpend({ record: {}, reader: reader([row]) })).native_construction_micros;
    for (const value of [{ state: "forward_pending" }, { state: "forward_pending", forwarding_started: true },
      { state: "accepted", receipt: {}, pipeline_status: { attempts: [] } },
      { state: "completed", receipt: {}, pipeline_status: { status: "completed", attempts: [] } }]) {
      expect(await spend(navigation(value))).toBe(0);
    }
    expect(await spend(rigid({ state: "forward_pending" }))).toBe(20_000_000);
    expect(await spend(rigid({ state: "accepted", receipt: {}, pipeline_status: { attempts: [] } }))).toBe(20_000_000);
    // Whatever the Pipeline reports a navigation intent holding still counts.
    expect(await spend(navigation({ state: "accepted", pipeline_status: { attempts: [{ maximum_spend_usd: 4 }] } })))
      .toBe(4_000_000);
  });

  it("never counts native construction above the budget the Pipeline enforces, and skips cancelled attempts", async () => {
    // The Pipeline refuses a reservation that would take its holds past the intent's
    // (extended) budget, so that budget bounds what native construction can spend.
    // capture-447ae4f4 (2026-11-02): $20 granted, extended to $70, 18 attempt rows
    // whose maxima summed to about $361 because settled rows kept their full maximum.
    const rows = Array.from({ length: 18 }, (_, index) => ({ maximum_spend_usd: index < 9 ? 30 : 10.1 }));
    const intake = (value: Record<string, any>) => ({ request: { execution: { max_total_spend_usd: 20 } }, ...value });
    const spend = async (value: Record<string, any>) =>
      (await websiteJobSpend({ record: {}, reader: reader([intake(value)]) })).native_construction_micros;
    const status = { attempts: rows, effective_execution_budget: { max_total_spend_usd: 70 } };
    expect(await spend({ state: "accepted", pipeline_status: status })).toBe(70_000_000);
    expect(await spend({ state: "completed", pipeline_status: status })).toBe(70_000_000);
    // A cancellation the Pipeline validated before execution bought nothing.
    expect(await spend({ state: "completed", pipeline_status: { attempts: [{ maximum_spend_usd: 4 },
      { maximum_spend_usd: 6, status: "cancelled_before_execution" }] } })).toBe(4_000_000);
  });

  it("counts a row the Pipeline settled after a terminal attempt at the hold it reports, never lower", async () => {
    // capture-447ae4f4 (2026-11-03): a $31 row settled after its CPU prestage was refused
    // for credit keeps $21.630673 against the intent's cap (Pipeline committed_spend_usd);
    // its successor holds $18. The status reads the settled row `cancelled_before_execution`.
    const intake = (value: Record<string, any>) => ({ request: { execution: { max_total_spend_usd: 20 } }, ...value });
    const spend = async (value: Record<string, any>) =>
      (await websiteJobSpend({ record: {}, reader: reader([intake(value)]) })).native_construction_micros;
    const successor = { maximum_spend_usd: 18, status: "reserved" };
    const crashed = { maximum_spend_usd: 31, status: "cancelled_before_execution" };
    const settled = { ...crashed, retained_spend_usd: 21.630673,
      retained_spend_basis: "artisan_proven_authoring_without_allocation" };
    const status = (attempts: unknown[], budget = 90) =>
      ({ status: "completed", attempts, effective_execution_budget: { max_total_spend_usd: budget } });
    // An older status without the figure counts the settled row as nothing, as before.
    expect(await spend({ state: "completed", pipeline_status: status([successor, crashed]) })).toBe(18_000_000);
    expect(await spend({ state: "completed", pipeline_status: status([successor, settled]) })).toBe(39_630_673);
    // While the intake is open its whole (extended) budget is held, or the reported holds if larger.
    expect(await spend({ state: "accepted", pipeline_status: status([successor, settled]) })).toBe(90_000_000);
    const unproven = { ...crashed, retained_spend_usd: 31, retained_spend_basis: "terminal_launch_unreconciled" };
    expect(await spend({ state: "accepted", pipeline_status: status([successor, unproven], 20) })).toBe(49_000_000);
    expect(await spend({ state: "completed", pipeline_status: status([successor, unproven], 20) })).toBe(49_000_000);
    // A never-started cancellation, or a settlement that released everything, still holds nothing.
    expect(await spend({ state: "completed", pipeline_status: status([successor, crashed,
      { ...crashed, retained_spend_usd: 0, retained_spend_basis: "launch_never_queued" }]) })).toBe(18_000_000);
    // The figure only raises a row: a live row keeps its whole reservation.
    expect(await spend({ state: "completed", pipeline_status: status([{ ...successor, retained_spend_usd: 1,
      retained_spend_basis: "terminal_launch_unreconciled" }]) })).toBe(18_000_000);
    // The earlier capture-447 intent: revoked, every row cancelled, five settled with holds.
    const holds = [5, 18.760959, 5, 9.258497, 5];
    const revoked = { status: "blocked", phase: "authority", blockers: ["scene_intake_authority_revoked"],
      effective_execution_budget: { max_total_spend_usd: 70 },
      attempts: [...holds.map(hold => ({ ...crashed, retained_spend_usd: hold, retained_spend_basis: "x" })),
        ...Array.from({ length: 13 }, () => crashed)] };
    const closed = { receipt: {}, state: "blocked", blocker: "terminal_closeout_poll_cap_exhausted" };
    expect(await spend({ ...closed, pipeline_status: { ...revoked, attempts: revoked.attempts.map(() => crashed) } }))
      .toBe(0);
    expect(await spend({ ...closed, pipeline_status: revoked })).toBe(43_019_456);
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
      .toBe(30_000_000);
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

  it("leaves a job only what remains after the Pipeline's settled holds", async () => {
    const crashed = { maximum_spend_usd: 31, status: "cancelled_before_execution" };
    const intake = (settled: Record<string, any>) => ({ state: "completed", receipt: {},
      request: { execution: { max_total_spend_usd: 20 } }, pipeline_status: { status: "completed",
        attempts: [{ maximum_spend_usd: 18, status: "reserved" }, settled],
        effective_execution_budget: { max_total_spend_usd: 90 } } });
    const input = (settled: Record<string, any>) => ({ record: { website_preparation_reservations: { a: held(40) } },
      captureId: "capture-a", atlas: { maximum_cost_usd: 130 }, reader: reader([intake(settled)]) });
    // Without the figure the settled $21.630673 was free to spend again.
    await expect(assertWithinWebsiteJobCeiling({ ...input(crashed), additionalCostUsd: 72 })).resolves.toBeDefined();
    const reported = input({ ...crashed, retained_spend_usd: 21.630673,
      retained_spend_basis: "artisan_proven_authoring_without_allocation" });
    await expect(assertWithinWebsiteJobCeiling({ ...reported, additionalCostUsd: 50.369327 })).resolves.toBeDefined();
    await expect(assertWithinWebsiteJobCeiling({ ...reported, additionalCostUsd: 50.369328 }))
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
