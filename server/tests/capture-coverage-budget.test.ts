// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null }));
import { reserveCaptureCoverageInference } from "../utils/captureCoverageInferenceBudget";
import { inferenceProgrammeContextDigest } from "../utils/inferenceProgrammeAdmission";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { SITE_ASSESSMENT_MODEL } from "../agents/provider-config";

const source = { kind: "browser_pending", key: "source-one" }, brief = { summary: "Move racks" };
const metadata = { capture_id: "walkthrough-one", review_id: "a".repeat(64), coverage_claim_token: "owned-claim" };
const path = `captureCoverageReviews/${metadata.review_id}`;
const usage = { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 0 };
function seed() {
  sharedFakeFirestoreState.docs.set(path, { state: "running", attempts: 1, claim_token: "owned-claim", captureId: metadata.capture_id,
    requestId: "one", binding: { source, brief_digest: humanDecisionDigest(brief) } });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/one", brief);
  sharedFakeFirestoreState.docs.set("inboundRequests/one", { request: { consent_attestation: { granted: true,
    statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } },
    capture_privacy_source_bound_decision: { proceeded: true, capture_id: metadata.capture_id, producer_source: source } });
}
beforeEach(() => { sharedFakeFirestoreState.docs.clear(); vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "5"); seed(); });
describe("normal coverage durable inference allowance", () => {
  const assessmentMetadata = { capture_id: metadata.capture_id, assessment_run_id: "assessment-one",
    assessment_request_id: "one", assessment_source: source };
  function seedAssessment(id = "assessment-one") {
    sharedFakeFirestoreState.docs.set(`agentRuns/${id}`, { task_kind: "site_assessment", status: "running",
      input: { input: { context: { request_id: "one" } } } });
  }
  it("shares one cap between coverage and SDK calls, including a new SDK run", async () => {
    const coverage = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await coverage.record(usage);
    seedAssessment();
    const sol = await reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {});
    expect(sol.receipt.capture_exposure_usd).toBeCloseTo(1.818624 + 0.33192);
    await sol.record({ input_tokens: 100, output_tokens: 10 });
    const probe = await reserveCaptureCoverageInference("gemini-3.8-flash", assessmentMetadata);
    await probe.record(usage);
    seedAssessment("assessment-two");
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash",
      { ...assessmentMetadata, assessment_run_id: "assessment-two" })).rejects.toThrow("inference_cost_cap");
  });
  it("holds uncertain SDK exposure against coverage and rejects inactive SDK runs", async () => {
    seedAssessment();
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), attempts: 0 });
    const sol = await reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {});
    await sol.record(undefined);
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("cost_unresolved");
    sharedFakeFirestoreState.docs.set("agentRuns/assessment-one", { task_kind: "site_assessment", status: "completed" });
    await expect(reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {})).rejects.toThrow("claim_changed");
  });
  it("fails closed on historical SDK exposure before admitting first coverage", async () => {
    seedAssessment();
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("historical_exposure_unresolved");
  });
  it("does not treat offloaded historical SDK input as absent exposure", async () => {
    sharedFakeFirestoreState.docs.set("agentRuns/offloaded", { task_kind: "site_assessment", status: "completed",
      input: null, agent_evidence_ref: { version: 1 } });
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("agent_evidence_reference_invalid");
  });
  it("shares reservations across corrections, retries, and changed briefs", async () => {
    const first = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await first.record(usage);
    const changed = { summary: "Changed brief" };
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/one", changed);
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), binding: { source, brief_digest: humanDecisionDigest(changed) } });
    const second = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    expect(second.receipt.capture_exposure_usd).toBeCloseTo(2 * 1.818624);
    await second.record(usage);
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("inference_cost_cap");
  });
  it("does not reset uncertain exposure after restart", async () => {
    const first = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await first.record(undefined);
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("cost_unresolved");
  });
  it("rejects stale claims and changed consent before reservation", async () => {
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", { ...metadata, coverage_claim_token: "other" })).rejects.toThrow("claim_changed");
    sharedFakeFirestoreState.docs.set("inboundRequests/one", {});
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("source_changed");
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.includes("/budget-"))).toHaveLength(0);
  });
  it("fails closed on historical pre-budget attempts", async () => {
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), attempts: 2 });
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("historical_exposure_unresolved");
  });
  it("fails closed on a paid run from before the durable queue", async () => {
    sharedFakeFirestoreState.docs.set("agentRuns/legacy", { task_kind: "capture_coverage", status: "completed",
      metadata: { capture_id: metadata.capture_id }, artifacts: { usage: { prompt_tokens: 100 } } });
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("historical_exposure_unresolved");
  });
  it("requires the durable review claim instead of an untracked direct call", async () => {
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", {})).rejects.toThrow("claim_required");
  });
});


