// @vitest-environment node
/**
 * Status v8: the first look in its second shape (`website_robot_fit_projection.v2`,
 * scratchpad/e2e/FIRST_LOOK_CONTRACT.md revision 2). The website asks for "8"; a Pipeline released before v8
 * answers v7, which still reads; the v2 rows are worded once, for the site's page and the company's page.
 */
import { describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const alerts = vi.hoisted(() => ({ codes: [] as Array<[string, string]> }));
vi.mock("../utils/unknownPipelineCode", () => ({ noteUnknownPipelineCode: vi.fn(async () => undefined),
  noteUnknownPipelineCodes: vi.fn(async (_job: string, codes: Array<[string, string]>) => { alerts.codes.push(...codes); }) }));

const status = await import("../utils/websitePreparationStatus");
const { firstLookFromStoredPreparation } = await import("../utils/firstLookTable");
const { firstLookInWords } = await import("../../client/src/lib/firstLookWords");
type Selector = import("../utils/websitePreparationStatus").WebsitePreparationSelector;
type Stored = import("../utils/websitePreparationStatus").StoredWebsitePreparation;
type Deps = import("../utils/websitePreparationStatus").WebsitePreparationDeps;

const selector: Selector = { request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1",
  completion_marker_generation: "90071992547409931", producer_delivery_key: `sha256:${"a".repeat(64)}`,
  source_payload_sha256: "b".repeat(64), task_context_digest: `sha256:${"c".repeat(64)}` };

const sealed = (value: Record<string, unknown>) => ({ ...value, status_digest: crossRuntimeArtifactDigest(value, "status_digest") });
function base(version: "v7" | "v8", revision = 3) {
  return { ...selector, schema_version: `website_preparation_status.${version}`, state: "handed_off", code: "preparation_handed_off",
    attempt_count: 1, revision, correlation_id: crossRuntimeDigest({ selector, revision }), terminal_reason: null,
    outcome: null, question: null, robot_fit_precheck: null };
}
const v1Fit = { schema_version: "website_robot_fit_projection.v1", route: "full", status: "completed", reason: null,
  evidence_label: "spec_bounded_estimate", counts: { fits: 0, fits_spec: 0, doesnt_fit: 1, unknown: 2 },
  models: [{ name: "xArm 7", manufacturer: "UFactory", verdict: "doesnt_fit", open_checks: ["reach"] }],
  models_truncated: true, table_digest: `sha256:${"e".repeat(64)}` };

/** The contract's own example rows (revision 2), plus a revision-3 `route_clear` condition. */
const rows = () => [
  { name: "Panda (FER)", manufacturer: "Franka Robotics", verdict: "fits_if", verdict_if_conditions_hold: "fits",
    rated_payload_kg: 3.0, payload_limit_kg: 2.1, failed_checks: [],
    conditions: [{ quantity: "item_mass_kg", need_min: 0.024, need_max: 33.647, limit: 2.1, need_basis: "estimated_from_video", limit_basis: "catalog" }],
    missing: [] },
  { name: "UR5e", manufacturer: "Universal Robots", verdict: "fits_if", verdict_if_conditions_hold: "fits_spec",
    rated_payload_kg: 5.0, payload_limit_kg: 4.1, failed_checks: [],
    conditions: [{ quantity: "reach_m", need_min: 0.701, need_max: 1.219, limit: 0.85, need_basis: "estimated_from_video", limit_basis: "catalog" },
      { quantity: "item_mass_kg", need_min: 0.024, need_max: 33.647, limit: 4.1, need_basis: "estimated_from_video", limit_basis: "catalog" }],
    missing: [] },
  { name: "UR10e", manufacturer: "Universal Robots", verdict: "fits_if", verdict_if_conditions_hold: "fits_spec",
    rated_payload_kg: 12.5, payload_limit_kg: 11.6, failed_checks: [],
    conditions: [{ quantity: "item_mass_kg", need_min: 0.024, need_max: 33.647, limit: 11.6, need_basis: "estimated_from_video", limit_basis: "catalog" }],
    missing: [] },
  { name: "Moxi", manufacturer: "Diligent", verdict: "fits_if", verdict_if_conditions_hold: "fits_spec",
    rated_payload_kg: 3.0, payload_limit_kg: 3.0, failed_checks: [],
    conditions: [{ quantity: "route_clear", need_min: null, need_max: null, limit: null, need_basis: "unavailable", limit_basis: "catalog" }],
    missing: [] },
  { name: "xArm 7", manufacturer: "UFactory", verdict: "doesnt_fit", verdict_if_conditions_hold: null,
    rated_payload_kg: 3.5, payload_limit_kg: 2.6, failed_checks: ["reach"], conditions: [], missing: [] },
  { name: "TIAGo", manufacturer: "PAL Robotics", verdict: "unknown", verdict_if_conditions_hold: null,
    rated_payload_kg: 3.0, payload_limit_kg: 3.0, failed_checks: [], conditions: [],
    missing: [{ check: "stance", cause: "footprint_not_searched" }, { check: "access", cause: "not_checked" }] },
];
const v2Fit = (change: Record<string, unknown> = {}) => ({ schema_version: "website_robot_fit_projection.v2", route: "full",
  status: "completed", reason: null, evidence_label: "spec_bounded_estimate",
  counts: { fits: 0, fits_spec: 0, fits_if: 9, doesnt_fit: 4, unknown: 20 }, geometry_basis: "estimated_from_video",
  weight_basis: "estimated", unknown_causes: { "stance:catalog_figure_missing": 12, "access:not_checked": 9 },
  models: rows(), models_truncated: true, table_digest: `sha256:${"f".repeat(64)}`, ...change });
const v7 = (fit: unknown = v1Fit, revision = 3) => sealed({ ...base("v7", revision), robot_fit: fit });
const v8 = (fit: unknown = v2Fit(), revision = 3) => sealed({ ...base("v8", revision), robot_fit: fit });

function harness() {
  let stored: Stored | null = null;
  let canonical: unknown = v7();
  const deps: Deps = {
    async readLedger() { return canonical; },
    async verifyCurrent() { return { fingerprint: "f", owner: "o" }; },
    async readStored() { return stored; },
    async commit(input, receipt) { stored = status.mergeWebsitePreparationStatus(stored, input, receipt); },
    async pending() { return []; }, async acknowledge() {}, async findEvent() { return null; },
  };
  return { deps, get stored() { return stored; }, ledger(value: unknown) { canonical = value; } };
}
const parses = (value: unknown) => status.websitePreparationReceiptSchema.safeParse(value).success;

describe("status v8", () => {
  it("asks for 8", () => {
    expect(status.WEBSITE_PREPARATION_STATUS_VERSION).toBe("8");
  });

  it("parses v7 with the v1 table and v8 with the v2 table, and neither with the other's table", () => {
    expect(parses(v7())).toBe(true);
    expect(parses(v8())).toBe(true);
    expect(parses(v8(v1Fit))).toBe(false);
    expect(parses(v7(v2Fit()))).toBe(false);
    expect(parses(v8(null))).toBe(true);
    expect(parses(v8(v2Fit({ status: "not_run", reason: "task_family_not_modelled", evidence_label: null, counts: null,
      geometry_basis: null, weight_basis: null, unknown_causes: null, models: [], models_truncated: false, table_digest: null })))).toBe(true);
  });

  it.each([
    ["a completed table without its digest", v2Fit({ table_digest: null })],
    ["a not-run table that lists robots", v2Fit({ status: "not_run", reason: "preparation_blocked", evidence_label: null, counts: null,
      geometry_basis: null, weight_basis: null, unknown_causes: null, table_digest: null })],
    ["a physical verdict", v2Fit({ evidence_label: "physical_test" })],
    ["the old four counts", v2Fit({ counts: { fits: 0, fits_spec: 0, doesnt_fit: 4, unknown: 20 } })],
    ["a row without its conditions key", v2Fit({ models: [(({ conditions: _dropped, ...row }) => row)(rows()[0])] })],
  ])("refuses v8 with %s", (_name, fit) => {
    expect(parses(v8(fit))).toBe(false);
  });

  // The Pipeline's v2 schema sets `additionalProperties: false` at every level and promises no additive key, so a key
  // this release does not know is refused, exactly as for v1 to v7. A new code in an open slot is not.
  it.each([
    ["the table", v2Fit({ new_field: 1 })],
    ["a row", v2Fit({ models: [{ ...rows()[0], new_field: 1 }] })],
    ["a condition", v2Fit({ models: [{ ...rows()[0], conditions: [{ ...rows()[0].conditions[0], unit: "kg" }] }] })],
    ["a missing item", v2Fit({ models: [{ ...rows()[5], missing: [{ check: "stance", cause: "not_checked", note: "x" }] }] })],
    ["the receipt", { ...v8(), extra: true }],
  ])("refuses an unknown key on %s (the contract promises none)", (_name, value) => {
    const receipt = (value as { schema_version?: string }).schema_version === "website_preparation_status.v8"
      ? value : v8(value);
    expect(parses(receipt)).toBe(false);
  });

  it("reads a new code in an open slot, words it Not rated yet, and alerts staff", async () => {
    const fit = v2Fit({ models: [
      { ...rows()[0], verdict: "fits_perhaps" },
      { ...rows()[0], conditions: [{ ...rows()[0].conditions[0], quantity: "floor_load_kg" }] },
      { ...rows()[5], missing: [{ check: "lift", cause: "nobody_knows" }] },
      rows()[3]] });
    const h = harness();
    h.ledger(v8(fit));
    alerts.codes.length = 0;
    await status.syncWebsitePreparationStatus(selector, h.deps);
    expect(alerts.codes).toEqual(expect.arrayContaining([["robot_fit.verdict", "fits_perhaps"],
      ["robot_fit.condition.quantity", "floor_load_kg"], ["robot_fit.check", "lift"], ["robot_fit.missing.cause", "nobody_knows"]]));
    expect(alerts.codes.some(([, code]) => code === "route_clear")).toBe(false);
    const words = firstLookFromStoredPreparation(h.stored, {})!;
    expect(words.rows.map(row => row.text)).toEqual(["Not rated yet.", "Not rated yet.", "Not rated yet.",
      "Fits if it has a clear route to the job."]);
    for (const row of words.rows) expect(row.text).not.toMatch(/fits_perhaps|floor_load|nobody_knows|lift/);
  });
});

describe("falling back to the newest version both sides know", () => {
  it("reads a v7 answer to a request for 8, never as unavailable, and moves to v8 when the Pipeline does", async () => {
    const h = harness();
    h.ledger(v7());
    expect((await status.syncWebsitePreparationStatus(selector, h.deps)).schema_version).toBe("website_preparation_status.v7");
    const old = await status.loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1", h.deps);
    expect(old.state).toBe("handed_off");
    expect(old.robotFit?.models).toEqual([{ name: "xArm 7", manufacturer: "UFactory", verdict: "doesnt_fit", openChecks: ["reach"] }]);
    // The same ledger revision read again in v8 (the Pipeline was released) is the same state, not a replay.
    h.ledger(v8());
    expect((await status.syncWebsitePreparationStatus(selector, h.deps)).schema_version).toBe("website_preparation_status.v8");
    const now = await status.loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1", h.deps);
    expect(now.state).toBe("handed_off");
    // The v1 view of a v2 table, for the readers that use it: a `fits_if` row reads unknown, as under v7.
    expect(now.robotFit?.models.slice(0, 2)).toEqual([
      { name: "Panda (FER)", manufacturer: "Franka Robotics", verdict: "unknown", openChecks: ["payload"] },
      { name: "UR5e", manufacturer: "Universal Robots", verdict: "unknown", openChecks: ["reach", "payload"] }]);
    expect(now.robotFit?.counts).toEqual({ fits: 0, fitsSpec: 0, doesntFit: 4, unknown: 29 });
  });

  it("gives no worded table for a stored v7 row, a not-run table or a row that does not parse", async () => {
    const h = harness();
    h.ledger(v7());
    await status.syncWebsitePreparationStatus(selector, h.deps);
    expect(firstLookFromStoredPreparation(h.stored, {})).toBeNull();
    expect(firstLookFromStoredPreparation(null, {})).toBeNull();
    expect(firstLookFromStoredPreparation({ selector, status: { ...v8(), robot_fit: v2Fit({ new_field: 1 }) }, notification: null }, {})).toBeNull();
    const notRun = harness();
    notRun.ledger(v8(v2Fit({ status: "not_run", reason: "task_family_not_modelled", evidence_label: null, counts: null,
      geometry_basis: null, weight_basis: null, unknown_causes: null, models: [], models_truncated: false, table_digest: null })));
    await status.syncWebsitePreparationStatus(selector, notRun.deps);
    expect(firstLookFromStoredPreparation(notRun.stored, {})).toBeNull();
  });
});

describe("the worded first look from the stored status", () => {
  it("words the Pipeline's rows in its order, with the site's weight answer, and says how many more", async () => {
    const h = harness();
    h.ledger(v8());
    await status.syncWebsitePreparationStatus(selector, h.deps);
    const plain = firstLookFromStoredPreparation(h.stored, {})!;
    expect(plain.rows.map(row => [row.robot, row.verdict, row.text])).toEqual([
      ["Franka Robotics Panda (FER)", "conditional", "Fits if the item weighs under 2.1 kg."],
      ["Universal Robots UR5e", "conditional",
        "Fits if the job is within its 0.85 m reach; it seems to need 0.7 to 1.22 m, estimated from the video. Fits if the item weighs under 4.1 kg."],
      ["Universal Robots UR10e", "conditional", "Fits if the item weighs under 11.6 kg."],
      ["Diligent Moxi", "conditional", "Fits if it has a clear route to the job."],
      ["UFactory xArm 7", "does_not_fit", "Does not fit: it cannot reach both spots."],
      ["PAL Robotics TIAGo", "not_rated",
        "Not rated yet: its base is larger than a standard station, and we have not looked for room for it; we do not yet check whether it can get there from the entrance."],
    ]);
    expect(plain.more).toBe("And 27 more.");
    const light = firstLookFromStoredPreparation(h.stored, { job_facts: { weight: "under_5kg", updatedAtIso: "2026-11-12T10:00:00.000Z" } })!;
    expect(light.rows.map(row => row.text).slice(0, 3)).toEqual([
      "Fits if the item weighs under 2.1 kg.",
      // 5 kg is over UR5e's 4.1 kg limit: the weight condition stays.
      "Fits if the job is within its 0.85 m reach; it seems to need 0.7 to 1.22 m, estimated from the video. Fits if the item weighs under 4.1 kg.",
      "Fits: the item is under 5 kg and this robot carries 11.6 kg."]);
  });

  it("words the same row identically for the site's page and the company's page", async () => {
    const h = harness();
    h.ledger(v8());
    await status.syncWebsitePreparationStatus(selector, h.deps);
    const record = { job_facts: { weight: "5_15kg", updatedAtIso: "2026-11-12T10:00:00.000Z" }, site: { name: "Acme" } };
    // The site's page and the company's page both call firstLookFromStoredPreparation (or loadFirstLookWords, which
    // reads the same stored row): identical input gives identical words, and no sentence addresses one side only.
    const sitePage = firstLookFromStoredPreparation(h.stored, record);
    const companyPage = firstLookFromStoredPreparation(JSON.parse(JSON.stringify(h.stored)), { ...record });
    expect(companyPage).toEqual(sitePage);
    expect(sitePage).toEqual(firstLookInWords(h.stored!.status.robot_fit, record.job_facts as never));
    for (const row of sitePage!.rows) expect(row.text).not.toMatch(/\byour\b|\bAcme\b/i);
  });
});
