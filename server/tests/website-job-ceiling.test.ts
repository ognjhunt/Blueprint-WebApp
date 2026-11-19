// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { assertWithinWebsiteJobCeiling, checkWebsiteJobCeiling, WEBSITE_JOB_SPEND_CAP_USD, websiteJobCeiling, websiteJobCeilingSummary,
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

const owner = (requestId: string, captureId: string, maximum: number) => ({
  schema_version: "website_atlas_authorization.v1", request_id: requestId, capture_id: captureId,
  task_context_digest: `sha256:${"a".repeat(64)}`, source_video_digest: `sha256:${"b".repeat(64)}`,
  provider_terms_reference: `sha256:${"c".repeat(64)}`, accepted_by: "owner", approval_reference: "test",
  private_processing_authorized: true, provider_training_authorized: false,
  provider_retention: "account_does_not_retain", maximum_cost_usd: maximum, maximum_requests: 40,
  expires_at_epoch: 4_000_000_000, claim_scope: "development_only" });

describe("one cap per job (owner decision 2026-11-19)", () => {
  it("is $40, from the one committed figure the Pipeline also reads, and nothing on the job or the host changes it", () => {
    const mirror = path.resolve(__dirname, "../../contracts/pipeline/website-job-spend-cap.v1.json");
    expect(JSON.parse(fs.readFileSync(mirror, "utf8")).per_job_cap_usd).toBe("40");
    expect(WEBSITE_JOB_SPEND_CAP_USD).toBe(40);
    // The Pipeline's file, byte for byte, when a sibling checkout is present (CI runs the parity script too).
    const pipeline = path.resolve(__dirname, "../../../BlueprintCapturePipeline/config/website_job_spend_cap.v1.json");
    if (fs.existsSync(pipeline)) expect(fs.readFileSync(mirror)).toEqual(fs.readFileSync(pipeline));
    // An owner's authorization row, a grant policy or a stored grant figure used to set or raise it; none does now.
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({ ...policy, maximum_cost_usd: 30 }));
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([owner("job-1", "capture-a", 130)]));
    expect(websiteJobCeiling()).toEqual({ maximum_cost_usd: 40, source: "job_spending_cap" });
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
    // An owner extension the Pipeline recorded before 2026-11-19 still counts in full while the intake is open.
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

  // What cannot be read is counted as unbounded (so the cap refuses), named, and left out of the readable figure.
  it("names every record whose figure cannot be read, and adds up only what can be read beside the count", async () => {
    const record = { website_preparation_reservations: { good: held(10), broken: { admission: {} } } };
    const intakes = [{ command: { submission_id: "sub-1" }, request: { execution: {} }, state: "accepted" }];
    const runs = [{ run: { run_kind: "beta_policy_screening", result_record_id: "screening-x" }, result: null }];
    const spend = await websiteJobSpend({ record, reader: reader(intakes, runs) });
    expect(spend).toMatchObject({ preparation_micros: Infinity, native_construction_micros: Infinity, screening_micros: 30_000_000,
      total_micros: Infinity, readable_total_micros: 10_000_000,
      unreadable: ["preparation reservation broken", "scene intake sub-1", "screening result screening-x"] });
    expect((await websiteJobSpend({ record: { website_preparation_reservations: { good: held(10) } }, reader: reader() })).unreadable).toEqual([]);
  });

  // Review of #1274: one unreadable result threw away every valid publication's readable figure.
  it("keeps the latest valid publication's readable figure when a sibling result cannot be read", async () => {
    const broken = { run: { run_kind: "beta_policy_screening", result_record_id: "screening-broken" }, result: null };
    const screening = (committed: string, generatedAt: string) => ({ run: { run_kind: "beta_policy_screening" },
      result: { publication: sealScreening({ ...screeningFixture().publication, generated_at: generatedAt,
        budget: { currency: "USD", limit_usd: "150", committed_upper_bound_usd: committed, spent_upper_bound_usd: "0", reserved_usd: committed } }) } });
    const spend = (runs: Parameters<typeof reader>[1]) => websiteJobSpend({ record: {}, reader: reader([], runs) });
    const one = await spend([screening("120", "2026-11-12T10:00:00Z"), broken]);
    // Counted at the site limit, and never below what the valid one commits: the cap is the only stop.
    expect(one).toMatchObject({ screening_micros: 120_000_000, readable_total_micros: 120_000_000,
      unreadable: ["screening result screening-broken"] });
    // Two valid ones and an unreadable one: the latest valid snapshot is the one read.
    const two = await spend([screening("120", "2026-11-12T10:00:00Z"), screening("80", "2026-11-12T11:00:00Z"), broken]);
    expect(two).toMatchObject({ screening_micros: 80_000_000, readable_total_micros: 80_000_000 });
    const low = await spend([screening("4", "2026-11-12T10:00:00Z"), broken]);
    expect(low).toMatchObject({ screening_micros: 30_000_000, readable_total_micros: 4_000_000 });
    // None valid: nothing readable, as before.
    expect(await spend([broken])).toMatchObject({ screening_micros: 30_000_000, readable_total_micros: 0 });
  });

  it("keeps the readable parts of a preparation row or scene intake that has one unreadable figure", async () => {
    // A settlement that cannot be read is bounded by the row's readable $4 hold.
    const record = { website_preparation_reservations: { a: { admission: { maximum_cost_usd: 4 }, settlement: { actual_cost_usd: "x" } } } };
    const intake = { state: "completed", receipt: {}, request: { execution: { max_total_spend_usd: 20 } },
      pipeline_status: { status: "completed", attempts: [{ maximum_spend_usd: 18, retained_spend_usd: 5 }, { maximum_spend_usd: "bad", retained_spend_usd: 1 }] } };
    const spend = await websiteJobSpend({ record, reader: reader([intake]) });
    expect(spend).toMatchObject({ preparation_micros: Infinity, native_construction_micros: Infinity,
      readable_total_micros: 4_000_000 + 18_000_000 + 1_000_000 });
    expect(spend.unreadable).toEqual(["preparation reservation a", "scene intake with no submission id"]);
  });
});

