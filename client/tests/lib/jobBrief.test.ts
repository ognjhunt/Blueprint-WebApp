import { describe, expect, it } from "vitest";
import {
  JOB_BRIEF_SCHEMA_VERSION, estimateFieldsMade, estimateInWords, jobBriefFitSummary, jobBriefQuestions, jobBriefShowable, jobBriefWords,
  jobBriefWordsRefused, quoteInSentence, sanitizeJobBriefRow, sanitizeJobBriefRows, sanitizeSiteJobBrief, sanitizeStoredJobBrief,
  siteJobBriefPayload,
  type JobBriefEstimates, type JobBriefRow, type StoredJobBrief,
} from "../../src/lib/jobBrief";
import { fitObjectRow } from "../../src/lib/companyJobPage";

const LAMP_SENTENCE = "Move the lamp from the round bedside table to the glass shelf on the wall.";
const LAMP_ESTIMATES: JobBriefEstimates = { largestSideM: 0.45, massKg: { low: 1, high: 3 }, surface: "shiny", pickToPlaceM: 1.6,
  pickHeightM: 0.6, placeHeightM: 1.5, frontClearanceM: null, cycleSeconds: null };
const DIGEST = "a".repeat(64);
const brief = (rows: JobBriefRow[]): StoredJobBrief => ({ schemaVersion: JOB_BRIEF_SCHEMA_VERSION, rows, generatedAtIso: "2026-11-25T10:00:00.000Z",
  inputDigest: DIGEST });

/** The lamp job's brief, as the model might answer it. */
const LAMP_ROWS: JobBriefRow[] = [
  { id: "lamp_size_weight", label: "Lamp size and weight", evidence: "video_estimate",
    estimate_fields: ["object_largest_side_m", "object_mass_kg_low", "object_mass_kg_high"] },
  { id: "table_to_shelf", label: "From table to shelf", evidence: "site_sentence", quote: "from the round bedside table to the glass shelf" },
  { id: "shelf_height", label: "Heights of table and shelf", evidence: "video_estimate", estimate_fields: ["pick_height_m", "place_height_m"] },
  { id: "how_often_moved", label: "How often it is moved", evidence: "ask_site", question: "How often is the lamp moved?",
    choices: ["Once a day", "A few times a day", "Once a week or less"] },
  { id: "hours", label: "Hours a day", evidence: "site_answer", answer_key: "hours" },
];

