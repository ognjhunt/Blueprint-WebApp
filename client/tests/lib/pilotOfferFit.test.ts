import { describe, expect, it } from "vitest";
import { pilotJobTypeOf, pilotOfferFit, type PilotFitJob } from "@/lib/pilotOfferFit";
import {
  PILOT_OFFER_STATEMENT, US_STATE_NAMES, pilotTermsLines, pilotUnknownLine, sanitizePilotOfferBody, sanitizeSitePilotOffers,
  sitePaysLine, usStateCodeOf, type PilotOfferBody,
} from "@/lib/pilotOffers";
import { US_STATES } from "../../../server/utils/typedPlaceState";
import { priceFindings } from "../../../scripts/qa/price-statements";

const OFFER: PilotOfferBody = {
  kinds: ["pick_and_place", "palletizing"],
  limits: { maxKg: 25, maxSide: "30_60cm", minHours: "two_shifts", states: ["TX", "OK"] },
  terms: { weeks: 6, sitePays: { kind: "nothing" }, siteProvides: ["floor_space", "power"], earliestStart: "within_month", afterPilot: "per_task" },
};
const facts = (answers: Record<string, string>) => ({ ...answers, updatedAtIso: "2026-11-28T00:00:00.000Z" }) as never;
const JOB: PilotFitJob = { kind: "pick_and_place", taskFamily: "Material handling",
  facts: facts({ weight: "5_15kg", size: "under_30cm", hours: "two_shifts" }), usState: "TX" };
const fit = (job: Partial<PilotFitJob>, offer: PilotOfferBody = OFFER) => pilotOfferFit(offer, { ...JOB, ...job });

describe("whether a job fits a pilot offer on paper", () => {
  it("fits a job whose stated answers all fit, with nothing left open", () => {
    expect(fit({})).toEqual({ fits: true, unknown: [], why: null });
  });

  it.each([
    ["job_type", { kind: "transport" as const, taskFamily: "Other" }],
    ["weight", { facts: facts({ weight: "over_30kg", size: "under_30cm", hours: "two_shifts" }) }],
    ["weight", { facts: facts({ maxLoadedWeightKg: "40", size: "under_30cm", hours: "two_shifts" }) }],
    ["size", { facts: facts({ weight: "under_5kg", size: "over_60cm", hours: "two_shifts" }) }],
    ["hours", { facts: facts({ weight: "under_5kg", size: "under_30cm", hours: "one_shift" }) }],
    ["region", { usState: "CA" }],
  ] as const)("rules an offer out on a stated %s that cannot fit", (why, job) => {
    expect(fit(job)).toMatchObject({ fits: false, why });
  });

  it.each([
    ["weight", { weight: "unsure", size: "under_30cm", hours: "two_shifts" }],
    ["weight", { size: "under_30cm", hours: "two_shifts" }],
    ["size", { weight: "under_5kg", size: "unsure", hours: "two_shifts" }],
    ["size", { weight: "under_5kg", hours: "two_shifts" }],
    ["hours", { weight: "under_5kg", size: "under_30cm", hours: "unsure" }],
    ["hours", { weight: "under_5kg", size: "under_30cm" }],
  ] as const)("never rules an offer out on %s answered Not sure or not at all: it is shown, flagged", (fact, answers) => {
    expect(fit({ facts: facts(answers) })).toEqual({ fits: true, unknown: [fact], why: null });
  });

  it("keeps a job with no state on record, or no kind yet, and flags it", () => {
    expect(fit({ usState: null })).toEqual({ fits: true, unknown: ["region"], why: null });
    expect(fit({ kind: null, taskFamily: "Quality inspection" })).toEqual({ fits: true, unknown: ["job_type"], why: null });
    expect(fit({ usState: null }, { ...OFFER, limits: { ...OFFER.limits, states: "all_us" } }).unknown).toEqual(["region"]);
  });

  it("flags a weight range only partly under the limit, and rules out only when even its lower end is over", () => {
    expect(fit({ facts: facts({ weight: "15_30kg", size: "under_30cm", hours: "two_shifts" }) }))
      .toEqual({ fits: true, unknown: ["weight"], why: null, weightPartly: true });
    expect(fit({ facts: facts({ weight: "15_30kg", size: "under_30cm", hours: "two_shifts" }) },
      { ...OFFER, limits: { ...OFFER.limits, maxKg: 10 } })).toMatchObject({ fits: false, why: "weight" });
    // A typed heaviest item decides by itself, in kg, whatever unit the site typed it in.
    expect(fit({ facts: facts({ maxLoadedWeightKg: "44lb", size: "under_30cm", hours: "two_shifts" }) }).fits).toBe(true);
    expect(fit({ facts: facts({ maxLoadedWeightKg: "60lb", size: "under_30cm", hours: "two_shifts" }) }).why).toBe("weight");
  });

  it("checks nothing an offer leaves open", () => {
    const open = { ...OFFER, limits: { maxKg: null, maxSide: null, minHours: null, states: "all_us" as const } };
    expect(fit({ facts: null }, open)).toEqual({ fits: true, unknown: [], why: null });
  });

  it("never reads an estimate from the video for a limit: only what the site said", () => {
    // Estimates live elsewhere on the record; a job's facts carrying anything else are not read.
    const withEstimates = { ...JOB, facts: facts({ size: "under_30cm", hours: "two_shifts" }),
      estimates: { object_mass_kg_low: 90, object_mass_kg_high: 120, object_largest_side_m: 2 } } as unknown as PilotFitJob;
    expect(pilotOfferFit(OFFER, withEstimates)).toEqual({ fits: true, unknown: ["weight"], why: null });
  });

  it("lets Unloading and Cleaning win over the reading's kind, as the visit list does", () => {
    expect(pilotJobTypeOf("palletizing", "Unloading")).toBe("unloading");
    expect(pilotJobTypeOf("pick_and_place", "Cleaning")).toBe("cleaning");
    expect(pilotJobTypeOf("transport", "Material handling")).toBe("transport");
    expect(pilotJobTypeOf(null, "Palletizing")).toBe("palletizing");
    expect(fit({ kind: "palletizing", taskFamily: "Unloading" })).toMatchObject({ fits: false, why: "job_type" });
  });
});

