// @vitest-environment node
/**
 * A robot team counts as supply only with all three agreements on record.
 *
 * The 2026-10-14 beta launch audit (L4, P0-7): before a site is told teams will
 * evaluate its job, a team must have agreed to run a policy on the supported
 * interface, to a free evaluation on a real job, and to take the pilot if it
 * passes. These tests pin that the agreement record, not the status word, is
 * what makes a team `engaged`, and that nothing a site or an operator reads
 * counts a prospect as supply.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { completeSupplyAgreement, syntheticAgreementEntry } from "./helpers/supply-agreement";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, authAdmin: null,
    default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
// The real admin gate runs; roles come from the fixture identity.
vi.mock("../utils/access-control", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/access-control")>()),
  hasAnyRole: vi.fn(async (res: { locals: { firebaseUser?: { roles?: string[] } } }, roles: string[]) =>
    roles.some((role) => (res.locals.firebaseUser?.roles ?? []).includes(role))),
}));

const {
  applySupplyAgreementTerms,
  effectiveTeamStatus,
  isWillingSupply,
  readSupplyAgreement,
  withdrawSupplyAgreement,
  SUPPORTED_SUPPLY_INTERFACE_ID,
} = await import("../utils/robotTeamSupply");
const { getRobotTeam, listMatchableRobotTeams, toMatchCandidate } = await import("../utils/robotTeamRegistry");
const { matchRobotTeam, summariseMatches } = await import("../../client/src/lib/robotMatch");
const { runSiteMatch, summariseForStorage } = await import("../utils/siteMatchRun");
const { projectWorkspaceTask } = await import("../utils/workspace-projection");
const router = (await import("../routes/admin-robot-teams")).default;
import type { RobotTeamRecord, SupplyAgreementTerm } from "../types/robot-team-registry";

const NOW = "2026-10-14T12:00:00.000Z";

function team(overrides: Partial<RobotTeamRecord> = {}): RobotTeamRecord {
  return { id: "team-a", name: "Team A", status: "prospect", capability: {}, fieldProvenance: {},
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", ...overrides };
}

const ALL_TERMS = [
  { term: "supportedInterface" as const, agreedOn: "2026-10-12", evidenceRef: "gmail-thread:18c2f0a1b2c3d4e5" },
  { term: "freeEvaluation" as const, agreedOn: "2026-10-12", evidenceRef: "gmail-thread:18c2f0a1b2c3d4e5" },
  { term: "pilotIfPassed" as const, agreedOn: "2026-10-13", evidenceRef: "signed-note:2026-10-13-team-a" },
];

/* --------------------------------------------------------------- the rule */