describe("a job brief's rows, checked by code", () => {
  const row = (fields: Record<string, unknown>) => ({ id: "lamp_size", label: "Lamp size", evidence: "site_answer", answer_key: "size", ...fields });

  it("keeps a well-formed row of each kind", () => {
    expect(sanitizeJobBriefRows(LAMP_ROWS, { sentence: LAMP_SENTENCE, estimates: new Set(estimateFieldsMade(LAMP_ESTIMATES)) }))
      .toEqual(LAMP_ROWS);
  });

  it("refuses ids that are not snake_case of at most 32 characters", () => {
    for (const id of ["LampSize", "lamp size", "lamp-size", "1lamp", "", "a".repeat(33), "_lamp", 12])
      expect(sanitizeJobBriefRow(row({ id })), String(id)).toBeNull();
    expect(sanitizeJobBriefRow(row({ id: "a".repeat(32) }))).not.toBeNull();
  });

  it("refuses a label over 40 characters, a label with a figure, and a label that is empty", () => {
    expect(sanitizeJobBriefRow(row({ label: "x".repeat(41) }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ label: "x".repeat(40) }))).not.toBeNull();
    // A label names a fact; a figure in it would be a value the model wrote.
    expect(sanitizeJobBriefRow(row({ label: "Lamp weighs 2 kg" }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ label: "   " }))).toBeNull();
    // Spaces and line breaks read as one space.
    expect(sanitizeJobBriefRow(row({ label: " Lamp\n size " }))?.label).toBe("Lamp size");
  });

  it("refuses a catalog key the catalog does not have, and an evidence kind it does not know", () => {
    expect(sanitizeJobBriefRow(row({ answer_key: "lampWeight" }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ answer_key: "constructor" }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ evidence: "model_value", value: "2 kg" }))).toBeNull();
    expect(sanitizeJobBriefRow({ id: "lamp", label: "Lamp" })).toBeNull();
  });

  it("keeps only the reading's own estimate fields, and only those it made when that is known", () => {
    const estimate = (fields: unknown) => row({ evidence: "video_estimate", estimate_fields: fields });
    expect(sanitizeJobBriefRow(estimate(["object_largest_side_m", "object_name", "basis"]))).toMatchObject({ estimate_fields: ["object_largest_side_m"] });
    expect(sanitizeJobBriefRow(estimate(["object", "basis", "other_items_likely"]))).toBeNull();
    expect(sanitizeJobBriefRow(estimate([]))).toBeNull();
    const made = new Set(estimateFieldsMade(LAMP_ESTIMATES));
    expect(sanitizeJobBriefRow(estimate(["front_clearance_m", "cycle_seconds"]), { estimates: made })).toBeNull();
    expect(sanitizeJobBriefRow(estimate(["front_clearance_m", "pick_height_m"]), { estimates: made })).toMatchObject({ estimate_fields: ["pick_height_m"] });
  });

  it("keeps a quote only when the site's sentence holds it, case and spacing aside", () => {
    const quote = (text: string) => row({ evidence: "site_sentence", quote: text });
    expect(sanitizeJobBriefRow(quote("to the glass shelf on the wall"), { sentence: LAMP_SENTENCE })).not.toBeNull();
    expect(sanitizeJobBriefRow(quote("To the  GLASS shelf"), { sentence: LAMP_SENTENCE })).not.toBeNull();
    // Reworded, or words the sentence never had.
    expect(sanitizeJobBriefRow(quote("to the glass shelf above the bed"), { sentence: LAMP_SENTENCE })).toBeNull();
    expect(sanitizeJobBriefRow(quote("the lamp weighs 2 kg"), { sentence: LAMP_SENTENCE })).toBeNull();
    expect(quoteInSentence("to", LAMP_SENTENCE)).toBe(false);
    expect(sanitizeJobBriefRow(quote("x".repeat(201)))).toBeNull();
  });

  it("asks the site two to four distinct short choices, with Not sure left to the code", () => {
    const ask = (question: string, choices: unknown[]) => row({ evidence: "ask_site", question, choices });
    expect(sanitizeJobBriefRow(ask("How often is the lamp moved?", ["Daily", "Weekly", "Not sure"])))
      .toMatchObject({ choices: ["Daily", "Weekly"] });
    expect(sanitizeJobBriefRow(ask("How often is the lamp moved?", ["Daily", "daily", "Not sure"]))).toBeNull();
    expect(sanitizeJobBriefRow(ask("How often is the lamp moved?", ["Daily"]))).toBeNull();
    expect(sanitizeJobBriefRow(ask("How often is the lamp moved?", ["A", "B", "C", "D", "E"]))).toBeNull();
    expect(sanitizeJobBriefRow(ask("How often is the lamp moved?", ["Daily", "x".repeat(41)]))).toBeNull();
    expect(sanitizeJobBriefRow(ask("x".repeat(121), ["Daily", "Weekly"]))).toBeNull();
    expect(sanitizeJobBriefRow(ask("How often is the lamp moved?", ["Daily", 7]))).toBeNull();
  });

  it("refuses money, the site's identity, contact details and robot makes in any of the model's words", () => {
    for (const words of ["What is your budget?", "How much would you pay per month?", "Cost per move", "Payback", "Under $500",
      "Is a lease an option?", "What is the site's name?", "Your street address", "Who should we contact?", "Email for updates",
      "Visit www.example.com", "Is a Fanuc arm fine?", "Universal Robots", "UR5e reach"]) expect(jobBriefWordsRefused(words), words).not.toBeNull();
    for (const words of ["How often is the lamp moved?", "Lamp size and weight", "Payload and reach", "Under 10 pounds",
      "How many people do this job on a shift?", "From table to shelf"]) expect(jobBriefWordsRefused(words), words).toBeNull();
    expect(sanitizeJobBriefRow(row({ label: "Monthly budget" }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ evidence: "ask_site", question: "What is your budget for this?", choices: ["Small", "Large"] }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ evidence: "ask_site", question: "Whom do we email?", choices: ["Dana", "Lee"] }))).toBeNull();
    expect(sanitizeJobBriefRow(row({ evidence: "ask_site", question: "Which arm do you use?", choices: ["A KUKA arm", "None"] }))).toBeNull();
    // A quote of the site's own words about money or a robot's make is left out too.
    expect(sanitizeJobBriefRow(row({ evidence: "site_sentence", quote: "within our budget" }), { sentence: "Stack boxes within our budget." })).toBeNull();
  });

  it("keeps at most six rows, the first of a repeated id and the first row for each catalog question", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `row_${index}`, label: `Row ${"abcdefghi"[index]}`, evidence: "ask_site",
      question: "How often?", choices: ["Daily", "Weekly"] }));
    expect(sanitizeJobBriefRows(many).map(item => item.id)).toEqual(["row_0", "row_1", "row_2", "row_3", "row_4", "row_5"]);
    expect(sanitizeJobBriefRows([row({}), row({ label: "Again" }), row({ id: "other", label: "Size again" }),
      row({ id: "hours", label: "Hours", answer_key: "hours" })]).map(item => [item.id, item.label]))
      .toEqual([["lamp_size", "Lamp size"], ["hours", "Hours"]]);
    expect(sanitizeJobBriefRows("rows")).toEqual([]);
  });

  it("reads a stored brief only in its own schema, with a digest, and checks its rows again", () => {
    const stored = { schemaVersion: JOB_BRIEF_SCHEMA_VERSION, inputDigest: DIGEST, generatedAtIso: "2026-11-25T10:00:00.000Z",
      rows: [...LAMP_ROWS, { id: "budget", label: "Budget", evidence: "site_answer", answer_key: "timing" }] };
    expect(sanitizeStoredJobBrief(stored)).toEqual(brief(LAMP_ROWS));
    expect(sanitizeStoredJobBrief({ ...stored, schemaVersion: "job_brief.v0" })).toBeNull();
    expect(sanitizeStoredJobBrief({ ...stored, inputDigest: "short" })).toBeNull();
    expect(sanitizeStoredJobBrief(null)).toBeNull();
  });
});

