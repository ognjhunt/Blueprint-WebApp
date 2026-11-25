// @vitest-environment node
/**
 * The owner's marketplace numbers (2026-11-25): the math (medians, the nearest-rank 90th percentile, shares), the
 * cohort window by the day a job was shared, the exclusions (internal test jobs, workspace evaluations, other buyers),
 * the empty states (nothing measured is null, never 0), and the bounded reads.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));

import {
  MARKETPLACE_JOB_LIMIT, MARKETPLACE_RECORDS_PER_JOB, OUTCOME_READERS, SHARED_FIELD, applicationBounds, firstApplyStep,
  firstResponseStep, jobSpendFacts, loadMarketplaceNumbers, madeIntroductionCompanies, marketplaceNumbersOf, median,
  percentile, windowStartIso, type MarketplaceJobInput,
} from "../utils/marketplaceNumbers";
import { firstApplicationTimestamp } from "../utils/jobCompanies";

type Row = Record<string, any>;
const C1 = "a".repeat(64), C2 = "b".repeat(64), C3 = "c".repeat(64);
const NOW = new Date("2026-11-25T15:00:00.000Z");
const META = { windowDays: 7 as const, includeTests: false, sinceIso: "2026-11-19T00:00:00.000Z", generatedAtIso: NOW.toISOString() };

/* --------------------------------------------------------------------------------- a fake store */

/**
 * A store keyed by full document path. Supports what the numbers read: equality and range filters, one ordering, a
 * limit, select, collection groups not at all (none is used), and getAll. Every query's limit is recorded, so a test
 * can check that no read is unbounded.
 */
function fakeStore(docs: Record<string, Row>) {
  const queries: Array<{ path: string; limit: number | null; filters: string[] }> = [];
  const read = (row: Row, field: string) => field.split(".").reduce<any>((value, key) => (value == null ? undefined : value[key]), row);
  const snap = (path: string) => ({ id: path.split("/").at(-1)!, exists: path in docs, data: () => docs[path], ref: refOf(path) });
  const refOf = (path: string): any => ({ id: path.split("/").at(-1), path, get: async () => snap(path),
    collection: (name: string) => collectionOf(`${path}/${name}`) });
  type Q = { filters: Array<[string, string, unknown]>; order: [string, string] | null; limit: number | null };
  const queryOf = (parent: string, q: Q): any => ({
    where: (field: string, op: string, value: unknown) => queryOf(parent, { ...q, filters: [...q.filters, [field, op, value]] }),
    orderBy: (field: string, direction = "asc") => queryOf(parent, { ...q, order: [field, direction] }),
    limit: (count: number) => queryOf(parent, { ...q, limit: count }),
    select: () => queryOf(parent, q),
    get: async () => {
      queries.push({ path: parent, limit: q.limit, filters: q.filters.map(([field, op]) => `${field} ${op}`) });
      let paths = Object.keys(docs).filter(path => path.startsWith(`${parent}/`) && !path.slice(parent.length + 1).includes("/"))
        .filter(path => q.filters.every(([field, op, value]) => {
          const actual = read(docs[path], field);
          return op === "==" ? actual === value : op === ">=" ? actual !== undefined && String(actual) >= String(value) : false;
        }));
      if (q.order) {
        const [field, direction] = q.order;
        paths = paths.filter(path => read(docs[path], field) !== undefined)
          .sort((a, b) => String(read(docs[a], field)).localeCompare(String(read(docs[b], field))) * (direction === "desc" ? -1 : 1));
      }
      return { docs: paths.slice(0, q.limit ?? undefined).map(snap) };
    },
  });
  const collectionOf = (path: string): any => ({ doc: (id: string) => refOf(`${path}/${id}`),
    ...queryOf(path, { filters: [], order: null, limit: null }) });
  const store: any = {
    collection: (name: string) => collectionOf(name),
    getAll: async (...args: any[]) => args.filter(arg => arg && arg.path).map(ref => snap(ref.path)),
  };
  return { store, queries };
}

