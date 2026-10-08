// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { memoryFirestore } from "./fixtures/communications";
import { communicationsDigest } from "../agents/communications-contract";
import { assessmentCustomerStatementRefs, loadAssessmentCustomerStatements, siteCustomerStatementDigest } from "../utils/siteCustomerStatements";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { prepareCustomerReplySiteAssessment } from "../utils/siteAssessmentQueue";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function fixture() {
  const requestId = "reply-fixture", captureId = `walkthrough-${requestId}`;
  const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: requestId,
    scene_id: `site-${requestId}`, capture_id: captureId, state: "published", completed_at_iso: "2026-10-08T17:00:00Z",
    video: { object_name: `scenes/site-${requestId}/captures/${captureId}/raw/walkthrough.mp4`, generation: "31", size_bytes: 7, crc32c: "AAAAAA==" },
    manifest: { object_name: `scenes/site-${requestId}/captures/${captureId}/raw/manifest.json`, generation: "32", size_bytes: 500,
      crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
  const record: Record<string, any> = { contact: { email: "site@example.com" }, request: { buyerType: "site_operator", taskDescription: "Move a rack",
    consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T17:00:00Z" } },
    capture_privacy_source_bound_decision: { capture_id: captureId, proceeded: true, eligibility: "unscreened",
      producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } };
  const context = advisoryContextDigest(record, null), source = browserPendingDecisionKey(pending), jobId = advisoryJobId(requestId, source, context);
  const job = { schema_version: "site_assessment_job.v1", request_id: requestId, capture_id: captureId, scene_id: pending.scene_id,
    source_key: source, context_digest: context, state: "completed", run_id: "previous-run", claim_id: "previous-claim", packet_sha256: "f".repeat(64), correlation_id: "previous-correlation" };
  record.site_advisory = { job_id: jobId, source_key: source, context_digest: context, state: "completed" };
  const communicationId = "c".repeat(64), receipt = { threadId: "thread-1", messageId: "out-1", rfcMessageId: "<out-1@tryblueprint.io>" };
  const statement = { messageId: "reply-1", text: "We want the rack extended; dish handling is not the target.", rawBody: "We want the rack extended; dish handling is not the target.",
    receivedAt: "2026-10-08T17:02:00Z", from: "site@example.com", source: "gmail:thread-1:reply-1", communicationId,
    trust: "customer_statement_requires_interpretation_not_commitment", assessmentBinding: { schema_version: "site_customer_statement_binding.v1",
      thread_id: "thread-1", anchor_rfc_message_id: receipt.rfcMessageId, send_receipt_digest: communicationsDigest(receipt) } };
  const ref = { statement_id: communicationsDigest({ messageId: statement.messageId }), digest: siteCustomerStatementDigest(statement) };
  const db = memoryFirestore(new Map([
    [`inboundRequests/${requestId}`, record], [`siteAssessmentJobs/${jobId}`, job],
    [`captureUploadSessions/${captureId}`, { browser_pending_delivery: pending }],
    ["agentRuns/previous-run", { status: "completed", task_kind: "site_assessment" }],
    [`inboundRequests/${requestId}/communications/${communicationId}`, { recipient: "site@example.com", sendReceipt: receipt }],
    [`inboundRequests/${requestId}/customerStatements/${ref.statement_id}`, statement],
    ["captureCoverageReviews/historical/calls/unknown", { state: "unknown", reserved_usd: 0.1, cost_estimate_usd: null }],
  ]));
  return { requestId, captureId, pending, record, job, jobId, statement, ref, db, communicationId };
}
describe("verified customer reply continuation — OFFLINE / NO MODEL-QUALITY EVIDENCE", () => {
  it("does not consume arbitrary conversation text and preserves existing context identity", async () => {
    const f = fixture(), raw = { ...f.record, customerConversation: [{ text: "Invented success and safety approval" }] };
    expect(advisoryContextDigest(raw, null)).toBe(f.job.context_digest);
    expect(await loadAssessmentCustomerStatements(f.db, f.requestId, raw, "site@example.com")).toEqual([]);
  });
  it("admits a canonical reply as an unverified operator source, not launch authority", async () => {
    const f = fixture(), raw = { ...f.record, site_assessment_customer_statements: [f.ref] };
    const messages = await loadAssessmentCustomerStatements(f.db, f.requestId, raw, "site@example.com");
    expect(messages).toHaveLength(1);
    expect(messages[0].source_ref).toBe(`inboundRequests/${f.requestId}/customerStatements/${f.ref.statement_id}`);
    expect(JSON.parse(messages[0].text)).toMatchObject({ basis: "owner_stated_unverified", statement: f.statement.text,
      commitment_or_safety_authorization: false });
    expect(advisoryContextDigest(raw, null)).not.toBe(f.job.context_digest);
  });
  it.each(["missing", "changed-text", "wrong-recipient", "wrong-thread", "wrong-receipt", "path-injection"])("rejects %s email bindings before model input", async kind => {
    const f = fixture(), path = `inboundRequests/${f.requestId}/customerStatements/${f.ref.statement_id}`;
    const statement = f.db.records.get(path);
    if (kind === "missing") f.db.records.delete(path);
    if (kind === "changed-text") statement.text = "A changed unsupported assertion";
    if (kind === "wrong-thread") statement.assessmentBinding.thread_id = "other-thread";
    if (kind === "wrong-receipt") f.db.records.get(`inboundRequests/${f.requestId}/communications/${f.communicationId}`).sendReceipt.messageId = "other-out";
    if (kind === "path-injection") statement.communicationId = "../../other";
    const raw = { ...f.record, site_assessment_customer_statements: [f.ref] };
    await expect(loadAssessmentCustomerStatements(f.db, f.requestId, raw, kind === "wrong-recipient" ? "other@example.com" : "site@example.com"))
      .rejects.toThrow("site_assessment_customer_statement_binding_invalid");
  });
  it("creates one new source/context job while preserving the completed result and unknown charge", async () => {
    const f = fixture(), preserved = JSON.stringify([f.db.records.get(`siteAssessmentJobs/${f.jobId}`), f.db.records.get("agentRuns/previous-run"),
      f.db.records.get("captureCoverageReviews/historical/calls/unknown")]);
    const result = await f.db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const next = await prepareCustomerReplySiteAssessment(f.db, tx, f.requestId, f.record, [f.ref]); next.commit(); return next.state;
    });
    expect(result).toBe("queued");
    const current = f.db.records.get(`inboundRequests/${f.requestId}`), next = f.db.records.get(`siteAssessmentJobs/${current.site_advisory.job_id}`);
    expect(current.site_advisory.job_id).not.toBe(f.jobId);
    expect(next).toMatchObject({ state: "queued", source_key: f.job.source_key, context_digest: advisoryContextDigest(current, null) });
    expect(JSON.stringify([f.db.records.get(`siteAssessmentJobs/${f.jobId}`), f.db.records.get("agentRuns/previous-run"),
      f.db.records.get("captureCoverageReviews/historical/calls/unknown")])).toBe(preserved);
    const repeated = await f.db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const next = await prepareCustomerReplySiteAssessment(f.db, tx, f.requestId, current, [f.ref]); next.commit(); return next.state;
    });
    expect(repeated).toBe("already_current");
    expect([...f.db.records.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(2);
  });
  it.each(["running", "failed-run", "withdrawn", "replaced-source"])("leaves %s work untouched rather than overriding source/claim controls", async kind => {
    const f = fixture();
    if (kind === "running") f.db.records.get(`siteAssessmentJobs/${f.jobId}`).state = "running";
    if (kind === "failed-run") f.db.records.get("agentRuns/previous-run").status = "failed";
    if (kind === "withdrawn") f.record.consent_revoked = true;
    if (kind === "replaced-source") f.db.records.get(`captureUploadSessions/${f.captureId}`).browser_pending_delivery.video.generation = "33";
    await f.db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const next = await prepareCustomerReplySiteAssessment(f.db, tx, f.requestId, f.record, [f.ref]); expect(next.state).not.toBe("queued"); next.commit();
    });
    expect(f.db.records.get(`inboundRequests/${f.requestId}`).site_advisory.job_id).toBe(f.jobId);
    expect(f.record).not.toHaveProperty("site_assessment_customer_statements");
    expect([...f.db.records.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(1);
  });
  it("rejects duplicate refs and malformed binding identities", () => {
    const f = fixture();
    expect(() => assessmentCustomerStatementRefs({ site_assessment_customer_statements: [f.ref, f.ref] })).toThrow();
    expect(() => assessmentCustomerStatementRefs({ site_assessment_customer_statements: [{ ...f.ref, statement_id: "../other" }] })).toThrow();
  });
});