describe("the supply agreement", () => {
  it.each(["supportedInterface", "freeEvaluation", "pilotIfPassed"] as SupplyAgreementTerm[])(
    "is incomplete without %s, so the team is not engaged",
    (missing) => {
      const result = applySupplyAgreementTerms(team(), ALL_TERMS.filter((row) => row.term !== missing), "founder@example.test", NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.reading.complete).toBe(false);
      expect(result.reading.missing).toEqual([missing]);
      expect(result.record.status).toBe("prospect");
      expect(isWillingSupply(result.record)).toBe(false);
      expect(result.engagedNow).toBe(false);
    },
  );

  it("makes the team engaged when the third agreement lands, and records who and when", () => {
    const first = applySupplyAgreementTerms(team({ status: "applied" }), ALL_TERMS.slice(0, 2), "founder@example.test", NOW);
    if (!first.ok) throw new Error("first recording refused");
    expect(first.record.status).toBe("applied");
    const second = applySupplyAgreementTerms(first.record, ALL_TERMS.slice(2), "ops@example.test", "2026-10-14T13:00:00.000Z");
    if (!second.ok) throw new Error("second recording refused");
    expect(second.engagedNow).toBe(true);
    expect(second.record.status).toBe("engaged");
    expect(second.record.statusBeforeEngaged).toBe("applied");
    expect(isWillingSupply(second.record)).toBe(true);
    expect(second.record.supplyAgreement?.terms.supportedInterface).toMatchObject({
      agreedOn: "2026-10-12", evidenceRef: "gmail-thread:18c2f0a1b2c3d4e5", recordedBy: "founder@example.test",
      recordedAt: NOW, interfaceId: SUPPORTED_SUPPLY_INTERFACE_ID,
    });
    expect(second.record.supplyAgreement?.terms.pilotIfPassed?.recordedBy).toBe("ops@example.test");
  });

  it("refuses the whole submission when any agreement is malformed, and records nothing", () => {
    const cases: Array<[string, typeof ALL_TERMS[number]]> = [
      ["no date", { ...ALL_TERMS[0], agreedOn: "" }],
      ["an impossible date", { ...ALL_TERMS[0], agreedOn: "2026-02-30" }],
      ["a date after it was recorded", { ...ALL_TERMS[0], agreedOn: "2026-10-15" }],
      ["prose instead of a reference", { ...ALL_TERMS[0], evidenceRef: "they said yes on the call" }],
      ["an email address", { ...ALL_TERMS[0], evidenceRef: "mailto:someone@example.test" }],
    ];
    for (const [label, bad] of cases) {
      const result = applySupplyAgreementTerms(team(), [bad, ...ALL_TERMS.slice(1)], "founder@example.test", NOW);
      expect(result.ok, label).toBe(false);
    }
    const unsupported = applySupplyAgreementTerms(team(), [{ ...ALL_TERMS[0], interfaceId: "unitree_g1_v1" }, ...ALL_TERMS.slice(1)],
      "founder@example.test", NOW);
    expect(unsupported.ok).toBe(false);
    expect(applySupplyAgreementTerms(team(), ALL_TERMS, "", NOW).ok).toBe(false);
  });

  it("does not count an agreement to an interface the website no longer evaluates", () => {
    const agreement = completeSupplyAgreement();
    agreement.terms.supportedInterface = syntheticAgreementEntry({ interfaceId: "some_retired_interface_v0" });
    const record = team({ status: "engaged", supplyAgreement: agreement });
    expect(readSupplyAgreement(record).missing).toEqual(["supportedInterface"]);
    expect(isWillingSupply(record)).toBe(false);
  });

  it("reads a typed `engaged` with no agreement as what the team really is", () => {
    expect(effectiveTeamStatus(team({ status: "engaged" }))).toBe("prospect");
    expect(effectiveTeamStatus(team({ status: "engaged", registrationSource: "self_serve" }))).toBe("self_registered");
    expect(effectiveTeamStatus(team({ status: "engaged", statusBeforeEngaged: "applied" }))).toBe("applied");
    expect(isWillingSupply(team({ status: "engaged" }))).toBe(false);
    // A complete record behind the word is the only thing that keeps it.
    expect(effectiveTeamStatus(team({ status: "engaged", supplyAgreement: completeSupplyAgreement() }))).toBe("engaged");
    // A later decline wins over an old agreement.
    expect(isWillingSupply(team({ status: "declined", supplyAgreement: completeSupplyAgreement() }))).toBe(false);
  });

  it("returns a team that withdrew to its earlier status and keeps the history", () => {
    const engaged = applySupplyAgreementTerms(team({ status: "applied" }), ALL_TERMS, "founder@example.test", NOW);
    if (!engaged.ok) throw new Error("refused");
    const withdrawn = withdrawSupplyAgreement(engaged.record,
      { withdrawnOn: "2026-10-14", evidenceRef: "gmail-thread:18c2f0a1b2c3ffff" }, "founder@example.test", NOW);
    if (!withdrawn.ok) throw new Error(withdrawn.problem);
    expect(withdrawn.wasEngaged).toBe(true);
    expect(withdrawn.record.status).toBe("applied");
    expect(isWillingSupply(withdrawn.record)).toBe(false);
    expect(withdrawn.record.supplyAgreement?.history).toHaveLength(1);
    expect(readSupplyAgreement(withdrawn.record)).toMatchObject({ complete: false, withdrawnOn: "2026-10-14" });
    // Coming back needs all three again, not just the one that changed.
    const partial = applySupplyAgreementTerms(withdrawn.record, ALL_TERMS.slice(2), "founder@example.test", NOW);
    if (!partial.ok) throw new Error("refused");
    expect(partial.record.status).toBe("applied");
    expect(withdrawSupplyAgreement(team(), { withdrawnOn: "2026-10-14", evidenceRef: "signed-note:x-1" }, "founder@example.test", NOW).ok)
      .toBe(false);
  });
});

