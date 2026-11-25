// @vitest-environment node
/**
 * The job summary (owner, 2026-11-25: "isnt the whole job packet available to download?"): the PDF a company downloads
 * from a job's page, written from the page's own payload (`server/utils/companyJobSummary.ts`) by a small text-only PDF
 * writer (`server/utils/simplePdf.ts`). The route and its access checks are pinned with the page's own in
 * `company-job-automation.test.ts`, and its content is swept for the site's identity in `company-facing-site-identity.test.ts`.
 *
 * What this pins: the summary holds the page's words in the page's order and nothing of its media, tickets or the
 * company's own answer; a text the fonts cannot draw is replaced by one line pointing to the page, never shown with a
 * gap; the PDF is well formed (every cross-reference offset points at its object), the same input gives the same bytes,
 * and every page has the footer and its number; the file names name nothing of the site.
 */
import { describe, expect, it, vi } from "vitest";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { JOB_SUMMARY_FOOTER, NOTHING_TESTED_AT_SITE, PACKET_FACTS_PENDING, SIMULATION_DOWNLOAD_HINT, SIMULATION_STATUS,
  SIMULATION_WITHOUT_OBJECT, SITE_IDENTITY_RULE, VIDEO_PREPARING, jobSummaryFileName, shortJobRef } from "../../client/src/lib/companyJobPage";
import { SUCCESS_RULE_CANT_BE_SHOWN } from "../../client/src/lib/companiesRead";
import type { CompanyJobPage } from "../../client/src/types/taskBrowse";
import { JOB_SUMMARY_ON_PAGE, JOB_SUMMARY_TEXT_ON_PAGE, companyJobSummaryBlocks, companyJobSummaryPdf } from "../utils/companyJobSummary";
import { pdfCanShow, renderPdf, wrapText } from "../utils/simplePdf";
import { companySimulationFileName } from "../utils/websiteCompanySimulation";
import { pdfLinks, pdfPageCount, pdfText, pdfTextLines } from "./helpers/pdfText";

// No store is read here: the file names come from the simulation module, which would otherwise start Firebase.
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: null, dbAdmin: null, authAdmin: null, storageAdmin: null }));

const JOB_URL = "https://tryblueprint.io/jobs/capture-6f0c2a1e-3b7d-4c55-9e21-8a4d0b6c1f99";
const VIDEO_URL = "/api/company-media/jobs/job-1/video.mp4?capture=c1&viewer=v1&expires=1794000123&signature=abc";
const DOWNLOAD_URL = "/api/company-media/jobs/job-1/simulation.zip?capture=c1&viewer=v1&expires=1794000123&signature=def";
const VIEWER_URL = "/splat-viewer/index.html?content=%2Fapi%2Fwebsite-atlas-preview-views%2Fscene.ply";
const THUMBNAIL_URL = "/api/site-worlds/tasks/job-1/thumbnail?viewer=v1&expires=1794000123&signature=ghi";

const item = (overrides: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "capture-6f0c2a1e-3b7d-4c55-9e21-8a4d0b6c1f99", title: "Carton palletizing opportunity",
  taskFamily: "Pallet handling", headline: "Stack cartons on pallets", headlineFacts: ["60 to 300 times an hour", "Two shifts"],
  fitSummary: [{ key: "object", label: "Object", value: "cartons", state: "from_video" },
    { key: "weight", label: "Weight", value: "5 to 15 kg (11 to 33 lb)", state: "stated" },
    { key: "perHour", label: "Times an hour", value: null, state: "not_stated", estimateBelow: true },
    { key: "brief:what", label: "What it is", value: "\u201cthe blue cartons from line 3\u201d", state: "stated", source: "site_sentence" },
    { key: "size", label: "Size", value: null, state: "not_stated" },
    { key: "timing", label: "When", value: null, state: "unsure" }],
  simulationStatus: null,
  visitMustConfirm: ["How pallets arrive, where they are staged and how full ones leave.", "Power and network at the cell."],
  aboutSite: [SITE_IDENTITY_RULE, "Answers questions from companies here, usually within 3 hours."],
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack 12 kg cartons onto the pallet. Call [removed]",
  successRule: "Every carton ends up on the pallet, label facing out.",
  jobFacts: ["Weight: 5 to 15 kg (11 to 33 lb)"], country: "United States",
  video: { state: "ready", url: VIDEO_URL, width: 1280, height: 720, durationSeconds: 4 },
  thumbnailUrl: THUMBNAIL_URL, thumbnailSource: "company_clip_frame",
  simulation: { state: "ready", viewerUrl: VIEWER_URL },
  simulationDownload: { state: "ready", url: DOWNLOAD_URL, sizeBytes: 170_400_000, fileName: "simulation-1a2b3c4d.zip" },
  packetFacts: { object: ["Starts: about 54 cm above the floor."], measured: ["Registration residual: 8 cm."],
    estimated: ["Weight: about 3.1 kg (0.34 to 28 kg). An estimate, not weighed."] },
  myAnswer: { state: "interested", inputs: "We palletize these for a grocer.", updatedAtIso: "2026-11-13T10:00:00.000Z",
    statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, details: { estimate: { lowUsd: 1200, highUsd: 1500 }, chargeModel: "per_month" } as never },
  clarification: { question: "How tall is the pallet?", answer: "About 1.2 m." },
  responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT },
  ...overrides,
});
const lines = (page: CompanyJobPage) => pdfTextLines(companyJobSummaryPdf(page, JOB_URL));
const textOf = (page: CompanyJobPage) => lines(page).join("\n");

