// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));

import { BILLABLE_EVENTS_CSV_HEADER, billableEventsCsv, loadJobTotals } from "../utils/ownerTotals";
import { countStandingBillableEvents, tallyStandingBillableEvents } from "../utils/billableEvents";

type Row = Record<string, any>;
/** A tiny store keyed by full document path ("a/b/c/d"). Counts how each record was read. */
function fakeStore(docs: Record<string, Row>) {
  const reads = { counts: 0, docs: 0 };
  const read = (row: Row, path: string) => path.split(".").reduce<any>((v, k) => (v == null ? undefined : v[k]), row);
  const refOf = (path: string): any => {
    const parts = path.split("/");
    const parentPath = parts.slice(0, -1).join("/");
    return { id: parts.at(-1), path, parent: { id: parts.at(-2), parent: parts.length > 2 ? refOf(parts.slice(0, -2).join("/")) : null, path: parentPath },
      get: async () => snap(path) };
  };
  const snap = (path: string) => ({ id: path.split("/").at(-1), ref: refOf(path), exists: path in docs, data: () => docs[path] });
  const query = (match: (path: string) => boolean, filters: Array<(row: Row) => boolean>): any => ({
    where: (field: string, _op: string, value: unknown) => query(match, [...filters, row => read(row, field) === value]),
    select: () => query(match, filters),
    get: async () => {
      const found = Object.keys(docs).filter(p => match(p) && filters.every(f => f(docs[p]))).map(snap);
      reads.docs += found.length;
      return { docs: found };
    },
    count: () => ({ get: async () => { reads.counts += 1;
      return { data: () => ({ count: Object.keys(docs).filter(p => match(p) && filters.every(f => f(docs[p]))).length }) }; } }),
  });
  const store: any = {
    collection: (name: string) => ({ doc: (id: string) => refOf(`${name}/${id}`),
      ...query(p => p.split("/").length === 2 && p.startsWith(`${name}/`), []) }),
    collectionGroup: (name: string) => query(p => { const s = p.split("/"); return s.length >= 2 && s.at(-2) === name; }, []),
    getAll: async (...args: any[]) => args.filter(a => a && a.path).map(ref => snap(ref.path)),
  };
  return { store, reads };
}

const NOW = new Date("2026-11-22T12:00:00.000Z");
const site = (createdAt: string, extra: Row = {}) => ({ createdAt, request: { buyerType: "site_operator", siteName: "Never read" }, ...extra });

describe("the owner's totals", () => {
  it("counts site jobs only, with a video, shown, answered, introductions asked and made, outcome answers and billable events", async () => {
    const { store, reads } = fakeStore({
      "inboundRequests/a": site("2026-11-20T00:00:00.000Z"),
      "inboundRequests/b": site("2026-10-01T00:00:00.000Z"),
      "inboundRequests/t": site("2026-11-21T00:00:00.000Z", { internal_test: { label: "test" } }),
      "inboundRequests/e": site("2026-11-21T00:00:00.000Z", { workspace_evaluation: { opportunityId: "a" } }),
      "inboundRequests/r": { createdAt: "2026-11-21T00:00:00.000Z", request: { buyerType: "robot_team" } },
      "captureUploadSessions/walkthrough-a": { browser_stored_upload: { completed_at_iso: "2026-11-20T01:00:00.000Z" } },
      "captureUploadSessions/walkthrough-b": {},
      "captureUploadSessions/walkthrough-t": { browser_stored_upload: { completed_at_iso: "2026-11-21T01:00:00.000Z" } },
      "inboundRequests/a/companySends/system-c1": { companyId: "c1" },
      "inboundRequests/a/companySends/system-c2": { companyId: "c2" },
      "inboundRequests/b/companySends/s1": { companyId: "c1", voidedAtIso: "2026-10-02T00:00:00.000Z" },
      "inboundRequests/t/companySends/s1": { companyId: "c1" },
      "inboundRequests/a/robotTeamInterest/c1": { state: "interested" },
      "inboundRequests/a/introductions/c1": { outcomes: [{ state: "talking" }, { state: "agreed" }] },
      "inboundRequests/a/introductions/c2": { outcomes: [] },
      "captureOutbox/x1": { kind: "introduction_made_company", status: "sent" },
      "captureOutbox/x2": { kind: "introduction_made_company", status: "pending" },
      "captureOutbox/x3": { kind: "introduction_made_site", status: "sent" },
      "billableEvents/introduction-a-c1": { status: "recorded_no_price", madeAtIso: "2026-11-20T00:05:00.000Z" },
      "billableEvents/introduction-a-c2": { status: "void" },
    });
    expect(await loadJobTotals(NOW, store)).toEqual({ siteJobs: 2, siteJobsThisWeek: 1, withVideo: 1, shownToCompanies: 1,
      answered: 1, introductionsAsked: 2, introductionsMade: 1, outcomeAnswers: 2, billableEvents: 1, billableEventsNotMade: 0 });
    // Introductions made is a count query; the billable events are read (status and made time only) to tell made from not.
    expect(reads.counts).toBe(1);
  });

  it("leaves a number it cannot read as null, never the line", async () => {
    const { store } = fakeStore({ "inboundRequests/a": site("2026-11-20T00:00:00.000Z") });
    store.collectionGroup = () => { throw new Error("index missing"); };
    const totals = await loadJobTotals(NOW, store);
    expect(totals).toMatchObject({ siteJobs: 1, shownToCompanies: null, answered: null, introductionsAsked: null, outcomeAnswers: null,
      introductionsMade: 0, billableEvents: 0, billableEventsNotMade: 0 });
  });

  // Owner, 2026-11-23: a billable event counts only once its introduction is made (the company's email was sent).
  it("counts one made event as billable, lists one recorded but not made apart, and counts no void one", async () => {
    const { store } = fakeStore({
      "inboundRequests/a": site("2026-11-20T00:00:00.000Z"),
      "inboundRequests/a/introductions/c1": { outcomes: [] },
      "inboundRequests/a/introductions/c2": { outcomes: [] },
      "inboundRequests/a/introductions/c3": { outcomes: [] },
      "captureOutbox/x1": { kind: "introduction_made_company", status: "sent" },
      "captureOutbox/x2": { kind: "introduction_made_company", status: "unknown" },
      "billableEvents/introduction-a-c1": { status: "recorded_no_price", madeAtIso: "2026-11-20T00:05:00.000Z" },
      "billableEvents/introduction-a-c2": { status: "recorded_no_price" },
      "billableEvents/introduction-a-c3": { status: "void", madeAtIso: "2026-11-20T00:06:00.000Z" },
    });
    expect(await loadJobTotals(NOW, store)).toMatchObject({ introductionsAsked: 3, introductionsMade: 1,
      billableEvents: 1, billableEventsNotMade: 1 });
  });

  it("leaves both billable numbers null when the events cannot be read", async () => {
    const { store } = fakeStore({ "inboundRequests/a": site("2026-11-20T00:00:00.000Z") });
    const collection = store.collection;
    store.collection = (name: string) => name === "billableEvents" ? { select: () => { throw new Error("unavailable"); } } : collection(name);
    expect(await loadJobTotals(NOW, store)).toMatchObject({ billableEvents: null, billableEventsNotMade: null });
  });
});