describe("admission", () => {
  it("admits spend that fits exactly and refuses a micro-dollar more, the same way for every ledger", async () => {
    const record = { website_preparation_reservations: { a: held(30) } };
    const intakes = [{ state: "accepted", request: { execution: { max_total_spend_usd: 5 } } }];
    const input = { record, reader: reader(intakes, [screening("4", "2026-10-30T11:00:00Z")]) };
    const { ceiling, spend } = await assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1 });
    expect(websiteJobCeilingSummary(ceiling, spend)).toEqual({ schema_version: "website_job_ceiling.v1",
      maximum_cost_usd: 40, source: "job_spending_cap", preparation_cost_usd: 30, native_construction_cost_usd: 5,
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
    const input = (settled: Record<string, any>) => ({ record: { website_preparation_reservations: { a: held(0.369327) } },
      reader: reader([intake(settled)]) });
    // Without the figure the settled $21.630673 was free to spend again.
    await expect(assertWithinWebsiteJobCeiling({ ...input(crashed), additionalCostUsd: 21.630673 })).resolves.toBeDefined();
    const reported = input({ ...crashed, retained_spend_usd: 21.630673,
      retained_spend_basis: "artisan_proven_authoring_without_allocation" });
    // $18 + $21.630673 + $0.369327 = $40: nothing more fits.
    await expect(assertWithinWebsiteJobCeiling({ ...reported, additionalCostUsd: 0.000001 }))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
  });

  it("treats an unreadable hold as unbounded: it refuses rather than guessing, and reports nothing remaining", async () => {
    const input = { record: { website_preparation_reservations: { a: { admission: {} } } }, reader: reader() };
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: .01 }))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
    const spend = await websiteJobSpend(input);
    expect(websiteJobCeilingSummary(websiteJobCeiling(), spend)).toMatchObject({ remaining_cost_usd: 0 });
  });

  it("puts a capture-447ae4f4-shaped job back under its $40 ceiling once the uncharged failed splat is released", async () => {
    // Atlas holds near the $40 allowance plus upstream rows: about $44 across the job's ledgers.
    const record = { website_preparation_reservations: { pose: held(30), splat: held(5), review: held(1),
      upstream: held(4), planner: held(4, 4) } };
    const input = { record, reader: reader() };
    expect((await websiteJobSpend(input)).total_micros).toBe(44_000_000);
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: .5 })).rejects.toThrow("budget_exhausted");
    record.website_preparation_reservations.splat = held(5, 0);
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1 })).resolves.toBeDefined();
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 1.01 })).rejects.toThrow("budget_exhausted");
  });
});

