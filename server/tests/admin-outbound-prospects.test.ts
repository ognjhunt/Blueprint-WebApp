// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outreachContext, outreachContract, outreachDraft } from "./fixtures/outreach-review";
import { CommunicationsStore } from "../agents/communications-store";
import * as draftBudget from "../agents/communications-draft-budget";
import * as producer from "../agents/communications-producer";
import { publishedResearchFixture } from "./fixtures/published-research";
import { communicationsNow } from "./fixtures/communications";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), set: vi.fn(), hasAnyRole: vi.fn(), runAgentTask: vi.fn(), executeAction: vi.fn(),
  isEmailSuppressed: vi.fn(), readResearch: vi.fn(),
}));
vi.mock("../agents/communications-research", async (original) => ({
  ...await original<typeof import("../agents/communications-research")>(), readExistingResearchSnapshot: mocks.readResearch,
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  dbAdmin: { collection: () => ({ doc: () => ({ get: mocks.get, set: mocks.set }) }) },
}));
vi.mock("../utils/access-control", () => ({ hasAnyRole: mocks.hasAnyRole }));
vi.mock("../agents/runtime", () => ({ runAgentTask: mocks.runAgentTask }));
vi.mock("../agents/action-executor", () => ({ executeAction: mocks.executeAction }));
vi.mock("../utils/email-suppression", () => ({
  isEmailSuppressed: mocks.isEmailSuppressed,
  normalizeSuppressionEmail: (value: string) => value.trim().toLowerCase(),
  buildUnsubscribeUrl: () => "https://blueprint.example/unsubscribe",
  recordEmailSuppression: vi.fn(),
}));
vi.mock("../logger", () => ({ logger: { error: vi.fn() } }));
import router from "../routes/admin-outbound-prospects";

