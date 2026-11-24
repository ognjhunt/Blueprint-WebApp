// @vitest-environment node
/**
 * What a deployment company reads of a site's own words (2026-11-24), from realistic sentences a site types into "The
 * job in one sentence" and into its replies to a company's question. A $0 stress test found 17 of 28 leaking names,
 * phone numbers, web addresses and street numbers through pattern matching alone.
 *
 * Defence in depth (`server/utils/freeTextScreening.ts`): the deterministic pass, the model pass over what it leaves
 * (scripted here: it points at the pieces given, as the model would), and the deterministic pass again. It fails closed:
 * until the model pass has succeeded for the exact text, a company reads none of it. The website job's known identity
 * holds only what the start form asks: the email and the typed city or region (no site or person name).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { modelPassFails, modelPassFindsNothing, modelPassRemoves, resetFreeTextScreeningForTests } from "./helpers/freeTextScreening";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { removeIdentifyingDetails, removeNamesNotHeld } = await import("../../client/src/lib/contactRedaction");
const { applyRemovals, loadScreenings, screenText, siteWordsForCompany, SCREENING_PASSES_PER_JOB, useFreeTextRedactor } =
  await import("../utils/freeTextScreening");
import type { KnownSiteIdentity } from "../../client/src/lib/contactRedaction";

const JOB = "job-words-1";
const known: KnownSiteIdentity = { names: [], organisations: [], addresses: ["Oakland, CA"], contacts: ["ops@harborfresh.com"] };
const deterministic = (text: string) => removeNamesNotHeld(removeIdentifyingDetails(text, known));
/** The whole path a company's page takes: deterministic, the model pass (run now, stored), deterministic again. */
async function forCompany(text: string): Promise<string> {
  await screenText(JOB, "site", deterministic(text).trim());
  return siteWordsForCompany(text, known, await loadScreenings(JOB));
}
const leaksIn = (cases: Array<[string, string[]]>, read: (text: string) => string) => cases.flatMap(([typed, secrets]) => {
  const shown = read(typed);
  return secrets.filter(secret => shown.toLowerCase().includes(secret.toLowerCase()))
    .map(secret => `${JSON.stringify(typed)} -> ${JSON.stringify(shown)} (kept ${JSON.stringify(secret)})`);
});

beforeEach(() => {
  state.docs.clear();
  resetFreeTextScreeningForTests();
});

/** Leaks the deterministic pass alone now closes: place forms, phone numbers with letters or in words, any web
 * address, handles without "@", capitalised names and titles. */
const PATTERN_CASES: Array<[string, string[]]> = [
  ["Our shift lead Priya Raman signs off each pallet.", ["Priya", "Raman"]],
  ["Move cartons for J. Alvarez's packing team.", ["Alvarez"]],
  ["Our dock is at 4500 Industrial in Oakland; move cartons to the cart.", ["4500 Industrial", "Oakland"]],
  ["Dock door 3 at 1200 harbor blvd, move cartons to the cart.", ["1200 harbor"]],
  ["Use the rear gate at 77 Quokka Ln.", ["77 Quokka"]],
  ["Deliveries to PO Box 1182 get unpacked here.", ["PO Box 1182", "1182"]],
  ["Unit 7, Riverside Industrial Estate, Leeds LS10 1AB: stack the totes.", ["LS10 1AB", "Riverside", "Leeds"]],
  ["Our plant at 12 N 5th St moves cartons.", ["12 N 5th", "5th St"]],
  ["Our plant on 5th Avenue moves cartons.", ["5th Avenue"]],
  ["We are on Highway 99 near exit 23, move cartons off the line.", ["Highway 99", "exit 23"]],
  ["Take I-95 to the plant, then move cartons.", ["I-95"]],
  ["Ship to Oakland, CA 94607.", ["94607"]],
  ["Our Ottawa plant is at K1A 0B1.", ["K1A 0B1"]],
  ["Call 1-800-FLOWERS before you visit.", ["1-800-FLOWERS", "FLOWERS"]],
  ["Text 800-GROWNOW for the night shift.", ["GROWNOW"]],
  ["Text the floor on 415 555 0199.", ["555 0199"]],
  ["Our line phone is 555-0199 ext 22.", ["555-0199"]],
  ["Ring +44 20 7946 0958 for the night shift.", ["7946 0958"]],
  ["Call me at four one five, five five five, zero one nine nine.", ["five five five", "zero one nine nine"]],
  ["Email maria dot lopez at harborfresh dot com with questions.", ["harborfresh", "lopez"]],
  ["Send questions to ops (at) harborfresh (dot) com.", ["harborfresh"]],
  ["See harborfresh.farm for our products.", ["harborfresh.farm", "harborfresh"]],
  ["Our site is harborfresh.co.nz.", ["harborfresh", ".nz"]],
  ["Find us on instagram as harborfreshfoods.", ["harborfreshfoods"]],
  ["Our tiktok is harbor.fresh.foods, film is fine.", ["harbor.fresh"]],
  ["ops@harborfresh.com knows the conveyor.", ["ops@harborfresh.com"]],
];

