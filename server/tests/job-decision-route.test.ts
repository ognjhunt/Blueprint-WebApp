// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } };
});
vi.mock("../middleware/requireAdminRole", () => ({ requireAdminRole: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail }));
const router = (await import("../routes/admin-robot-teams")).default;
const listingRouter = (await import("../routes/task-listings")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

describe("recording Blueprint's reviewed job decision", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    state.docs.clear(); sendEmail.mockReset();
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "owner@example.test" } } as never);
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { if (req.headers["x-fixture-reviewer"]) res.locals.firebaseUser = { uid: "synthetic-reviewer" }; next(); });
    app.use(router); app.use(listingRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve())); });

  it("keeps private decision bases outside admin/owner responses and retains the reviewed clarification", async () => {
    const advisory = await import("../utils/siteAssessmentPublic");
    const { siteJobDecisionSourceDigest } = await import("../utils/siteJobDecision");
    const safe = { schemaVersion: "site_customer_advisory.v1" as const, state: "ready" as const, correlationId: "synthetic-correlation",
      sections: [], unknowns: ["Force remains unknown"], nextAction: "Measure pull force" };
    const privateBasis = { ...safe, nextAction: "Internal rationale test paragraph", sections: [{ title: "Internal analysis test paragraph", claims: [] }],
      decisionEvidence: { schemaVersion: "site_decision_evidence.v1" as const, packetSha256: "a".repeat(64), qualificationSha256: "b".repeat(64) } };
    const load = vi.spyOn(advisory, "loadCurrentSiteAssessmentView").mockResolvedValue({ customerAdvisory: safe, decisionAssessment: privateBasis,
      compatibleDecisionAssessments: [safe] });
    const brief = { requestId: "req1", summary: "Open rack", unresolved: [], proposed: [], operatorAnswers: {}, operatorUnknown: [] };
    state.docs.set("siteTaskBriefs/req1", brief);
    const record = state.docs.get("inboundRequests/req1")!;
    record.customer_decision = { schemaVersion: "site_job_decision.v1", sourceDigest: siteJobDecisionSourceDigest(record, brief, privateBasis),
      reviewedBy: "synthetic-reviewer", reviewedAtIso: "2026-09-02T00:00:00Z", recommendation: "Obtain force measurements", why: "Force remains unknown",
      decisiveUncertainty: "Force", nextAction: "Measure pull force", question: { text: "Which final state is required?", reason: "Defines success" } };
    const admin = await (await fetch(`${base}/recommendations/req1`)).json();
    expect(admin.assessment).toEqual(safe); expect(admin.decision.nextAction).toBe("Measure pull force");
    expect(JSON.stringify(admin)).not.toMatch(/Internal analysis test paragraph|Internal rationale test paragraph|compatibleDecisionAssessments|decisionAssessment|decisionEvidence|packetSha256|qualificationSha256/);
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    const owner = await (await fetch(`${base}/owner/${token}`)).json();
    // The owner card route no longer carries the decision or any pilot booking state.
    expect(owner).not.toHaveProperty("decision");
    expect(owner).not.toHaveProperty("recommendation");
    expect(owner).not.toHaveProperty("pilotBooking");
    expect(JSON.stringify(owner)).not.toMatch(/Internal analysis test paragraph|Internal rationale test paragraph|compatibleDecisionAssessments|decisionAssessment|decisionEvidence|packetSha256|qualificationSha256/);
    const clarification = await (await import("../utils/siteTaskClarifications")).readSiteClarification("req1");
    expect(clarification).toMatchObject({ needed: true, questions: ["Which final state is required? — Defines success"] });
    expect(JSON.stringify(clarification)).not.toContain("Internal");
    load.mockRestore();
  });

  it("requires the primary current evidence digest for new named writes, rejecting a stale basics admin view", async () => {
    const advisory = await import("../utils/siteAssessmentPublic");
    const { siteJobDecisionSourceDigest } = await import("../utils/siteJobDecision");
    const safe = { schemaVersion: "site_customer_advisory.v1" as const, state: "ready" as const, correlationId: "synthetic-correlation",
      sections: [], unknowns: [], nextAction: "Measure pull force" };
    const primary = { ...safe, nextAction: "Internal source basis" };
    vi.spyOn(advisory, "loadCurrentSiteAssessmentView").mockResolvedValue({ customerAdvisory: safe, decisionAssessment: primary, compatibleDecisionAssessments: [safe] });
    const record = state.docs.get("inboundRequests/req1")!;
    const input = { recommendation: "Obtain force measurements", why: "Force remains unknown", decisiveUncertainty: "Force", nextAction: "Measure pull force", question: null };
    const decision = (sourceDigest: string) => fetch(`${base}/recommendations/req1/decision`, { method: "POST", headers: { "content-type": "application/json", "x-fixture-reviewer": "yes" }, body: JSON.stringify({ ...input, sourceDigest }) });
    expect((await decision(siteJobDecisionSourceDigest(record, null, safe))).status).toBe(409);
    expect(record.customer_decision).toBeUndefined();
    const digest = siteJobDecisionSourceDigest(record, null, primary);
    expect((await decision(digest)).status).toBe(200);
    expect(state.docs.get("inboundRequests/req1")?.customer_decision).toMatchObject({ sourceDigest: digest, reviewedBy: "synthetic-reviewer", ...input });
  });

  it("no longer records, books, reconciles or schedules a recommended pilot", async () => {
    const post = (path: string) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-fixture-reviewer": "yes" }, body: JSON.stringify({ recommendationId: "rec_1", authorized: true }) });
    for (const path of ["/recommendations/req1", "/recommendations/req1/reconcile", "/recommendations/req1/coordination"]) expect((await post(path)).status).toBe(404);
    expect((await fetch(`${base}/jobs/req1/evaluations`)).status).toBe(404);
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    expect((await post(`/owner/${token}/book`)).status).toBe(404);
    expect(state.docs.get("inboundRequests/req1")).not.toHaveProperty("pilot_recommendation");
    expect(state.docs.get("inboundRequests/req1")).not.toHaveProperty("pilot_booking");
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