describe("one cap at $40: every provider, every retry, released when a call ends (owner, 2026-11-19)", () => {
  const atlasRow = (maximum: number, settled?: number) => ({ admission: { maximum_cost_usd: maximum, provider: "world_labs_atlas" },
    ...(settled === undefined ? {} : { settlement: { actual_cost_usd: settled, status: "settled" } }) });
  const scene = (value: Record<string, any>) => ({ request: { task: { strategy: "pick_and_place" },
    execution: { max_total_spend_usd: 20 } }, ...value });

  it("admits a job under the cap across Gemini, SAM, World Labs, OpenAI and the scene", async () => {
    const record = { website_preparation_reservations: { gemini: held(0.25, 0.04), sam: held(0.6), splat: atlasRow(5),
      planner: held(0.5, 0.12) } };
    const input = { record, reader: reader([scene({ state: "accepted", receipt: {}, pipeline_status: { attempts: [] } })]) };
    const job = await checkWebsiteJobCeiling({ ...input, additionalCostUsd: 4 });
    // $0.04 + $0.60 + $5 + $0.12 + the scene's $20 allowance + this $4 = $29.76.
    expect(job).toMatchObject({ exceeded: false, ceiling: { maximum_cost_usd: 40 } });
    expect(job.spend.total_micros).toBe(25_760_000);
  });

  it("refuses the call that would cross it, whichever provider asks", async () => {
    const record = { website_preparation_reservations: { splat: atlasRow(5), mesh: atlasRow(0.5, 0.5) } };
    const input = { record, reader: reader([scene({ state: "accepted", receipt: {}, pipeline_status: { attempts: [] } })]) };
    // $5.50 + $20 = $25.50 counted: $14.50 more fits, a micro-dollar over does not.
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 14.5 })).resolves.toBeDefined();
    await expect(assertWithinWebsiteJobCeiling({ ...input, additionalCostUsd: 14.500001 }))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
  });

  it("counts every retry as its own call: each reservation, held until it settles", async () => {
    // A splat that failed twice before it completed: three reservations, each counted.
    const record = { website_preparation_reservations: { first: atlasRow(5), retry: atlasRow(5), second: atlasRow(5) } };
    expect((await websiteJobSpend({ record, reader: reader() })).preparation_micros).toBe(15_000_000);
    // The scene's retried attempts count too, once its intent has ended.
    const ended = scene({ state: "completed", receipt: {}, pipeline_status: { status: "completed",
      attempts: [{ maximum_spend_usd: 18, status: "cancelled_before_execution", retained_spend_usd: 12.4 },
        { maximum_spend_usd: 18 }] } });
    expect((await websiteJobSpend({ record: {}, reader: reader([ended]) })).native_construction_micros).toBe(30_400_000);
  });

  it("releases a reservation when its call ends, so holds never pile up", async () => {
    const record: Record<string, any> = { website_preparation_reservations: { a: atlasRow(5), b: atlasRow(5), c: held(4) } };
    const input = { record, reader: reader() };
    expect((await websiteJobSpend(input)).total_micros).toBe(14_000_000);
    // Two failed splats cost nothing and one review cost $0.31: settled, they count what they cost.
    record.website_preparation_reservations = { a: atlasRow(5, 0), b: atlasRow(5, 0), c: held(4, 0.31) };
    expect((await websiteJobSpend(input)).total_micros).toBe(310_000);
    // A scene whose Pipeline outcome is terminal (the cap reached among them) starts nothing more: its allowance is
    // released down to what its attempts still hold.
    const capped = scene({ state: "blocked", receipt: {}, pipeline_status: { status: "blocked", phase: "preparation",
      blockers: ["scene_intake_spend_cap_exhausted"], attempts: [{ maximum_spend_usd: 18, retained_spend_usd: 6 }],
      outcome: { kind: "spending_cap_reached", terminal: true } } });
    expect((await websiteJobSpend({ record: {}, reader: reader([capped]) })).native_construction_micros).toBe(18_000_000);
    const open = { ...capped, pipeline_status: { ...capped.pipeline_status, outcome: undefined } };
    expect((await websiteJobSpend({ record: {}, reader: reader([open]) })).native_construction_micros).toBe(20_000_000);
  });

  it("counts a job in flight across the switch by everything it already holds or spent; past $40 it admits nothing", async () => {
    // capture-447-shaped: an owner row at $70, a scene extended to $70 by six owner grants, $52.23 kept by
    // settled rows and $6.01 live, Atlas rows near its old allowance.
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([owner("job-447", "capture-447", 70)]));
    const kept = [5, 5, 5, 20, 17.23].map(hold => ({ maximum_spend_usd: 30, status: "cancelled_before_execution",
      retained_spend_usd: hold, retained_spend_basis: "x" }));
    const intake = scene({ state: "accepted", receipt: {}, pipeline_status: { status: "running", phase: null, blockers: [],
      attempts: [...kept, { maximum_spend_usd: 6.01, status: "reserved" }],
      effective_execution_budget: { max_total_spend_usd: 70, max_paid_attempts: 16, extension_digest: null, extension_count: 6 } } });
    const record = { website_preparation_reservations: { pose: atlasRow(9.5, 9.5), splat: atlasRow(5, 0) },
      website_scene_sponsorship: { automatic_budget_extension: true } };
    const job = await checkWebsiteJobCeiling({ record, reader: reader([intake]), additionalCostUsd: 0.01 });
    expect(job.ceiling.maximum_cost_usd).toBe(40);
    expect(job.spend.total_micros).toBe(79_500_000);
    expect(job.exceeded).toBe(true);
    // A job in flight that is still under $40 keeps going, inside the cap and no further, whatever its grant names.
    const small = { website_preparation_reservations: { pose: atlasRow(3, 2.2) }, website_scene_sponsorship: { automatic_budget_extension: true } };
    await expect(assertWithinWebsiteJobCeiling({ record: small, reader: reader(), additionalCostUsd: 37.8 })).resolves.toBeDefined();
    await expect(assertWithinWebsiteJobCeiling({ record: small, reader: reader(), additionalCostUsd: 37.800001 }))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
  });
});