const siteJob = (sharedAtIso: string | null, extra: Row = {}) => ({ createdAt: "2026-11-01T00:00:00.000Z",
  request: { buyerType: "site_operator", siteName: "Never read" },
  ...(sharedAtIso ? { [SHARED_FIELD]: { schemaVersion: 1, sentAtIso: sharedAtIso, count: 3 } } : {}), ...extra });
const answer = (state: string, firstAnsweredAtIso: string, extra: Row = {}) => ({ state, recordedBy: "company", firstAnsweredAtIso,
  updatedAtIso: firstAnsweredAtIso, ...(["interested", "tested_can_do"].includes(state) ? { firstAppliedAtIso: firstAnsweredAtIso } : {}), ...extra });

/* ----------------------------------------------------------------------------------- the math */

describe("the math", () => {
  it("takes the median of an odd and an even count, and none of nothing", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("takes the nearest-rank 90th percentile", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([10, 1, 5], 90)).toBe(10);
    expect(percentile([7], 90)).toBe(7);
    expect(percentile([], 90)).toBeNull();
  });

  it("starts a window on the first UTC day of the last 7 or 30 days, today included", () => {
    expect(windowStartIso(NOW, 7)).toBe("2026-11-19T00:00:00.000Z");
    expect(windowStartIso(NOW, 30)).toBe("2026-10-27T00:00:00.000Z");
    expect(windowStartIso(new Date("2026-11-25T00:00:00.000Z"), 7)).toBe("2026-11-19T00:00:00.000Z");
  });
});

describe("when a company applied", () => {
  it("reads the recorded first application, kept after the answer changed", () => {
    expect(applicationBounds(answer("declined", "2026-11-20T10:00:00.000Z", { firstAppliedAtIso: "2026-11-20T09:00:00.000Z" })))
      .toEqual({ lo: Date.parse("2026-11-20T09:00:00.000Z"), hi: Date.parse("2026-11-20T09:00:00.000Z") });
  });

  it("an older application: exact when never edited, bounded when edited, none when not an application", () => {
    const at = "2026-11-20T10:00:00.000Z", later = "2026-11-21T10:00:00.000Z";
    expect(applicationBounds({ state: "interested", recordedBy: "company", firstAnsweredAtIso: at, updatedAtIso: at }))
      .toEqual({ lo: Date.parse(at), hi: Date.parse(at) });
    expect(applicationBounds({ state: "interested", recordedBy: "company", firstAnsweredAtIso: at, updatedAtIso: later }))
      .toEqual({ lo: Date.parse(at), hi: Date.parse(later) });
    expect(applicationBounds({ state: "needs_something", recordedBy: "company", firstAnsweredAtIso: at, updatedAtIso: at })).toBeNull();
    // An answer from before package C1 (no `recordedBy`) is not a response at all.
    expect(applicationBounds({ state: "interested", firstAnsweredAtIso: at, updatedAtIso: at })).toBeNull();
  });

  it("is recorded at the source once, and never made up for an older answer edited since", () => {
    const at = "2026-11-25T10:00:00.000Z";
    expect(firstApplicationTimestamp(undefined, "interested", at)).toBe(at);
    expect(firstApplicationTimestamp(undefined, "declined", at)).toBeNull();
    expect(firstApplicationTimestamp({ state: "interested", firstAppliedAtIso: "2026-11-24T00:00:00.000Z" }, "declined", at))
      .toBe("2026-11-24T00:00:00.000Z");
    expect(firstApplicationTimestamp({ state: "needs_something", firstAnsweredAtIso: "2026-11-24T00:00:00.000Z",
      updatedAtIso: "2026-11-24T00:00:00.000Z" }, "interested", at)).toBe(at);
    // An older answer that stood as an application: its one write is the time; after an edit it is not known.
    expect(firstApplicationTimestamp({ state: "interested", firstAnsweredAtIso: "2026-11-23T00:00:00.000Z",
      updatedAtIso: "2026-11-23T00:00:00.000Z" }, "interested", at)).toBe("2026-11-23T00:00:00.000Z");
    expect(firstApplicationTimestamp({ state: "interested", firstAnsweredAtIso: "2026-11-23T00:00:00.000Z",
      updatedAtIso: "2026-11-24T00:00:00.000Z" }, "interested", at)).toBeNull();
  });
});