describe("a brief's values, written by code from the evidence", () => {
  it("says the estimates the row names in fixed words, only those the reading made", () => {
    expect(estimateInWords(["object_largest_side_m", "object_mass_kg_low", "object_mass_kg_high"], LAMP_ESTIMATES))
      .toBe("About 45 cm on its longest side, about 1 to 3 kg");
    expect(estimateInWords(["place_height_m", "pick_height_m"], LAMP_ESTIMATES))
      .toBe("Picked up about 60 cm above the floor, put down about 1.5 m above the floor");
    expect(estimateInWords(["object_mass_kg_high", "object_surface", "pick_to_place_m"], LAMP_ESTIMATES))
      .toBe("About 1 to 3 kg, shiny surface, moved about 1.6 m");
    expect(estimateInWords(["front_clearance_m", "cycle_seconds"], LAMP_ESTIMATES)).toBeNull();
    expect(estimateInWords(["object_largest_side_m"], null)).toBeNull();
    const floor = { ...LAMP_ESTIMATES, pickHeightM: 0, frontClearanceM: 0, cycleSeconds: 300, massKg: { low: 0.2, high: 0.2 } };
    expect(estimateInWords(["pick_height_m", "front_clearance_m", "cycle_seconds", "object_mass_kg_low"], floor))
      .toBe("About 200 g, picked up from the floor, no open floor in front, about 5 minutes a cycle");
  });

  const inputs = (overrides: Partial<Parameters<typeof jobBriefFitSummary>[1]> = {}) => ({ facts: null, estimates: LAMP_ESTIMATES,
    sentence: LAMP_SENTENCE, shown: () => true, ...overrides });

  it("shows the lamp job's own rows, each value from its evidence, and Not stated where the site gave none", () => {
    const rows = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ objectRow: fitObjectRow({ object: "bedside lamp", others: [] }) }))!;
    expect(rows.map(row => [row.label, row.value, row.state, row.source ?? null])).toEqual([
      ["Object", "bedside lamp", "from_video", null],
      ["Lamp size and weight", "About 45 cm on its longest side, about 1 to 3 kg", "from_video", "video_estimate"],
      ["From table to shelf", "from the round bedside table to the glass shelf", "stated", "site_sentence"],
      ["Heights of table and shelf", "Picked up about 60 cm above the floor, put down about 1.5 m above the floor", "from_video", "video_estimate"],
      ["How often it is moved", null, "not_stated", "site"],
      ["Hours a day", null, "not_stated", "site"],
    ]);
    // Every row has its own key.
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
    expect(rows.map(row => row.key)).toContain("brief:lamp_size_weight");
    expect(rows.map(row => row.key)).toContain("hours");
  });

  it("shows the site's answers: a catalog answer in the catalog's words, the choice it tapped, and Not sure", () => {
    const facts = { hours: "two_shifts", timing: "asap", weight: "unsure", custom: { how_often_moved: 1 }, updatedAtIso: "" };
    const rows = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ facts }))!;
    expect(rows.find(row => row.label === "How often it is moved")).toMatchObject({ value: "A few times a day", state: "stated" });
    expect(rows.find(row => row.label === "Hours a day")).toMatchObject({ value: "Two shifts", state: "stated" });
    // Another catalog question the site answered is kept after the brief's rows; "Not sure" there is not.
    expect(rows.at(-1)).toMatchObject({ key: "timing", label: "When", value: "As soon as possible", state: "stated" });
    expect(rows.some(row => row.key === "weight")).toBe(false);
    const unsure = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ facts: { custom: { how_often_moved: "unsure" }, updatedAtIso: "" } }))!;
    expect(unsure.find(row => row.label === "How often it is moved")).toMatchObject({ value: null, state: "unsure" });
  });

  it("writes no value without evidence: no estimate, a quote the sentence lost, an answer that is no choice", () => {
    const noEstimates = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ estimates: null }));
    // Two estimate rows dropped leave three rows: still a brief, with no figure in it.
    expect(noEstimates!.map(row => row.label)).toEqual(["From table to shelf", "How often it is moved", "Hours a day"]);
    const changed = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ sentence: "Move the lamp to the desk." }))!;
    expect(changed.some(row => row.source === "site_sentence")).toBe(false);
    const outOfRange = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ facts: { custom: { how_often_moved: 3 }, updatedAtIso: "" } }))!;
    expect(outOfRange.some(row => row.label === "How often it is moved")).toBe(false);
    for (const row of jobBriefFitSummary(brief(LAMP_ROWS), inputs())!) if (row.value) expect(row.value).not.toMatch(/Daily|weighs/);
  });

  it("shows only words the screening kept, leaving out the row whose label or value it did not", () => {
    const hidden = new Set(["From table to shelf", "A few times a day"]);
    const facts = { custom: { how_often_moved: 1 }, updatedAtIso: "" };
    const rows = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ facts, shown: text => !hidden.has(text) }))!;
    expect(rows.map(row => row.label)).toEqual(["Lamp size and weight", "Heights of table and shelf", "Hours a day"]);
    expect(jobBriefWords(brief(LAMP_ROWS))).toEqual(["Lamp size and weight", "From table to shelf",
      "from the round bedside table to the glass shelf", "Heights of table and shelf", "How often it is moved", "Once a day",
      "A few times a day", "Once a week or less", "Hours a day"]);
  });

  it("is not used when fewer than three of its rows can be shown", () => {
    expect(jobBriefFitSummary(brief(LAMP_ROWS), inputs({ shown: text => text === "Hours a day" || text === "Lamp size and weight" }))).toBeNull();
    expect(jobBriefFitSummary(brief(LAMP_ROWS.slice(0, 2)), inputs())).toBeNull();
    expect(jobBriefFitSummary(null, inputs())).toBeNull();
    expect(jobBriefShowable(brief(LAMP_ROWS), { estimates: LAMP_ESTIMATES, sentence: LAMP_SENTENCE })).toBe(true);
    expect(jobBriefShowable(brief([LAMP_ROWS[0], LAMP_ROWS[1], LAMP_ROWS[2]]), { estimates: null, sentence: "" })).toBe(false);
  });

  it("marks the estimate below a catalog question the site skipped, as the catalog's rows do", () => {
    const rows = jobBriefFitSummary(brief(LAMP_ROWS), inputs({ estimated: new Set(["hours"]) }))!;
    expect(rows.find(row => row.key === "hours")).toMatchObject({ state: "not_stated", estimateBelow: true });
  });
});

