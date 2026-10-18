// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { syntheticSiteTaskQualification, syntheticEpisodeOutcomes } from "./helpers/recommendation-evidence";
import { completeSupplyAgreement, syntheticRobotEmbodiment, syntheticSupplyExecutionAdmission } from "./helpers/supply-agreement";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } };
});
vi.mock("../middleware/requireAdminRole", () => ({ requireAdminRole: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const enqueue = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/taskLifecycleNotifications", async importOriginal => ({ ...(await importOriginal<typeof import("../utils/taskLifecycleNotifications")>()), enqueueTaskLifecycleNotification: enqueue }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail }));
const calendar = vi.hoisted(() => vi.fn(async (calendarEventId: string) => ({ calendarEventId, calendarId: "fixture",
  startsAt: "2026-11-10T15:00:00.000Z", endsAt: "2026-11-10T17:00:00.000Z" })));
vi.mock("../utils/google-calendar", () => ({ readPilotCalendarEvent: calendar }));
const slack = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", async importOriginal => ({ ...(await importOriginal<typeof import("../utils/slack")>()), sendSlackMessage: slack }));
const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
const router = (await import("../routes/admin-robot-teams")).default;
const listingRouter = (await import("../routes/task-listings")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
const { withdrawSupplyAgreement } = await import("../utils/robotTeamSupply");
const plan = {
  evaluationRunId: "run_pass",
  purpose: "Test carton palletizing at line 3", siteProvides: "One escort", teamProvides: "Robot and operation",
  pilotCost: "$18,000", window: "November",
};
/** A completed, passing qualified simulation evaluation of req1 by the engaged team. */
function evaluationRun(overrides: Record<string, unknown> = {}, observed: Record<string, unknown> = {}) {
  const runId = String(overrides.runId ?? "run_pass");
  const teamId = String(overrides.teamId ?? "engaged");
  const sceneId = String(overrides.sceneId ?? "req1");
  return { runId, reservationId: `free_${runId}`, teamId, checkpointId: "ckpt_engaged", sceneId, taskFamily: "palletizing",
    evaluationPurpose: "pilot", quotedUsd: 0, quotedEpisodes: 200, state: "completed", episodesRun: 200, moneyResolved: true,
    requestedAtIso: "2026-10-01T00:00:00.000Z", resolvedAtIso: null, note: null,
    executionAdmission: syntheticSupplyExecutionAdmission(), executionCaptureId: "walkthrough-req1",
    result: { evidenceScope: "simulation", episodeOutcomes: syntheticEpisodeOutcomes(Number(observed.episodesRun ?? 200), Number(observed.episodesSucceeded ?? 190)), confidencePolicyVersion: "wilson95-success-bands.v2", runId, teamId, checkpointId: "ckpt_engaged", sceneId,
      // What the Pipeline states for a team's scored evaluation (runResultScoring.ts).
      scoring: { schemaVersion: "blueprint.agent_run_result_scoring.v1", runtime: "team_evaluation_scored",
        successSource: "simulator_scored", scoredEpisodeCount: Number(observed.episodesRun ?? 200),
        successContractDigest: `sha256:${"1".repeat(64)}`, sceneRevisionDigest: `sha256:${"2".repeat(64)}`,
        robotFreeProbeReceiptDigest: `sha256:${"3".repeat(64)}`, teamCandidateAdmissionDigest: `sha256:${"4".repeat(64)}`,
        sessionResultDigest: `sha256:${"5".repeat(64)}`, claimCeiling: "site_task_simulation", siteTaskQualification: syntheticSiteTaskQualification("walkthrough-req1") },
      observed: { episodesRun: 200, episodesSucceeded: 190, successRate: 0.95, medianCycleSeconds: 12, ...observed },
      claimed: { demonstratedSuccessRate: null, cycleTime: "under_30s" }, note: null, artifactUri: null, reportedAtIso: "2026-10-02T00:00:00.000Z" },
    ...overrides };
}
/** Site-facing outbox rows; the recommended team's notices are asserted separately. */
const isSiteOutboxKey = (key: string) => key.startsWith("captureOutbox/") && !key.includes(":team_pilot_");
const siteSends = () => sendEmail.mock.calls.filter(([message]) => (message as { to?: string }).to !== "team@example.test");

describe("recording Blueprint's recommended pilot", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    state.docs.clear(); sendEmail.mockReset(); sendEmail.mockResolvedValue({ sent: true, provider: "fixture", messageId: "fixture-receipt" }); enqueue.mockReset(); enqueue.mockResolvedValue({ enqueued: true });
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "owner@example.test" } } as never);
    state.docs.set("robotTeams/engaged", { id: "engaged", name: "Acme Robotics", status: "engaged", contactEmail: "team@example.test",
      supplyAgreement: completeSupplyAgreement() } as never);
    state.docs.set("robotTeams/prospect", { id: "prospect", name: "Unknown Co", status: "prospect" } as never);
    state.docs.set(`robotTeamAccess/${accessRecordId("team@example.test")}`, { status: "approved" });
    state.docs.set("evaluationRuns/run_pass", evaluationRun() as never);
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { if (req.headers["x-fixture-reviewer"]) res.locals.firebaseUser = { uid: "synthetic-reviewer" }; next(); });
    app.use(router); app.use(listingRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const post = (body: unknown) => fetch(`${base}/recommendations/req1`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const doc = () => state.docs.get("inboundRequests/req1") as { pilot_recommendation?: { teamName: string; teamId: string } };

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
    expect(owner.decision.question.text).toBe("Which final state is required?");
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

  it("names only a registered team we have talked to, by its registry name", async () => {
    expect((await post({ ...plan, teamId: "missing" })).status).toBe(400);
    expect((await post({ ...plan, teamId: "prospect" })).status).toBe(400);
    expect((await post({ ...plan, teamName: "Typed Name", teamId: "engaged" })).status).toBe(400);
    expect(doc().pilot_recommendation).toBeUndefined();

    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(doc().pilot_recommendation).toMatchObject({ teamId: "engaged", teamName: "Acme Robotics" });
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/req1:pilot_recommended:"))).toHaveLength(1);
  });

  it.each(["humanoid", "wheeled_humanoid", "mobile_manipulator"] as const)("recommends a passing %s evaluation with the team's agreement to that exact setup", async form => {
    const robotEmbodiment = syntheticRobotEmbodiment(form);
    state.docs.set("robotTeams/engaged", { ...state.docs.get("robotTeams/engaged"),
      supplyAgreement: completeSupplyAgreement({ interfaceId: "blueprint_policy_https.v1", robotEmbodiment }) } as never);
    state.docs.set("evaluationRuns/run_pass", evaluationRun({ executionAdmission: syntheticSupplyExecutionAdmission("blueprint_policy_https.v1", robotEmbodiment) }) as never);
    expect((await post(plan)).status).toBe(200);
    expect(doc().pilot_recommendation).toMatchObject({ teamId: "engaged" });
  });

  it("refuses using a DROID agreement for an own-robot run, a different declared setup, or missing execution binding", async () => {
    const robotEmbodiment = syntheticRobotEmbodiment();
    const ownAdmission = syntheticSupplyExecutionAdmission("blueprint_policy_https.v1", robotEmbodiment);
    const refused = async (executionAdmission: unknown, code = "team_supply_interface_mismatch") => {
      state.docs.set("evaluationRuns/run_pass", evaluationRun({ executionAdmission }) as never);
      const response = await post(plan);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code });
      expect(doc().pilot_recommendation).toBeUndefined();
    };
    await refused(ownAdmission);
    await refused(undefined, "evaluation_scene_not_qualified");
    state.docs.set("robotTeams/engaged", { ...state.docs.get("robotTeams/engaged"),
      supplyAgreement: completeSupplyAgreement({ interfaceId: "blueprint_policy_https.v1", robotEmbodiment }) } as never);
    await refused(syntheticSupplyExecutionAdmission());
    await refused(syntheticSupplyExecutionAdmission("blueprint_policy_https.v1",
      { ...robotEmbodiment, model: { ...robotEmbodiment.model, sha256: `sha256:${"8".repeat(64)}` } }));
    const listed = await (await fetch(`${base}/jobs/req1/evaluations`)).json();
    expect(listed.evaluations[0]).toMatchObject({ recommendable: false, teamRefusal: { code: "team_supply_interface_mismatch" } });
  });

  it("rechecks the agreement inside the recommendation transaction after a withdrawal", async () => {
    const runTransaction = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => {
      const withdrawn = withdrawSupplyAgreement(state.docs.get("robotTeams/engaged") as never,
        { withdrawnOn: "2026-10-14", evidenceRef: "signed-note:withdrawal-during-review" }, "operator", "2026-10-16T00:00:00.000Z");
      if (!withdrawn.ok) throw new Error(withdrawn.problem);
      state.docs.set("robotTeams/engaged", withdrawn.record as never);
      return runTransaction(callback);
    });
    const response = await post(plan);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "team_supply_agreement_missing" });
    expect(doc().pilot_recommendation).toBeUndefined();
  });

  it("does not replace a booked pilot", async () => {
    state.docs.set("inboundRequests/req1", { requestId: "req1", pilot_booking: { recommendationId: "rec_1" } } as never);
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(409);
    expect(doc().pilot_recommendation).toBeUndefined();
  });

  it("refuses stale owner booking after recommendations are replaced in the same millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const first = await post({ ...plan, teamId: "engaged" });
    expect(first.status).toBe(200);
    const previous = await first.json() as { id: string };
    const replacement = await post({ ...plan, pilotCost: "$24,000", window: "December", teamId: "engaged" });
    expect(replacement.status).toBe(200);
    const current = await replacement.json() as { id: string };
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    const book = (recommendationId: string) => fetch(`${base}/owner/${token}/book`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recommendationId, authorized: true }),
    });

    expect((await book(previous.id)).status).toBe(409);
    expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toBeUndefined();
    expect(current.id).not.toBe(previous.id);
    expect((await book(current.id)).status).toBe(200);
    expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toMatchObject({ recommendationId: current.id, amountUsd: 0 });
  });

  it("keeps an exact durable notification even when post-commit enqueue is unavailable", async () => {
    enqueue.mockRejectedValueOnce(new Error("queue unavailable") as never);
    const response = await post({ ...plan, teamId: "engaged" });
    expect(response.status).toBe(200);
    const { id } = await response.json() as { id: string };
    const intents = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/req1:pilot_recommended:"));
    expect(intents).toHaveLength(1);
    expect(intents[0][0]).toContain(id);
    expect(intents[0][1]).toMatchObject({ to: "owner@example.test", kind: "pilot_recommended", status: "pending" });
  });

  it("reuses the current recommendation and intent on an identical request retry", async () => {
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(first.id);
    expect([...state.docs.keys()].filter(key => isSiteOutboxKey(key) && key.split("/").length === 2)).toHaveLength(1);
  });


  it("rolls back the recommendation when atomic notification creation fails", async () => {
    const run = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => callback({ ...tx,
      create: () => { throw new Error("outbox write unavailable"); },
    })));
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(503);
    expect(doc().pilot_recommendation).toBeUndefined();
    expect([...state.docs.keys()].filter(key => isSiteOutboxKey(key) && key.split("/").length === 2)).toHaveLength(0);
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
  });

  it("reads before writes and reuses exact durable bytes across transaction callback retries", async () => {
    const run = store.runTransaction.bind(store);
    const proposals: unknown[] = [];
    const intents: unknown[] = [];
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => {
      for (const commit of [false, true]) {
        let wrote = false;
        const result = await callback({ ...tx,
          get: async ref => {
            if (wrote) throw new Error("Firestore requires all reads before writes");
            return tx.get(ref);
          },
          update: (ref, value) => { wrote = true; proposals.push(value); if (commit) tx.update(ref, value); },
          create: (ref, value) => { wrote = true; intents.push(value); if (commit) tx.create(ref, value); },
        });
        if (commit) return result;
      }
      throw new Error("unreachable");
    }));
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toEqual(proposals[1]);
    // The site's notice and the recommended team's notice, once per callback run.
    expect(intents).toHaveLength(4);
    expect(intents[0]).toEqual(intents[2]);
    expect(intents[1]).toEqual(intents[3]);
  });

  it("requires a usable recipient before committing and binds authorized retries to a changed recipient", async () => {
    state.docs.set("inboundRequests/req1", { requestId: "req1" });
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(409);
    expect(doc().pilot_recommendation).toBeUndefined();
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "first@example.test" } });
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "second@example.test" } });
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(first.id);
    const intents = [...state.docs.entries()].filter(([key]) => isSiteOutboxKey(key));
    expect(intents).toHaveLength(2);
    expect(new Set(intents.map(([, value]) => value.to))).toEqual(new Set(["first@example.test", "second@example.test"]));
  });


  it("does not reset delivery history when an acknowledged recommendation is retried", async () => {
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const [key, intent] = [...state.docs.entries()].find(([key]) => isSiteOutboxKey(key))!;
    const sent = { ...intent, status: "sent", attempts: 1, sentAtIso: "2026-10-07T00:00:00Z" };
    state.docs.set(key, sent);
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(first.id);
    expect(state.docs.get(key)).toEqual(sent);
  });


  it("recovers committed notifications through the real pump and suppresses a superseded recommendation", async () => {
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const second = await (await post({ ...plan, purpose: "Test a different exact task", teamId: "engaged" })).json() as { id: string };
    // Simulate a process boundary: only persisted store bytes reach the pump.
    // It uses the real source guard and a no-send provider stub.
    await deliverOutbox();
    const rows = [...state.docs.entries()].filter(([key]) => isSiteOutboxKey(key));
    expect(rows.find(([key]) => key.includes(first.id))?.[1]).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(rows.find(([key]) => key.includes(second.id))?.[1]).toMatchObject({ status: "sent", attempts: 1 });
    expect(siteSends()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.test", text: expect.stringContaining("different exact task") }));
  });

  it("never sends a retained old-recipient intent after the authoritative contact changes", async () => {
    await post({ ...plan, teamId: "engaged" });
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "updated@example.test" } });
    await post({ ...plan, teamId: "engaged" });
    await deliverOutbox();
    expect(siteSends()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "updated@example.test" }));
    const rows = [...state.docs.entries()].filter(([key]) => isSiteOutboxKey(key));
    expect(rows.find(([, row]) => row.to === "owner@example.test")?.[1]).toMatchObject({ status: "cancelled", attempts: 0 });
  });


  async function seedLegacyIntent(status: string) {
    const { id } = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const [key, intent] = [...state.docs.entries()].find(([key]) => isSiteOutboxKey(key))!;
    state.docs.delete(key);
    const legacyKey = `req1:pilot_recommended:${id}`;
    const legacy = { ...intent, idempotencyKey: legacyKey, status,
      attempts: status === "pending" || status === "claimed" ? 0 : 1,
      deliveryLeaseUntilMs: Date.now() + 600000, deliveryToken: "legacy-claim-token" };
    state.docs.set(`captureOutbox/${legacyKey}`, legacy);
    return { id, path: `captureOutbox/${legacyKey}`, legacy };
  }

  it.each(["pending", "sent", "unknown", "claimed", "dispatching", "cancelled"])(
    "reuses historical %s recommendation intent without creating a second email",
    async status => {
      const historical = await seedLegacyIntent(status);
      const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
      expect(retry.id).toBe(historical.id);
      expect([...state.docs.keys()].filter(key => isSiteOutboxKey(key) && key.split("/").length === 2)).toHaveLength(1);
      expect(state.docs.get(historical.path)).toEqual(historical.legacy);
      await deliverOutbox();
      expect(siteSends()).toHaveLength(status === "pending" ? 1 : 0);
    },
  );

  it("creates a current-recipient intent while cancelling a historical different-recipient intent", async () => {
    const historical = await seedLegacyIntent("pending");
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "updated@example.test" } });
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(historical.id);
    await deliverOutbox();
    expect(siteSends()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "updated@example.test" }));
    expect(state.docs.get(historical.path)).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("rearms only a zero-attempt cancelled intent when an explicit retry restores its current recipient", async () => {
    await post({ ...plan, teamId: "engaged" });
    const [key] = [...state.docs.entries()].find(([key]) => isSiteOutboxKey(key))!;
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "temporary@example.test" } });
    await deliverOutbox();
    expect(state.docs.get(key)).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(siteSends()).toHaveLength(0);
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "owner@example.test" } });
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(state.docs.get(key)).toMatchObject({ status: "pending", attempts: 0 });
    await deliverOutbox();
    expect(siteSends()).toHaveLength(1);
  });


  it("reserves the old writer's key when repairing its committed recommendation before delayed enqueue", async () => {
    const { id } = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const [savedKey, savedIntent] = [...state.docs.entries()].find(([key]) => isSiteOutboxKey(key))!;
    // The old handler has committed this exact recommendation but is paused
    // before its separate enqueue. Keep only that committed source state.
    state.docs.delete(savedKey);
    let resumeOldWriter!: () => void;
    const oldWriter = new Promise<void>(resolve => { resumeOldWriter = resolve; }).then(() => enqueueOutbox({
      idempotencyKey: `req1:pilot_recommended:${id}`, requestId: "req1", kind: "pilot_recommended",
      to: "owner@example.test", subject: String(savedIntent.subject), body: String(savedIntent.body),
    }));
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(id);
    resumeOldWriter();
    await oldWriter;
    await deliverOutbox();
    expect(siteSends()).toHaveLength(1);
    expect([...state.docs.keys()].filter(key => isSiteOutboxKey(key) && key.split("/").length === 2)).toHaveLength(1);
  });

  it("does not alias a changed recipient onto an occupied old-writer key", async () => {
    const old = await seedLegacyIntent("pending");
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "corrected@example.test" } });
    await post({ ...plan, teamId: "engaged" });
    await enqueueOutbox({ idempotencyKey: `req1:pilot_recommended:${old.id}`, requestId: "req1", kind: "pilot_recommended",
      to: "corrected@example.test", subject: "Late old writer", body: "Late old writer" });
    expect(state.docs.get(old.path)?.to).toBe("owner@example.test");
    await deliverOutbox();
    expect(siteSends()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "corrected@example.test" }));
  });


  it("uses the transaction retry's current recipient when the reserved legacy key is unchanged", async () => {
    const run = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => {
      await callback({ ...tx, update: () => undefined, create: () => undefined });
      state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "retry-recipient@example.test" } });
      return callback(tx);
    }));
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    const intents = [...state.docs.entries()].filter(([key]) => isSiteOutboxKey(key));
    expect(intents).toHaveLength(1);
    expect(intents[0][1].to).toBe("retry-recipient@example.test");
    await deliverOutbox();
    expect(siteSends()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "retry-recipient@example.test" }));
  });

  /* ------------------------------------------ evidence-bound recommendation */

  const teamRows = (kind?: string) => [...state.docs.entries()]
    .filter(([key, row]) => key.startsWith("captureOutbox/") && String(row.kind).startsWith("team_pilot_") && (!kind || row.kind === kind));
  const refusal = async (body: unknown) => {
    const response = await post(body);
    return { status: response.status, body: await response.json() as { code?: string; error?: string } };
  };

  it("refuses a recommendation with no evaluation evidence", async () => {
    const { evaluationRunId: _omitted, ...withoutEvidence } = plan;
    expect(await refusal({ ...withoutEvidence, teamId: "engaged" })).toMatchObject({ status: 400, body: { code: "evaluation_run_required" } });
    expect(await refusal({ ...plan, evaluationRunId: "run_nobody_ran" })).toMatchObject({ status: 400, body: { code: "evaluation_run_missing" } });
    state.docs.set("evaluationRuns/run_pending", evaluationRun({ runId: "run_pending", state: "requested", result: undefined }) as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_pending" })).toMatchObject({ status: 400, body: { code: "evaluation_result_missing" } });
    expect(doc().pilot_recommendation).toBeUndefined();
    expect(teamRows()).toHaveLength(0);
  });

  it("refuses an evaluation that did not meet the job's pass mark", async () => {
    state.docs.set("evaluationRuns/run_fail", evaluationRun({ runId: "run_fail" }, { episodesSucceeded: 12, successRate: 0.6 }) as never);
    const failed = await refusal({ ...plan, evaluationRunId: "run_fail" });
    expect(failed).toMatchObject({ status: 400, body: { code: "evaluation_below_pass_mark" } });
    expect(failed.body.error).toMatch(/pass mark/);
    state.docs.set("evaluationRuns/run_short", evaluationRun({ runId: "run_short" }, { episodesRun: 4, episodesSucceeded: 4, successRate: 1 }) as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_short" })).toMatchObject({ status: 400, body: { code: "evaluation_too_few_episodes" } });
    // The site's own target is the pass mark: 190 of 200 passes the 90% default
    // but not a 98% job target, and not a 10-second cycle target either.
    state.docs.set("inboundRequests/req1", { ...doc(), workspace_task: { terms: { successRate: 98 } } } as never);
    expect(await refusal(plan)).toMatchObject({ status: 400, body: { code: "evaluation_below_pass_mark" } });
    state.docs.set("inboundRequests/req1", { ...doc(), workspace_task: { terms: { successRate: 90, cycleTimeSeconds: 10 } } } as never);
    expect(await refusal(plan)).toMatchObject({ status: 400, body: { code: "evaluation_cycle_time_missed" } });
    expect(doc().pilot_recommendation).toBeUndefined();
  });

  it("judges a run against the targets its evaluation request froze, not targets lowered afterwards", async () => {
    // Requested against a 98% target, the run (95%) failed; the site then
    // lowered its target to 90%. The result is not re-judged post hoc.
    const funded = (runId: string) => evaluationRun({ runId,
      executionAdmission: { ...syntheticSupplyExecutionAdmission(), envelope: {
        ...syntheticSupplyExecutionAdmission().envelope, funding: { workspace_request_id: "eval_req" } } } });
    state.docs.set("evaluationRuns/run_funded", funded("run_funded") as never);
    state.docs.set("inboundRequests/eval_req", { requestId: "eval_req",
      workspace_evaluation: { opportunityId: "req1", targetSnapshot: { successRate: 98, cycleTimeSeconds: null } } } as never);
    state.docs.set("inboundRequests/req1", { ...doc(), workspace_task: { terms: { successRate: 90 } } } as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_funded" })).toMatchObject({ status: 400, body: { code: "evaluation_criteria_changed" } });
    const listed = await (await fetch(`${base}/jobs/req1/evaluations`)).json();
    expect(listed.evaluations.find((row: { runId: string }) => row.runId === "run_funded"))
      .toMatchObject({ recommendable: false, refusals: [{ code: "evaluation_criteria_changed" }] });
    // Unchanged targets: the same run is judged as it stands and passes.
    state.docs.set("inboundRequests/req1", { ...doc(), workspace_task: { terms: { successRate: 98 } } } as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_funded" })).toMatchObject({ status: 400, body: { code: "evaluation_below_pass_mark" } });
    state.docs.set("inboundRequests/eval_req", { requestId: "eval_req",
      workspace_evaluation: { opportunityId: "req1", targetSnapshot: { successRate: 90, cycleTimeSeconds: null } } } as never);
    state.docs.set("inboundRequests/req1", { ...doc(), workspace_task: { terms: { successRate: 90 } } } as never);
    expect((await post({ ...plan, evaluationRunId: "run_funded" })).status).toBe(200);
  });

  it("lists every evaluation of a job, past the first page", async () => {
    for (let index = 0; index < 205; index += 1) {
      const runId = `run_page_${String(index).padStart(3, "0")}`;
      state.docs.set(`evaluationRuns/${runId}`, evaluationRun({ runId }, { episodesSucceeded: 10, successRate: 0.5 }) as never);
    }
    const listed = await (await fetch(`${base}/jobs/req1/evaluations`)).json();
    expect(listed.evaluations).toHaveLength(206);
    expect(listed.evaluations[0]).toMatchObject({ runId: "run_pass", recommendable: true });
  });

  it("refuses an evaluation of another job, a private run, and a run by another team", async () => {
    state.docs.set("evaluationRuns/run_elsewhere", evaluationRun({ runId: "run_elsewhere", sceneId: "req_other" }) as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_elsewhere" })).toMatchObject({ status: 400, body: { code: "evaluation_run_other_job" } });
    state.docs.set("evaluationRuns/run_private", evaluationRun({ runId: "run_private", evaluationPurpose: "private" }) as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_private" })).toMatchObject({ status: 400, body: { code: "evaluation_run_private" } });
    state.docs.set("robotTeams/other", { id: "other", name: "Other Robotics", status: "engaged", contactEmail: "other@example.test" } as never);
    state.docs.set(`robotTeamAccess/${accessRecordId("other@example.test")}`, { status: "approved" });
    // The run is the engaged team's; naming another team is refused, not swapped.
    expect(await refusal({ ...plan, teamId: "other" })).toMatchObject({ status: 400, body: { code: "evaluation_team_mismatch" } });
    state.docs.set("evaluationRuns/run_other", evaluationRun({ runId: "run_other", teamId: "other" }) as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_other", teamId: "engaged" })).toMatchObject({ status: 400, body: { code: "evaluation_team_mismatch" } });
    // A result that changed after the reviewer listed it is not the evidence reviewed.
    expect(await refusal({ ...plan, resultId: "0".repeat(64) })).toMatchObject({ status: 400, body: { code: "evaluation_result_changed" } });
    expect(doc().pilot_recommendation).toBeUndefined();
  });

  it("refuses evidence from a site that withdrew recording permission", async () => {
    state.docs.set("inboundRequests/req1", { ...doc(), capture_rights: { consent_revoked: true } } as never);
    expect(await refusal(plan)).toMatchObject({ status: 409, body: { code: "capture_consent_withdrawn" } });
  });

  it("recommends the account-bound team that ran the evaluation when its intake row is split", async () => {
    // The evaluation-request intake wrote team_acme (applied); the account
    // flow wrote the self-registered, account-bound row the run names.
    state.docs.set("robotTeams/team_acme", { id: "team_acme", name: "Acme", status: "applied", registrationSource: "intake",
      contactEmail: "lead@acme.test", canonicalTeamId: "team_acme_1a2b3c", capability: {}, fieldProvenance: {} } as never);
    state.docs.set("robotTeams/team_acme_1a2b3c", { id: "team_acme_1a2b3c", name: "Acme Robotics", status: "self_registered",
      registrationSource: "self_serve", accountUid: "uid_acme", accountEmail: "lead@acme.test", linkedIntakeTeamIds: ["team_acme"], capability: {}, fieldProvenance: {} } as never);
    state.docs.set("evaluationRuns/run_acme", evaluationRun({ runId: "run_acme", teamId: "team_acme_1a2b3c" }) as never);
    // Not yet invited: a self-registered team needs approved access.
    expect(await refusal({ ...plan, evaluationRunId: "run_acme", teamId: "team_acme" })).toMatchObject({ status: 400, body: { code: "team_not_recommendable" } });
    state.docs.set(`robotTeamAccess/${accessRecordId("lead@acme.test")}`, { status: "approved" });
    // Invited and passing, but it has not agreed to take the pilot.
    expect(await refusal({ ...plan, evaluationRunId: "run_acme", teamId: "team_acme" })).toMatchObject({ status: 400, body: { code: "team_supply_agreement_missing" } });
    // The agreement recorded on the linked intake row counts for the team.
    state.docs.set("robotTeams/team_acme", { ...state.docs.get("robotTeams/team_acme"), status: "engaged", statusBeforeEngaged: "applied",
      supplyAgreement: completeSupplyAgreement() } as never);
    const response = await post({ ...plan, evaluationRunId: "run_acme", teamId: "team_acme" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, teamId: "team_acme_1a2b3c" });
    const saved = doc().pilot_recommendation as unknown as Record<string, any>;
    expect(saved).toMatchObject({ teamId: "team_acme_1a2b3c", teamName: "Acme Robotics", evaluationRunId: "run_acme",
      evidence: { teamId: "team_acme_1a2b3c", runId: "run_acme" } });
    expect(saved.registryTeamIds).toEqual(expect.arrayContaining(["team_acme", "team_acme_1a2b3c"]));
    expect(teamRows("team_pilot_recommended")[0][1]).toMatchObject({ to: "lead@acme.test" });
    // A declined row in the same identity takes the team out.
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "owner@example.test" } } as never);
    state.docs.set("robotTeams/team_acme", { ...state.docs.get("robotTeams/team_acme"), status: "declined" } as never);
    expect(await refusal({ ...plan, evaluationRunId: "run_acme" })).toMatchObject({ status: 400, body: { code: "team_declined" } });
  });

  it("refuses a team that passed but has no recorded agreement to take the pilot, whatever its status says", async () => {
    state.docs.set("robotTeams/engaged", { ...state.docs.get("robotTeams/engaged"), supplyAgreement: null } as never);
    expect(await refusal(plan)).toMatchObject({ status: 400, body: { code: "team_supply_agreement_missing" } });
    expect(doc().pilot_recommendation).toBeUndefined();
    expect(siteSends()).toHaveLength(0);
    const listed = await (await fetch(`${base}/jobs/req1/evaluations`)).json();
    expect(listed.evaluations[0]).toMatchObject({ passed: true, recommendable: false, teamRefusal: { code: "team_supply_agreement_missing" } });
  });

  it("carries the qualified simulation evidence snapshot and the simulation boundary", async () => {
    const response = await post(plan);
    expect(response.status).toBe(200);
    const saved = doc().pilot_recommendation as unknown as Record<string, any>;
    expect(saved).toMatchObject({ teamId: "engaged", evaluationRunId: "run_pass", evidenceScope: "simulation" });
    expect(saved.evidence).toMatchObject({
      schemaVersion: "pilot_recommendation_evidence.v1", runId: "run_pass", teamId: "engaged", checkpointId: "ckpt_engaged",
      episodesRun: 200, episodesSucceeded: 190, successRate: 0.95, confidenceBand: "ninety",
      passMark: { successRate: 0.9, source: "blueprint_default", minimumEpisodes: 190, cycleTimeSeconds: null },
      passed: true, evaluatedAtIso: "2026-10-02T00:00:00.000Z", evidenceScope: "simulation",
    });
    expect(saved.evidence.resultId).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.evidence.boundary).toMatch(/does not certify physical performance or safety/);
    expect(saved.capabilityBasis).toMatch(/190 of 200 episodes succeeded.*pass mark of 90%/);
    // The site sees the numbers and the boundary, never the checkpoint or run internals.
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    const owner = await (await fetch(`${base}/owner/${token}`)).json();
    expect(owner.recommendation.evidence).toMatchObject({ episodesRun: 200, episodesSucceeded: 190, passMarkSuccessRate: 0.9,
      evidenceScope: "simulation", resultUrl: null });
    expect(JSON.stringify(owner.recommendation)).not.toMatch(/ckpt_engaged|run_pass|registryTeamIds/);
    state.docs.set("inboundRequests/req1", { ...doc(), account_owner_uid: "site_uid" } as never);
    const claimed = await (await fetch(`${base}/owner/${token}`)).json();
    expect(claimed.recommendation.evidence.resultUrl).toBe("/app/tasks/req1");
  });

  it("refuses development or unqualified scenes and missing required cycle time before writing any recommendation", async () => {
    const original = evaluationRun() as Record<string, any>;
    for (const [candidate, code] of [
      [{ ...original, result: { ...original.result, evidenceScope: "development_only" } }, "evaluation_development_only"],
      [{ ...original, executionCaptureId: "another-capture" }, "evaluation_scene_not_qualified"],
    ] as const) {
      state.docs.set("evaluationRuns/run_pass", candidate as never);
      const response = await post(plan);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code });
      expect(doc().pilot_recommendation).toBeUndefined();
    }
    state.docs.set("inboundRequests/req1", { ...doc(), workspace_task: { terms: { cycleTimeSeconds: 30 } } } as never);
    state.docs.set("evaluationRuns/run_pass", evaluationRun({}, { medianCycleSeconds: null }) as never);
    const response = await post(plan);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "evaluation_cycle_time_missing" });
    expect(doc().pilot_recommendation).toBeUndefined();
    expect(siteSends()).toHaveLength(0);
  });

  it("blocks a new booking on a historical development snapshot and rechecks the qualified run", async () => {
    expect((await post(plan)).status).toBe(200);
    const record = state.docs.get("inboundRequests/req1") as Record<string, any>;
    const recommendation = record.pilot_recommendation;
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    const book = () => fetch(`${base}/owner/${token}/book`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ recommendationId: recommendation.id, authorized: true }) });
    state.docs.set("inboundRequests/req1", { ...record, pilot_recommendation: { ...recommendation,
      evidence: { ...recommendation.evidence, evidenceScope: "development_only" } } });
    const refused = await book();
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "recommendation_evidence_ineligible" });
    const visible = await (await fetch(`${base}/owner/${token}`)).json();
    expect(visible.recommendation).toMatchObject({ reviewRequired: true, evidence: null });
    state.docs.set("inboundRequests/req1", record);
    state.docs.set("evaluationRuns/run_pass", evaluationRun({}, { medianCycleSeconds: 90 }) as never);
    expect((await book()).status).toBe(409);
    expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toBeUndefined();
  });

  it("freezes the task the simulation scored and shows it to the site, never a guess", async () => {
    const offer = { capture_id: "walkthrough-req1", team_evaluation: { contract: { task_kind: "rigid_pick_place" } } };
    state.docs.set("inboundRequests/req1", { ...doc(), agent_execution_offer: offer } as never);
    state.docs.set("evaluationRuns/run_pass", evaluationRun({ executionCaptureId: "walkthrough-req1" }) as never);
    expect((await post(plan)).status).toBe(200);
    expect((doc().pilot_recommendation as unknown as Record<string, any>).evidence.scoredTaskKind).toBe("rigid_pick_place");
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    const owner = await (await fetch(`${base}/owner/${token}`)).json();
    expect(owner.recommendation.scoredTask).toBe("Pick up the object and place it in the target area");
    // An offer for another capture is not what this run scored: recorded as unknown, not read from the offer.
    state.docs.delete("inboundRequests/req1");
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "owner@example.test" },
      agent_execution_offer: { ...offer, capture_id: "walkthrough-req1-v2" } } as never);
    expect((await post({ ...plan, purpose: "Retest after recapture" })).status).toBe(200);
    expect((doc().pilot_recommendation as unknown as Record<string, any>).evidence.scoredTaskKind).toBeNull();
    expect((await (await fetch(`${base}/owner/${token}`)).json()).recommendation.scoredTask).toBeNull();
  });

  it("lists the job's evaluations against its pass mark for the reviewer", async () => {
    state.docs.set("evaluationRuns/run_fail", evaluationRun({ runId: "run_fail" }, { episodesSucceeded: 12, successRate: 0.6 }) as never);
    state.docs.set("evaluationRuns/run_elsewhere", evaluationRun({ runId: "run_elsewhere", sceneId: "req_other" }) as never);
    const listed = await (await fetch(`${base}/jobs/req1/evaluations`)).json();
    expect(listed).toMatchObject({ ok: true, requestId: "req1", passMark: { successRate: 0.9, source: "blueprint_default" }, currentRecommendation: null });
    expect(listed.evaluations.map((row: { runId: string }) => row.runId)).toEqual(["run_pass", "run_fail"]);
    expect(listed.evaluations[0]).toMatchObject({ teamId: "engaged", teamName: "Acme Robotics", recommendedTeamId: "engaged",
      passed: true, recommendable: true, refusals: [], episodesRun: 200, episodesSucceeded: 190, evidenceScope: "simulation" });
    expect(listed.evaluations[1]).toMatchObject({ passed: false, recommendable: false, refusals: [{ code: "evaluation_below_pass_mark" }] });
    // The same passing numbers, decided by the team's own HTTP responses, are listed and refused.
    const teamReported = evaluationRun({ runId: "run_team_reported" }) as Record<string, any>;
    teamReported.result.scoring = { ...teamReported.result.scoring, runtime: "http_policy_api_observation_probe", successSource: "team_reported" };
    state.docs.set("evaluationRuns/run_team_reported", teamReported as never);
    const relisted = await (await fetch(`${base}/jobs/req1/evaluations`)).json();
    const refused = relisted.evaluations.find((row: { runId: string }) => row.runId === "run_team_reported");
    expect(refused).toMatchObject({ passed: false, recommendable: false, refusals: [{ code: "evaluation_not_simulator_scored" }] });
    expect(await refusal({ ...plan, evaluationRunId: "run_team_reported" })).toMatchObject({ status: 400,
      body: { code: "evaluation_not_simulator_scored" } });
    state.docs.delete("evaluationRuns/run_team_reported");
    // The listed result id binds the recommendation to what the reviewer saw.
    expect((await post({ ...plan, resultId: listed.evaluations[0].resultId })).status).toBe(200);
    expect((await (await fetch(`${base}/jobs/missing/evaluations`)).status)).toBe(404);
  });

  it("notifies the recommended team once per recommendation and suppresses a replaced one", async () => {
    const first = await (await post(plan)).json() as { id: string; teamNotified: boolean };
    expect(first.teamNotified).toBe(true);
    await post(plan);
    expect(teamRows("team_pilot_recommended")).toHaveLength(1);
    expect(teamRows("team_pilot_recommended")[0][1]).toMatchObject({ to: "team@example.test", requestId: "req1", status: "pending" });
    expect(String(teamRows("team_pilot_recommended")[0][1].body)).toMatch(/190 of 200 simulated episodes.*does not certify physical performance or safety/s);
    expect(String(teamRows("team_pilot_recommended")[0][1].body)).toMatch(/Blueprint charges nothing during the beta/);
    expect(String(teamRows("team_pilot_recommended")[0][1].body)).not.toContain("owner@example.test");
    const second = await (await post({ ...plan, window: "December" })).json() as { id: string };
    expect(second.id).not.toBe(first.id);
    expect(teamRows("team_pilot_recommended")).toHaveLength(2);
    await deliverOutbox();
    const teamSends = sendEmail.mock.calls.filter(([message]) => (message as { to: string }).to === "team@example.test");
    expect(teamSends).toHaveLength(1);
    expect(String((teamSends[0][0] as { text: string }).text)).toContain("December");
    await deliverOutbox();
    expect(sendEmail.mock.calls.filter(([message]) => (message as { to: string }).to === "team@example.test")).toHaveLength(1);
  });

  it("books the evidence-bound recommendation for free, tells the team and rings ops once", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.example.test/fixture";
    slack.mockClear();
    try {
      const { id } = await (await post(plan)).json() as { id: string };
      const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
      const book = () => fetch(`${base}/owner/${token}/book`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ recommendationId: id, authorized: true }) });
      expect((await book()).status).toBe(200);
      expect((await book()).status).toBe(200);
      expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toMatchObject({ recommendationId: id, amountUsd: 0, commercialBasis: "invited_beta_free" });
      expect(teamRows("team_pilot_booked")).toHaveLength(1);
      expect(String(teamRows("team_pilot_booked")[0][1].body)).toMatch(/booked the pilot.*No date is reserved/s);
      await vi.waitFor(() => expect(slack).toHaveBeenCalledTimes(1));
      const [text] = slack.mock.calls[0] as unknown as [string];
      expect(text).toContain("req1");
      expect(text).toContain(id);
      expect(text).not.toMatch(/owner@example\.test|team@example\.test|Acme|palletizing/);
      // A booked pilot is not replaced, even by a passing evaluation.
      expect((await post({ ...plan, window: "January" })).status).toBe(409);
      // Scheduling tells the team too, exactly once.
      const coordinate = { recommendationId: id, calendarEventId: "fixture_event", sitePreparation: "Site isolates the station before arrival",
        providerAgreement: { agreedBy: "Fixture provider", evidenceRef: "https://example.test/provider" },
        siteAgreement: { agreedBy: "Fixture site", evidenceRef: "https://example.test/site" }, verifiedAgreements: true };
      const schedule = () => fetch(`${base}/recommendations/req1/coordination`, { method: "POST",
        headers: { "content-type": "application/json", "x-fixture-reviewer": "yes" }, body: JSON.stringify(coordinate) });
      expect((await schedule()).status).toBe(200);
      expect((await schedule()).status).toBe(200);
      expect(teamRows("team_pilot_scheduled")).toHaveLength(1);
      expect(String(teamRows("team_pilot_scheduled")[0][1].body)).toContain("2026-11-10 15:00 UTC");
      await deliverOutbox();
      const teamSubjects = sendEmail.mock.calls.filter(([message]) => (message as { to: string }).to === "team@example.test")
        .map(([message]) => (message as { subject: string }).subject);
      // The recommended notice is superseded by the booking; booked and scheduled send.
      expect(teamSubjects.sort()).toEqual(["A site booked your recommended pilot", "Your pilot is scheduled"]);
    } finally { delete process.env.SLACK_WEBHOOK_URL; }
  });

  /* ------------------------- contact exchange at booking (owner decision 2026-10-15) */

  const ownerToken = () => createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
  const bookPilot = (recommendationId: string) => fetch(`${base}/owner/${ownerToken()}/book`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ recommendationId, authorized: true }) });
  const teamWithdraws = () => {
    const withdrawn = withdrawSupplyAgreement(state.docs.get("robotTeams/engaged") as never,
      { withdrawnOn: "2026-10-14", evidenceRef: "signed-note:synthetic-withdrawal" }, "synthetic-reviewer", "2026-10-15T00:00:00.000Z");
    if (!withdrawn.ok) throw new Error(withdrawn.problem);
    state.docs.set("robotTeams/engaged", withdrawn.record as never);
  };

  it("refuses booking with a typed code once the site or the team has withdrawn", async () => {
    const { id } = await (await post(plan)).json() as { id: string };
    const job = state.docs.get("inboundRequests/req1")!;
    state.docs.set("inboundRequests/req1", { ...job, consent_revoked: true, future_processing_allowed: false });
    const siteWithdrawn = await bookPilot(id);
    expect(siteWithdrawn.status).toBe(409);
    expect(await siteWithdrawn.json()).toMatchObject({ code: "site_consent_withdrawn" });
    state.docs.set("inboundRequests/req1", job);
    teamWithdraws();
    const teamWithdrawn = await bookPilot(id);
    expect(teamWithdrawn.status).toBe(409);
    expect(await teamWithdrawn.json()).toMatchObject({ code: "team_consent_withdrawn" });
    expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toBeUndefined();
    expect(teamRows("team_pilot_booked")).toHaveLength(0);
  });

  it("gives each side the other's contact only while both consents stand", async () => {
    state.docs.set("inboundRequests/req1", { ...state.docs.get("inboundRequests/req1")!,
      contact: { firstName: "Dana", lastName: "Reyes", company: "Fixture Foods", email: "owner@example.test" } });
    const { id } = await (await post(plan)).json() as { id: string };
    expect((await bookPilot(id)).status).toBe(200);
    const bookedRows = () => [...state.docs.entries()].filter(([key, row]) => key.startsWith("captureOutbox/")
      && key.split("/").length === 2 && row.kind === "pilot_booked").map(([, row]) => row);
    const siteRow = bookedRows()[0];
    expect(String(siteRow.body)).toContain("Robot team contact:\nAcme Robotics\nteam@example.test");
    expect(String(siteRow.body)).toMatch(/agree the pilot's dates and terms directly/);
    expect(String(siteRow.body)).not.toMatch(/owns that next step/);
    expect(String(teamRows("team_pilot_booked")[0][1].body)).toContain("Site contact:\nDana Reyes, Fixture Foods\nowner@example.test");
    const { projectPilotBooking } = await import("../utils/pilotContactExchange");
    expect(await projectPilotBooking(state.docs.get("inboundRequests/req1"), "site"))
      .toMatchObject({ consentWithdrawn: false, contact: { organization: "Acme Robotics", email: "team@example.test" } });
    expect(await projectPilotBooking(state.docs.get("inboundRequests/req1"), "team"))
      .toMatchObject({ consentWithdrawn: false, contact: { name: "Dana Reyes", email: "owner@example.test", phone: null } });
    // The team withdraws between booking and send: neither contact goes out, and neither workspace shows one.
    teamWithdraws();
    await deliverOutbox();
    const subjects = sendEmail.mock.calls.map(([message]) => (message as { subject: string }).subject);
    expect(subjects).not.toContain("Your pilot is booked");
    expect(subjects).not.toContain("A site booked your recommended pilot");
    expect(bookedRows().map(row => row.status)).toEqual(["cancelled"]);
    expect(teamRows("team_pilot_booked")[0][1].status).toBe("cancelled");
    expect(await projectPilotBooking(state.docs.get("inboundRequests/req1"), "team")).toMatchObject({ consentWithdrawn: true, contact: null });
  });

});