describe("server-owned programme baseline controls", () => {
  it("does not admit optional coverage on a programme-bound request", async () => {
    sharedFakeFirestoreState.docs.get("inboundRequests/one").inference_program_id = "programme-one";
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("inference_programme_coverage_deferred");
    expect([...sharedFakeFirestoreState.docs.keys()].some(key => key.includes("/budget-"))).toBe(false);
  });
  it("requires canonical programme authority before SDK reservation", async () => {
    sharedFakeFirestoreState.docs.get("inboundRequests/one").inference_program_id = "programme-one";
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), attempts: 0 });
    sharedFakeFirestoreState.docs.set("agentRuns/assessment-one", { task_kind: "site_assessment", status: "running",
      input: { input: { context: { request_id: "one" } } } });
    await expect(reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, {
      capture_id: metadata.capture_id, assessment_run_id: "assessment-one", assessment_request_id: "one", assessment_source: source,
      assessment_video_sha256: "a".repeat(64),
    }, "openai", {})).rejects.toThrow("inference_programme_authority_invalid");
  });
});


describe("programme-bound actual reservation transaction", () => {
  const programmePath = "inferencePrograms/programme-one";
  const assessmentMetadata = { capture_id: metadata.capture_id, assessment_run_id: "assessment-one",
    assessment_request_id: "one", assessment_source: source, assessment_video_sha256: "a".repeat(64) };
  const budgetPath = `captureCoverageReviews/budget-${humanDecisionDigest({ capture_id: metadata.capture_id })}`;
  const read = (path: string): any => sharedFakeFirestoreState.docs.get(path);
  beforeEach(() => {
    read("inboundRequests/one").inference_program_id = "programme-one";
    read(path).attempts = 0;
    sharedFakeFirestoreState.docs.set("agentRuns/assessment-one", { task_kind: "site_assessment", status: "running",
      input: { input: { context: { request_id: "one" } } } });
    sharedFakeFirestoreState.docs.set(programmePath, { schema_version: "inference_program.v1", status: "active",
      authority_ref: "synthetic-test-approval", ledger_sha256: `sha256:${"b".repeat(64)}`, request_id: "one", capture_id: metadata.capture_id,
      context_digest: inferenceProgrammeContextDigest(read("inboundRequests/one"), brief), video_sha256: "a".repeat(64),
      expires_at_ms: Date.now() + 60000, cap_micro_usd: 5000000, slots: [
        { id: "original-gem", provider: "gemini", model: "gemini-3.8-flash", reserved_micro_usd: 1818624, state: "unknown" },
        { id: "original-sol", provider: "openai", model: SITE_ASSESSMENT_MODEL, reserved_micro_usd: 331920, state: "recorded" },
        ...[1, 2, 3].map(n => ({ id: `held-sol-${n}`, provider: "openai", model: SITE_ASSESSMENT_MODEL, reserved_micro_usd: 331920, state: "held" })),
        // Synthetic future-authority control only: no production programme or amendment is written.
        { id: "new-gem", provider: "gemini", model: "gemini-3.8-flash", reserved_micro_usd: 1818624, state: "held" },
      ] });
  });
  const sol = () => reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {});
  function reconcilePreProviderHistory() {
    sharedFakeFirestoreState.docs.delete(path);
    const id = "d".repeat(64), data = { requestId: "one", sceneId: "site-one", captureId: metadata.capture_id,
      state: "waiting_prerequisite", attempts: 3, started_at: 123, claim_token: "historical-claim",
      binding: { source, brief_digest: humanDecisionDigest(brief), capture_id: metadata.capture_id }, reason: null, finding: null };
    sharedFakeFirestoreState.docs.set(`captureCoverageReviews/${id}`, data);
    read(programmePath).capture_history_reconciliation = { schema_version: "capture_history_reconciliation.v1", status: "accepted",
      receipt_sha256: `sha256:${"e".repeat(64)}`, source_commit: "f".repeat(40), reviewed_by: "synthetic-independent-reviewer",
      authority_ref: "synthetic-history-approval", request_id: "one", capture_id: metadata.capture_id,
      history_digest: humanDecisionDigest([{ review_id: id, ...data }]),
      reviews: [{ review_id: id, attempts: 3, disposition: "verified_zero_provider" }] };
    return id;
  }
  const continueClock = async (extra: Record<string, any> = {}) => {
    const { grantInferenceProgrammeTechnicalContinuation } = await import("../utils/captureCoverageInferenceBudget");
    return grantInferenceProgrammeTechnicalContinuation({ programmeId: "programme-one", expectedAuthorityDigest: read(budgetPath).inference_programme_authority_digest,
      continuationIdentity: "explicit-window-one", authorityRef: "synthetic-test-approval", operatorRef: "synthetic-authorized-operator",
      effectiveExpiresAtMs: Date.now() + 7200000, ...extra });
  };
  it("explicit technical continuation admits remaining held slots without rewriting original expiry or accounting", async () => {
    reconcilePreProviderHistory();const first = await sol();await first.record({input_tokens:100,output_tokens:10});
    const before = structuredClone(read(budgetPath)), original = structuredClone(read(programmePath));
    vi.spyOn(Date,"now").mockReturnValue(original.expires_at_ms + 1);
    try {
      await expect(sol()).rejects.toThrow("inference_programme_expired");
      const receipt = await continueClock();
      expect(read(budgetPath)).toEqual(before);expect(read(programmePath).expires_at_ms).toBe(original.expires_at_ms);
      expect(read(programmePath).slots).toEqual(original.slots);
      expect(await continueClock()).toEqual(receipt);expect(read(programmePath).technical_continuations).toHaveLength(1);
      const next=await sol();await next.assertDispatchAllowed();await next.record({input_tokens:100,output_tokens:10});
      const gem=await reserveCaptureCoverageInference("gemini-3.8-flash",assessmentMetadata,"gemini");await gem.assertDispatchAllowed();
      expect(read(programmePath).slots[0]).toEqual(original.slots[0]);expect(read(programmePath).slots[1]).toEqual(original.slots[1]);
      expect(read(budgetPath).inference_programme_authority_digest).toBe(before.inference_programme_authority_digest);
      expect(read(budgetPath).calls).toBe(3);
    } finally {vi.restoreAllMocks();}
  });
  it.each(["identity","authority","digest","deadline","too-long","source","context","cap","cross-programme"])("refuses %s technical continuation without authority writes",async defect=>{
    reconcilePreProviderHistory();const first=await sol();await first.record({input_tokens:100,output_tokens:10});
    vi.spyOn(Date,"now").mockReturnValue(Date.now());
    try {
    const input:any={};
    if(defect==="identity")input.continuationIdentity="bad / identity";
    if(defect==="authority")input.authorityRef="unrelated-human-approval";
    if(defect==="digest")input.expectedAuthorityDigest="f".repeat(64);
    if(defect==="deadline")input.effectiveExpiresAtMs=Date.now()-1;
    if(defect==="too-long")input.effectiveExpiresAtMs=Date.now()+7200001;
    if(defect==="source")read("inboundRequests/one").capture_privacy_source_bound_decision.producer_source={...source,key:"changed"};
    if(defect==="context")read("inboundRequests/one").request.taskDescription="changed";
    if(defect==="cap")read(programmePath).cap_micro_usd=4999999;
    if(defect==="cross-programme")input.programmeId="different-programme";
    const before=structuredClone(read(programmePath));await expect(continueClock(input)).rejects.toThrow();expect(read(programmePath)).toEqual(before);
    }finally{vi.restoreAllMocks();}
  });
  it("continuation never makes old admitted calls fresh, and permits late original accounting",async()=>{
    reconcilePreProviderHistory();const first=await sol(),original=structuredClone(read(programmePath));
    vi.spyOn(Date,"now").mockReturnValue(original.expires_at_ms+1);
    try {
      await continueClock();await expect(first.assertDispatchAllowed()).rejects.toThrow("inference_programme_");
      await first.record({input_tokens:100,output_tokens:10});expect(read(programmePath).slots[2].state).toBe("recorded");
      const next=await sol();await next.assertDispatchAllowed();
      await expect(continueClock({continuationIdentity:"another-window"})).rejects.toThrow();
      const receipt=read(programmePath).technical_continuations[0];vi.spyOn(Date,"now").mockReturnValue(receipt.effective_expires_at_ms+1);
      await expect(next.assertDispatchAllowed()).rejects.toThrow("inference_programme_expired");
      expect(read(budgetPath).pending_token).toBeTruthy();
    } finally {vi.restoreAllMocks();}
  });
  it.each(["forged","original-expiry","slot-reset","new-slot"])("refuses %s after a technical continuation",async defect=>{
    reconcilePreProviderHistory();const first=await sol();await first.record({input_tokens:100,output_tokens:10});await continueClock();
    vi.spyOn(Date,"now").mockReturnValue(read(programmePath).expires_at_ms+1);
    try {
      if(defect==="forged")read(programmePath).technical_continuations[0].receipt_sha256="f".repeat(64);
      if(defect==="original-expiry")read(programmePath).expires_at_ms+=1000;
      if(defect==="slot-reset")read(programmePath).slots[2].state="held";
      if(defect==="new-slot")read(programmePath).slots.push({id:"extra",provider:"openai",model:SITE_ASSESSMENT_MODEL,reserved_micro_usd:1,state:"held"});
      await expect(sol()).rejects.toThrow("inference_programme_");
    }finally{vi.restoreAllMocks();}
  });
  it("admits first paid reservation only for exactly accepted pre-provider history, without resetting attempts", async () => {
    const id = reconcilePreProviderHistory();
    const call = await sol(); await call.assertDispatchAllowed();
    expect(read(budgetPath).calls).toBe(1);
    expect(read(`captureCoverageReviews/${id}`).attempts).toBe(3);
    expect(read(programmePath).slots[0].state).toBe("unknown");
  });
  it.each(["missing", "malformed", "unaccepted", "attempts", "binding", "running", "additional", "unknown_run", "metadata_only", "missing_row", "truncated"])("never excuses %s historical evidence", async defect => {
    const id = reconcilePreProviderHistory(); const receipt = read(programmePath).capture_history_reconciliation;
    if (defect === "missing" || defect === "metadata_only") delete read(programmePath).capture_history_reconciliation;
    if (defect === "malformed") receipt.receipt_sha256 = "forged";
    if (defect === "unaccepted") receipt.status = "proposed";
    if (defect === "attempts") read(`captureCoverageReviews/${id}`).attempts = 4;
    if (defect === "binding") read(`captureCoverageReviews/${id}`).binding.source.key = "changed";
    if (defect === "running") read(`captureCoverageReviews/${id}`).state = "running";
    if (defect === "additional") sharedFakeFirestoreState.docs.set(`captureCoverageReviews/${"c".repeat(64)}`,
      { ...read(`captureCoverageReviews/${id}`), attempts: 1 });
    if (defect === "missing_row") sharedFakeFirestoreState.docs.delete(`captureCoverageReviews/${id}`);
    if (defect === "truncated") delete read(`captureCoverageReviews/${id}`).started_at;
    if (defect === "unknown_run") sharedFakeFirestoreState.docs.set("agentRuns/unknown-old", {
      task_kind: "site_video_evidence", status: "completed", metadata: { capture_id: metadata.capture_id } });
    await expect(reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL,
      { ...assessmentMetadata, capture_history_reconciliation: receipt }, "openai", {})).rejects.toThrow();
    expect(read(budgetPath)).toBeUndefined();
    expect(read(programmePath).slots[2].state).toBe("held");
  });
  it("rejects changed history and changed reconciliation immediately before dispatch without clearing pending", async () => {
    const id = reconcilePreProviderHistory(); const call = await sol(); const pending = read(budgetPath).pending_token;
    read(`captureCoverageReviews/${id}`).attempts = 4;
    await expect(call.assertDispatchAllowed()).rejects.toThrow("inference_programme_history_changed");
    read(`captureCoverageReviews/${id}`).attempts = 3;
    read(programmePath).capture_history_reconciliation.receipt_sha256 = `sha256:${"c".repeat(64)}`;
    await expect(call.assertDispatchAllowed()).rejects.toThrow("inference_programme_dispatch_changed");
    expect(read(budgetPath).pending_token).toBe(pending);
  });
  it("rejects an SDK run added after reconciled reservation and before continuation", async () => {
    reconcilePreProviderHistory(); const call = await sol(); const pending = read(budgetPath).pending_token;
    sharedFakeFirestoreState.docs.set("agentRuns/unknown-old", { task_kind: "site_video_evidence", status: "completed",
      metadata: { capture_id: metadata.capture_id } });
    const dispatch = await call.assertDispatchAllowed().then(() => "allowed", error => error.message);
    expect(read(budgetPath).pending_token).toBe(pending);
    // Synthetic already-in-flight usage remains honestly recordable despite the refused dispatch.
    await call.record({ input_tokens: 100, output_tokens: 10 });
    const continuation = await sol().then(() => "allowed", error => error.message);
    expect({ dispatch, continuation }).toEqual({ dispatch: "coverage_budget_historical_exposure_unresolved",
      continuation: "coverage_budget_historical_exposure_unresolved" });
    expect(read(budgetPath).calls).toBe(1);
  });
  it("atomically reuses three held Sol slots without changing retained aggregate exposure and denies a fourth", async () => {
    const originals = structuredClone(read(programmePath).slots.slice(0, 2));
    for (let n = 0; n < 3; n++) {
      const call = await sol();
      expect(read(programmePath).slots.filter((row: any) => row.state === "admitted")).toHaveLength(1);
      expect(read(budgetPath).inference_program_id).toBe("programme-one");
      await call.record({ input_tokens: 100, output_tokens: 10 });
    }
    await expect(sol()).rejects.toThrow("inference_programme_slot_unavailable");
    expect(read(programmePath).slots.slice(0, 2)).toEqual(originals);
    expect(read(programmePath).slots.reduce((sum: number, row: any) => sum + row.reserved_micro_usd, 0)).toBe(4964928);
    expect(read(budgetPath).calls).toBe(3);
    expect(read(programmePath).producer_source_digest).toBe(humanDecisionDigest(source));
  });
  it("uses the separately held Gemini slot without adopting the original uncertain call", async () => {
    const call = await reserveCaptureCoverageInference("gemini-3.8-flash", assessmentMetadata);
    await call.record(usage);
    expect(read(programmePath).slots[0].state).toBe("unknown");
    expect(read(programmePath).slots[5].state).toBe("recorded");
  });
  it("unknown usage retains the admitted slot and capture pending token across restart", async () => {
    const call = await sol(); const token = read(budgetPath).pending_token;
    await call.record(undefined);
    expect(read(budgetPath).pending_token).toBe(token);
    expect(read(programmePath).slots[2].state).toBe("admitted");
    await expect(sol()).rejects.toThrow("coverage_budget_cost_unresolved");
  });
  it.each(["remove", "replace"])("never falls back to unbound admission after programme reference %s", async change => {
    const call = await sol(); await call.record({ input_tokens: 100, output_tokens: 10 });
    if (change === "remove") delete read("inboundRequests/one").inference_program_id;
    else read("inboundRequests/one").inference_program_id = "other";
    await expect(sol()).rejects.toThrow("inference_programme_binding_changed");
    expect(read(budgetPath).calls).toBe(1);
  });
  it.each(["context", "brief", "video", "expired", "cap", "duplicate", "model"])("rejects %s authority defects before either reservation write", async defect => {
    if (defect === "context") read("inboundRequests/one").request.taskDescription = "Changed task";
    if (defect === "brief") read("siteTaskBriefs/one").summary = "Changed brief";
    if (defect === "video") read(programmePath).video_sha256 = "c".repeat(64);
    if (defect === "expired") read(programmePath).expires_at_ms = Date.now() - 1;
    if (defect === "cap") read(programmePath).cap_micro_usd = 4964927;
    if (defect === "duplicate") read(programmePath).slots[3].id = read(programmePath).slots[2].id;
    if (defect === "model") read(programmePath).slots[2].model = "other-model";
    await expect(sol()).rejects.toThrow("inference_programme_");
    expect(read(budgetPath)).toBeUndefined();
    expect(read(programmePath).slots.every((row: any) => row.state !== "admitted")).toBe(true);
  });
  it("rejects changed current producer source after the first pinned admission", async () => {
    const call = await sol(); await call.record({ input_tokens: 100, output_tokens: 10 });
    const changed = { ...source, key: "replacement" };
    read("inboundRequests/one").capture_privacy_source_bound_decision.producer_source = changed;
    await expect(reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, { ...assessmentMetadata, assessment_source: changed }, "openai", {}))
      .rejects.toThrow("inference_programme_binding_changed");
    expect(read(budgetPath).calls).toBe(1);
  });
  it("rejects authority amount replacement between known calls", async () => {
    const call = await sol(); await call.record({ input_tokens: 100, output_tokens: 10 });
    read(programmePath).slots[3].reserved_micro_usd -= 1;
    await expect(sol()).rejects.toThrow("inference_programme_authority_changed");
    expect(read(budgetPath).calls).toBe(1);
  });
  it("never adopts reset original or consumed slots as fresh authority", async () => {
    for (let n = 0; n < 3; n++) { const call = await sol(); await call.record({ input_tokens: 100, output_tokens: 10 }); }
    for (const slot of read(programmePath).slots) if (slot.provider === "openai") slot.state = "held";
    await expect(sol()).rejects.toThrow("inference_programme_slot_unavailable");
    expect(read(budgetPath).calls).toBe(3);
  });
  it.each(["expired", "revoked", "authority", "context", "source", "token", "history", "withdrawal", "future_processing"])("rechecks %s after reservation immediately before dispatch", async change => {
    const call = await sol(); const pending = read(budgetPath).pending_token;
    if (change === "expired") vi.spyOn(Date, "now").mockReturnValue(read(programmePath).expires_at_ms + 1);
    if (change === "revoked") read(programmePath).status = "revoked";
    if (change === "authority") read(programmePath).slots[3].reserved_micro_usd -= 1;
    if (change === "context") read("inboundRequests/one").request.taskDescription = "Changed task";
    if (change === "source") read("inboundRequests/one").capture_privacy_source_bound_decision.producer_source.key = "replacement";
    if (change === "token") read(programmePath).slots[2].admission_token = "other";
    if (change === "history") read(budgetPath).inference_programme_admitted_slot_ids = [];
    if (change === "withdrawal") read("inboundRequests/one").consent_revoked = true;
    if (change === "future_processing") read("inboundRequests/one").capture_rights = { future_processing_allowed: false };
    try {
      // Old runtime has no pre-dispatch guard; its reservation would proceed.
      await expect((call as any).assertDispatchAllowed?.() ?? Promise.resolve()).rejects.toThrow("inference_programme_");
    } finally { vi.restoreAllMocks(); }
    expect(read(budgetPath).pending_token).toBe(pending);
    expect(read(programmePath).slots[2].state).toBe("admitted");
  });
  it("allows an unchanged bound reservation and keeps ordinary dispatch admission unchanged", async () => {
    const call = await sol(); await call.assertDispatchAllowed();
    expect(read(budgetPath).pending_token).toBeTruthy();
    await call.record({ input_tokens: 100, output_tokens: 10 });
    sharedFakeFirestoreState.docs.clear(); seed();
    const ordinary = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await ordinary.assertDispatchAllowed();
  });
  it("records already dispatched known usage after expiry and revocation, without releasing reservations", async () => {
    const call = await sol(); read(programmePath).status = "revoked";
    // Expiry of the retained timestamp occurs naturally; authority bytes are not changed.
    vi.spyOn(Date, "now").mockReturnValue(read(programmePath).expires_at_ms + 1);
    try { await call.record({ input_tokens: 100, output_tokens: 10 }); }
    finally { vi.restoreAllMocks(); }
    expect(read(programmePath).slots[2].state).toBe("recorded");
    expect(read(programmePath).slots[2].reserved_micro_usd).toBe(331920);
    expect(read(budgetPath).pending_token).toBeNull();
    await expect(sol()).rejects.toThrow("inference_programme_authority_invalid");
  });
  it("does not clear pending accounting when the admitted slot's retained amount changes", async () => {
    const call = await sol(); const token = read(budgetPath).pending_token;
    read(programmePath).slots[2].reserved_micro_usd = 331919;
    await expect(call.record({ input_tokens: 100, output_tokens: 10 })).rejects.toThrow("inference_programme_admission_changed");
    expect(read(budgetPath).pending_token).toBe(token);
  });
});