describe("a job's first steps", () => {
  const video = Date.parse("2026-11-20T08:00:00.000Z");
  it("is none with no answer, its time after the video, or not known when an answer's first time is missing", () => {
    expect(firstResponseStep([], video)).toEqual({ state: "none" });
    expect(firstResponseStep([answer("declined", "2026-11-20T12:00:00.000Z"), answer("interested", "2026-11-20T10:00:00.000Z")], video))
      .toEqual({ state: "at", atIso: "2026-11-20T10:00:00.000Z", afterVideoMs: 2 * 3_600_000 });
    expect(firstResponseStep([answer("declined", "2026-11-20T12:00:00.000Z"), { state: "declined", recordedBy: "company",
      updatedAtIso: "2026-11-20T13:00:00.000Z" }], video)).toEqual({ state: "time_unknown" });
    // No video time, or an answer before it: the time is kept, the duration is not measured.
    expect(firstResponseStep([answer("declined", "2026-11-20T12:00:00.000Z")], null))
      .toEqual({ state: "at", atIso: "2026-11-20T12:00:00.000Z", afterVideoMs: null });
    expect(firstResponseStep([answer("declined", "2026-11-20T07:00:00.000Z")], video).state).toBe("at");
    expect((firstResponseStep([answer("declined", "2026-11-20T07:00:00.000Z")], video) as { afterVideoMs: unknown }).afterVideoMs).toBeNull();
  });

  it("first Apply: the earliest, unless an application whose time is only bounded could be earlier", () => {
    const exact = answer("interested", "2026-11-20T10:00:00.000Z");
    const bounded = { state: "interested", recordedBy: "company", firstAnsweredAtIso: "2026-11-20T09:00:00.000Z", updatedAtIso: "2026-11-21T00:00:00.000Z" };
    const boundedLater = { ...bounded, firstAnsweredAtIso: "2026-11-20T11:00:00.000Z" };
    expect(firstApplyStep([answer("declined", "2026-11-20T09:00:00.000Z")], video)).toEqual({ state: "none" });
    expect(firstApplyStep([exact, bounded], video)).toEqual({ state: "time_unknown" });
    expect(firstApplyStep([exact, boundedLater], video)).toEqual({ state: "at", atIso: "2026-11-20T10:00:00.000Z", afterVideoMs: 2 * 3_600_000 });
  });

  it("an introduction is made once the company's email was sent; void and not-made events are not", () => {
    expect([...madeIntroductionCompanies([
      { companyId: C1, status: "recorded_no_price", madeAtIso: "2026-11-21T00:00:00.000Z" },
      { companyId: C2, status: "recorded_no_price" },
      { companyId: C3, status: "void", madeAtIso: "2026-11-21T00:00:00.000Z" },
    ])]).toEqual([C1]);
    // A test introduction's event counts on a test job (only shown with the switch on).
    expect(madeIntroductionCompanies([{ companyId: C1, status: "test_no_charge", testEvent: true, madeAtIso: "2026-11-21T00:00:00.000Z" }]).has(C1)).toBe(true);
  });
});

/* ------------------------------------------------------------------------------- the window's numbers */

const input = (jobId: string, extra: Partial<MarketplaceJobInput> = {}): MarketplaceJobInput => ({ jobId, internalTest: null,
  sharedAtIso: "2026-11-20T09:00:00.000Z", videoAtIso: "2026-11-20T08:00:00.000Z", answers: [], introductions: [], billableEvents: [],
  simulationUse: [], spend: { state: "no_ledger" }, ...extra });

