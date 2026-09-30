// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { outreachContext, outreachContract, outreachDraft } from "./fixtures/outreach-review";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), set: vi.fn(), hasAnyRole: vi.fn(), runAgentTask: vi.fn(), executeAction: vi.fn(),
  isEmailSuppressed: vi.fn(),
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
async function invoke(path: string, body: unknown = {}) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods.post);
  if (!layer?.route) throw new Error("Missing route " + path);
  const res = { locals: {}, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  await layer.route.stack[0].handle({ params: { prospectId: "prospect-1" }, body }, res, vi.fn());
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

describe("outbound prospect review routes (no provider, Firestore, or transport I/O)", () => {
  it("does not draft or queue without the existing ops role", async () => {
    mocks.hasAnyRole.mockResolvedValue(false);
    expect((await invoke("/:prospectId/draft")).status).toBe(403);
    expect((await invoke("/:prospectId/send")).status).toBe(403);
    expect(mocks.runAgentTask).not.toHaveBeenCalled();
    expect(mocks.executeAction).not.toHaveBeenCalled();
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

  it("still blocks a suppressed recipient before drafting", async () => {
    mocks.isEmailSuppressed.mockResolvedValue(true);
    const response = await invoke("/:prospectId/draft");
    expect(response.status).toBe(409);
    expect(response.body.blocker).toBe("email_suppressed");
    expect(mocks.runAgentTask).not.toHaveBeenCalled();
  });
});
