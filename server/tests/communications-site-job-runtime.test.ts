import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryFirestore } from "./fixtures/communications";
import { communicationsDigest } from "../agents/communications-contract";
import { resolveSiteJobRuntimeAuthorization, reserveSiteJobDraft, recordSiteJobDraftUsage, SITE_JOB_RUNTIME_REQUEST_ID } from "../agents/communications-site-job-runtime";
import { draftSiteJobCommunication, existingSiteJobCommunicationsPorts, loadSiteJobCommunicationsContext, siteJobCommunicationsRuntimeFlags } from "../agents/communications-site-job";
import { CommunicationsAgentsAPI } from "../agents/communications-api";
import { communicationsSendingEnabled } from "../agents/communications-send";
import { isEmailSuppressed } from "../utils/email-suppression";

vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: unknown) => value }));
vi.mock("../utils/siteAssessmentPublic", () => ({ loadCurrentSiteAssessmentView: async () => null }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, storageAdmin: null }));
vi.mock("../utils/email-suppression", () => ({ isEmailSuppressed: vi.fn(async () => false), recordEmailSuppression: async () => ({ persisted: true }), buildUnsubscribeUrl: () => "" }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.mocked(isEmailSuppressed).mockResolvedValue(false); });
const now = Date.parse("2026-10-09T05:00:00Z"), recipient = "owned-test@example.com";
function authority(overrides = {}) {
  return { schema_version: "blueprint.site-job-communications-runtime.v1", owner: "Nijel Hunt", request_id: SITE_JOB_RUNTIME_REQUEST_ID,
    recipient_digest: communicationsDigest({ recipient }), owner_instruction_ref: "gs://blueprint-8c1ca.appspot.com/operations/assessment-e2e/owner-direction.json",
    owner_instruction_sha256: "a".repeat(64), starts_at_ms: Date.parse("2026-10-09T04:24:35Z"), expires_at_ms: Date.parse("2026-10-09T12:24:35Z"),
    evidence_retention_deadline_ms: 1791574084894, ...overrides };
}
function install(overrides = {}) {
  vi.stubEnv("BLUEPRINT_SITE_JOB_COMMUNICATIONS_AUTHORIZATION_JSON", JSON.stringify(authority(overrides)));
  return resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, recipient, now)!;
}
function store() {
  return memoryFirestore(new Map([
    [`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}`, { contact: { email: recipient } }],
    ...["b", "d"].map(character => [`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}/communications/${character.repeat(64)}`,
      { state: "drafting", recipient, binding: { requestId: SITE_JOB_RUNTIME_REQUEST_ID } }] as [string, any]),
    ["operations/communications/draftBudgetAdmissions/unrelated", { state: "usage_unknown", estimatedModelMicros: 1000000 }],
  ]));
}
describe("one original job's optional runtime authorization", () => {
  it("rechecks expiry after awaited suppression before calling the drafting provider", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const db = store(); install();
      vi.mocked(isEmailSuppressed).mockResolvedValueOnce(false).mockImplementationOnce(async () => {
        await Promise.resolve(); vi.setSystemTime(authority().expires_at_ms); return false;
      });
      const run = vi.spyOn(CommunicationsAgentsAPI.prototype, "run");
      const loaded = await loadSiteJobCommunicationsContext(db, SITE_JOB_RUNTIME_REQUEST_ID);
      await expect(draftSiteJobCommunication(db, SITE_JOB_RUNTIME_REQUEST_ID, "existing-operator", {
        purpose: "question", instruction: "Ask the recorded missing sequence question", decisionReason: "Defines the still unknown acceptance condition",
        expectedContextDigest: loaded.contextDigest, reviewedCustomerContext: true,
      })).rejects.toMatchObject({ code: "job_runtime_authorization_unavailable" });
      expect(run).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it.each(["expired", "removed"])("settles a retained scoped admission with recovery ports created after authority is %s", async mode => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const db = store(), a = install(), unrelated = structuredClone(db.records.get("operations/communications/draftBudgetAdmissions/unrelated"));
      await reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now);
      if (mode === "expired") vi.setSystemTime(a.expires_at_ms); else vi.stubEnv("BLUEPRINT_SITE_JOB_COMMUNICATIONS_AUTHORIZATION_JSON", "");
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE", "false");
      const ports = existingSiteJobCommunicationsPorts(db, SITE_JOB_RUNTIME_REQUEST_ID, recipient), callbacks = (ports.api as any).options;
      expect(callbacks.allowPaidInference).toBe(false); expect(ports.sendsEnabled()).toBe(false);
      await callbacks.recordPaidDraftUsage("b".repeat(64), "c".repeat(64), { input_tokens: 100, output_tokens: 50, total_tokens: 150 });
      expect([...db.records.entries()].find(([path]) => path.includes("siteJobDraftAdmissions"))![1]).toMatchObject({ state: "usage_recorded", estimatedModelMicros: 53 });
      expect(db.records.get("operations/communications/draftBudgetAdmissions/unrelated")).toEqual(unrelated);
    } finally { vi.useRealTimers(); }
  });
  it("uses the selected-case callbacks in the existing draft handler and reuses the exact completed draft", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE", "false");
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const db = store(); install();
      const run = vi.spyOn(CommunicationsAgentsAPI.prototype, "run").mockImplementation(async function (this: CommunicationsAgentsAPI, params) {
        // Hermetic provider stand-in exercises the real admission/usage ports.
        const callbacks = (this as any).options, digest = "c".repeat(64);
        expect(callbacks.allowPaidInference).toBe(true);
        await callbacks.reservePaidDraft(params.jobId, digest);
        const checkpoint = { ...params.checkpoint, createClaimedAt: new Date(now).toISOString(), requestDigest: digest,
          sessionId: "synthetic-scoped-session", turnId: "synthetic-scoped-turn" };
        await params.saveCheckpoint(checkpoint);
        await callbacks.recordPaidDraftUsage(params.jobId, digest, { input_tokens: 100, output_tokens: 50, total_tokens: 150 });
        return { checkpoint, usage: null, output: { disposition: "draft", subject: "Ignored envelope subject",
          body: "What sequence and final state should this job achieve? That determines which test can answer your question.",
          reason: "The intended acceptance condition remains unknown.", usedFactIds: [], refreshFactIds: [], outreachContract: null, requiresHumanReview: true } };
      });
      const loaded = await loadSiteJobCommunicationsContext(db, SITE_JOB_RUNTIME_REQUEST_ID);
      const input = { purpose: "question" as const, instruction: "Ask the recorded sequence and final-state question",
        decisionReason: "Define acceptance without inventing the operator's intended task", expectedContextDigest: loaded.contextDigest, reviewedCustomerContext: true as const };
      const drafted = await draftSiteJobCommunication(db, SITE_JOB_RUNTIME_REQUEST_ID, "existing-operator", input);
      expect(drafted).toMatchObject({ state: "needs_review", output: { subject: "A question about your Blueprint job" } });
      expect(await draftSiteJobCommunication(db, SITE_JOB_RUNTIME_REQUEST_ID, "existing-operator", input)).toMatchObject({ reused: true });
      expect(run).toHaveBeenCalledTimes(1);
      const admission = [...db.records.entries()].find(([path]) => path.includes("siteJobDraftAdmissions"))![1];
      expect(admission).toMatchObject({ jobId: drafted.id, state: "usage_recorded", estimatedModelMicros: 53 });
      expect(db.records.get("operations/communications/draftBudgetAdmissions/unrelated").state).toBe("usage_unknown");
    } finally { vi.useRealTimers(); }
  });
  it("enables only the existing selected-job ports and UI flags while global outreach stays off", () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE", "false");
    expect(siteJobCommunicationsRuntimeFlags(SITE_JOB_RUNTIME_REQUEST_ID, recipient)).toEqual({ draftingEnabled: false, deliveryEnabled: false });
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      install();
      expect(siteJobCommunicationsRuntimeFlags(SITE_JOB_RUNTIME_REQUEST_ID, recipient)).toEqual({ draftingEnabled: true, deliveryEnabled: true });
      expect(siteJobCommunicationsRuntimeFlags("other-job", recipient)).toEqual({ draftingEnabled: false, deliveryEnabled: false });
      const ports = existingSiteJobCommunicationsPorts(store(), SITE_JOB_RUNTIME_REQUEST_ID, recipient);
      expect(ports.sendsEnabled()).toBe(true);
      expect(communicationsSendingEnabled()).toBe(false);
      vi.setSystemTime(authority().expires_at_ms);
      expect(ports.sendsEnabled()).toBe(false);
      expect(() => ports.assertRuntime!()).toThrow("job_runtime_authorization_unavailable");
      expect(siteJobCommunicationsRuntimeFlags(SITE_JOB_RUNTIME_REQUEST_ID, recipient)).toEqual({ draftingEnabled: false, deliveryEnabled: false });
    } finally { vi.useRealTimers(); }
  });
  it("defaults off and binds request, unchanged recipient, eight-hour expiry and original retention", () => {
    expect(resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, recipient, now)).toBeNull();
    install();
    expect(resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, recipient, now)).not.toBeNull();
    expect(resolveSiteJobRuntimeAuthorization("another-job", recipient, now)).toBeNull();
    expect(resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, "another@example.com", now)).toBeNull();
    expect(resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, recipient, authority().expires_at_ms)).toBeNull();
    install({ expires_at_ms: authority().expires_at_ms + 1 });
    expect(resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, recipient, now)).toBeNull();
    install({ evidence_retention_deadline_ms: 1791574084895 });
    expect(resolveSiteJobRuntimeAuthorization(SITE_JOB_RUNTIME_REQUEST_ID, recipient, now)).toBeNull();
  });
  it("retains separate case admission while leaving unrelated global unknown liability untouched", async () => {
    const db = store(), a = install(), before = structuredClone(db.records.get("operations/communications/draftBudgetAdmissions/unrelated"));
    await reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now);
    expect(db.records.get("operations/communications/draftBudgetAdmissions/unrelated")).toEqual(before);
    const saved = [...db.records.entries()].find(([path]) => path.includes("siteJobDraftAdmissions"))![1];
    expect(saved).toMatchObject({ state: "reserved", usageState: "unresolved", estimatedModelMicros: null, invoiceVerified: false });
    expect(saved.authority).toEqual(a);
  });
  it("blocks own unknown admission and never treats a missing receipt as zero", async () => {
    const db = store(), a = install();
    await reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now);
    await recordSiteJobDraftUsage(db, a, "b".repeat(64), "c".repeat(64), null, now);
    await expect(reserveSiteJobDraft(db, a, "d".repeat(64), "e".repeat(64), () => now)).rejects.toMatchObject({ code: "job_draft_cost_unresolved" });
    await expect(reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now)).rejects.toMatchObject({ code: "job_draft_reservation_requires_reconciliation" });
  });
  it("refuses revoked authority and a communication not bound to the selected job", async () => {
    const db = store(), a = install();
    db.records.get(`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}`).consent_revoked = true;
    await expect(reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now)).rejects.toMatchObject({ code: "job_runtime_authorization_unavailable" });
    db.records.get(`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}`).consent_revoked = false;
    db.records.get(`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}/communications/${"b".repeat(64)}`).binding.requestId = "unrelated";
    await expect(reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now)).rejects.toMatchObject({ code: "job_draft_binding_invalid" });
  });
  it("rechecks expiry and canonical recipient before admission; usage can settle after expiry", async () => {
    const db = store(), a = install();
    await expect(reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => a.expires_at_ms)).rejects.toMatchObject({ code: "job_runtime_authorization_unavailable" });
    db.records.get(`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}`).contact.email = "changed@example.com";
    await expect(reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now)).rejects.toMatchObject({ code: "job_runtime_authorization_unavailable" });
    db.records.get(`inboundRequests/${SITE_JOB_RUNTIME_REQUEST_ID}`).contact.email = recipient;
    await reserveSiteJobDraft(db, a, "b".repeat(64), "c".repeat(64), () => now);
    await recordSiteJobDraftUsage(db, a, "b".repeat(64), "c".repeat(64), { input_tokens: 100, output_tokens: 50, total_tokens: 150 }, a.expires_at_ms + 1);
    const row = [...db.records.entries()].find(([path]) => path.includes("siteJobDraftAdmissions"))![1];
    expect(row).toMatchObject({ state: "usage_recorded", estimatedModelMicros: 53, usageState: "best_effort_not_invoice" });
    await recordSiteJobDraftUsage(db, a, "b".repeat(64), "c".repeat(64), { input_tokens: 10, output_tokens: 5, total_tokens: 15 }, a.expires_at_ms + 2);
    expect([...db.records.entries()].find(([path]) => path.includes("siteJobDraftAdmissions"))![1].estimatedModelMicros).toBe(53);
    await recordSiteJobDraftUsage(db, a, "b".repeat(64), "c".repeat(64), null, a.expires_at_ms + 3);
    const uncertain = [...db.records.entries()].find(([path]) => path.includes("siteJobDraftAdmissions"))![1];
    expect(uncertain).toMatchObject({ state: "usage_unknown", estimatedModelMicros: 53, usage: { total_tokens: 15 } });
    await expect(recordSiteJobDraftUsage(db, a, "b".repeat(64), "f".repeat(64), null, now)).rejects.toMatchObject({ code: "job_draft_usage_binding_changed" });
  });
});