/* ------------------------------------------- nothing counts a prospect */

const siteSpec = { payloadWeight: "ten_to_twentyfive", humanProximity: "shared", budgetBand: "fifty_to_250k" };
const site = { serviceArea: "austin_metro", spec: siteSpec };
const clearsEverything = {
  capability: { payloadCapacity: "ten_to_twentyfive", humanProximity: "shared", budgetBand: "fifty_to_250k", deploymentGeography: "yes" },
  fieldProvenance: Object.fromEntries(["payloadCapacity", "humanProximity", "budgetBand", "deploymentGeography"].map((field) =>
    [field, { grade: "self_reported", source: "inboundRequest:fixture", observedAt: "2026-10-01T00:00:00.000Z" }])),
} as Pick<RobotTeamRecord, "capability" | "fieldProvenance">;

describe("matching and site-facing counts", () => {
  it("keeps a team whose robot fits but who agreed to nothing out of `supply`", () => {
    const prospect = team({ id: "fits-but-prospect", ...clearsEverything });
    const typedEngaged = team({ id: "typed-engaged", status: "engaged", ...clearsEverything });
    const willing = team({ id: "willing", status: "engaged", supplyAgreement: completeSupplyAgreement(), ...clearsEverything });
    const results = [prospect, typedEngaged, willing].map((row) => matchRobotTeam(site, toMatchCandidate(row)));
    expect(results.map((result) => result.outcome)).toEqual(["matched", "matched", "matched"]);
    const summary = summariseMatches(results);
    expect(summary.matched).toHaveLength(3);
    expect(summary.supply.map((result) => result.robotTeamId)).toEqual(["willing"]);
    // A candidate built without the registry is never supply.
    expect(matchRobotTeam(site, { id: "bare", capability: {} }).willingSupply).toBe(false);
  });

  it("stores the supply count for the site's workspace and never the fit count", () => {
    const record = summariseForStorage(summariseMatches([
      matchRobotTeam(site, toMatchCandidate(team({ id: "p1", ...clearsEverything }))),
      matchRobotTeam(site, toMatchCandidate(team({ id: "p2", ...clearsEverything }))),
    ]));
    expect(record).toMatchObject({ matchedCount: 2, supplyMatchedCount: 0, supplyMatchedTeamIds: [] });
    expect(projectWorkspaceTask("req1", { request: {}, site_match: record }).potentialMatches).toBe(0);
    // Older stored matches have no supply count: unknown, never the fit count.
    expect(projectWorkspaceTask("req1", { request: {}, site_match: { matchedCount: 3 } }).potentialMatches).toBeNull();
  });
});

describe("registry reads", () => {
  beforeEach(() => { state.docs.clear(); });

  it("never returns a stored `engaged` without its agreement as engaged", async () => {
    state.docs.set("robotTeams/typed", { ...team({ id: "typed", status: "engaged" }) } as never);
    state.docs.set("robotTeams/willing", { ...team({ id: "willing", status: "engaged", supplyAgreement: completeSupplyAgreement() }) } as never);
    expect((await getRobotTeam("typed"))?.status).toBe("prospect");
    expect((await getRobotTeam("willing"))?.status).toBe("engaged");
    const engagedOnly = await listMatchableRobotTeams({ statuses: ["engaged"] });
    expect(engagedOnly.map((row) => row.id)).toEqual(["willing"]);
  });

  it("runs the site match without counting prospects as supply", async () => {
    state.docs.set("robotTeams/p1", { ...team({ id: "p1", ...clearsEverything }) } as never);
    state.docs.set("robotTeams/typed", { ...team({ id: "typed", status: "engaged", ...clearsEverything }) } as never);
    const summary = await runSiteMatch({ requestId: "req1", request: { siteTaskSpec: siteSpec },
      site_task_triage: { disposition: "qualified" }, siteTaskGates: { serviceArea: "austin_metro" } } as never);
    expect(summary?.matched.length).toBeGreaterThan(0);
    expect(summary?.supply).toEqual([]);
  });
});

/* ------------------------------------------------------- the admin route */

