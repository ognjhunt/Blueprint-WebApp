import { describe, expect, it } from "vitest";
import { VISIT_MUST_CONFIRM, answerSpeedInWords, fitRowMarks, fitRowValue, fitRowsShown, fitSummary, jobHeadline, jobSummaryFileName,
  publicJobKind, rateInWords, sharedOnInWords, simulationDownloadLabel, visitMustConfirm, type FitSummaryRow } from "@/lib/companyJobPage";
import { READER_JOB_KINDS } from "@/lib/jobFacts";

/**
 * What the company's page for one job leads with (owner, 2026-11-23): a title from the job's facts, the facts as fixed
 * fields with "Not stated" where the site skipped one, and what a first visit must confirm for this kind of job.
 */
const headline = (kind: Parameters<typeof jobHeadline>[0]["kind"], object: string | null, extra: Partial<Parameters<typeof jobHeadline>[0]> = {}) =>
  jobHeadline({ kind, object, actions: [], taskFamily: "Other", fallback: "Automation job", ...extra });

describe("the job's title", () => {
  it("says what is done to what, from the video reading", () => {
    expect(headline("other", "cake batter", { actions: ["scraping", "scooping"] })).toBe("Scrape and scoop cake batter");
    expect(headline("palletizing", "cartons")).toBe("Stack cartons on pallets");
    expect(headline("palletizing", "cartons", { taskFamily: "Depalletizing" })).toBe("Take cartons off pallets");
    expect(headline("machine_tending", "metal blanks")).toBe("Load and unload metal blanks at a machine");
    expect(headline("transport", "linen carts")).toBe("Carry linen carts between places");
    expect(headline("transport", null)).toBe("Go between places");
    expect(headline("pick_and_place", "jars")).toBe("Pick and place jars");
    expect(headline("pick_and_place", "jars", { taskFamily: "Case packing" })).toBe("Pack jars into cases");
  });

  it("keeps the category title until a reading names the job, and never makes up a task", () => {
    expect(headline(null, null)).toBe("Automation job");
    expect(headline(null, "towels", { fallback: "Move materials" })).toBe("Move materials: towels");
    expect(headline("pick_and_place", null, { fallback: "Move materials" })).toBe("Move materials");
    // An action outside the reader's closed list is not a verb.
    expect(headline("other", "towels", { actions: ["teleporting"] })).toBe("Automation job: towels");
  });
});

describe("the fit summary", () => {
  const reading = { kind: "pick_and_place" as const, object: "cartons", others: ["totes"] };

  it("lists each question the site was asked, saying which it skipped or was not sure of", () => {
    const rows = fitSummary({ weight: "5_15kg", hours: "unsure", updatedAtIso: "" }, "Other", reading, new Set(["perHour"]));
    expect(rows.map(row => [row.label, row.value, row.state, row.estimateBelow ?? false])).toEqual([
      ["Object", "cartons (the video suggests totes too)", "from_video", false],
      ["Weight", "5 to 15 kg (11 to 33 lb)", "stated", false],
      ["Size, longest side", null, "not_stated", false],
      ["Times an hour", null, "not_stated", true],
      ["Hours a day", null, "unsure", false],
      ["When", null, "not_stated", false],
    ]);
  });

  it("asks the same questions the site's page asked, and adds any other answer the site gave", () => {
    const rows = fitSummary({ route: "floors", weight: "under_5kg", updatedAtIso: "" }, "Other", { kind: "transport", object: null, others: [] });
    expect(rows.map(row => row.key)).toEqual(["route", "routeObstacles", "perHour", "hours", "timing", "weight"]);
  });

  it("says the rate and the hours in the title's meta only when the site gave them", () => {
    expect(rateInWords({ perHour: "60_300", hours: "two_shifts", updatedAtIso: "" })).toEqual(["60 to 300 times an hour", "Two shifts"]);
    expect(rateInWords({ perHour: "unsure", updatedAtIso: "" })).toEqual([]);
    expect(rateInWords(null)).toEqual([]);
  });
});

describe("At a glance as the page and the job summary show it", () => {
  const rows: FitSummaryRow[] = [
    { key: "object", label: "Object", value: "cartons", state: "from_video" },
    { key: "brief:weight", label: "Weight", value: "about 9 kg", state: "from_video", source: "video_estimate" },
    { key: "brief:what", label: "What", value: "“blue cartons”", state: "stated", source: "site_sentence" },
    { key: "perHour", label: "Times an hour", value: null, state: "not_stated", estimateBelow: true },
    { key: "hours", label: "Hours a day", value: null, state: "unsure" },
    { key: "size", label: "Size", value: null, state: "not_stated" },
  ];

  it("says each row's value and its marks, and names the skipped questions apart", () => {
    expect(rows.map(row => `${fitRowValue(row)}${fitRowMarks(row).join("")}`)).toEqual([
      "cartons (from the video)", "about 9 kg (estimated from the video)", "“blue cartons” (the site's words)",
      "Not stated · Blueprint's estimate is below", "Not sure", "Not stated"]);
    const { shown, skipped } = fitRowsShown(rows);
    expect(shown.map(row => row.label)).toEqual(["Object", "Weight", "What", "Times an hour", "Hours a day"]);
    expect(skipped.map(row => row.label)).toEqual(["Size"]);
  });
});