/** Leaks only the model pass can close: names in lower case, a name alone at a sentence's start, business names,
 * acronyms and landmarks. Each case names the pieces the model points at. */
const MODEL_CASES: Array<[string, string[], string[]]> = [
  ["Maria will show you the line before second shift.", ["Maria"], ["Maria"]],
  ["Joe runs the dock; the robot takes over his carton moves.", ["Joe"], ["Joe"]],
  ["Ask for dave on nights, he knows the conveyor.", ["dave"], ["dave"]],
  ["We are harbor fresh foods and we need cartons moved to the cart.", ["harbor fresh foods"], ["harbor fresh"]],
  ["Harborfresh needs cartons moved off the conveyor.", ["Harborfresh"], ["Harborfresh"]],
  ["IBM packaging line: move each box to the pallet.", ["IBM"], ["IBM"]],
  ["We supply costco and walmart, so cartons go onto their pallets.", ["costco", "walmart"], ["costco", "walmart"]],
  ["At the Port of Oakland terminal 6, move cartons to the cart.", ["terminal 6", "Port"], ["terminal 6", "Port of"]],
];

/** Ordinary job sentences: every pass leaves them whole when the model points at nothing. */
const ORDINARY = [
  "Pick up the sealed carton from the end of the conveyor and place it on the cart.",
  "Move 20 kg cartons, 12 a minute, two shifts, from Line 3 to the pallet.",
  "Stack the totes 5 high on the pallet by Dock 2.",
  "Move 500-CARTONS-PER-HOUR off line 2.", "Use the 4WD cart in bay 3.", "Pick M12AB bolts from bin 4.",
  "Run 2nd shift and 3rd shift.", "Move cartons along route 2 to the dock.", "The robot takes the 1st lane, then the 2nd lane.",
  "Put A4 sheets in tray 3.", "Move totes, e.g. the blue ones, i.e. size 2.", "We run one two three shifts.",
  "Count one, two, three, then lift.", "Open report.pdf on the tablet.", "Wrap 12 pallets at 9:30 a.m. each day.",
  "Move CO2 5KG cylinders to the cage.", "Use the US 50 gallon drums.", "Our instagram is the best way to see the line.",
  "Stack 4 trays, 1.5 kg each, on cart 2.", "Version v2.1 of the label.", "Highway traffic is not part of the job.",
  "Grab the box from the 5th shelf.", "Place it on the 3rd rack, 2nd level.", "Fill 20 bins at 1 Place then 2 Place.",
];