const prospect = {
  prospectId: "prospect-1", facilityName: "Fixture packing facility", facilityAddress: "Fixture address",
  contactEmail: outreachDraft.to, observations: outreachContext.observations,
  hypothesisedTask: "Packing might be a recurring job.", inferredGates: {}, gateAnswerSources: {},
  reasonForContact: "Public packing-job observation", stage: "drafted", createdAtIso: "2026-09-30T19:00:00Z",
};
async function invoke(path: string, body: unknown = {}, method = "post", actor: string | null = "authenticated-operator") {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  if (!layer?.route) throw new Error("Missing route " + path);
  const res = { locals: { firebaseUser: { uid: actor } }, status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  await layer.route.stack[0].handle({ params: { prospectId: "prospect-1", jobId: "a".repeat(64) }, body }, res, vi.fn());
  return { status: res.status.mock.calls[0]?.[0] ?? 200, body: res.json.mock.calls[0]?.[0] };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.hasAnyRole.mockResolvedValue(true);
  mocks.get.mockResolvedValue({ exists: true, data: () => prospect });
  mocks.set.mockResolvedValue(undefined);
  mocks.isEmailSuppressed.mockResolvedValue(false);
  mocks.executeAction.mockResolvedValue({ state: "pending_approval", tier: 3, ledgerDocId: "ledger-1" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("outbound prospect review routes (no provider, Firestore, or transport I/O)", () => {
  it("previews actual published research without writes and refuses caller-supplied facts, approval or credentials", async () => {
    const f = publishedResearchFixture();
    vi.spyOn(Date, "now").mockReturnValue(communicationsNow);
    mocks.get.mockResolvedValue({ exists: true, data: () => f.prospect });
    mocks.readResearch.mockResolvedValue(f.snapshot);
    const result = await invoke("/:prospectId/communications/research-preview", f.input);
    expect(result.status).toBe(200);
    expect(result.body.preview.source.sheetsProspectId).toBe("BP-000042");
    expect(result.body.preview.proposal).not.toHaveProperty("qualityReview");
    expect(mocks.set).not.toHaveBeenCalled();
    for (const extra of [{ facts: [] }, { qualityReview: { state: "approved" } }, { refreshToken: "UNACCEPTED_MOCK" }]) {
      expect((await invoke("/:prospectId/communications/research-preview", { ...f.input, ...extra })).status).toBe(400);
    }
    mocks.hasAnyRole.mockResolvedValue(false);
    expect((await invoke("/:prospectId/communications/research-preview", f.input)).status).toBe(403);
    expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("requires explicit review of the exact preview and derives the actor from authentication", async () => {
    const f = publishedResearchFixture();
    vi.spyOn(Date, "now").mockReturnValue(communicationsNow);
    mocks.get.mockResolvedValue({ exists: true, data: () => f.prospect });
    mocks.readResearch.mockResolvedValue(f.snapshot);
    const preview = producer.previewResearchCommunications(f.snapshot, "prospect-1", f.prospect, f.input, communicationsNow);
    const approval = vi.spyOn(producer, "approveResearchCommunications").mockResolvedValue({ created: true } as any);
    expect((await invoke("/:prospectId/communications/research-approve", f.input)).status).toBe(400);
    const result = await invoke("/:prospectId/communications/research-approve", { ...f.input,
      previewDigest: preview.previewDigest, contextReviewed: true });
    expect(result.status).toBe(201);
    expect(approval).toHaveBeenCalledWith(expect.anything(), preview, f.input, preview.previewDigest,
      "authenticated-operator", communicationsNow);
    expect(result.body).toMatchObject({ sent: false, gmailDraftCreated: false, sessionCreated: false, jobQueued: false });
    expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("provides preparation only behind ops access without accepting credentials or writing records", async () => {
    mocks.hasAnyRole.mockResolvedValue(false);
    expect((await invoke("/communications/connection", {}, "get")).status).toBe(403);
    mocks.hasAnyRole.mockResolvedValue(true);
    const response = await invoke("/communications/connection", {}, "get");
    expect(response.body.connection).toMatchObject({ account: "nijel@tryblueprint.io", credentialsAccepted: false,
      grantStarted: false, oauth: { authorizationUrl: null, callbackUrl: null } });
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });
  it("gates job retry behind ops and refuses caller-supplied credentials, body or approval", async () => {
    mocks.hasAnyRole.mockResolvedValue(false);
    expect((await invoke("/:prospectId/communications/:jobId/retry")).status).toBe(403);
    mocks.hasAnyRole.mockResolvedValue(true);
    const response = await invoke("/:prospectId/communications/:jobId/retry", {
      briefDigest: "a".repeat(64), refreshToken: "MOCK_UNACCEPTED", body: "invented", approved: true,
    });
    expect(response.status).toBe(400); expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });
  it("derives the retry actor from authentication and queues only the bound job without inference/send", async () => {
    const retried: any = { jobId: "a".repeat(64), prospectId: "prospect-1", briefDigest: "b".repeat(64), state: "queued" };
    const retry = vi.spyOn(CommunicationsStore.prototype, "retryBlocked").mockResolvedValueOnce(retried);
    const response = await invoke("/:prospectId/communications/:jobId/retry", { briefDigest: retried.briefDigest });
    expect(response.status).toBe(202);
    expect(retry).toHaveBeenCalledWith({ jobId: retried.jobId, prospectId: retried.prospectId,
      briefDigest: retried.briefDigest, requestedBy: "authenticated-operator" });
    expect(response.body).toMatchObject({ sent: false, sessionCreated: false });
    expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });
  it("gates exact existing-session reconciliation and rejects supplied costs, credentials, authority and actors", async () => {
    const recovery = vi.spyOn(draftBudget, "reconcileCommunicationsDraftSession");
    const body = { briefDigest: "b".repeat(64), expectedCheckpointDigest: "c".repeat(64), sessionId: "synthetic-existing-session" };
    mocks.hasAnyRole.mockResolvedValue(false);
    expect((await invoke("/:prospectId/communications/:jobId/reconcile-draft", body)).status).toBe(403);
    mocks.hasAnyRole.mockResolvedValue(true);
    expect((await invoke("/:prospectId/communications/:jobId/reconcile-draft", body, "post", null)).status).toBe(403);
    for (const extra of [{ usage: { total_tokens: 0 } }, { cost: 0 }, { apiKey: "synthetic-unaccepted" }, { approved: true },
      { requestedBy: "forged-actor" }, { body: "invented" }, { sessionId: "https://invalid.example/session" }]) {
      expect((await invoke("/:prospectId/communications/:jobId/reconcile-draft", { ...body, ...extra })).status).toBe(400);
    }
    expect(recovery).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });
  it("derives reconciliation identity from auth and constructs a paid-disabled observer, without queue/approval/send", async () => {
    const body = { briefDigest: "b".repeat(64), expectedCheckpointDigest: "c".repeat(64), sessionId: "synthetic-existing-session" };
    const recovery = vi.spyOn(draftBudget, "reconcileCommunicationsDraftSession").mockResolvedValueOnce({
      state: "usage_recorded", sessionRecovered: true, costResolved: true,
    });
    const result = await invoke("/:prospectId/communications/:jobId/reconcile-draft", body);
    expect(result.status).toBe(200);
    expect(recovery).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      jobId: "a".repeat(64), prospectId: "prospect-1", ...body, requestedBy: "authenticated-operator",
    }, expect.any(Number));
    const observer = recovery.mock.calls[0][1] as import("../agents/communications-api").CommunicationsAgentsAPI;
    await expect(observer.run({} as any)).rejects.toMatchObject({ code: "communications_inference_disabled" });
    expect(result.body).toEqual({ ok: true, state: "usage_recorded", sessionRecovered: true, costResolved: true,
      sent: false, sessionCreated: false, jobQueued: false });
    expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled();
  });
  it("reports unverifiable existing-session recovery without returning provider bodies or private configuration", async () => {
    vi.spyOn(draftBudget, "reconcileCommunicationsDraftSession").mockRejectedValueOnce(new Error("PRIVATE SYNTHETIC PROVIDER BODY"));
    const result = await invoke("/:prospectId/communications/:jobId/reconcile-draft", {
      briefDigest: "b".repeat(64), expectedCheckpointDigest: "c".repeat(64), sessionId: "synthetic-existing-session",
    });
    expect(result).toEqual({ status: 409, body: { error: "communications_draft_recovery_not_verified" } });
  });
  it("does not draft or queue without the existing ops role", async () => {
    mocks.hasAnyRole.mockResolvedValue(false);
    expect((await invoke("/:prospectId/draft")).status).toBe(403);
    expect((await invoke("/:prospectId/send")).status).toBe(403);
    expect((await invoke("/:prospectId/communications")).status).toBe(403);
    expect(mocks.runAgentTask).not.toHaveBeenCalled();
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });
  it("accepts communications references only and refuses invented approval or recipient", async () => {
    const response = await invoke("/:prospectId/communications", { briefId: "brief-1", intent: "outreach", inboundMessageId: null,
      to: "invented@example.com", qualityReview: { state: "approved" } });
    expect(response.status).toBe(400);
    expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.runAgentTask).not.toHaveBeenCalled();
  });
  it("fails closed when the communications handoff is not available", async () => {
    const response = await invoke("/:prospectId/communications", { briefId: "brief-missing", intent: "outreach", inboundMessageId: null });
    expect(response.status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.runAgentTask).not.toHaveBeenCalled();
  });

  it("rejects legacy text-only submissions before queueing", async () => {
    const response = await invoke("/:prospectId/send", { subject: outreachDraft.subject, body: outreachDraft.body });
    expect(response.status).toBe(400);
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("rejects unsupported cold details before queueing", async () => {
    const contract = structuredClone(outreachContract);
    if (contract.opening.kind !== "cold") throw new Error("cold fixture required");
    contract.opening.publicDetail.source = "https://invented.example/research";
    const response = await invoke("/:prospectId/send", { subject: outreachDraft.subject, body: outreachDraft.body, outreachContract: contract });
    expect(response.status).toBe(409);
    expect(response.body.outreachReview.blockers).toContain("cold_detail_not_in_recorded_evidence");
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("uses stored evidence and preserves separate approval for a valid draft", async () => {
    const response = await invoke("/:prospectId/send", { subject: outreachDraft.subject, body: outreachDraft.body, outreachContract });
    expect(response.status).toBe(202);
    expect(response.body.sent).toBe(false);
    expect(response.body.outreachReview.hardChecksPassed).toBe(true);
    expect(response.body.nextStep).toContain("/api/admin/leads/action-queue/ledger-1/approve");
    expect(mocks.executeAction).toHaveBeenCalledWith(expect.objectContaining({
      safetyPolicy: expect.objectContaining({ lane: "outbound_prospect" }),
      actionPayload: expect.objectContaining({ outreachContract, outreachContext }),
      draftOutput: expect.objectContaining({ requires_human_review: true }),
    }));
  });

  it("does not accept caller-invented verification or semantic approval at queue time", async () => {
    const response = await invoke("/:prospectId/send", {
      subject: outreachDraft.subject, body: outreachDraft.body, outreachContract,
      outreachContext: { connectionEvidence: { claim: "A mutual friend" } },
      outreachSemanticReview: { checks: { evidence: "pass" } },
    });
    expect(response.status).toBe(400);
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("exposes hard checks and semantic review needs after drafting without queueing", async () => {
    mocks.runAgentTask.mockResolvedValue({ status: "completed", output: {
      subject: outreachDraft.subject, body: outreachDraft.body, outreach_contract: outreachContract,
    } });
    const response = await invoke("/:prospectId/draft");
    expect(response.body.outreachReview.hardChecksPassed).toBe(true);
    expect(Object.keys(response.body.outreachReview.semanticReviewRequired)).toHaveLength(6);
    expect(mocks.runAgentTask).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ connectionEvidence: null }) }));
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  describe("legacy mailer route and research-derived prospects", () => {
    const send = { subject: outreachDraft.subject, body: outreachDraft.body, outreachContract };
    const verifiedResearch = { ...prospect, researchPublicationId: "BP-000042", entityAdmission: "research_provisional" };
    const hypothesis = { ...verifiedResearch, researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" };

    it("refuses a research-derived prospect at /send while the send flag is off, without queueing or marking it contacted", async () => {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
      mocks.get.mockResolvedValue({ exists: true, data: () => verifiedResearch });
      const response = await invoke("/:prospectId/send", send);
      expect(response).toMatchObject({ status: 409, body: { ok: false, blocker: "communications_sending_disabled" } });
      expect(mocks.executeAction).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
    });

    it("refuses an outreach-ready hypothesis at /send and /draft even with the send flag on", async () => {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
      mocks.get.mockResolvedValue({ exists: true, data: () => hypothesis });
      for (const path of ["/:prospectId/send", "/:prospectId/draft"]) {
        expect(await invoke(path, path.endsWith("send") ? send : {}))
          .toMatchObject({ status: 409, body: { ok: false, blocker: "outreach_ready_hypothesis_draft_only" } });
      }
      expect(mocks.isEmailSuppressed).not.toHaveBeenCalled();
      expect(mocks.runAgentTask).not.toHaveBeenCalled(); expect(mocks.executeAction).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
    });

    it("still drafts a verified research prospect while the send flag is off: drafting is not sending", async () => {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
      mocks.get.mockResolvedValue({ exists: true, data: () => verifiedResearch });
      mocks.runAgentTask.mockResolvedValue({ status: "completed", output: {
        subject: outreachDraft.subject, body: outreachDraft.body, outreach_contract: outreachContract,
      } });
      const response = await invoke("/:prospectId/draft");
      expect(response.body.ok).toBe(true);
      expect(mocks.runAgentTask).toHaveBeenCalledOnce(); expect(mocks.executeAction).not.toHaveBeenCalled();
    });

    it("keeps hand-chosen prospects queueable for human approval while the send flag is off", async () => {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
      const response = await invoke("/:prospectId/send", send);
      expect(response).toMatchObject({ status: 202, body: { sent: false } });
      expect(mocks.executeAction).toHaveBeenCalledOnce();
    });
  });

  it("still blocks a suppressed recipient before drafting", async () => {
    mocks.isEmailSuppressed.mockResolvedValue(true);
    const response = await invoke("/:prospectId/draft");
    expect(response.status).toBe(409);
    expect(response.body.blocker).toBe("email_suppressed");
    expect(mocks.runAgentTask).not.toHaveBeenCalled();
  });
});
