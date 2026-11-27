// @vitest-environment node
/**
 * The owner's outreach log on the research record (outreach playbook fix 8).
 *
 * Pins three things: only an admin reads or writes it; a change is validated
 * and an opt-out is never removed; and the log never leaves the admin routes:
 * no registry read, match candidate, robot-fit ranking or registry list
 * carries it, and recording a contact never changes a record's status.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, authAdmin: null,
    default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/access-control", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/access-control")>()),
  hasAnyRole: vi.fn(async (res: { locals: { firebaseUser?: { roles?: string[] } } }, roles: string[]) =>
    roles.some((role) => (res.locals.firebaseUser?.roles ?? []).includes(role))),
}));

const { getRobotTeam, listMatchableRobotTeams, toMatchCandidate, recordEvaluationOutcome } = await import("../utils/robotTeamRegistry");
const { rankingCandidates } = await import("../utils/siteRobotFit");
const { applyOutreachChange, outreachFlags } = await import("../utils/robotTeamOutreach");
const router = (await import("../routes/admin-robot-teams")).default;
import type { RobotTeamRecord } from "../types/robot-team-registry";

function team(overrides: Partial<RobotTeamRecord> = {}): RobotTeamRecord {
  return { id: "team-a", name: "Team A", status: "prospect", capability: {}, fieldProvenance: {},
    capabilityDescription: "Mobile manipulators for light assembly.", website: "https://team-a.test",
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z", ...overrides };
}

let server: Server; let base: string;
beforeEach(async () => {
  state.docs.clear();
  state.docs.set("robotTeams/team-a", team() as never);
  state.docs.set("robotTeams/team-b", team({ id: "team-b", name: "Team B", status: "self_registered" }) as never);
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    const identity = req.headers["x-fixture-identity"];
    if (identity === "founder") res.locals.firebaseUser = { uid: "founder-uid", email: "founder@example.test", roles: ["admin"] };
    if (identity === "company") res.locals.firebaseUser = { uid: "company-uid", email: "lead@team-b.test", roles: [] };
    next();
  });
  app.use(router);
  server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

const post = (path: string, body: unknown, identity = "founder") => fetch(`${base}${path}`, {
  method: "POST", headers: { "content-type": "application/json", "x-fixture-identity": identity }, body: JSON.stringify(body) });
const get = (path: string, identity = "founder") => fetch(`${base}${path}`, { headers: { "x-fixture-identity": identity } });
const stored = (id = "team-a") => state.docs.get(`robotTeams/${id}`) as unknown as RobotTeamRecord;
const FIRST = { contactedOn: "2026-12-01", channel: "email", messageVersion: "company-first.v1", goAheadEntryOn: "2026-11-30",
  answer: "no_reply_yet", nextStep: "One follow-up", nextStepOn: "2026-12-08" };

describe("who may read and write the outreach log", () => {
  it("is refused to a signed-in company or site and to a signed-out caller, and writes nothing", async () => {
    for (const identity of ["company", "none"]) {
      const expected = identity === "none" ? 401 : 403;
      expect((await post("/team-a/outreach", FIRST, identity)).status).toBe(expected);
      expect((await get("/team-a/outreach", identity)).status).toBe(expected);
      expect((await get("/outreach", identity)).status).toBe(expected);
    }
    expect(stored().outreach).toBeUndefined();
    expect([...state.docs.keys()].filter((key) => key.includes("/outreachEvents/"))).toEqual([]);
  });

  it("records an admin's change with the operator named, keeps an event, and leaves status and updatedAt alone", async () => {
    const response = await post("/team-a/outreach", { ...FIRST, recordedBy: "someone-else" });
    expect(response.status).toBe(400); // recordedBy comes from the session, never the body
    const ok = await post("/team-a/outreach", FIRST);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(stored().outreach).toMatchObject({ ...FIRST, doNotContact: false, doNotContactSince: null,
      recordedBy: "founder@example.test", schemaVersion: "robot_team_outreach.v1" });
    expect(stored().status).toBe("prospect");
    expect(stored().updatedAt).toBe("2026-10-02T00:00:00.000Z");
    const events = [...state.docs.entries()].filter(([key]) => key.startsWith("robotTeams/team-a/outreachEvents/"));
    expect(events).toHaveLength(1);
    expect(events[0][1]).toMatchObject({ before: null, recordedBy: "founder@example.test" });

    const view = await (await get("/team-a/outreach")).json();
    expect(view.row).toMatchObject({ teamId: "team-a", status: "prospect", flags: [] });
    const list = await (await get("/outreach")).json();
    expect(list).toMatchObject({ ok: true, contacted: 1, doNotContact: 0 });
    expect(list.rows.map((row: { teamId: string }) => row.teamId)).toEqual(["team-a", "team-b"]);
    // A row carries identity, log and flags only: no contact email, capability or description.
    expect(Object.keys(list.rows[0]).sort()).toEqual(["flags", "name", "outreach", "status", "teamId", "website"]);
  });

  it("answers 404 for an unknown record", async () => {
    expect((await post("/nobody/outreach", FIRST)).status).toBe(404);
    expect((await get("/nobody/outreach")).status).toBe(404);
  });
});

describe("what a change may say", () => {
  it("refuses unknown fields, bad dates, unknown channels or answers and message text, with field errors", async () => {
    for (const body of [{ contactedOn: "1 Dec" }, { contactedOn: "2026-02-30" }, { channel: "carrier pigeon" }, { answer: "maybe" },
      { messageVersion: "Hello, I work on Blueprint and" }, { note: "free text" }, { nextStep: "x".repeat(201) }, { doNotContact: "yes" }]) {
      const response = await post("/team-a/outreach", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect((await response.json()).code).toBe("outreach_invalid");
    }
    expect(stored().outreach).toBeUndefined();
  });

  it("changes only the fields named, and clears a field sent as null", async () => {
    await post("/team-a/outreach", FIRST);
    await post("/team-a/outreach", { answer: "applied", nextStep: null, nextStepOn: null });
    expect(stored().outreach).toMatchObject({ contactedOn: "2026-12-01", messageVersion: "company-first.v1", answer: "applied",
      nextStep: null, nextStepOn: null });
    expect(stored().status).toBe("prospect"); // an application is recorded elsewhere; this never makes a relationship
  });

  it("sets do not contact when they ask to stop, keeps it, and refuses to remove it", async () => {
    await post("/team-a/outreach", FIRST);
    const stop = await post("/team-a/outreach", { answer: "asked_to_stop" });
    expect(stop.status).toBe(200);
    expect(stored().outreach).toMatchObject({ doNotContact: true });
    expect(stored().outreach?.doNotContactSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const since = stored().outreach?.doNotContactSince;
    const undo = await post("/team-a/outreach", { doNotContact: false });
    expect(undo.status).toBe(400);
    expect((await undo.json()).error).toContain("never removed");
    await post("/team-a/outreach", { answer: "replied" });
    expect(stored().outreach).toMatchObject({ doNotContact: true, doNotContactSince: since, answer: "replied" });
    const list = await (await get("/outreach")).json();
    expect(list.doNotContact).toBe(1);
  });

  it("flags a contact with no go-ahead date or message version, and one after do not contact, without refusing it", () => {
    const at = "2026-12-02T10:00:00.000Z";
    const bare = applyOutreachChange(null, { contactedOn: "2026-12-01" }, "ops", at);
    if (!bare.ok) throw new Error("refused");
    expect(outreachFlags(bare.outreach)).toEqual(["no_go_ahead_date", "no_message_version"]);
    const stopped = applyOutreachChange(null, { doNotContact: true, doNotContactSince: "2026-11-20" }, "ops", at);
    if (!stopped.ok) throw new Error("refused");
    const after = applyOutreachChange(stopped.outreach, { ...FIRST, channel: "email", answer: "no_reply_yet" } as never, "ops", at);
    if (!after.ok) throw new Error("refused");
    expect(outreachFlags(after.outreach)).toEqual(["contacted_after_do_not_contact"]);
    expect(outreachFlags(null)).toEqual([]);
  });
});

describe("the log never leaves the admin routes", () => {
  beforeEach(async () => { await post("/team-a/outreach", { ...FIRST, answer: "asked_to_stop" }); });

  it("is not in a registry read, a match candidate, a robot-fit ranking candidate or the registry list", async () => {
    expect(stored().outreach).toBeTruthy();
    const read = await getRobotTeam("team-a");
    expect(read).not.toHaveProperty("outreach");
    const listed = await listMatchableRobotTeams();
    expect(listed.map((row) => row.id)).toEqual(["team-a"]);
    expect(listed[0]).not.toHaveProperty("outreach");
    const serialized = JSON.stringify([toMatchCandidate(listed[0]), toMatchCandidate(listed[0], { quotableOnly: false }), rankingCandidates(listed)]);
    for (const marker of ["company-first.v1", "asked_to_stop", "One follow-up", "doNotContact", "outreach"]) expect(serialized).not.toContain(marker);
    const registryList = await (await get("/")).text();
    for (const marker of ["company-first.v1", "asked_to_stop", "One follow-up", "\"outreach\""]) expect(registryList).not.toContain(marker);
    const supply = await (await get("/team-a/supply-agreement")).text();
    expect(supply).not.toContain("company-first.v1");
  });

  it("survives a registry write made from a read that left it out", async () => {
    await recordEvaluationOutcome({ robotTeamId: "team-a", runId: "run-1", demonstratedSuccessRate: "80_95", observedAt: "2026-12-03T00:00:00.000Z" });
    expect(stored().outreach).toMatchObject({ messageVersion: "company-first.v1", doNotContact: true });
  });
});