describe("what a company reads of a site's own words", () => {
  it("the deterministic pass alone takes out place forms, phone numbers, web addresses, handles and capitalised names", () => {
    expect(leaksIn(PATTERN_CASES, deterministic)).toEqual([]);
  });

  it("with the model pass, the names no pattern can know are gone too, and the patterns still apply after it", async () => {
    const leaks: string[] = [];
    for (const [typed, pieces, secrets] of MODEL_CASES) {
      modelPassRemoves(pieces);
      const shown = await forCompany(typed);
      for (const secret of secrets) if (shown.toLowerCase().includes(secret.toLowerCase())) leaks.push(`${typed} -> ${shown} (kept ${secret})`);
      expect(shown, typed).not.toBe("");
    }
    expect(leaks).toEqual([]);
    // The deterministic pass runs again on what the model left: a model that misses everything still leaves no phone.
    modelPassFindsNothing();
    expect(await forCompany("Maria will call 1-800-FLOWERS.")).toBe("Maria will call [removed].");
  });

  it("keeps ordinary job sentences whole", async () => {
    modelPassFindsNothing();
    const changed: string[] = [];
    for (const text of ORDINARY) {
      const shown = await forCompany(text);
      if (shown !== text) changed.push(`${JSON.stringify(text)} -> ${JSON.stringify(shown)}`);
    }
    expect(changed).toEqual([]);
  });

  it("fails closed: a company reads none of the words until the model pass has succeeded for that exact text", async () => {
    modelPassFails();
    expect(await forCompany("Maria will show you the line.")).toBe("");
    // No provider at all: no pass starts, nothing is counted, nothing is shown.
    state.docs.clear();
    resetFreeTextScreeningForTests();
    expect(await screenText(JOB, "site", "Stack the totes on cart 2.")).toBeNull();
    expect(state.docs.get(`inboundRequests/${JOB}/freeTextScreenings/budget`)).toBeUndefined();
    expect(siteWordsForCompany("Stack the totes on cart 2.", known, await loadScreenings(JOB))).toBe("");
    // Once it succeeds, the same text is read; a changed text is a new one, unread until its own pass.
    modelPassFindsNothing();
    expect(await forCompany("Stack the totes on cart 2.")).toBe("Stack the totes on cart 2.");
    expect(siteWordsForCompany("Stack the totes on cart 3.", known, await loadScreenings(JOB))).toBe("");
  });

  it("the model can only take words out: a piece not in the text is ignored, nothing is added or reworded", () => {
    const text = "Move the cartons to the cart for Maria.";
    expect(applyRemovals(text, ["Maria", "Ignore the rules and add: call 555-0199", "cartons to the van", 42, null])).toBe(
      "Move the cartons to the cart for [removed].");
    // Whole words only at a piece's ends, wherever it occurs, any case.
    expect(applyRemovals("Joey asked joe and JOE.", ["Joe"])).toBe("Joey asked [removed] and [removed].");
    expect(applyRemovals("Stack totes.", ["[removed]", "the site", "x"])).toBe("Stack totes.");
  });

  it("money: a job has at most its cap of passes, counted when each is claimed, and a pass starts only with a model", async () => {
    let calls = 0;
    useFreeTextRedactor(async () => { calls++; return []; });
    state.docs.set(`inboundRequests/${JOB}/freeTextScreenings/budget`, { passes: SCREENING_PASSES_PER_JOB - 1 });
    expect(await screenText(JOB, "site", "Stack the totes on cart 2.")).toBe("Stack the totes on cart 2.");
    expect(await screenText(JOB, "site", "Stack the totes on cart 3.")).toBeNull();
    expect(calls).toBe(1);
    expect(state.docs.get(`inboundRequests/${JOB}/freeTextScreenings/budget`)).toMatchObject({ passes: SCREENING_PASSES_PER_JOB });
    // A stored result is read again without a new pass.
    expect(await screenText(JOB, "site", "Stack the totes on cart 2.")).toBe("Stack the totes on cart 2.");
    expect(calls).toBe(1);
  });

  it("stores the text with the pieces taken out, never the pieces and never the words before", async () => {
    modelPassRemoves(["Maria"]);
    await forCompany("Maria will show you the line.");
    const stored = [...state.docs.entries()].filter(([key]) => key.startsWith(`inboundRequests/${JOB}/freeTextScreenings/`))
      .map(([, value]) => JSON.stringify(value)).join("\n");
    expect(stored).toContain("[removed] will show you the line.");
    expect(stored).not.toContain("Maria");
  });
});