describe("recording an agreement through the admin route", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    state.docs.clear();
    state.docs.set("robotTeams/team-a", { ...team({ status: "applied", contactEmail: "lead@team-a.test" }) } as never);
    const app = express(); app.use(express.json());
    app.use((req, res, next) => {
      const identity = req.headers["x-fixture-identity"];
      if (identity === "founder") res.locals.firebaseUser = { uid: "founder-uid", email: "founder@example.test", roles: ["admin"] };
      if (identity === "site") res.locals.firebaseUser = { uid: "site-uid", email: "site@example.test", roles: [] };
      next();
    });
    app.use(router);
    server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

  const post = (path: string, body: unknown, identity = "founder") => fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", "x-fixture-identity": identity }, body: JSON.stringify(body) });
  const stored = () => state.docs.get("robotTeams/team-a") as unknown as RobotTeamRecord;

  it("is refused to anyone without an admin or ops role", async () => {
    expect((await post("/team-a/supply-agreement", { terms: ALL_TERMS, evidenceHeld: true }, "site")).status).toBe(403);
    expect((await post("/team-a/supply-agreement", { terms: ALL_TERMS, evidenceHeld: true }, "none")).status).toBe(401);
    expect(stored().status).toBe("applied");
    expect(stored().supplyAgreement).toBeUndefined();
  });

  it("takes the recorder from the session, never from the body", async () => {
    const forged = await post("/team-a/supply-agreement", { terms: [{ ...ALL_TERMS[0], recordedBy: "someone-else" }], evidenceHeld: true });
    expect(forged.status).toBe(400);
    expect(stored().supplyAgreement).toBeUndefined();
  });

  it("keeps the team applied until all three are recorded, then engages it and logs each recording", async () => {
    const partial = await post("/team-a/supply-agreement", { terms: ALL_TERMS.slice(0, 2), evidenceHeld: true });
    expect(partial.status).toBe(200);
    expect(await partial.json()).toMatchObject({ status: "applied", willingSupply: false, missingAgreements: ["pilotIfPassed"], engagedNow: false });
    expect(stored().status).toBe("applied");

    const bad = await post("/team-a/supply-agreement", { terms: [{ ...ALL_TERMS[2], evidenceRef: "yes they agreed" }], evidenceHeld: true });
    expect(bad.status).toBe(400);
    expect(stored().status).toBe("applied");

    const complete = await post("/team-a/supply-agreement", { terms: ALL_TERMS.slice(2), evidenceHeld: true });
    expect(await complete.json()).toMatchObject({ status: "engaged", willingSupply: true, missingAgreements: [], engagedNow: true });
    expect(stored()).toMatchObject({ status: "engaged", statusBeforeEngaged: "applied" });
    expect(stored().supplyAgreement?.terms.pilotIfPassed?.recordedBy).toBe("founder@example.test");
    const events = [...state.docs.keys()].filter((key) => key.startsWith("robotTeams/team-a/supplyAgreementEvents/"));
    expect(events).toHaveLength(2);

    const listed = await (await fetch(`${base}/`, { headers: { "x-fixture-identity": "founder" } })).json();
    expect(listed.supplyCount).toBe(1);
    expect(listed.teams[0]).toMatchObject({ id: "team-a", status: "engaged", supply: { willingSupply: true } });

    const withdrawn = await post("/team-a/supply-agreement/withdraw",
      { withdrawnOn: "2026-10-14", evidenceRef: "gmail-thread:18c2f0a1b2c3ffff", evidenceHeld: true });
    expect(await withdrawn.json()).toMatchObject({ status: "applied", willingSupply: false, wasEngaged: true });
    const relisted = await (await fetch(`${base}/`, { headers: { "x-fixture-identity": "founder" } })).json();
    expect(relisted.supplyCount).toBe(0);
  });

  it("shows an operator which agreements are missing and why", async () => {
    await post("/team-a/supply-agreement", { terms: ALL_TERMS.slice(1, 2), evidenceHeld: true });
    const view = await (await fetch(`${base}/team-a/supply-agreement`, { headers: { "x-fixture-identity": "founder" } })).json();
    expect(view).toMatchObject({ teamId: "team-a", status: "applied", willingSupply: false,
      missingAgreements: ["supportedInterface", "pilotIfPassed"], supportedInterfaceId: SUPPORTED_SUPPLY_INTERFACE_ID });
    expect(view.terms.find((row: { term: string }) => row.term === "freeEvaluation").recorded).toMatchObject({ evidenceRef: ALL_TERMS[1].evidenceRef });
  });
});