describe("the questions a brief asks the site", () => {
  it("asks the catalog questions it reads answers from and its own, in its order", () => {
    expect(jobBriefQuestions(brief(LAMP_ROWS))).toEqual([
      { kind: "custom", id: "how_often_moved", question: "How often is the lamp moved?", choices: ["Once a day", "A few times a day", "Once a week or less"] },
      { kind: "catalog", key: "hours" },
    ]);
  });
});

describe("the brief's questions as the site's page receives them", () => {
  it("keeps a short version and well-formed questions only", () => {
    const payload = siteJobBriefPayload(brief(LAMP_ROWS));
    expect(payload.version).toBe("a".repeat(16));
    expect(sanitizeSiteJobBrief(payload)).toEqual(payload);
    expect(sanitizeSiteJobBrief({ version: "a".repeat(16), questions: [{ kind: "catalog", key: "hours" }, { kind: "catalog", key: "hours" },
      { kind: "catalog", key: "lampWeight" }, { kind: "custom", id: "x", question: "What is your budget?", choices: ["Small", "Large"] },
      { kind: "custom", id: "often", question: "How often?", choices: ["Daily", "Weekly", "Not sure"] }, { kind: "other" }] }))
      .toEqual({ version: "a".repeat(16), questions: [{ kind: "catalog", key: "hours" },
        { kind: "custom", id: "often", question: "How often?", choices: ["Daily", "Weekly"] }] });
    expect(sanitizeSiteJobBrief({ version: "not hex!", questions: [] })).toBeNull();
    expect(sanitizeSiteJobBrief(null)).toBeNull();
  });
});
