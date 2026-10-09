// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
const storage = vi.hoisted(() => ({ raw: "", generation: "1", afterRead: undefined as (() => void) | undefined }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => ({ bucketName: "blueprint-8c1ca.appspot.com",
  info: async () => ({ generation: storage.generation, size: Buffer.byteLength(storage.raw) }),
  readText: async () => { storage.afterRead?.(); return storage.raw; } }) }));
import { memoryFirestore, communicationsNow, communicationsFixture, cancelledContinuationFixture } from "./fixtures/communications";
import { reserveCommunicationsDraft, recordCommunicationsDraftUsage, reconcileCommunicationsDraftCost, estimatedDraftMicros,
  COMMUNICATIONS_DRAFT_BUDGET, configuredCommunicationsDraftBudget, reconcileCommunicationsDraftSession,
  claimCommunicationsRejectedCreateDraftBudget, claimCommunicationsCancelledContinuationBudget,
  assertCommunicationsContinuationBudget, type CommunicationsRejectedCreateDraftBudgetClaim } from "../agents/communications-draft-budget";
import { communicationsDigest } from "../agents/communications-contract";
import { CommunicationsStore, COMMUNICATIONS_SAVED_RECOVERY_REQUESTER } from "../agents/communications-store";
const root = "blueprintCommunications/default", digest = "a".repeat(64);
const usage = { input_tokens: 1000, output_tokens: 200, total_tokens: 1200,
  input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 100 } };

describe("durable saved-output recovery discovery", () => {
  it.each(["blocked", "queued", "running", "retry", "pending_approval"])("retains the owned %s handoff on reload without changing business state", async state => {
    const f = communicationsFixture(), db = memoryFirestore();
    const savedOutputRecovery = { rawOutputSha256: "a".repeat(64), ownerAction: { actorUid: "synthetic-owner",
      sourceCommit: "b".repeat(40), originalJobDigest: "c".repeat(64), requestDigest: "d".repeat(64) } };
    const record = { ...f.job, state, attempts: 2, checkpoint: { sessionId: "synthetic-existing-session", turnId: "synthetic-existing-turn" }, retryRequestedBy: COMMUNICATIONS_SAVED_RECOVERY_REQUESTER,
      savedOutputRecovery, lease: { owner: "original-recovery", until: state === "running" ? communicationsNow + 1000 : 0 } };
    db.records.set(`${root}/jobs/${f.job.jobId}`, record);
    db.records.set(`${root}/draftBudgetState/current`, { activeAdmissionId: null });
    const before = structuredClone([...db.records]);
    const visible = await new CommunicationsStore(db, () => communicationsNow, "read-only-observer").blockedJobs();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ jobId: f.job.jobId, state, attempts: 2, savedOutputRecovery,
      sessionId: record.checkpoint.sessionId, expectedJobDigest: communicationsDigest(record),
      expectedCheckpointDigest: communicationsDigest(record.checkpoint), leaseUntil: record.lease.until });
    expect([...db.records]).toEqual(before);
  });
  it("does not expose unrelated queued jobs or completed recoveries as a resumable handoff", async () => {
    const f = communicationsFixture(), db = memoryFirestore();
    for (const [id, extra] of Object.entries({ unowned: { state: "queued", retryRequestedBy: COMMUNICATIONS_SAVED_RECOVERY_REQUESTER },
      unrelated: { state: "queued", retryRequestedBy: "another-operator", savedOutputRecovery: { ownerAction: { actorUid: "other" } } },
      completed: { state: "sent", retryRequestedBy: COMMUNICATIONS_SAVED_RECOVERY_REQUESTER, savedOutputRecovery: { ownerAction: { actorUid: "owner" } } } })) {
      db.records.set(`${root}/jobs/${id}`, { ...f.job, jobId: id, ...extra });
    }
    expect(await new CommunicationsStore(db, () => communicationsNow, "observer").blockedJobs()).toEqual([]);
  });
});

describe("one owner-authorized phase inside the existing unresolved hold", () => {
  function continuationBudget() {
    const f = cancelledContinuationFixture(), db = memoryFirestore(), id = communicationsDigest({ jobId: f.job.jobId });
    const policy = { ...COMMUNICATIONS_DRAFT_BUDGET, softTargetUsd: 1 };
    const path = `${root}/draftBudgetAdmissions/${id}`, day = "2026-09-30";
    db.records.set(path, { jobId: f.job.jobId, requestDigest: f.checkpoint.requestDigest, policy, policyDigest: communicationsDigest(policy),
      state: "usage_unknown", usageState: "unresolved", originalUsageState: "unresolved", correctedCreate: {
        requestDigest: f.child.requestDigest, policy, policyDigest: communicationsDigest(policy), claimDigest: "c".repeat(64),
        day, state: "usage_recorded", usageState: "best_effort_not_invoice", estimatedModelMicros: 55334 } });
    db.records.set(`${root}/draftBudgetState/current`, { activeAdmissionId: id });
    db.records.set(`${root}/draftBudgetDays/${day}`, { admissions: 2, estimatedModelMicros: 55334 });
    db.records.set("blueprintDailyResearch/sites-first", { enabled: false, config: { enabled: false, soft_target_usd: 5,
      recurring_budget_authority_reference: "retained-synthetic-research-authority" } });
    const claim = () => db.runTransaction((tx: any) => claimCommunicationsCancelledContinuationBudget(db, tx, f.phase, communicationsNow));
    return { ...f, db, id, path, day, claim };
  }
  it("reserves 3.944666 additional soft dollars once without clearing/refunding original unknown cost", async () => {
    const f = continuationBudget(), original = structuredClone(f.db.records.get(f.path));
    await Promise.all([f.claim(), f.claim()]);
    expect(f.db.records.get(f.path)).toMatchObject({ ...original, cancelledContinuation: {
      additionalAllowanceMicros: 3944666, baselineModelMicros: 55334, originalUnknownPolicyReservationUsd: 1,
      researchReservationUsd: 5, accountingComplete: false, invoiceVerified: false } });
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).admissions).toBe(3);
    expect(f.db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(f.id);
    await expect(reserveCommunicationsDraft(f.db, "other", digest, communicationsNow)).rejects.toThrow("cost_unresolved");
    await assertCommunicationsContinuationBudget(f.db, f.phase, communicationsNow);
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros).toBe(55334);
  });
  it.each(["unknown_baseline", "wrong_original", "other_hold", "research_enabled", "research_target", "daily_ceiling", "wrong_day"])("refuses %s before a phase claim", async kind => {
    const f = continuationBudget(), row = f.db.records.get(f.path);
    if (kind === "unknown_baseline") delete row.correctedCreate.estimatedModelMicros;
    if (kind === "wrong_original") row.requestDigest = "9".repeat(64);
    if (kind === "other_hold") f.db.records.set(`${root}/draftBudgetAdmissions/other`, { state: "usage_unknown" });
    if (kind === "research_enabled") f.db.records.get("blueprintDailyResearch/sites-first").enabled = true;
    if (kind === "research_target") f.db.records.get("blueprintDailyResearch/sites-first").config.soft_target_usd = 6;
    if (kind === "daily_ceiling") f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros = 4000000;
    if (kind === "wrong_day") row.correctedCreate.day = "2026-09-29";
    await expect(f.claim()).rejects.toThrow();
    expect(f.db.records.get(f.path).cancelledContinuation).toBeUndefined();
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).admissions).toBe(2);
  });
  it("accounts cumulative accepted-session usage without double-counting baseline or resolving original400", async () => {
    const f = continuationBudget(); await f.claim();
    const cumulative = { input_tokens: 300000, output_tokens: 10000, total_tokens: 310000 };
    await recordCommunicationsDraftUsage(f.db, f.job.jobId, f.child.requestDigest, cumulative, communicationsNow);
    const amount = estimatedDraftMicros(cumulative)!;
    expect(f.db.records.get(f.path)).toMatchObject({ state: "usage_unknown", originalUsageState: "unresolved", knownTotalIsComplete: false,
      cancelledContinuation: { additionalEstimatedModelMicros: amount - 55334, cumulativeAcceptedSessionModelMicros: amount, accountingComplete: false } });
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros).toBe(amount);
    await recordCommunicationsDraftUsage(f.db, f.job.jobId, f.child.requestDigest, null, communicationsNow);
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros).toBe(amount);
    expect(f.db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(f.id);
  });
});
// Hermetic test targets below are invented fixtures, unrelated to any owner
// approval or production configuration. They are never used to enable spending.
beforeEach(() => vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "2.5"));
afterEach(() => vi.unstubAllEnvs());