describe("the words of a pilot offer", () => {
  it("says each open fact plainly, with what the company takes", () => {
    expect(pilotUnknownLine("weight", OFFER)).toBe("You have not said how heavy the item is. This company takes up to 25 kg.");
    expect(pilotUnknownLine("region", OFFER)).toBe("Your job's state is not on record. This company works in Texas and Oklahoma.");
    expect(pilotUnknownLine("weight", { ...OFFER, limits: { ...OFFER.limits, maxKg: null } })).toBeNull();
  });

  it("says the company's figure as its own and not a quote, with no price of Blueprint's", () => {
    expect(sitePaysLine({ kind: "nothing" })).toBe("Cost to you: free");
    expect(sitePaysLine({ kind: "once", low: 5000, high: 8000 }))
      .toBe("Cost to you: $5,000 to $8,000 in total (the company's own figure, not a quote)");
    expect(sitePaysLine({ kind: "monthly", low: 900, high: 900 })).toBe("Cost to you: $900 a month (the company's own figure, not a quote)");
    expect(pilotTermsLines(OFFER.terms)).toEqual(["Pilot: 6 weeks", "Cost to you: free", "You provide: Floor space and Power",
      "Earliest start: Within a month", "After a pilot that works: Per task or item"]);
    expect(priceFindings(PILOT_OFFER_STATEMENT)).toEqual([]);
  });

  it("keeps only a well-formed offer, and drops a figure a site could read as a phone number", () => {
    expect(sanitizePilotOfferBody(OFFER)).toEqual(OFFER);
    expect(sanitizePilotOfferBody({ ...OFFER, kinds: [] })).toBeNull();
    expect(sanitizePilotOfferBody({ ...OFFER, terms: { ...OFFER.terms, weeks: 27 } })).toBeNull();
    expect(sanitizePilotOfferBody({ ...OFFER, terms: { ...OFFER.terms, sitePays: { kind: "monthly", low: 4155550.19, high: 4155550.19 } } })).toBeNull();
    expect(sanitizePilotOfferBody({ ...OFFER, limits: { ...OFFER.limits, states: ["ZZ"] } })).toBeNull();
    expect(sanitizeSitePilotOffers({ offers: [{ offerRef: "not-a-ref", company: { name: "North" }, offer: OFFER, unknown: [] }] })?.offers)
      .toEqual([]);
  });

  it("names the same states as the server's list", () => {
    expect(US_STATE_NAMES).toEqual(US_STATES);
    expect(usStateCodeOf("Texas")).toBe("TX");
    expect(usStateCodeOf("tx")).toBe("TX");
    expect(usStateCodeOf("Ontario")).toBeNull();
  });
});
