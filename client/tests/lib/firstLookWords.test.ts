import { describe, expect, it } from "vitest";
import {
  conditionWords, figureWords, firstLookInWords, firstLookRowFromAnswerRobot, firstLookRowInWords, kgWords, missingCauseWords,
  type FirstLookRow,
} from "@/lib/firstLookWords";
import type { JobFacts } from "@/lib/jobFacts";

const mass = (limit: number) => ({ quantity: "item_mass_kg", need_min: 0.024, need_max: 33.6, limit,
  need_basis: "estimated_from_video", limit_basis: "catalog" });
const reach = (limit: number, min: number | null = 0.701, max: number | null = 1.219, basis = "estimated_from_video") =>
  ({ quantity: "reach_m", need_min: min, need_max: max, limit, need_basis: basis, limit_basis: "catalog" });
const cycle = (limit: number, min: number | null = 4.2, max: number | null = 7.9) =>
  ({ quantity: "cycle_time_s", need_min: min, need_max: max, limit, need_basis: "estimated_from_video", limit_basis: "owner_target" });
const route = { quantity: "route_clear", need_min: null, need_max: null, limit: null, need_basis: "unavailable", limit_basis: "catalog" };
const fitsIf = (conditions: unknown[], rated: number | null = 12.5): FirstLookRow => ({ name: "UR10e", manufacturer: "Universal Robots",
  verdict: "fits_if", verdict_if_conditions_hold: "fits_spec", rated_payload_kg: rated, payload_limit_kg: 11.6, failed_checks: [],
  conditions, missing: [] });
const facts = (weight: JobFacts["weight"]): JobFacts => ({ weight, updatedAtIso: "2026-11-12T10:00:00.000Z" });