describe("retained recurring direction and one new draft slot", () => {
  function recurring() {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "5");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
    storage.generation = "1"; storage.afterRead = undefined;
    const f = cancelledContinuationFixture(), db = memoryFirestore(), id = communicationsDigest({ jobId: f.job.jobId });
    const path = `${root}/draftBudgetAdmissions/${id}`, day = "2026-09-30", policy = { ...COMMUNICATIONS_DRAFT_BUDGET, softTargetUsd: 1 };
    const phase = { ...f.phase, state: "submitted", turnId: "continued-turn", checkpoint: { ...f.phase.checkpoint, finalRepairSettled: true } };
    const authority: any = { version: "blueprint.communications-recurring-budget-direction.v1", owner: "Nijel Hunt",
      approvedAt: new Date(communicationsNow - 1000).toISOString(), expiresAt: new Date(communicationsNow + 3 * 86400000).toISOString(),
      expiryBasis: "operator_boundary_no_later_than_existing_history_scope",
      direction: { spending: { kind: "direct_current_chat_human_reply", questionItemId: ["request_user_input_async", "call_synthetic", 0], answer: "$10 per day" },
        unattended: { kind: "verified_prior_human_instruction", text: "Synthetic fixture direction", sourceRef: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/direction.json" } },
      allocation: { timezone: "America/Chicago", maxCombinedDailyUsd: 10, researchReservationUsd: 5, communicationsReservationUsd: 5 },
      scope: { draftOnly: true, sendsAuthorized: false, gmailCopiesAuthorized: false, accessChangesAuthorized: false,
        newDraftSessionsAuthorized: true, recurringWorkersAuthorized: true },
      liability: { admissionId: id, jobId: f.job.jobId, originalRequestDigest: f.checkpoint.requestDigest,
        originalCheckpointDigest: communicationsDigest(f.checkpoint), originalPolicyDigest: communicationsDigest(policy), reservedExposureUsd: 1 } };
    const retain = () => { storage.raw = JSON.stringify(authority); db.records.set(root, { recurringDraftBudgetDirection: {
      uri: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/agent-e2e-recurring-budget-owner-direction.json", generation: "1",
      sha256: createHash("sha256").update(storage.raw).digest("hex") } }); };
    retain();
    db.records.set(path, { jobId: f.job.jobId, requestDigest: f.checkpoint.requestDigest, policy, policyDigest: communicationsDigest(policy),
      state: "usage_unknown", originalUsageState: "unresolved", correctedCreate: { requestDigest: f.child.requestDigest,
        claimDigest: "c".repeat(64), policy, policyDigest: communicationsDigest(policy), day, state: "usage_recorded",
        usageState: "best_effort_not_invoice", estimatedModelMicros: 55334 },
      cancelledContinuation: { intentDigest: phase.intentDigest, baselineModelMicros: 55334, usageState: "best_effort_not_invoice" } });
    db.records.set(`${root}/jobs/${f.job.jobId}`, { ...f.job, checkpoint: f.checkpoint, cancelledContinuation: phase, lease: { until: 0 } });
    db.records.set(`${root}/draftBudgetState/current`, { activeAdmissionId: id });
    db.records.set(`${root}/draftBudgetDays/${day}`, { admissions: 3, estimatedModelMicros: 55334 });
    db.records.set("blueprintDailyResearch/sites-first", { config: { soft_target_usd: 5, recurring_budget_authority_reference: "synthetic-retained-direction" } });
    return { ...f, db, id, path, day, authority, retain, phase,
      reserve: (job = "new-job", now = communicationsNow) => reserveCommunicationsDraft(db, job, digest, now) };
  }
  it("serializes one new admission, retaining the original checkpoint/hold and counting known usage once", async () => {
    const f = recurring(), held = structuredClone(f.db.records.get(f.path)), job = structuredClone(f.db.records.get(`${root}/jobs/${f.job.jobId}`));
    const results = await Promise.allSettled([f.reserve("new-1"), f.reserve("new-2")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const id = (results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<string>).value;
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toEqual({ activeAdmissionId: f.id, recurringActiveAdmissionId: id });
    expect(f.db.records.get(`${root}/draftBudgetAdmissions/${id}`)).toMatchObject({ recurringDirection: {
      additionalAllowanceMicros: 3944666, retainedUnknownPolicyReservationMicros: 1000000, accountingComplete: false, invoiceVerified: false } });
    expect(f.db.records.get(f.path)).toEqual(held); expect(f.db.records.get(`${root}/jobs/${f.job.jobId}`)).toEqual(job);
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros).toBe(55334);
  });
  async function rejectedBounded() {
    const f = recurring(), fixture = communicationsFixture();
    const brief = { ...fixture.brief, prospectId: "bounded-prospect", briefId: "bounded-brief" };
    const briefDigest = communicationsDigest(brief), identity = { prospectId: brief.prospectId, briefId: brief.briefId,
      briefDigest, intent: "outreach", inboundMessageId: null };
    const jobId = communicationsDigest(identity), base = "e".repeat(64);
    const requestDigest = communicationsDigest({ requestBaseDigest: base, sessionSpendLimitCents: 100 });
    const admissionId = await reserveCommunicationsDraft(f.db, jobId, requestDigest, communicationsNow, 100);
    const binding = { jobId, requestDigest, inputDigest: "f".repeat(64), createClaimedAt: new Date(communicationsNow - 1000).toISOString(),
      sessionId: null, turnId: null };
    const bodyBase64 = Buffer.from(JSON.stringify({ error: { type: "invalid_request_error", code: "invalid_request_error",
      param: "spend_control", message: "Session budget configuration is not enabled" } })).toString("base64");
    const response = { status: 400, method: "POST", path: "/agents/sessions", capture: "complete",
      requestId: "synthetic-request", bytes: Buffer.from(bodyBase64, "base64").length, bodyBase64,
      bodyDigest: createHash("sha256").update(bodyBase64).digest("hex") };
    const parent: any = { ...identity, jobId, state: "blocked", reason: "agents_api_http_400", attempts: 1, lease: { until: 0 },
      manualDraftRequest: { actorUid: "synthetic-owner", state: "failed", sessionSpendLimitCents: 100 },
      checkpoint: { createClaimedAt: binding.createClaimedAt, sessionId: null, turnId: null, requestDigest,
        sessionSpendRequestBaseDigest: base, sessionSpendLimitCents: 100, draftProfile: "outreach-ready-hypothesis-v1",
        httpFailure: { ...response, binding, retention: "retained" }, httpEvidence: { snapshot: { version: 1, binding: structuredClone(binding), response } } } };
    f.db.records.set(`${root}/jobs/${jobId}`, parent);
    f.db.records.set(`${root}/briefs/${brief.briefId}`, brief);
    f.db.records.set(`${root}/handoffs/${briefDigest}`, { ...fixture.handoff, briefDigest });
    f.db.records.set(`outboundProspects/${brief.prospectId}`, { contactEmail: brief.contact.email, stage: "drafted" });
    // Stable first-touch claim must be present for the original owner job.
    const { communicationsDeliveryKey } = await import("../agents/communications-contract");
    f.db.records.set(`${root}/firstTouches/${communicationsDeliveryKey(parent)}`, { jobId });
    const store = new CommunicationsStore(f.db, () => communicationsNow, "synthetic-worker");
    const input = { prospectId: brief.prospectId, briefId: brief.briefId, expectedBriefDigest: briefDigest,
      sourceCommit: "a".repeat(40), sessionSpendLimitCents: 100, regenerationOf: jobId, expectedJobDigest: communicationsDigest(parent) };
    return { ...f, parent, admissionId, input, store };
  }
  it("atomically classifies only the retained rejection and admits one deterministic owner replacement without refunding exposure", async () => {
    const f = await rejectedBounded(), originalCheckpoint = structuredClone(f.parent.checkpoint);
    const oldLiability = structuredClone(f.db.records.get(f.path));
    const outcomes = await Promise.all([f.store.requestDraft(f.input, "synthetic-owner"), f.store.requestDraft(f.input, "synthetic-owner")]);
    expect(outcomes[0].jobId).toBe(outcomes[1].jobId);
    const old = f.db.records.get(`${root}/jobs/${f.parent.jobId}`);
    expect(old.checkpoint).toEqual(originalCheckpoint); expect(old).toMatchObject({ state: "superseded", replacedBy: outcomes[0].jobId });
    expect(f.db.records.get(`${root}/draftBudgetAdmissions/${f.admissionId}`)).toMatchObject({ state: "create_rejected", usageState: "unresolved",
      sessionReservationMicros: 1000000, rejectedCreateClassification: { replacementJobId: outcomes[0].jobId,
        accountingComplete: false, invoiceVerified: false } });
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toMatchObject({ activeAdmissionId: f.id,
      recurringActiveAdmissionId: null, retainedSessionReservationsMicros: 1000000 });
    const newId = await reserveCommunicationsDraft(f.db, outcomes[0].jobId, digest, communicationsNow, 100);
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toMatchObject({ recurringActiveAdmissionId: newId,
      retainedSessionReservationsMicros: 2000000 });
    expect(f.db.records.get(f.path)).toEqual(oldLiability);
    await expect(recordCommunicationsDraftUsage(f.db, f.parent.jobId, f.parent.checkpoint.requestDigest, usage, communicationsNow))
      .rejects.toThrow("invoice_unresolved");
    await expect(reserveCommunicationsDraft(f.db, "third", digest, communicationsNow, 100)).rejects.toThrow("cost_unresolved");
  });
  it.each(["unknown", "partial", "different_error", "body_digest", "binding", "session", "limit", "owner", "checkpoint", "pointer", "unretained", "second_recovery"])
    ("preserves all records when rejected-create regeneration has %s evidence", async kind => {
      const f = await rejectedBounded(), parent = f.db.records.get(`${root}/jobs/${f.parent.jobId}`), cp = parent.checkpoint;
      if (kind === "unknown") { parent.reason = "agents_api_connection_unknown"; cp.httpFailure.status = 502; }
      if (kind === "partial") cp.httpFailure.capture = "partial";
      if (kind === "different_error") {
        const r = cp.httpEvidence.snapshot.response;
        r.bodyBase64 = Buffer.from(JSON.stringify({ error: { type: "invalid_request_error", code: "invalid_request_error",
          param: "input", message: "Other validation error" } })).toString("base64");
        r.bytes = Buffer.from(r.bodyBase64, "base64").length; r.bodyDigest = createHash("sha256").update(r.bodyBase64).digest("hex");
        cp.httpFailure.bytes = r.bytes; cp.httpFailure.bodyDigest = r.bodyDigest;
      }
      if (kind === "body_digest") cp.httpEvidence.snapshot.response.bodyBase64 += "x";
      if (kind === "binding") cp.httpEvidence.snapshot.binding.inputDigest = "0".repeat(64);
      if (kind === "session") cp.sessionId = "existing-session";
      if (kind === "limit") f.input.sessionSpendLimitCents = 101;
      if (kind === "owner") parent.manualDraftRequest.actorUid = "different-owner";
      if (kind === "pointer") f.db.records.get(`${root}/draftBudgetState/current`).recurringActiveAdmissionId = "other";
      if (kind === "unretained") cp.httpFailure.retention = "private_evidence_unavailable";
      if (kind === "second_recovery") parent.regenerationOf = "0".repeat(64);
      f.input.expectedJobDigest = kind === "checkpoint" ? "0".repeat(64) : communicationsDigest(parent);
      const before = structuredClone([...f.db.records]);
      await expect(f.store.requestDraft(f.input, "synthetic-owner")).rejects.toThrow();
      expect([...f.db.records]).toEqual(before);
    });
  it("reserves the whole selected session limit, retains it after best-effort usage and prevents changed replay or daily oversubscription", async () => {
    const f = recurring(), original = structuredClone(f.db.records.get(f.path));
    const id = await reserveCommunicationsDraft(f.db, "bounded", digest, communicationsNow, 10);
    expect(f.db.records.get(`${root}/draftBudgetAdmissions/${id}`)).toMatchObject({ sessionSpendLimitCents: 10, sessionReservationMicros: 100000 });
    expect(await reserveCommunicationsDraft(f.db, "bounded", digest, communicationsNow, 10)).toBe(id);
    await expect(reserveCommunicationsDraft(f.db, "bounded", digest, communicationsNow, 11)).rejects.toThrow("requires_reconciliation");
    await expect(reserveCommunicationsDraft(f.db, "bounded", digest, communicationsNow)).rejects.toThrow("requires_reconciliation");
    await recordCommunicationsDraftUsage(f.db, "bounded", digest, usage, communicationsNow);
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`)).toMatchObject({ retainedSessionReservationsMicros: 100000, estimatedModelMicros: 55334 + 358 });
    await expect(reserveCommunicationsDraft(f.db, "too-large", digest, communicationsNow, 385)).rejects.toThrow("soft_target_reached");
    await f.reserve("ordinary");
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).retainedSessionReservationsMicros).toBe(100000);
    expect(f.db.records.get(f.path)).toEqual(original);
  });
  it("retains whole session exposure after midnight even after a terminal usage receipt clears the active pointer", async () => {
    const f = recurring();
    await reserveCommunicationsDraft(f.db, "crossing", digest, communicationsNow, 390);
    await recordCommunicationsDraftUsage(f.db, "crossing", digest, usage, communicationsNow + 86400000);
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toMatchObject({ recurringActiveAdmissionId: null, retainedSessionReservationsMicros: 3900000 });
    await expect(reserveCommunicationsDraft(f.db, "tomorrow", digest, communicationsNow + 86400000, 11)).rejects.toThrow("soft_target_reached");
  });
  it("replays only the identical pre-create claim and clears only its owned new pointer with monotonic usage", async () => {
    const f = recurring(), id = await f.reserve(); expect(await f.reserve()).toBe(id);
    await expect(reserveCommunicationsDraft(f.db, "new-job", "b".repeat(64), communicationsNow)).rejects.toThrow("requires_reconciliation");
    await recordCommunicationsDraftUsage(f.db, "new-job", digest, usage, communicationsNow);
    await recordCommunicationsDraftUsage(f.db, "new-job", digest, { input_tokens: 1, output_tokens: 0, total_tokens: 1 }, communicationsNow);
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toEqual({ activeAdmissionId: f.id, recurringActiveAdmissionId: null });
    expect(f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros).toBe(55334 + 358);
    const later = await f.reserve("later"); await recordCommunicationsDraftUsage(f.db, "new-job", digest, usage, communicationsNow);
    await recordCommunicationsDraftUsage(f.db, f.job.jobId, f.child.requestDigest, { input_tokens: 1, output_tokens: 0, total_tokens: 1 }, communicationsNow);
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toEqual({ activeAdmissionId: f.id, recurringActiveAdmissionId: later });
  });
  it("keeps missing usage across a day boundary and stops at the remaining soft allowance without adding a result quota", async () => {
    const f = recurring();
    for (let i = 0; i < 6; i++) { await f.reserve(`known-${i}`); await recordCommunicationsDraftUsage(f.db, `known-${i}`, digest, usage, communicationsNow); }
    await f.reserve(); await recordCommunicationsDraftUsage(f.db, "new-job", digest, null, communicationsNow);
    await expect(f.reserve("tomorrow", communicationsNow + 86400000)).rejects.toThrow("cost_unresolved");
    const g = recurring(); g.db.records.get(`${root}/draftBudgetDays/${g.day}`).estimatedModelMicros = 4000000;
    await expect(g.reserve()).rejects.toThrow("soft_target_reached");
  });
  it.each(["expired", "hash", "generation", "manual_grant", "unattended", "send", "checkpoint", "policy", "phase_pending", "phase_usage_unknown", "lease", "research", "auto_send", "baseline_missing", "other_unknown", "ref_race"])("refuses %s without a new claim", async kind => {
    const f = recurring(), row = f.db.records.get(f.path), job = f.db.records.get(`${root}/jobs/${f.job.jobId}`);
    if (kind === "expired") f.authority.expiresAt = new Date(communicationsNow).toISOString();
    if (kind === "manual_grant") f.authority.version = "blueprint.communications-cancelled-continuation-authority.v1";
    if (kind === "unattended") f.authority.direction.unattended.text = "";
    if (kind === "send") f.authority.scope.sendsAuthorized = true;
    f.retain();
    if (kind === "hash") storage.raw += " ";
    if (kind === "generation") storage.generation = "2";
    if (kind === "checkpoint") job.checkpoint.requestDigest = "f".repeat(64);
    if (kind === "policy") row.policy.softTargetUsd = 0;
    if (kind === "phase_pending") job.cancelledContinuation.checkpoint.finalRepairSettled = false;
    if (kind === "phase_usage_unknown") row.cancelledContinuation.usageState = "unresolved";
    if (kind === "lease") job.lease.until = communicationsNow + 1;
    if (kind === "research") f.db.records.get("blueprintDailyResearch/sites-first").config.soft_target_usd = 6;
    if (kind === "auto_send") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    if (kind === "baseline_missing") f.db.records.get(`${root}/draftBudgetDays/${f.day}`).estimatedModelMicros = 0;
    if (kind === "other_unknown") f.db.records.set(`${root}/draftBudgetAdmissions/unrelated`, { state: "usage_unknown" });
    if (kind === "ref_race") storage.afterRead = () => { f.db.records.get(root).recurringDraftBudgetDirection.sha256 = "f".repeat(64); };
    await expect(f.reserve()).rejects.toThrow();
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toEqual({ activeAdmissionId: f.id });
    expect(f.db.records.has(`${root}/draftBudgetAdmissions/${communicationsDigest({ jobId: "new-job" })}`)).toBe(false);
  });
  it.each(["storage", "transaction"])("refuses authority expiring during awaited %s instead of trusting the captured clock", async boundary => {
    vi.useFakeTimers({ toFake: ["performance"] });
    try {
      const f = recurring(); f.authority.expiresAt = new Date(communicationsNow + 1000).toISOString(); f.retain();
      if (boundary === "storage") storage.afterRead = () => vi.advanceTimersByTime(1001);
      else {
        const transact = f.db.runTransaction;
        f.db.runTransaction = async (callback: any) => { vi.advanceTimersByTime(1001); return transact(callback); };
      }
      await expect(f.reserve()).rejects.toThrow();
      expect(f.db.records.get(`${root}/draftBudgetState/current`)).toEqual({ activeAdmissionId: f.id });
      expect(f.db.records.has(`${root}/draftBudgetAdmissions/${communicationsDigest({ jobId: "new-job" })}`)).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("prioritizes the new active draft and observes expanded old-phase usage without the immutable old-child reader", async () => {
    const f = recurring(); await f.reserve();
    const cp = { sessionId: "new-session", requestDigest: digest };
    f.db.records.set(`${root}/jobs/new-job`, { checkpoint: cp });
    const api = { reconcileUsage: vi.fn(async () => usage), reconcileCancelledContinuationUsage: vi.fn(async () => ({ input_tokens: 1, output_tokens: 0, total_tokens: 1 })) };
    await reconcileCommunicationsDraftCost(f.db, api, communicationsNow);
    expect(api.reconcileUsage).toHaveBeenCalledWith(cp, "new-job"); expect(api.reconcileCancelledContinuationUsage).not.toHaveBeenCalled();
    Object.assign(f.checkpoint.rejectedCreateRecovery, { originalRequestDigest: f.checkpoint.requestDigest, correctedRequestDigest: f.child.requestDigest });
    f.db.records.get(`${root}/jobs/${f.job.jobId}`).checkpoint = f.checkpoint;
    await reconcileCommunicationsDraftCost(f.db, api, communicationsNow);
    expect(api.reconcileUsage).toHaveBeenCalledTimes(1);
    expect(api.reconcileCancelledContinuationUsage).toHaveBeenCalledWith(f.checkpoint, f.phase, f.job.jobId);
    await reconcileCommunicationsDraftCost(f.db, { reconcileUsage: api.reconcileUsage }, communicationsNow);
    expect(api.reconcileUsage).toHaveBeenCalledTimes(1);
  });
  it("uses the owned new pointer when binding an existing unknown-create session", async () => {
    const f = recurring(), jobId = "9".repeat(64), id = await f.reserve(jobId), cp = { createClaimedAt: new Date(communicationsNow).toISOString(), requestDigest: digest };
    f.db.records.set(`${root}/jobs/${jobId}`, { jobId, prospectId: "new-prospect", briefDigest: digest, state: "blocked", checkpoint: cp, lease: { until: 0 } });
    const api = { verifyExistingDraftSession: vi.fn(async () => ({ sessionId: "existing-session", requestDigest: digest, turnId: "existing-turn", usage })) };
    await reconcileCommunicationsDraftSession(f.db, api, { jobId, prospectId: "new-prospect", briefDigest: digest,
      expectedCheckpointDigest: communicationsDigest(cp), sessionId: "existing-session", requestedBy: "synthetic-operator" }, communicationsNow);
    expect(f.db.records.get(`${root}/draftBudgetAdmissions/${id}`).state).toBe("usage_recorded");
    expect(f.db.records.get(`${root}/draftBudgetState/current`)).toEqual({ activeAdmissionId: f.id, recurringActiveAdmissionId: null });
  });
});

describe("communications-only soft model target and serialized admissions", () => {
  it("serializes fresh admissions and retains an unresolved in-flight reservation", async () => {
    const db = memoryFirestore();
    const results = await Promise.allSettled(["job-1", "job-2"].map(job => reserveCommunicationsDraft(db, job, digest, communicationsNow)));
    expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`)).toMatchObject({ admissions: 1, timezone: "America/Chicago", estimatedModelMicros: 0 });
    await expect(reserveCommunicationsDraft(db, "job-3", digest, communicationsNow)).rejects.toThrow("cost_unresolved");
  });
  it("reuses the same proven pre-create admission without counting twice, but fences a different request", async () => {
    const db = memoryFirestore(), first = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).toBe(first);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).admissions).toBe(1);
    await expect(reserveCommunicationsDraft(db, "job-1", "b".repeat(64), communicationsNow)).rejects.toThrow("reservation_requires_reconciliation");
  });
  it("counts verified usage conservatively and never silently refunds later lower best-effort counts", async () => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(await recordCommunicationsDraftUsage(db, "job-1", digest, usage, communicationsNow)).toBe(true);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
    await recordCommunicationsDraftUsage(db, "job-1", digest, { input_tokens: 1, output_tokens: 0, total_tokens: 1 }, communicationsNow);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
    await expect(reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).rejects.toThrow();
  });
  it.each([null, {}, { input_tokens: 1, output_tokens: -1, total_tokens: 0 }, { input_tokens: 100, output_tokens: 1, total_tokens: 2 },
    { ...usage, input_tokens_details: { cached_tokens: 1001 } }])("retains unknown/inconsistent cost without treating it as zero", async invalid => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(await recordCommunicationsDraftUsage(db, "job-1", digest, invalid, communicationsNow)).toBe(false);
    expect(estimatedDraftMicros(invalid)).toBeNull();
    await expect(reserveCommunicationsDraft(db, "job-2", digest, communicationsNow + 86400000)).rejects.toThrow("cost_unresolved");
  });
  it("stops at the initial five admissions independently of discovery volume", async () => {
    const db = memoryFirestore();
    for (let i = 0; i < 5; i++) { await reserveCommunicationsDraft(db, `job-${i}`, digest, communicationsNow); await recordCommunicationsDraftUsage(db, `job-${i}`, digest, usage, communicationsNow); }
    expect(COMMUNICATIONS_DRAFT_BUDGET.maxDailyAdmissions).toBe(5);
    await expect(reserveCommunicationsDraft(db, "job-6", digest, communicationsNow)).rejects.toThrow("daily_admission_limit");
    // UTC midnight during the user's evening does not provide another allowance.
    await expect(reserveCommunicationsDraft(db, "job-6", digest, Date.parse("2026-10-01T01:00:00Z"))).rejects.toThrow("daily_admission_limit");
    await expect(reserveCommunicationsDraft(db, "job-6", digest, Date.parse("2026-10-01T05:00:00Z"))).resolves.toBeTruthy();
  });
  it("refuses further calls once known cost reaches the soft target, without claiming an in-flight hard cap", async () => {
    const db = memoryFirestore(); await db.doc(`${root}/draftBudgetDays/2026-09-30`).set({ admissions: 1, estimatedModelMicros: 2500000 });
    await expect(reserveCommunicationsDraft(db, "job-2", digest, communicationsNow)).rejects.toThrow("soft_target_reached");
  });
  it.each(["", "0", "-1", "1e3", "01", "NaN", "Infinity", "0.0000001"])("refuses absent or invalid private target %s before admission", async value => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", value);
    expect(() => configuredCommunicationsDraftBudget()).toThrow("communications_draft_target_not_configured");
    const db = memoryFirestore();
    await expect(reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).rejects.toThrow("communications_draft_target_not_configured");
    expect(db.records.size).toBe(0);
  });
  it("binds a private configured target and refuses a changed pre-create reservation", async () => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(db.records.get(`${root}/draftBudgetAdmissions/${communicationsDigest({ jobId: "job-1" })}`).policy.softTargetUsd).toBe(2.5);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "3");
    await expect(reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).rejects.toThrow("reservation_requires_reconciliation");
  });
  it("keeps a pre-create budget-held prospect queued without consuming its recovery attempts", async () => {
    const db = memoryFirestore(), store = new CommunicationsStore(db, () => communicationsNow, "budget-worker");
    const job = await store.enqueue({ prospectId: "prospect-1", briefId: "brief-1", briefDigest: digest, intent: "outreach", inboundMessageId: null });
    await store.claim(job.jobId); await store.deferDraftForBudget(job.jobId, "communications_draft_daily_admission_limit");
    expect(db.records.get(`${root}/jobs/${job.jobId}`)).toMatchObject({ state: "queued", attempts: 0,
      reason: "communications_draft_daily_admission_limit", nextAttemptAt: communicationsNow + 15 * 60000 });
  });
  it("reconciles one actual saved root turn with reads and releases accounting only after verified usage", async () => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    await recordCommunicationsDraftUsage(db, "job-1", digest, null, communicationsNow);
    const checkpoint = { sessionId: "mock-session", turnId: "mock-turn", createClaimedAt: "2026-09-30T23:00:00Z" };
    await db.doc(`${root}/jobs/job-1`).set({ checkpoint });
    const api = { reconcileUsage: vi.fn(async () => usage) };
    await reconcileCommunicationsDraftCost(db, api, communicationsNow);
    expect(api.reconcileUsage).toHaveBeenCalledWith(checkpoint, "job-1");
    expect(db.records.get(`${root}/draftBudgetAdmissions/${communicationsDigest({ jobId: "job-1" })}`).state).toBe("usage_recorded");
    await expect(reserveCommunicationsDraft(db, "job-2", digest, communicationsNow)).resolves.toBeTruthy();
  });
  async function unknownCreate() {
    const db = memoryFirestore(), jobId = "a".repeat(64);
    await reserveCommunicationsDraft(db, jobId, digest, communicationsNow);
    const checkpoint = { createClaimedAt: new Date(communicationsNow).toISOString(), sessionId: null, turnId: null, requestDigest: digest };
    await db.doc(`${root}/jobs/${jobId}`).set({ jobId, prospectId: "prospect-1", briefDigest: "b".repeat(64), state: "blocked", attempts: 3,
      checkpoint, lease: { owner: "original-worker", until: 0 } });
    const input = { jobId, prospectId: "prospect-1", briefDigest: "b".repeat(64), expectedCheckpointDigest: communicationsDigest(checkpoint),
      sessionId: "mock-existing-session", requestedBy: "authenticated-operator" };
    const api = { verifyExistingDraftSession: vi.fn(async () => ({ sessionId: input.sessionId, requestDigest: digest, turnId: "mock-root-turn", usage })) };
    return { db, input, api, checkpoint, admission: `${root}/draftBudgetAdmissions/${communicationsDigest({ jobId })}` };
  }
  it("atomically recovers a verified existing session and accounts once, preserving claim, attempts and original day", async () => {
    const f = await unknownCreate();
    const results = await Promise.all([reconcileCommunicationsDraftSession(f.db, f.api, f.input, communicationsNow + 86400000),
      reconcileCommunicationsDraftSession(f.db, f.api, f.input, communicationsNow + 86400000)]);
    expect(results).toEqual(Array(2).fill({ state: "usage_recorded", sessionRecovered: true, costResolved: true }));
    expect(f.db.records.get(`${root}/draftBudgetDays/2026-09-30`)).toMatchObject({ admissions: 1, estimatedModelMicros: 358 });
    expect(f.db.records.get(`${root}/jobs/${f.input.jobId}`)).toMatchObject({ state: "blocked", attempts: 3,
      checkpoint: { ...f.checkpoint, sessionId: f.input.sessionId, turnId: "mock-root-turn" } });
    await reserveCommunicationsDraft(f.db, "next-job", digest, communicationsNow + 86400000);
    const active = f.db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId;
    await reconcileCommunicationsDraftSession(f.db, f.api, f.input, communicationsNow + 86400000);
    expect(f.db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(active);
    expect(f.db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
  });
  it.each([null, { input_tokens: 1, output_tokens: 2, total_tokens: 1 }])("attaches a verified session but retains the global hold for unknown/inconsistent usage", async invalid => {
    const f = await unknownCreate(); f.api.verifyExistingDraftSession.mockResolvedValueOnce({ sessionId: f.input.sessionId, requestDigest: digest,
      turnId: "mock-root-turn", usage: invalid as any });
    expect(await reconcileCommunicationsDraftSession(f.db, f.api, f.input, communicationsNow)).toEqual({ state: "usage_unknown", sessionRecovered: true, costResolved: false });
    await expect(reserveCommunicationsDraft(f.db, "other-job", digest, communicationsNow + 86400000)).rejects.toThrow("cost_unresolved");
    expect(f.db.records.get(`${root}/draftBudgetDays/2026-09-30`)).toMatchObject({ admissions: 1, estimatedModelMicros: 0 });
  });
  it("exposes a crashed expired unknown-create job and leaves it blocked after GET-only accounting recovery", async () => {
    const f = await unknownCreate();
    await f.db.doc(`${root}/jobs/${f.input.jobId}`).update({ state: "running", lease: { owner: "crashed-worker", until: communicationsNow - 1 } });
    for (let i = 0; i < 20; i++) await f.db.doc(`${root}/jobs/older-${i}`).set({ jobId: `older-${i}`, prospectId: `older-prospect-${i}`,
      briefDigest: digest, state: "blocked", attempts: 1, checkpoint: { createClaimedAt: null, sessionId: null, turnId: null } });
    const store = new CommunicationsStore(f.db, () => communicationsNow, "observer");
    const visible = await store.blockedJobs(); expect(visible).toHaveLength(20);
    expect(visible[0]).toEqual(expect.objectContaining({ jobId: f.input.jobId,
      expectedJobDigest: communicationsDigest(f.db.records.get(`${root}/jobs/${f.input.jobId}`)),
      expectedCheckpointDigest: f.input.expectedCheckpointDigest, sessionReconciliationRequired: true, sessionId: null }));
    await reconcileCommunicationsDraftSession(f.db, f.api, f.input, communicationsNow);
    expect(f.db.records.get(`${root}/jobs/${f.input.jobId}`)).toMatchObject({ state: "blocked", attempts: 3,
      reason: "communications_session_reconciled_requires_operator_retry" });
  });
  it.each(["stale_checkpoint", "active_lease", "wrong_job", "wrong_prospect", "wrong_brief", "missing_claim", "changed_policy", "wrong_digest", "wrong_session", "race", "race_state"])("fails closed without changing accounting during operator recovery: %s", async kind => {
    const f = await unknownCreate(), job = f.db.records.get(`${root}/jobs/${f.input.jobId}`);
    if (kind === "stale_checkpoint") f.input.expectedCheckpointDigest = "c".repeat(64);
    if (kind === "active_lease") job.lease.until = communicationsNow + 1;
    if (kind === "wrong_job") job.jobId = "other-job";
    if (kind === "wrong_prospect") f.input.prospectId = "other-prospect";
    if (kind === "wrong_brief") f.input.briefDigest = "c".repeat(64);
    if (kind === "missing_claim") { job.checkpoint.createClaimedAt = null; f.input.expectedCheckpointDigest = communicationsDigest(job.checkpoint); }
    if (kind === "changed_policy") f.db.records.get(f.admission).policyDigest = "c".repeat(64);
    if (kind === "wrong_digest") f.api.verifyExistingDraftSession.mockResolvedValueOnce({ sessionId: f.input.sessionId, requestDigest: "c".repeat(64), turnId: "mock-root-turn", usage });
    if (kind === "wrong_session") f.api.verifyExistingDraftSession.mockResolvedValueOnce({ sessionId: "other-session", requestDigest: digest, turnId: "mock-root-turn", usage });
    if (kind === "race") f.api.verifyExistingDraftSession.mockImplementationOnce(async () => {
      await f.db.doc(`${root}/jobs/${f.input.jobId}`).update({ checkpoint: { ...f.checkpoint, turnId: "changed" } });
      return { sessionId: f.input.sessionId, requestDigest: digest, turnId: "mock-root-turn", usage };
    });
    if (kind === "race_state") f.api.verifyExistingDraftSession.mockImplementationOnce(async () => {
      await f.db.doc(`${root}/jobs/${f.input.jobId}`).update({ state: "queued" });
      return { sessionId: f.input.sessionId, requestDigest: digest, turnId: "mock-root-turn", usage };
    });
    await expect(reconcileCommunicationsDraftSession(f.db, f.api, f.input, communicationsNow)).rejects.toThrow();
    expect(f.db.records.get(f.admission).state).toBe("reserved");
    expect(f.db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBeTruthy();
    expect(f.db.records.get(`${root}/draftBudgetDays/2026-09-30`)).toMatchObject({ admissions: 1, estimatedModelMicros: 0 });
  });
  it("keeps a failed pre-POST checkpoint write on the existing same-job retry and reused admission path", async () => {
    let now = communicationsNow;
    const f = communicationsFixture(), db = memoryFirestore(), store = new CommunicationsStore(db, () => now, "synthetic-worker");
    await db.doc("outboundProspects/prospect-1").set({ contactEmail: f.brief.contact.email, siteId: f.brief.siteId, taskId: f.brief.taskId, stage: "drafted" });
    await db.doc(`${root}/briefs/${f.brief.briefId}`).set(f.brief);
    await db.doc(`${root}/handoffs/${f.job.briefDigest}`).set(f.handoff);
    const job = await store.enqueue({ prospectId: f.job.prospectId, briefId: f.job.briefId, briefDigest: f.job.briefDigest, intent: "outreach", inboundMessageId: null });
    await store.claim(job.jobId);
    const admission = await reserveCommunicationsDraft(db, job.jobId, digest, communicationsNow);
    await store.finish(job, "blocked", "communications_context_or_permission_unavailable");
    now += 180001; // The original inference lease must expire before operator retry.
    await store.retryBlocked({ jobId: job.jobId, prospectId: job.prospectId, briefDigest: job.briefDigest, requestedBy: "authenticated-operator" });
    expect((await store.claim(job.jobId))?.attempts).toBe(2);
    expect(await reserveCommunicationsDraft(db, job.jobId, digest, communicationsNow)).toBe(admission);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).admissions).toBe(1);
    await expect(reserveCommunicationsDraft(db, "other-job", digest, communicationsNow)).rejects.toThrow("cost_unresolved");
  });
});