describe("the standing billable events", () => {
  it("count only those whose introduction was made; recorded but not made are counted apart; void never", async () => {
    const { store } = fakeStore({
      "billableEvents/made": { status: "recorded_no_price", madeAtIso: "2026-11-20T00:05:00.000Z" },
      "billableEvents/made-retry": { status: "recorded_no_price", attempt: 1, madeAtIso: "2026-11-21T00:05:00.000Z" },
      "billableEvents/not-made": { status: "recorded_no_price" },
      "billableEvents/empty-made": { status: "recorded_no_price", madeAtIso: "" },
      "billableEvents/void": { status: "void" },
      "billableEvents/void-made": { status: "void", madeAtIso: "2026-11-20T00:05:00.000Z" },
    });
    expect(await countStandingBillableEvents(store)).toBe(2);
    expect(await tallyStandingBillableEvents(store)).toEqual({ made: 2, notMade: 2 });
  });
});

describe("the billable events CSV", () => {
  it("lists each event's ids, times and status, oldest first, with no site identity or price", async () => {
    const { store } = fakeStore({
      "billableEvents/introduction-b-c2": { kind: "introduction", requestId: "b", companyId: "c2", atIso: "2026-11-21T00:00:00.000Z",
        priceUsd: null, status: "void", siteName: "Never shown" },
      "billableEvents/introduction-a-c1": { kind: "introduction", requestId: "a", companyId: "c1", atIso: "2026-11-20T00:00:00.000Z",
        madeAtIso: "2026-11-20T00:05:00.000Z", priceUsd: null, status: "recorded_no_price" },
      // Recorded but not made: listed, with no made time, so staff can see it; never counted.
      "billableEvents/=cmd": { requestId: "+x", companyId: "c3", atIso: "2026-11-22T00:00:00.000Z", status: "recorded_no_price" },
    });
    const csv = await billableEventsCsv(store);
    expect(csv.split("\r\n")).toEqual([
      BILLABLE_EVENTS_CSV_HEADER.map(h => `"${h}"`).join(","),
      '"introduction-a-c1","a","c1","2026-11-20T00:00:00.000Z","2026-11-20T00:05:00.000Z","recorded_no_price"',
      '"introduction-b-c2","b","c2","2026-11-21T00:00:00.000Z","","void"',
      `"'=cmd","'+x","c3","2026-11-22T00:00:00.000Z","","recorded_no_price"`,
      "",
    ]);
    expect(csv).not.toMatch(/Never shown|price_usd|\$/);
  });
});