describe("the job summary holds what the job page shows, in its words and its order", () => {
  it("the title line, the identity line, the media's state with the way back, the site's words, At a glance, the object and the visit", () => {
    const shown = lines(item());
    const at = (line: string) => {
      const index = shown.indexOf(line);
      expect(index, line).toBeGreaterThanOrEqual(0);
      return index;
    };
    const order = [
      at("Stack cartons on pallets"),
      at("United States · 60 to 300 times an hour · Two shifts · Shared November 12, 2026"),
      at(SITE_IDENTITY_RULE),
      at("Answers questions from companies here, usually within 3 hours."),
      at("The video and the simulation"),
      at(JOB_SUMMARY_ON_PAGE.both),
      at(SIMULATION_DOWNLOAD_HINT),
      at(JOB_URL),
      at("The job, in the site's words"),
      at("Stack 12 kg cartons onto the pallet. Call [removed]"),
      at("What counts as done"),
      at("Every carton ends up on the pallet, label facing out."),
      at("At a glance"),
      // Each answer as the page shows it, with its marks: where it came from, the site's words, an estimate below.
      at("Object cartons (from the video)"),
      at("Weight 5 to 15 kg (11 to 33 lb)"),
      at("Times an hour Not stated · Blueprint's estimate is below"),
      at("What it is \u201cthe blue cartons from line 3\u201d (the site's words)"),
      at("When Not sure"),
      at("Not stated yet: Size"),
      at("The site's own answers. Blueprint has not checked them."),
      at("The object, and how sure we are"),
      at("\u2022 Starts: about 54 cm above the floor."),
      at("Measured"),
      at("\u2022 Registration residual: 8 cm."),
      at("Estimated"),
      at("What a visit must confirm"),
      at("\u2022 How pallets arrive, where they are staged and how full ones leave."),
      at(NOTHING_TESTED_AT_SITE),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(pdfLinks(companyJobSummaryPdf(item(), JOB_URL))).toEqual([JOB_URL]);
  });

  it("carries none of the page's media, tickets, the company's own answer, its question, the response line or a price", () => {
    const pdf = companyJobSummaryPdf(item(), JOB_URL);
    const raw = pdf.toString("latin1");
    for (const url of [VIDEO_URL, DOWNLOAD_URL, VIEWER_URL, THUMBNAIL_URL]) expect(raw).not.toContain(url.split("?")[0]);
    expect(raw).not.toMatch(/signature=|expires=|viewer=|\/Image|\/XObject|\/EmbeddedFile/);
    const text = pdfText(pdf);
    for (const left of ["grocer", "1200", "1,200", "How tall is the pallet?", "About 1.2 m.", COMPANY_RESPONSE_STATEMENT, "simulation-1a2b3c4d.zip", "170 MB"])
      expect(text).not.toContain(left);
    expect(text).not.toMatch(/[$€£]\s?\d/);
  });

  it("says where the video and the simulation stand while they are not ready, as the page does", () => {
    const waiting = textOf(item({ video: { state: "preparing" }, simulation: { state: "not_finished" }, simulationDownload: { state: "not_finished" },
      simulationStatus: SIMULATION_STATUS.simulation_building }));
    expect(waiting).toContain(VIDEO_PREPARING);
    expect(waiting).toContain(SIMULATION_STATUS.simulation_building);
    expect(waiting).not.toContain(SIMULATION_DOWNLOAD_HINT);
    for (const line of Object.values(JOB_SUMMARY_ON_PAGE)) expect(waiting).not.toContain(line);
    expect(textOf(item({ simulation: { state: "not_finished" }, simulationDownload: { state: "not_finished" } })))
      .toContain(JOB_SUMMARY_ON_PAGE.video);
    expect(textOf(item({ video: { state: "preparing" } }))).toContain(JOB_SUMMARY_ON_PAGE.simulation);
    // A room without the job's object is said, as beside the page's download.
    const room = textOf(item({ simulationDownload: { state: "ready", url: DOWNLOAD_URL, sizeBytes: 1, fileName: "simulation-1.zip", objectIncluded: false } }));
    expect(room.replace(/\n/g, " ")).toContain(SIMULATION_WITHOUT_OBJECT);
  });

  it("says what the page says when the site's words cannot be shown yet and the facts are being checked", () => {
    const text = textOf(item({ sentence: "", successRule: undefined, successRulePending: true, packetFacts: null, packetFactsPending: true }));
    expect(text).toContain("The site's description can't be shown right now.");
    expect(text).toContain("What counts as done");
    expect(text).toContain(SUCCESS_RULE_CANT_BE_SHOWN);
    expect(text.replace(/\n/g, " ")).toContain(PACKET_FACTS_PENDING);
    // A site that has not said what counts as done: no heading and no line saying so, as on the page (owner, 2026-11-25).
    const unsaid = textOf(item({ successRule: undefined }));
    expect(unsaid).not.toContain("What counts as done");
    expect(unsaid).not.toMatch(/has not said what counts as done/);
    // The identity line is always there, even if the page's list were to lose it.
    expect(textOf(item({ aboutSite: [] }))).toContain(SITE_IDENTITY_RULE);
  });

  // Owner, 2026-11-25: the first look stays on the site's own pages, and the tested answers are gone. A payload of before
  // that still carries a first look puts none of it in the summary, and nothing asks what the company tested.
  it("holds no first look, even from a payload that still carries one, and asks nothing about a test", () => {
    const robot = { name: "UR20", manufacturer: "Universal Robots", verdictLabel: "Fits on paper", checks: [], specs: [], evidence: [] };
    const card = { headline: "Most likely to fit: UR20", familyLabel: "Palletizing", facts: [], pick: robot as never, runnerUp: null,
      confidence: { level: "fair" as const, reason: "We estimated the weight from the video." }, unknowns: [], note: "" };
    const before = { ...item({ simulationDownload: { state: "ready", url: DOWNLOAD_URL, sizeBytes: 1, fileName: "simulation-1.zip", objectIncluded: false } }),
      firstLook: card, firstLookRows: [{ verdict: "conditional", text: "Fits if the item weighs under 11.6 kg.", robot: "Universal Robots UR10e" }],
      firstLookMore: "And 27 more.", firstLookStatus: "Our first look is not ready yet." } as CompanyJobPage;
    const text = textOf(before).replace(/\n/g, " ");
    expect(text).not.toMatch(/first look|Universal Robots|UR20|Fits if the item|And 27 more|most likely to fit|closest robot|How sure are we/i);
    expect(text).toContain(SIMULATION_WITHOUT_OBJECT);
    expect(text).not.toMatch(/what you tested|stand-in|Tested it/i);
  });

  it("replaces a text its fonts cannot draw with one line pointing to the page, never the text with a gap", () => {
    const page = item({ sentence: "Stack the cartons at \u0141\u00f3d\u017a \u4e2d\u6587 by noon.", packetFacts: { object: ["\u{1F4E6} boxes"], measured: [], estimated: [] } });
    const text = textOf(page);
    expect(text).not.toMatch(/Stack the cartons at|boxes|\?\?/);
    expect(text.split(JOB_SUMMARY_TEXT_ON_PAGE)).toHaveLength(3);
    // Western European letters and the usual punctuation are drawn as written.
    const written = textOf(item({ sentence: "Caf\u00e9 cr\u00e8me \u2014 \u201cfragile\u201d, 5\u00b0C \u2013 \u00bd pallet." }));
    expect(written).toContain("Caf\u00e9 cr\u00e8me \u2014 \u201cfragile\u201d, 5\u00b0C \u2013 \u00bd pallet.");
    expect(pdfCanShow("Na\u00efve \u2018quotes\u2019 \u20ac")).toBe(true);
    expect(pdfCanShow("\u0141\u00f3d\u017a")).toBe(false);
  });
});

describe("the PDF itself", () => {
  it("is well formed: every cross-reference offset points at its object, and the trailer at the table", () => {
    const pdf = companyJobSummaryPdf(item(), JOB_URL);
    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-1.4\n")).toBe(true);
    expect(raw.endsWith("%%EOF\n")).toBe(true);
    const start = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(raw)![1]);
    expect(raw.slice(start, start + 4)).toBe("xref");
    const offsets = [...raw.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map(match => Number(match[1]));
    expect(offsets.length).toBeGreaterThan(5);
    offsets.forEach((offset, index) => expect(raw.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
    for (const stream of raw.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const begin = stream.index! + stream[0].length;
      expect(raw.slice(begin + Number(stream[1]), begin + Number(stream[1]) + "endstream".length)).toBe("endstream");
    }
  });

  it("gives the same bytes for the same page, with no date or random id in it", () => {
    expect(companyJobSummaryPdf(item(), JOB_URL).equals(companyJobSummaryPdf(item(), JOB_URL))).toBe(true);
    expect(companyJobSummaryPdf(item(), JOB_URL).toString("latin1")).not.toMatch(/CreationDate|ModDate|\/ID/);
  });

  it("is one to two pages for a full job, and puts the footer and the page's number on every page", () => {
    const full = companyJobSummaryPdf(item(), JOB_URL);
    expect(pdfPageCount(full)).toBeLessThanOrEqual(2);
    // A job with a long description and long lists still keeps every line, page after page.
    const long = item({ sentence: "Stack the cartons, label out. ".repeat(60), visitMustConfirm: Array.from({ length: 40 }, (_, n) => `Visit item ${n + 1}.`) });
    const pdf = companyJobSummaryPdf(long, JOB_URL);
    const pages = pdfPageCount(pdf);
    expect(pages).toBeGreaterThan(2);
    const text = pdfText(pdf);
    for (let n = 1; n <= pages; n += 1) expect(text).toContain(`${JOB_SUMMARY_FOOTER} Page ${n} of ${pages}`);
    for (let n = 1; n <= 40; n += 1) expect(text).toContain(`\u2022 Visit item ${n}.`);
  });

  it("escapes what a PDF string cannot hold as written, and breaks a word too long for a line", () => {
    const pdf = renderPdf({ title: "T", footer: "F", blocks: [{ kind: "paragraph", text: "Load (and unload) C:\\bay 4 \u2014 caf\u00e9" },
      { kind: "paragraph", text: "x".repeat(400) }] });
    expect(pdf.toString("latin1")).toContain("(Load \\(and unload\\) C:\\\\bay 4 \\227 caf\\351)");
    const text = pdfTextLines(pdf);
    expect(text[0]).toBe("Load (and unload) C:\\bay 4 \u2014 caf\u00e9");
    expect(text.filter(line => /^x+$/.test(line)).join("")).toBe("x".repeat(400));
    expect(wrapText("x".repeat(400), "regular", 10, 504).every(line => line.length < 400)).toBe(true);
  });
});

describe("the downloads' file names name nothing of the site", () => {
  it("the job summary: job-summary-<short job ref>.pdf, from the job's own id", () => {
    expect(jobSummaryFileName("capture-6f0c2a1e-3b7d-4c55-9e21-8a4d0b6c1f99")).toBe("job-summary-6f0c2a1e.pdf");
    expect(jobSummaryFileName(`itest-${"a1b2c3d4e5".repeat(4)}`)).toBe("job-summary-a1b2c3d4.pdf");
    expect(jobSummaryFileName("req-e2")).toBe("job-summary-e2.pdf");
    expect(shortJobRef("Abc.DEF:12/34")).toBe("abcdef12");
    expect(shortJobRef("---")).toBe("job");
  });

  it("the simulation: simulation-<first 8 hex of the package digest>.zip; the job console's with the job's id first", () => {
    const reference = { digest: `sha256:1a2b3c4d${"0".repeat(56)}` };
    expect(companySimulationFileName(reference)).toBe("simulation-1a2b3c4d.zip");
    expect(companySimulationFileName({ digest: `sha256:9f8e7d6c${"0".repeat(56)}` })).toBe("simulation-9f8e7d6c.zip");
    expect(companySimulationFileName(reference, "req-dl")).toBe("simulation-req-dl-1a2b3c4d.zip");
    expect(companySimulationFileName(reference, "job:with/odd chars")).toBe("simulation-job-with-odd-chars-1a2b3c4d.zip");
  });
});