describe("firstLookRowInWords", () => {
  it("says Fits. for fits and fits_spec, with the robot named from the row", () => {
    expect(firstLookRowInWords({ name: "UR20", manufacturer: "Universal Robots", verdict: "fits" }))
      .toEqual({ verdict: "fits", text: "Fits.", robot: "Universal Robots UR20" });
    expect(firstLookRowInWords({ name: "UR20", manufacturer: "Universal Robots", verdict: "fits_spec" }).text).toBe("Fits.");
  });

  it("says why a robot does not fit, in fixed words for every check code, never a raw code", () => {
    const words = (check: string) => firstLookRowInWords({ name: "xArm 7", verdict: "doesnt_fit", failed_checks: [check] }).text;
    expect(words("reach")).toBe("Does not fit: it cannot reach both spots.");
    expect(words("payload")).toBe("Does not fit: the item is too heavy for it.");
    expect(words("cycle_time")).toBe("Does not fit: it is too slow for the rate.");
    expect(words("stance")).toBe("Does not fit: there is no place for it to stand.");
    expect(words("access")).toBe("Does not fit: it cannot get there from the entrance.");
    expect(words("zz_new_check")).toBe("Does not fit.");
  });

  it("words each condition quantity", () => {
    expect(conditionWords(mass(11.6))).toBe("Fits if the item weighs under 11.6 kg.");
    expect(conditionWords(reach(0.85))).toBe("Fits if the job is within its 0.85 m reach; it seems to need 0.7 to 1.22 m, estimated from the video.");
    expect(conditionWords(reach(0.85, 0.9, 0.9, "owner_stated"))).toBe("Fits if the job is within its 0.85 m reach; it seems to need about 0.9 m, from the site's own numbers.");
    expect(conditionWords(reach(1.3, null, null))).toBe("Fits if the job is within its 1.3 m reach.");
    expect(conditionWords(reach(0.85, 0.7, 1.2, "unavailable"))).toBe("Fits if the job is within its 0.85 m reach; it seems to need 0.7 to 1.2 m.");
    expect(conditionWords(cycle(6))).toBe("Fits if each cycle can stay within the site's 6 s target; it seems to take 4.2 to 7.9 s.");
    expect(conditionWords(cycle(6, null, null))).toBe("Fits if each cycle can stay within the site's 6 s target.");
    expect(conditionWords(route)).toBe("Fits if it has a clear route to the job.");
    const floor = (limit: number, min: number | null, max: number | null) =>
      ({ quantity: "floor_width_m", need_min: min, need_max: max, limit, need_basis: "estimated_from_video", limit_basis: "catalog" });
    expect(conditionWords(floor(0.62, 0.5, 0.9))).toBe("Fits if there is 0.62 m of clear floor to stand on; this job seems to offer 0.5 to 0.9 m, estimated from the video.");
    expect(conditionWords(floor(0.62, null, null))).toBe("Fits if there is 0.62 m of clear floor to stand on.");
    expect(conditionWords(floor(0, 0.5, 0.9))).toBeNull();
    expect(conditionWords({ ...route, quantity: "floor_load_kg", limit: 3 })).toBeNull();
    expect(conditionWords(mass(0))).toBeNull();
    expect(conditionWords(reach(Number.NaN))).toBeNull();
    expect(conditionWords(null)).toBeNull();
  });

  it("joins several conditions in the Pipeline's order", () => {
    expect(firstLookRowInWords(fitsIf([reach(0.85), mass(4.1)])))
      .toMatchObject({ verdict: "conditional", text: "Fits if the job is within its 0.85 m reach; it seems to need 0.7 to 1.22 m, estimated from the video. Fits if the item weighs under 4.1 kg." });
  });

  it("resolves the weight condition when the range's upper bound is within the limit", () => {
    expect(firstLookRowInWords(fitsIf([mass(11.6)]), facts("under_5kg")))
      .toMatchObject({ verdict: "fits", text: "Fits: the item is under 5 kg and this robot carries 11.6 kg." });
    expect(firstLookRowInWords(fitsIf([mass(15)]), facts("5_15kg")).verdict).toBe("fits");
    // Other conditions stay; the settled weight is said after them.
    expect(firstLookRowInWords(fitsIf([route, mass(11.6)]), facts("under_5kg")))
      .toMatchObject({ verdict: "conditional", text: "Fits if it has a clear route to the job. The item is under 5 kg and this robot carries 11.6 kg." });
  });

  it("stays conditional when the range overlaps the limit, for over 30 kg against a limit of 30 kg or more, and for not sure", () => {
    expect(firstLookRowInWords(fitsIf([mass(29.1)], 30), facts("15_30kg")).text).toBe("Fits if the item weighs under 29.1 kg.");
    expect(firstLookRowInWords(fitsIf([mass(11.6)]), facts("5_15kg")).verdict).toBe("conditional");
    expect(firstLookRowInWords(fitsIf([mass(30)], 31), facts("over_30kg")).verdict).toBe("conditional");
    expect(firstLookRowInWords(fitsIf([mass(11.6)]), facts("unsure")).verdict).toBe("conditional");
    expect(firstLookRowInWords(fitsIf([mass(11.6)]), { weight: "a_ton" } as never).verdict).toBe("conditional");
  });

  // One weight rule (contract revision 5): the site's range against the condition's limit (rating less a 0.9 kg gripper).
  it("compares the site's weight range with the condition's limit, never the rating: holds, does not fit, or stays", () => {
    // The whole range at or under the limit: the condition holds and the row reads as a fit.
    expect(firstLookRowInWords(fitsIf([mass(11.6)], 12.5), facts("under_5kg")).verdict).toBe("fits");
    // The whole range over the limit, though under the rating (3 kg rating, 2.1 kg limit, 2.5 to 3 kg is not a code;
    // 5 to 15 kg over 4.1): does not fit, said with the standard gripper.
    expect(firstLookRowInWords(fitsIf([mass(4.1)], 5), facts("5_15kg"))).toMatchObject({ verdict: "does_not_fit",
      text: "Does not fit: the item is too heavy for it with a standard gripper (it carries 4.1 kg)." });
    expect(firstLookRowInWords(fitsIf([reach(0.85), mass(4.1)], null), facts("5_15kg")).verdict).toBe("does_not_fit");
    // A range that straddles the limit, "over 30 kg" and "not sure" leave the condition as it is.
    expect(firstLookRowInWords(fitsIf([mass(11.6)], 12.5), facts("5_15kg")).verdict).toBe("conditional");
    // "Over 30 kg" means more than 30 kg (planner, S6): it does not fit a limit under 30 kg; at 30 kg or more it stays.
    expect(firstLookRowInWords(fitsIf([mass(11.6)], 12.5), facts("over_30kg"))).toMatchObject({ verdict: "does_not_fit",
      text: "Does not fit: the item is too heavy for it with a standard gripper (it carries 11.6 kg)." });
    expect(firstLookRowInWords(fitsIf([mass(29.1)], 30), facts("over_30kg")).verdict).toBe("does_not_fit");
    expect(firstLookRowInWords(fitsIf([mass(30)], 31), facts("over_30kg")).verdict).toBe("conditional");
    expect(firstLookRowInWords(fitsIf([mass(34.1)], 35), facts("over_30kg")).verdict).toBe("conditional");
    expect(firstLookRowInWords(fitsIf([mass(11.6)], 12.5), facts("unsure")).verdict).toBe("conditional");
  });

  it("never resolves an unknown or doesnt_fit row from the weight answer", () => {
    expect(firstLookRowInWords({ name: "UR5e", verdict: "unknown", conditions: [mass(4.1)], missing: [] }, facts("under_5kg")).verdict)
      .toBe("not_rated");
    expect(firstLookRowInWords({ name: "xArm 7", verdict: "doesnt_fit", failed_checks: ["reach"], conditions: [mass(2.6)] },
      facts("under_5kg")).verdict).toBe("does_not_fit");
  });

  it("words every missing cause, and an unknown cause not at all", () => {
    const row = (missing: unknown[]) => firstLookRowInWords({ name: "TIAGo", verdict: "unknown", missing }).text;
    expect(row([{ check: "stance", cause: "catalog_figure_missing" }])).toBe("Not rated yet: the maker publishes no base size for it.");
    expect(row([{ check: "reach", cause: "catalog_figure_missing" }])).toBe("Not rated yet: the maker publishes no reach for it.");
    expect(row([{ check: "payload", cause: "catalog_figure_missing" }])).toBe("Not rated yet: the maker publishes no rated payload for it.");
    expect(row([{ check: "cycle_time", cause: "catalog_figure_missing" }])).toBe("Not rated yet: the maker publishes no top speed for it.");
    expect(row([{ check: "access", cause: "catalog_figure_missing" }])).toBe("Not rated yet: the maker publishes no figure we need for it.");
    expect(row([{ check: "stance", cause: "footprint_not_searched" }])).toBe("Not rated yet: its base is larger than a standard station, and we have not looked for room for it.");
    expect(row([{ check: "stance", cause: "no_clear_station" }])).toBe("Not rated yet: we found no clear floor space for it to stand.");
    expect(row([{ check: "reach", cause: "arm_pose_search_inconclusive" }])).toBe("Not rated yet: our search found no arm position that reaches, although its published reach is enough.");
    expect(row([{ check: "reach", cause: "carry_check_undecided" }])).toBe("Not rated yet: the carry check in the simulation did not settle whether it reaches.");
    expect(row([{ check: "reach", cause: "not_modelled" }])).toBe("Not rated yet: we do not yet model its reach from where it stands.");
    expect(row([{ check: "stance", cause: "not_modelled" }])).toBe("Not rated yet: we do not model this yet.");
    expect(row([{ check: "access", cause: "not_checked" }])).toBe("Not rated yet: we do not yet check whether it can get there from the entrance.");
    expect(row([{ check: "reach", cause: "not_checked" }])).toBe("Not rated yet: we have not checked this yet.");
    expect(row([{ check: "reach", cause: "tool_figure_missing" }])).toBe("Not rated yet: the size of its standard gripper is not known.");
    expect(row([{ check: "payload", cause: "item_mass_missing" }])).toBe("Not rated yet: the item's weight is not known, and its standard gripper alone is over its rating.");
    expect(row([{ check: "payload", cause: "estimate_straddles_limit" }])).toBe("Not rated yet: the item's estimated weight is too close to its rating to tell.");
    expect(row([{ check: "stance", cause: "footprint_not_searched" }, { check: "access", cause: "not_checked" }]))
      .toBe("Not rated yet: its base is larger than a standard station, and we have not looked for room for it; we do not yet check whether it can get there from the entrance.");
    expect(row([{ check: "lift", cause: "nobody_knows" }])).toBe("Not rated yet.");
    expect(row([])).toBe("Not rated yet.");
    expect(missingCauseWords(1, "x")).toBeNull();
  });

  it("shows Not rated yet. for unknown verdicts, unknown quantities and malformed rows, never a raw code, never a crash", () => {
    for (const row of [{ name: "R", verdict: "brand_new_code" }, { name: "R" }, {}, null, undefined, "x" as never,
      fitsIf([]), fitsIf([{ ...route, quantity: "floor_load_kg" }]), fitsIf([mass(Number.NaN)]), fitsIf("x" as never),
      { name: "R", verdict: "fits_if_weight_within_limit", payload_limit_kg: 2 }]) {
      const words = firstLookRowInWords(row as FirstLookRow, facts("under_5kg"));
      expect(words).toMatchObject({ verdict: "not_rated", text: "Not rated yet." });
    }
  });

  // FIRST_LOOK_CONTRACT revision 4: hand height (a robot that drives) and floor width (reversed: at least the limit).
  it("words hand_height_m and floor_width_m from the contract, and the site's weight answer never resolves them", () => {
    const hand = (limit: number, min: number | null = 0.4, max: number | null = 1.65) =>
      ({ quantity: "hand_height_m", need_min: min, need_max: max, limit, need_basis: "estimated_from_video", limit_basis: "catalog" });
    const floor = { quantity: "floor_width_m", need_min: 0.5, need_max: 0.9, limit: 0.62, need_basis: "estimated_from_video", limit_basis: "catalog" };
    expect(conditionWords(hand(1.5))).toBe("Fits if the job's heights are within its hand range up to 1.5 m; it seems to need 0.4 to 1.65 m, estimated from the video.");
    expect(conditionWords(hand(1.5, null, null))).toBe("Fits if the job's heights are within its hand range up to 1.5 m.");
    expect(conditionWords(hand(0))).toBeNull();
    for (const weight of ["under_5kg", "5_15kg", "over_30kg", "unsure"] as const) {
      expect(firstLookRowInWords(fitsIf([hand(1.5), floor]), facts(weight))).toEqual({ verdict: "conditional", robot: "Universal Robots UR10e",
        text: "Fits if the job's heights are within its hand range up to 1.5 m; it seems to need 0.4 to 1.65 m, estimated from the video. "
          + "Fits if there is 0.62 m of clear floor to stand on; this job seems to offer 0.5 to 0.9 m, estimated from the video." });
    }
  });

  it("says a quantity the website does not word in the Pipeline's own sentence when it sent one, and never throws", () => {
    const unknown = { quantity: "floor_load_kg", need_min: 1, need_max: 2, limit: 3, need_basis: "estimated_from_video", limit_basis: "catalog" };
    expect(firstLookRowInWords({ ...fitsIf([unknown, mass(11.6)]), first_look_reasons: ["Fits if the floor holds its weight.", "x"] }))
      .toMatchObject({ verdict: "conditional", text: "Fits if the floor holds its weight. Fits if the item weighs under 11.6 kg." });
    expect(firstLookRowInWords(fitsIf([{ ...unknown, sentence: "Fits if the floor holds it." }])))
      .toMatchObject({ verdict: "conditional", text: "Fits if the floor holds it." });
    // No sentence from the Pipeline either: the row is not rated, never a raw code.
    expect(firstLookRowInWords(fitsIf([unknown]))).toMatchObject({ verdict: "not_rated", text: "Not rated yet." });
    expect(() => firstLookRowInWords({ ...fitsIf([unknown]), first_look_reasons: [null, 3] as never })).not.toThrow();
  });

  it("names the robot only from the row", () => {
    expect(firstLookRowInWords({ verdict: "fits" }).robot).toBeNull();
    expect(firstLookRowInWords({ name: "UR10e", verdict: "fits" }).robot).toBe("UR10e");
    expect(firstLookRowInWords({ name: "Franka Panda", manufacturer: "Franka", verdict: "fits" }).robot).toBe("Franka Panda");
  });

  it("writes figures with few decimals", () => {
    expect([kgWords(5), kgWords(11.6), kgWords(29.149), kgWords(2.0)]).toEqual(["5", "11.6", "29.1", "2"]);
    expect([figureWords(0.701, 2), figureWords(1.219, 2), figureWords(0.85, 2)]).toEqual(["0.7", "1.22", "0.85"]);
  });

  it("never addresses one side: the same words reach the site and the company", () => {
    const all = [firstLookRowInWords(fitsIf([reach(0.85), mass(11.6), cycle(6), route]), facts("under_5kg")).text,
      firstLookRowInWords(fitsIf([mass(11.6)]), facts("under_5kg")).text];
    for (const line of all) expect(line).not.toMatch(/\byour?\b/i);
  });
});