const correctionInput = (jobId = "job-1", now = communicationsNow): CommunicationsRejectedCreateDraftBudgetClaim => ({
  jobId, originalRequestDigest: digest, originalCheckpointDigest: "b".repeat(64), correctedRequestDigest: "c".repeat(64),
  recoveryDigest: "d".repeat(64), ownerDirectionRef: "private-reviewed-owner-direction", negativeCoverageDigest: "e".repeat(64),
  originalCreateClaimedAt: new Date(now - 360000).toISOString(), correctedCreateClaimedAt: new Date(now).toISOString(), deadlineMs: now + 180000,
});
const claimCorrection = (db: ReturnType<typeof memoryFirestore>, input = correctionInput(), now = communicationsNow) =>
  db.runTransaction(tx => claimCommunicationsRejectedCreateDraftBudget(db, tx, input, now));

describe("same-job confirmed rejected-create corrected budget slot", () => {
  it("retains original unknown reservation/hold and claims one corrected admission without a new job", async () => {
    const db = memoryFirestore(), id = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    await recordCommunicationsDraftUsage(db, "job-1", digest, null, communicationsNow);
    const original = structuredClone(db.records.get(`${root}/draftBudgetAdmissions/${id}`));
    expect(await claimCorrection(db)).toEqual({ admissionId: id });
    const row = db.records.get(`${root}/draftBudgetAdmissions/${id}`);
    expect(row.requestDigest).toBe(original.requestDigest); expect(row.admittedAt).toBe(original.admittedAt);
    expect(row).toMatchObject({ state: "usage_unknown", usageState: "unresolved", originalUsageState: "unresolved" });
    expect(row.correctedCreate).toMatchObject({ requestDigest: "c".repeat(64), state: "reserved", usageState: "unresolved", deadlineMs: communicationsNow + 180000 });
    expect(row.correctedCreate.estimatedModelMicros).toBeUndefined();
    expect(db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(id);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).admissions).toBe(2);
    expect(await claimCorrection(db)).toEqual({ admissionId: id });
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).admissions).toBe(2);
    await expect(claimCorrection(db, { ...correctionInput(), correctedRequestDigest: "f".repeat(64) })).rejects.toThrow("already_claimed");
    await expect(reserveCommunicationsDraft(db, "different-job", digest, communicationsNow + 86400000)).rejects.toThrow("cost_unresolved");
  });

  it("adds corrected known usage monotonically while the original cost stays unknown and blocks other jobs", async () => {
    const db = memoryFirestore(), id = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    await claimCorrection(db);
    expect(await recordCommunicationsDraftUsage(db, "job-1", "c".repeat(64), usage, communicationsNow)).toBe(false);
    expect(db.records.get(`${root}/draftBudgetAdmissions/${id}`)).toMatchObject({ state: "usage_unknown", originalUsageState: "unresolved",
      knownTotalModelMicros: 358, knownTotalIsComplete: false, correctedCreate: { state: "usage_recorded", estimatedModelMicros: 358 } });
    expect(db.records.get(`${root}/draftBudgetAdmissions/${id}`).estimatedModelMicros).toBeUndefined();
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
    await recordCommunicationsDraftUsage(db, "job-1", "c".repeat(64), { input_tokens: 1, output_tokens: 0, total_tokens: 1 }, communicationsNow);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
    expect(db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(id);
    await expect(reserveCommunicationsDraft(db, "another-job", digest, communicationsNow)).rejects.toThrow("cost_unresolved");
    await expect(recordCommunicationsDraftUsage(db, "job-1", "f".repeat(64), usage, communicationsNow)).rejects.toThrow("usage_binding_changed");
  });

  it("does not mistake usage from either one attempt as the total and sums verified originals independently", async () => {
    const db = memoryFirestore(), id = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    await claimCorrection(db);
    await recordCommunicationsDraftUsage(db, "job-1", digest, usage, communicationsNow);
    expect(db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(id);
    expect(db.records.get(`${root}/draftBudgetAdmissions/${id}`).knownTotalIsComplete).toBe(false);
    expect(await recordCommunicationsDraftUsage(db, "job-1", "c".repeat(64), usage, communicationsNow)).toBe(true);
    expect(db.records.get(`${root}/draftBudgetAdmissions/${id}`)).toMatchObject({ knownTotalModelMicros: 716, knownTotalIsComplete: true });
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(716);
  });

  it("keeps the corrected slot unknown when usage is absent and does not invent a full zero estimate", async () => {
    const db = memoryFirestore(), id = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow); await claimCorrection(db);
    expect(await recordCommunicationsDraftUsage(db, "job-1", "c".repeat(64), null, communicationsNow)).toBe(false);
    const row = db.records.get(`${root}/draftBudgetAdmissions/${id}`);
    expect(row.correctedCreate).toMatchObject({ state: "usage_unknown", usageState: "unresolved" });
    expect(row.correctedCreate.estimatedModelMicros).toBeUndefined();expect(row.knownTotalModelMicros).toBeUndefined();
    expect(db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(id);
  });

  it.each(["deadline", "wrong_original", "wrong_active", "policy_changed", "target_reached", "daily_limit"])
    ("rejects %s without mutating the original reservation", async kind => {
      const db = memoryFirestore(), id = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow), input = correctionInput();
      if (kind === "deadline") input.deadlineMs += 1;
      if (kind === "wrong_original") input.originalRequestDigest = "f".repeat(64);
      if (kind === "wrong_active") db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId = "another";
      if (kind === "policy_changed") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "2.4");
      if (kind === "target_reached") db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros = 2500000;
      if (kind === "daily_limit") db.records.get(`${root}/draftBudgetDays/2026-09-30`).admissions = 5;
      const before = structuredClone(db.records.get(`${root}/draftBudgetAdmissions/${id}`));
      await expect(claimCorrection(db, input)).rejects.toThrow();
      expect(db.records.get(`${root}/draftBudgetAdmissions/${id}`)).toEqual(before);
    });

  it("reconciles only the exact corrected saved child and still retains the original unknown hold", async () => {
    const db = memoryFirestore(), id = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow); await claimCorrection(db);
    const checkpoint = { createClaimedAt: correctionInput().originalCreateClaimedAt, requestDigest: digest, sessionId: null, turnId: null,
      rejectedCreateRecovery: { originalRequestDigest: digest, correctedRequestDigest: "c".repeat(64),
        checkpoint: { createClaimedAt: correctionInput().correctedCreateClaimedAt, requestDigest: "c".repeat(64), sessionId: "corrected-saved-session", turnId: "corrected-turn" } } };
    db.records.set(`${root}/jobs/job-1`, { jobId: "job-1", checkpoint });
    const api = { reconcileUsage: vi.fn(async (value: any) => { expect(value).toEqual(checkpoint); return usage; }) };
    await reconcileCommunicationsDraftCost(db, api, communicationsNow);
    expect(api.reconcileUsage).toHaveBeenCalledTimes(1);
    expect(db.records.get(`${root}/draftBudgetAdmissions/${id}`).correctedCreate.estimatedModelMicros).toBe(358);
    expect(db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(id);
    checkpoint.rejectedCreateRecovery.checkpoint.requestDigest = "f".repeat(64);
    await expect(reconcileCommunicationsDraftCost(db, api, communicationsNow)).rejects.toThrow("usage_binding_changed");
  });
});

