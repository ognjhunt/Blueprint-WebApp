import { describe, expect, it } from "vitest";
import {
  JOB_FACT_CHOICES, JOB_FACT_KEYS, NOT_SURE_LABEL, isJobFactCode, jobFactKeysForType, jobFactQuestion, jobFactQuestionHint, jobFactsInWords,
  jobFactKeysFor, looksPlural, sanitizeJobFacts, sanitizeJobReading, weightLowerBoundKg, weightUpperBoundKg,
} from "@/lib/jobFacts";
import { outcomeThanksSentence } from "@/pages/JobOutcomeThanks";

describe("job facts code lists (PACKAGE_E E1)", () => {
  it("keeps the general questions and their codes, with Not sure for every question", () => {
    expect(jobFactKeysForType(undefined)).toEqual(["weight", "size", "perHour", "hours", "timing"]);
    const codes = Object.fromEntries(jobFactKeysForType(undefined).map(key => [key, JOB_FACT_CHOICES[key].map(choice => choice.code)]));
    expect(codes).toEqual({
      weight: ["under_5kg", "5_15kg", "15_30kg", "over_30kg", "unsure"],
      size: ["under_30cm", "30_60cm", "over_60cm", "unsure"],
      perHour: ["under_60", "60_300", "over_300", "unsure"],
      hours: ["one_shift", "two_shifts", "around_the_clock", "unsure"],
      timing: ["asap", "3_months", "this_year", "just_looking", "unsure"],
    });
    for (const key of JOB_FACT_KEYS) expect(JOB_FACT_CHOICES[key].at(-1)?.label).toBe(NOT_SURE_LABEL);
  });

  it("asks distinct questions by job type and shares only relevant answers plus existing general facts", () => {
    expect(jobFactKeysForType("Palletizing").slice(0, 3)).toEqual(["maxLoadedWeightKg", "peakPerMinute", "palletPattern"]);
    expect(jobFactKeysForType("Machine tending")[0]).toBe("machineAccess");
    expect(jobFactKeysForType("Quality inspection")).not.toContain("weight");
    expect(jobFactKeysForType("constructor")).toEqual(jobFactKeysForType(undefined));
    expect(jobFactsInWords({ peakPerMinute: "26.5", palletPattern: "varies", weight: "5_15kg" }, "Quality inspection")).toEqual([
      "Peak incoming rate: 26.5 items/min", "Weight: 5 to 15 kg (11 to 33 lb)",
    ]);
  });

  it("accepts bounded measurements and prioritizes the heaviest loaded item in the first look", () => {
    expect(isJobFactCode("maxLoadedWeightKg", "7.938")).toBe(true);
    expect(isJobFactCode("peakPerMinute", "1e4")).toBe(false);
    expect(isJobFactCode("itemsPerCase", "1.5")).toBe(false);
    expect(isJobFactCode("machineCycleSeconds", "15 kg")).toBe(false);
    expect(weightUpperBoundKg({ weight: "5_15kg", maxLoadedWeightKg: "11.25" })).toBe(11.25);
  });

  // Owner, 2026-11-23: more descriptive than "the item".
  it("names the video reading's object in the weight and size questions, and asks for the heaviest without one", () => {
    expect(jobFactQuestion("weight")).toBe("How heavy is the heaviest thing the robot handles?");
    expect(jobFactQuestion("weight", { kind: null, object: "cake batter", others: [] })).toBe("How heavy is the cake batter?");
    expect(jobFactQuestion("size", { kind: null, object: "cake batter", others: [] })).toBe("How big is the cake batter, on its longest side?");
    expect(jobFactQuestion("size", { kind: null, object: "cardboard boxes", others: [] })).toBe("How big are the cardboard boxes, on their longest side?");
    expect(jobFactQuestion("perHour", { kind: null, object: "cake batter", others: [] })).toBe("How many times an hour is the job done?");
    expect(jobFactQuestionHint("weight", { kind: null, object: "cardboard boxes", others: [] })).toBe("If they vary, answer for the heaviest.");
    expect(jobFactQuestionHint("size", { kind: null, object: "tote", others: ["bin"] })).toBe("Your video suggests the job may also handle bin. Answer for the biggest.");
    expect(jobFactQuestionHint("weight", { kind: null, object: "tote", others: [] })).toBeNull();
    expect(jobFactQuestionHint("hours", { kind: null, object: "totes", others: ["bins"] })).toBeNull();
    expect(jobFactsInWords({ perHour: "60_300" })).toEqual(["Times an hour: 60 to 300"]);
  });

  it("reads plural names as plural, and words ending in s that are not plural as singular", () => {
    expect(["boxes", "cardboard boxes", "dishes", "people", "parts"].map(looksPlural)).toEqual([true, true, true, true, true]);
    expect(["glass", "chassis", "cake batter", "bus", "electronics"].map(looksPlural)).toEqual([false, false, false, false, false]);
  });

  it("keeps only a known kind, a short name and short other names from the status read", () => {
    expect(sanitizeJobReading({ kind: "transport", object: " tote ", others: ["bin", 3, "x".repeat(61)], extra: true }))
      .toEqual({ kind: "transport", object: "tote", others: ["bin"] });
    expect(sanitizeJobReading({ kind: "teleport", object: "tote" })).toEqual({ kind: null, object: "tote", others: [] });
    expect(sanitizeJobReading({ kind: "other", object: "" })).toEqual({ kind: "other", object: null, others: [] });
    expect(sanitizeJobReading({ kind: "teleport", object: "x".repeat(61) })).toBeNull();
    expect(sanitizeJobReading("tote")).toBeNull();
    expect(sanitizeJobReading(null)).toBeNull();
  });

  // Owner, 2026-11-23: once the video reading gives a kind of job, the kind chooses the questions.
  it("chooses the questions from the reading's kind of job, and from the keyword match only until then", () => {
    const reading = (kind: string | null, object: string | null = "tote") => ({ kind, object }) as never;
    // No reading yet: the keyword match.
    expect(jobFactKeysFor("Case packing", null)).toEqual(jobFactKeysForType("Case packing"));
    expect(jobFactKeysFor(undefined, reading(null))).toEqual(["weight", "size", "perHour", "hours", "timing"]);
    // Scraping batter: no weight or size, whatever the keyword match said.
    expect(jobFactKeysFor("Other", reading("other", "cake batter"))).toEqual(["variation", "areaChange", "perHour", "hours", "timing"]);
    expect(jobFactKeysFor("Material handling", reading("other"))).toEqual(["variation", "areaChange", "perHour", "hours", "timing"]);
    // Moving between places: where it goes and what is on the way; no weight when nothing is carried.
    expect(jobFactKeysFor("Material handling", reading("transport"))).toEqual(["route", "routeObstacles", "weight", "perHour", "hours", "timing"]);
    expect(jobFactKeysFor(undefined, reading("transport", null))).toEqual(["route", "routeObstacles", "perHour", "hours", "timing"]);
    // A keyword type of the same kind keeps its narrower questions; a disagreeing one gives way to the reading.
    expect(jobFactKeysFor("Case packing", reading("pick_and_place"))).toEqual(jobFactKeysForType("Case packing"));
    expect(jobFactKeysFor("Depalletizing", reading("palletizing"))).toEqual(jobFactKeysForType("Depalletizing"));
    expect(jobFactKeysFor("Case packing", reading("palletizing"))).toEqual(jobFactKeysForType("Palletizing"));
    expect(jobFactKeysFor("Quality inspection", reading("other"))).toEqual(jobFactKeysForType("Quality inspection"));
    expect(jobFactKeysFor("Other", reading("machine_tending"))).toEqual(jobFactKeysForType("Machine tending"));
  });

  it("names the object in the same-every-time question, and says a company only the job's own answers", () => {
    expect(jobFactQuestion("variation")).toBe("Is the work the same every time?");
    expect(jobFactQuestion("variation", { object: "cake batter" })).toBe("Is the cake batter the same every time?");
    expect(jobFactQuestion("variation", { object: "towels" })).toBe("Are the towels the same every time?");
    const facts = { route: "floors", routeObstacles: "lifts", variation: "varies", weight: "under_5kg" };
    expect(jobFactsInWords(facts, "Material handling", { kind: "transport", object: "linen cart" }))
      .toEqual(["Where it goes: Between floors", "On the way: Lifts or elevators", "Weight: Under 5 kg (11 lb)"]);
    expect(jobFactsInWords(facts, "Other", { kind: "other", object: null }))
      .toEqual(["How much it varies: Different each time", "Weight: Under 5 kg (11 lb)"]);
  });

  it("labels show both units", () => {
    expect(JOB_FACT_CHOICES.weight[1].label).toBe("5 to 15 kg (11 to 33 lb)");
    expect(JOB_FACT_CHOICES.size[1].label).toBe("30 to 60 cm (1 to 2 ft)");
  });

  it("gives the weight range's bounds in kg", () => {
    const at = (weight: string) => ({ weight, updatedAtIso: "" }) as never;
    expect([weightUpperBoundKg(at("under_5kg")), weightUpperBoundKg(at("5_15kg")), weightUpperBoundKg(at("15_30kg"))]).toEqual([5, 15, 30]);
    expect(weightUpperBoundKg(at("over_30kg"))).toBeNull();
    expect(weightUpperBoundKg(at("unsure"))).toBeNull();
    expect(weightUpperBoundKg(at("bogus"))).toBeNull();
    expect(weightUpperBoundKg(null)).toBeNull();
    expect(weightLowerBoundKg(at("15_30kg"))).toBe(15);
  });

  it("drops anything that is not a known code", () => {
    expect(sanitizeJobFacts({ weight: "5_15kg", size: "huge", note: "free text", updatedAtIso: "2026-11-12T00:00:00.000Z" }))
      .toEqual({ weight: "5_15kg", updatedAtIso: "2026-11-12T00:00:00.000Z" });
    expect(sanitizeJobFacts({ size: "huge" })).toBeNull();
    expect(sanitizeJobFacts("x")).toBeNull();
    expect(sanitizeJobFacts([])).toBeNull();
  });

  it("words the answers the same way for both pages", () => {
    expect(jobFactsInWords({ timing: "asap", weight: "under_5kg", hours: "unsure", updatedAtIso: "x" })).toEqual([
      "Weight: Under 5 kg (11 lb)", "Hours a day: Not sure", "When: As soon as possible"]);
    expect(jobFactsInWords(null)).toEqual([]);
    expect(jobFactsInWords({ weight: "<script>" })).toEqual([]);
  });
});

describe("outcome thank-you page", () => {
  it("says the recorded answer, and nothing for an unknown one", () => {
    expect(outcomeThanksSentence("?answer=quote_given")).toBe("Thanks. We've recorded: Quote given.");
    expect(outcomeThanksSentence("?answer=not_going_ahead")).toBe("Thanks. We've recorded: Not going ahead.");
    expect(outcomeThanksSentence("?answer=<b>hi</b>")).toBe("Thanks.");
    expect(outcomeThanksSentence("")).toBe("Thanks.");
  });
});

// Review S3: after a final answer, a later link records nothing and its page says what is on record.
describe("the outcome page after a final answer", () => {
  it("says the introduction is already recorded as that answer", async () => {
    const { outcomeThanksSentence } = await import("@/pages/JobOutcomeThanks");
    expect(outcomeThanksSentence("?already=installed")).toBe("This introduction is already recorded as Installed. Nothing more is needed.");
    expect(outcomeThanksSentence("?already=not_going_ahead")).toBe("This introduction is already recorded as Not going ahead. Nothing more is needed.");
    expect(outcomeThanksSentence("?already=nonsense")).toBe("Thanks.");
  });
});