describe("firstLookInWords", () => {
  const table = (change: Record<string, unknown> = {}) => ({ counts: { fits: 0, fits_spec: 0, fits_if: 9, doesnt_fit: 4, unknown: 20 },
    models: [fitsIf([mass(11.6)]), { name: "xArm 7", verdict: "doesnt_fit", failed_checks: ["reach"] }], models_truncated: false, ...change });
  it("keeps the Pipeline's rows and order", () => {
    expect(firstLookInWords(table()).rows.map(row => row.text)).toEqual(["Fits if the item weighs under 11.6 kg.", "Does not fit: it cannot reach both spots."]);
    expect(firstLookInWords(table()).more).toBeNull();
  });
  it("says how many more when the Pipeline cut the list", () => {
    expect(firstLookInWords(table({ models_truncated: true })).more).toBe("And 31 more.");
    expect(firstLookInWords(table({ models_truncated: true, counts: null })).more).toBe("And more not listed here.");
  });
  it("reads a malformed table as empty", () => {
    expect(firstLookInWords(null)).toEqual({ rows: [], more: null });
    expect(firstLookInWords({ models: "x" })).toEqual({ rows: [], more: null });
  });
});

describe("firstLookRowFromAnswerRobot", () => {
  const base = { name: "UR10e", manufacturer: "Universal Robots" };
  const check = (key: "reach" | "payload" | "cycle_time", outcome: "pass" | "fail" | "unknown") =>
    ({ key, outcome, text: "", estimated: false, basis: null });
  it("maps today's verdicts onto the published codes", () => {
    expect(firstLookRowInWords(firstLookRowFromAnswerRobot({ ...base, verdict: "fits", checks: [] })).text).toBe("Fits.");
    expect(firstLookRowInWords(firstLookRowFromAnswerRobot({ ...base, verdict: "fits_on_paper", checks: [] })).text).toBe("Fits.");
    expect(firstLookRowInWords(firstLookRowFromAnswerRobot({ ...base, verdict: "ruled_out",
      checks: [check("reach", "fail"), check("payload", "pass")] })).text).toBe("Does not fit: it cannot reach both spots.");
    expect(firstLookRowInWords(firstLookRowFromAnswerRobot({ ...base, verdict: "possible",
      checks: [check("payload", "unknown")] })).text).toBe("Not rated yet.");
  });
});