describe("the window's numbers", () => {
  it("with no job, every number is null and every list empty: nothing is 0 that was not measured", () => {
    const numbers = marketplaceNumbersOf([], META);
    expect(numbers.sharedJobs).toBe(0);
    expect(numbers.headline.firstResponse).toEqual({ measured: 0, medianMs: null, p90Ms: null, waiting: 0, notMeasurable: 0 });
    expect(numbers.headline.jobsWithApply).toEqual({ count: 0, of: 0, share: null });
    expect(numbers.headline.applicationsIntroduced.share).toBeNull();
    expect(numbers.answers.needMoreDetails.share).toBeNull();
    expect(numbers.outcomes.introductions).toBe(0);
    expect(numbers.cost.perJob).toBeNull();
    expect(numbers.cost.lanes).toEqual([]);
    expect(numbers.simulation).toEqual({ viewerOpens: null, downloads: null });
    expect(numbers.jobs).toEqual([]);
  });

  it("a shared job with no answer is waiting, not 0 minutes; its use with no counter is null", () => {
    const numbers = marketplaceNumbersOf([input("j1")], META);
    expect(numbers.headline.firstResponse).toMatchObject({ measured: 0, medianMs: null, waiting: 1 });
    expect(numbers.headline.jobsWithApply).toEqual({ count: 0, of: 1, share: 0 });
    expect(numbers.jobs[0]).toMatchObject({ firstResponse: { state: "none" }, simulationOpens: null, simulationDownloads: null,
      spend: { state: "no_ledger" } });
  });

  it("adds up responses, applications, introductions, answers, outcomes, spend and use", () => {
    const h = 3_600_000;
    const jobs = [
      input("j1", { answers: [{ companyId: C1, data: answer("interested", "2026-11-20T10:00:00.000Z") },
        { companyId: C2, data: answer("needs_something", "2026-11-20T09:30:00.000Z") },
        { companyId: C3, data: answer("declined", "2026-11-20T11:00:00.000Z") }],
        introductions: [{ companyId: C1, data: { requestedAtIso: "2026-11-21T00:00:00.000Z", progress: { visitAtIso: "2026-11-23T00:00:00.000Z" },
          outcomes: [{ by: "site", state: "still_talking", atIso: "2026-11-22T00:00:00.000Z" }] } }],
        billableEvents: [{ companyId: C1, status: "recorded_no_price", madeAtIso: "2026-11-21T00:01:00.000Z" }],
        simulationUse: [{ companyId: C1, kind: "viewer_open", count: 3 }, { companyId: C2, kind: "viewer_open", count: 1 },
          { companyId: C1, kind: "download", count: 1 }],
        spend: { state: "counted", totalMicros: 12_340_000, lanes: { preparation: 10_000_000, scene_construction: 0, video_readings: 2_000_000,
          screening: 0, "model_lane:job_brief": 340_000 } } }),
      input("j2", { sharedAtIso: "2026-11-22T09:00:00.000Z", videoAtIso: "2026-11-22T00:00:00.000Z",
        answers: [{ companyId: C1, data: answer("tested_can_do", "2026-11-22T04:00:00.000Z") },
          { companyId: C2, data: answer("interested", "2026-11-22T06:00:00.000Z") }],
        // Asked for, not made yet (its company email not sent): counted apart, not as made.
        introductions: [{ companyId: C2, data: { requestedAtIso: "2026-11-23T00:00:00.000Z" } }],
        billableEvents: [{ companyId: C2, status: "recorded_no_price" }],
        spend: { state: "counted", totalMicros: 30_000_000, lanes: { preparation: 30_000_000, scene_construction: 0, video_readings: 0, screening: 0 } } }),
      input("j3", { sharedAtIso: "2026-11-24T09:00:00.000Z", spend: { state: "unreadable", lanes: { preparation: Infinity, video_readings: 1_000_000 } } }),
    ];
    const numbers = marketplaceNumbersOf(jobs, META);
    expect(numbers.headline.firstResponse).toEqual({ measured: 2, medianMs: (1.5 * h + 4 * h) / 2, p90Ms: 4 * h, waiting: 1, notMeasurable: 0 });
    expect(numbers.headline.firstApply).toEqual({ measured: 2, medianMs: (2 * h + 4 * h) / 2, p90Ms: 4 * h, waiting: 1, notMeasurable: 0 });
    expect(numbers.headline.jobsWithApply).toEqual({ count: 2, of: 3, share: 2 / 3 });
    expect(numbers.headline.applicationsIntroduced).toEqual({ count: 1, of: 3, share: 1 / 3 });
    expect(numbers.answers.needMoreDetails).toEqual({ count: 1, of: 5, share: 0.2 });
    expect(numbers.answers.notAFit).toEqual({ count: 1, of: 5, share: 0.2 });
    expect(numbers.outcomes.introductions).toBe(1);
    expect(numbers.outcomes.rows.filter(row => row.introductions)).toEqual([
      { key: "visit", label: "Visit (marked by the site)", introductions: 1 },
      { key: "answer_still_talking", label: "Still talking", introductions: 1 }]);
    expect(numbers.cost).toMatchObject({ perJob: { jobs: 2, medianUsd: 21.17, p90Usd: 30, maxUsd: 30, totalUsd: 42.34 },
      noLedger: 0, unreadable: 1, unavailable: 0 });
    expect(numbers.cost.lanes.map(lane => [lane.key, lane.spread?.medianUsd ?? null, lane.unreadable])).toEqual([
      ["preparation", 20, 1], ["video_readings", 1, 0], ["model_lane:job_brief", 0, 0]]);
    expect(numbers.cost.lanes.find(lane => lane.key === "model_lane:job_brief")).toMatchObject({ label: "Job brief",
      spread: { jobs: 3, maxUsd: 0.34 } });
    expect(numbers.simulation).toEqual({ viewerOpens: { total: 4, jobs: 1, companies: 2 }, downloads: { total: 1, jobs: 1, companies: 1 } });
    // Newest shared first; the row carries ids, times and counts only.
    expect(numbers.jobs.map(job => job.jobId)).toEqual(["j3", "j2", "j1"]);
    expect(numbers.jobs[1]).toMatchObject({ applications: 2, introductions: 0, introductionsWaiting: 1, spend: { state: "counted", usd: 30 } });
    expect(numbers.jobs[2]).toMatchObject({ responses: 3, applications: 1, introductions: 1, simulationOpens: 4, simulationDownloads: 1,
      spend: { state: "counted", usd: 12.34 } });
    expect(JSON.stringify(numbers)).not.toContain("Never read");
  });

  it("every outcome reader can be read on any introduction, and names its key once", () => {
    const keys = OUTCOME_READERS.map(reader => reader.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(["visit", "pilot", "answer_not_going_ahead", "answer_installed"]));
    for (const reader of OUTCOME_READERS) expect(reader.recorded({})).toBe(false);
  });
});