it('legacy positive session recovery cannot overwrite the original checkpoint or misattribute corrected child usage',async()=>{
  const db=memoryFirestore(),jobId='job-1',id=await reserveCommunicationsDraft(db,jobId,digest,communicationsNow);
  await claimCorrection(db);
  const checkpoint={createClaimedAt:correctionInput().originalCreateClaimedAt,requestDigest:digest,sessionId:null,turnId:null,
    rejectedCreateRecovery:{correctedRequestDigest:'c'.repeat(64),checkpoint:{sessionId:null,turnId:null,requestDigest:'c'.repeat(64)}}};
  db.records.set(`${root}/jobs/${jobId}`,{jobId,prospectId:'prospect-1',briefDigest:'b'.repeat(64),state:'blocked',checkpoint,lease:{until:0}});
  const input={jobId,prospectId:'prospect-1',briefDigest:'b'.repeat(64),expectedCheckpointDigest:communicationsDigest(checkpoint),
    sessionId:'actual-corrected-session',requestedBy:'verified-operator'};
  const api={verifyExistingDraftSession:vi.fn(async()=>({sessionId:input.sessionId,requestDigest:'c'.repeat(64),turnId:'corrected-turn',usage}))};
  const original=structuredClone(db.records.get(`${root}/jobs/${jobId}`));
  await expect(reconcileCommunicationsDraftSession(db,api,input,communicationsNow)).rejects.toThrow('corrected_create_session_recovery_requires_child');
  expect(api.verifyExistingDraftSession).not.toHaveBeenCalled();expect(db.records.get(`${root}/jobs/${jobId}`)).toEqual(original);
  expect(db.records.get(`${root}/draftBudgetState/current`).activeAdmissionId).toBe(id);
});