describe("the job page's downloads", () => {
  it("says the simulation's size in whole megabytes, under one megabyte as that, and nothing it does not know", () => {
    expect(simulationDownloadLabel(170_400_000)).toBe("Download the simulation (170 MB)");
    expect(simulationDownloadLabel(170_600_000)).toBe("Download the simulation (171 MB)");
    expect(simulationDownloadLabel(536_870_912)).toBe("Download the simulation (537 MB)");
    expect(simulationDownloadLabel(400_000)).toBe("Download the simulation (under 1 MB)");
    for (const unknown of [undefined, null, 0, Number.NaN]) expect(simulationDownloadLabel(unknown)).toBe("Download the simulation");
  });

  it("names the job summary by a short job reference, and says the day the job was shared", () => {
    expect(jobSummaryFileName("capture-6f0c2a1e-3b7d-4c55-9e21-8a4d0b6c1f99")).toBe("job-summary-6f0c2a1e.pdf");
    expect(sharedOnInWords("2026-11-12T10:00:00.000Z")).toBe("Shared November 12, 2026");
    expect(sharedOnInWords("")).toBe("");
    expect(sharedOnInWords("not a date")).toBe("");
  });
});

describe("what a visit must confirm", () => {
  it("gives every kind of job five to seven items, and a keyword job type the list of its kind", () => {
    for (const kind of READER_JOB_KINDS) expect(VISIT_MUST_CONFIRM[kind].length).toBeGreaterThanOrEqual(5);
    for (const kind of READER_JOB_KINDS) expect(VISIT_MUST_CONFIRM[kind].length).toBeLessThanOrEqual(7);
    expect(visitMustConfirm(null, "Depalletizing")).toBe(VISIT_MUST_CONFIRM.palletizing);
    expect(visitMustConfirm(null, "Machine tending")).toBe(VISIT_MUST_CONFIRM.machine_tending);
    expect(visitMustConfirm(null, "Other")).toBe(VISIT_MUST_CONFIRM.other);
    // The reading's kind wins over the keyword match.
    expect(visitMustConfirm("transport", "Palletizing")).toBe(VISIT_MUST_CONFIRM.transport);
  });
});

describe("a public live job's kind", () => {
  it("keeps a specific category the reading agrees with, and otherwise says the reading's kind in fixed words", () => {
    expect(publicJobKind({ taskFamily: "Palletizing", categoryTitle: "Palletize items", readerKind: "palletizing",
      categoryKinds: ["palletizing"] })).toEqual({ kind: "Palletize items", kindKey: "palletizing" });
    expect(publicJobKind({ taskFamily: "Other", categoryTitle: "Automation job", readerKind: "pick_and_place" }))
      .toEqual({ kind: "Pick and place job", kindKey: "pick_and_place" });
    expect(publicJobKind({ taskFamily: "Palletizing", categoryTitle: "Palletize items", readerKind: "transport",
      categoryKinds: ["palletizing"] })).toEqual({ kind: "Moving things between places", kindKey: "transport" });
    expect(publicJobKind({ taskFamily: "Machine tending", categoryTitle: "Load or unload a machine", readerKind: null }))
      .toEqual({ kind: "Load or unload a machine", kindKey: "machine_tending" });
    expect(publicJobKind({ taskFamily: "Other", categoryTitle: "Automation job", readerKind: null }))
      .toEqual({ kind: "Automation job", kindKey: "other" });
  });
});

describe("how quickly the site answers", () => {
  it("rounds up to the hour or the day, and says nothing without an answer", () => {
    expect(answerSpeedInWords(0.4)).toBe("Answers questions from companies here, usually within an hour.");
    expect(answerSpeedInWords(2.2)).toBe("Answers questions from companies here, usually within 3 hours.");
    expect(answerSpeedInWords(30)).toBe("Answers questions from companies here, usually within 2 days.");
    expect(answerSpeedInWords(24)).toBe("Answers questions from companies here, usually within a day.");
    expect(answerSpeedInWords(null)).toBeNull();
    expect(answerSpeedInWords(-1)).toBeNull();
  });
});
