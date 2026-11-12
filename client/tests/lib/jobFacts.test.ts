import { describe, expect, it } from "vitest";
import {
  JOB_FACT_CHOICES, JOB_FACT_KEYS, NOT_SURE_LABEL, jobFactsInWords, sanitizeJobFacts, weightLowerBoundKg, weightUpperBoundKg,
} from "@/lib/jobFacts";
import { outcomeThanksSentence } from "@/pages/JobOutcomeThanks";

describe("job facts code lists (PACKAGE_E E1)", () => {
  it("has exactly the five questions and their codes, each with Not sure", () => {
    expect(JOB_FACT_KEYS).toEqual(["weight", "size", "perHour", "hours", "timing"]);
    const codes = Object.fromEntries(JOB_FACT_KEYS.map(key => [key, JOB_FACT_CHOICES[key].map(choice => choice.code)]));
    expect(codes).toEqual({
      weight: ["under_5kg", "5_15kg", "15_30kg", "over_30kg", "unsure"],
      size: ["under_30cm", "30_60cm", "over_60cm", "unsure"],
      perHour: ["under_60", "60_300", "over_300", "unsure"],
      hours: ["one_shift", "two_shifts", "around_the_clock", "unsure"],
      timing: ["asap", "3_months", "this_year", "just_looking", "unsure"],
    });
    for (const key of JOB_FACT_KEYS) expect(JOB_FACT_CHOICES[key].at(-1)?.label).toBe(NOT_SURE_LABEL);
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