/* ---------------------------------------------------------------------------------- the reads */

describe("the reads", () => {
  it("takes the jobs shared in the window, leaves out tests, evaluations and other buyers, and reads the earliest video", async () => {
    const { store, queries } = fakeStore({
      "inboundRequests/in": siteJob("2026-11-20T09:00:00.000Z", { active_capture_id: `supplement-${"1".repeat(40)}` }),
      "inboundRequests/old": siteJob("2026-11-18T23:59:59.000Z"),
      "inboundRequests/never": siteJob(null),
      "inboundRequests/eval": siteJob("2026-11-20T09:00:00.000Z", { workspace_evaluation: { opportunityId: "x" } }),
      "inboundRequests/robot": { request: { buyerType: "robot_team" }, [SHARED_FIELD]: { sentAtIso: "2026-11-20T09:00:00.000Z" } },
      "inboundRequests/test": siteJob(null, { internal_test: { label: "mug to tray", created_at_iso: "2026-11-21T00:00:00.000Z" } }),
      "inboundRequests/test/companySends/system-x": { sentAtIso: "2026-11-21T01:00:00.000Z", sentBy: "system" },
      "captureUploadSessions/walkthrough-in": { browser_stored_upload: { completed_at_iso: "2026-11-20T07:00:00.000Z" } },
      [`captureUploadSessions/supplement-${"1".repeat(40)}`]: { browser_stored_upload: { completed_at_iso: "2026-11-20T08:00:00.000Z" } },
      [`inboundRequests/in/robotTeamInterest/${C1}`]: answer("interested", "2026-11-20T10:00:00.000Z"),
      [`inboundRequests/test/robotTeamInterest/${C2}`]: answer("declined", "2026-11-21T02:00:00.000Z"),
    });
    const numbers = await loadMarketplaceNumbers({ windowDays: 7, includeTests: false, now: NOW, store });
    expect(numbers.jobs.map(job => job.jobId)).toEqual(["in"]);
    expect(numbers.jobs[0]).toMatchObject({ videoAtIso: "2026-11-20T07:00:00.000Z",
      firstApply: { state: "at", atIso: "2026-11-20T10:00:00.000Z", afterVideoMs: 3 * 3_600_000 } });
    expect(numbers.limits).toEqual([]);
    // No unbounded read: every query has a limit (the cap's own ledger queries by job are equality filters on one job).
    const unbounded = queries.filter(query => query.limit === null && !query.filters.some(filter => / ==$/.test(filter)));
    expect(unbounded).toEqual([]);
    expect(queries.find(query => query.path === "inboundRequests")).toMatchObject({ limit: MARKETPLACE_JOB_LIMIT,
      filters: [`${SHARED_FIELD}.sentAtIso >=`] });
    expect(queries.filter(query => query.path.endsWith("/robotTeamInterest")).every(query => query.limit === MARKETPLACE_RECORDS_PER_JOB)).toBe(true);

    const withTests = await loadMarketplaceNumbers({ windowDays: 7, includeTests: true, now: NOW, store });
    expect(withTests.jobs.map(job => [job.jobId, job.internalTest])).toEqual([["test", { label: "mug to tray" }], ["in", null]]);
    expect(withTests.jobs[0]).toMatchObject({ sharedAtIso: "2026-11-21T01:00:00.000Z", responses: 1 });
  });

  it("reads each job's answers, introductions, billable events and use counters from the store", async () => {
    const { store } = fakeStore({
      "inboundRequests/in": siteJob("2026-11-20T09:00:00.000Z"),
      "captureUploadSessions/walkthrough-in": { browser_stored_upload: { completed_at_iso: "2026-11-20T08:00:00.000Z" } },
      [`inboundRequests/in/robotTeamInterest/${C1}`]: answer("interested", "2026-11-20T10:00:00.000Z"),
      [`inboundRequests/in/robotTeamInterest/${C2}`]: answer("interested", "2026-11-20T11:00:00.000Z"),
      [`inboundRequests/in/introductions/${C1}`]: { requestedAtIso: "2026-11-21T00:00:00.000Z",
        outcomes: [{ by: "company", state: "not_going_ahead", atIso: "2026-12-05T00:00:00.000Z", linkDigest: "never read back" }] },
      [`inboundRequests/in/introductions/${C2}`]: { requestedAtIso: "2026-11-21T00:00:00.000Z", cancelledAtIso: "2026-11-21T00:02:00.000Z" },
      [`billableEvents/introduction-in-${C1}`]: { requestId: "in", companyId: C1, status: "recorded_no_price", madeAtIso: "2026-11-21T00:01:00.000Z" },
      [`billableEvents/introduction-in-${C2}`]: { requestId: "in", companyId: C2, status: "void" },
      [`billableEvents/introduction-other-${C1}`]: { requestId: "other", companyId: C1, status: "recorded_no_price", madeAtIso: "2026-11-21T00:01:00.000Z" },
      [`inboundRequests/in/simulationUse/${C1}-viewer_open`]: { companyId: C1, kind: "viewer_open", count: 2 },
      [`inboundRequests/in/simulationUse/${C1}-download`]: { companyId: C1, kind: "download", count: 1 },
      [`inboundRequests/in/simulationUse/${C2}-download`]: { companyId: "not a company", kind: "download", count: 9 },
    });
    const numbers = await loadMarketplaceNumbers({ windowDays: 30, includeTests: false, now: NOW, store });
    expect(numbers.sinceIso).toBe("2026-10-27T00:00:00.000Z");
    expect(numbers.jobs[0]).toMatchObject({ responses: 2, applications: 2, introductions: 1, introductionsWaiting: 0,
      simulationOpens: 2, simulationDownloads: 1, firstResponse: { afterVideoMs: 2 * 3_600_000 } });
    expect(numbers.headline.applicationsIntroduced).toEqual({ count: 1, of: 2, share: 0.5 });
    expect(numbers.outcomes).toMatchObject({ introductions: 1 });
    expect(numbers.outcomes.rows.find(row => row.key === "answer_not_going_ahead")).toMatchObject({ introductions: 1 });
    expect(JSON.stringify(numbers)).not.toContain("never read back");
  });

  it("says when the read limit was reached", async () => {
    const docs: Record<string, Row> = {};
    for (let index = 0; index < MARKETPLACE_JOB_LIMIT + 1; index += 1)
      docs[`inboundRequests/job-${String(index).padStart(3, "0")}`] = siteJob(`2026-11-2${index % 5}T00:00:00.000Z`);
    const { store } = fakeStore(docs);
    const numbers = await loadMarketplaceNumbers({ windowDays: 7, includeTests: false, now: NOW, store });
    expect(numbers.sharedJobs).toBe(MARKETPLACE_JOB_LIMIT);
    expect(numbers.limits).toEqual([expect.stringContaining(`Only the ${MARKETPLACE_JOB_LIMIT} jobs shared most recently were read`)]);
  });

  it("counts a job's spend on every ledger the cap counts, the model lanes by lane; none with no ledger row", async () => {
    const record = { website_preparation_reservations: {
      a: { admission: { maximum_cost_usd: 8 }, settlement: { actual_cost_usd: 6.5 } },
      b: { admission: { maximum_cost_usd: 2 } } } };
    const { store } = fakeStore({
      "inboundRequests/j1/modelLaneReservations/r1": { lane: "job_brief", admission: { maximum_cost_usd: 0.5 }, settlement: { actual_cost_usd: 0.12 } },
      "inboundRequests/j1/modelLaneReservations/r2": { lane: "free_text_redaction", admission: { maximum_cost_usd: 0.3 } },
    });
    expect(await jobSpendFacts(store, "j1", record)).toEqual({ state: "counted", totalMicros: 8_920_000, lanes: {
      preparation: 8_500_000, scene_construction: 0, video_readings: 0, screening: 0,
      "model_lane:job_brief": 120_000, "model_lane:free_text_redaction": 300_000 } });
    expect(await jobSpendFacts(store, "j2", {})).toEqual({ state: "no_ledger" });
    const unreadable = await jobSpendFacts(store, "j3", { website_preparation_reservations: { a: { admission: {} } } });
    expect(unreadable.state).toBe("unreadable");
  });

  it("reads the share time from the automatic send's own marker", async () => {
    const { AUTO_SEND_FIELD } = await import("../utils/jobAutoSend");
    expect(SHARED_FIELD).toBe(AUTO_SEND_FIELD);
  });

  it("refuses without a store", async () => {
    await expect(loadMarketplaceNumbers({ windowDays: 7, includeTests: false, store: null })).rejects.toThrow("marketplace_numbers_store_unavailable");
  });
});
