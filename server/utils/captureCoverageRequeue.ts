/**
 * The owner's requeue of one video reading that used up its automatic attempts (owner approval, 2026-11-12).
 *
 * A reading whose three attempts were all lost to a fault, and not to the video, is left with
 * `capture_coverage_review.state = "review_required"` and no `capture_coverage`, so the site's page says the video is
 * still being read for ever. This gives that one reading its attempts back so the queue's own reconcile claims it on
 * its next tick. Every check runs inside one transaction that reads the request, the review job and the brief; the
 * current-clearance checks are the queue's own (`coverageClearanceRefusal`). A preview changes nothing.
 */
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { CAPTURE_MODE_NOT_CONVERTED, CAPTURE_MODE_NOT_CONVERTED_DETAIL, authorizeCaptureUpload } from "./captureUploadAuthorization";
import { ANSWER_NOTICES_WAITING_FIELD, waitingMap } from "./answerNoticeOwed";
import { COVERAGE_REVIEW_MAX_ATTEMPTS, coverageClearanceRefusal, type CoverageClearanceRefusal } from "./captureCoverageQueue";

/** A reading can be requeued at most this many times in its life: each attempt can buy a paid model call. */
export const COVERAGE_REVIEW_MAX_REQUEUES = 2;
/** Where each applied requeue's audit record is kept, under its own digest. */
export const COVERAGE_REQUEUE_AUDIT_COLLECTION = "captureCoverageRequeueAudits";
/** The state a requeued job is left in: neither running nor completed, so the queue's claim takes it. */
export const REQUEUED_STATE = "requeued";
/** How long a running claim is trusted, as the queue's claim reads it. */
const RUNNING_TRUSTED_MS = 30 * 60_000;

export type CoverageRequeueRefusal = "approval_required" | "request_missing" | "not_exhausted" | "review_job_missing"
  | "review_job_mismatch" | "review_running" | "review_completed" | "attempts_remaining" | "coverage_already_recorded"
  | "capture_superseded" | "requeue_limit_reached" | "requeue_history_unreadable" | "capture_not_authorized"
  | "model_call_in_flight" | "capture_mode_not_converted" | CoverageClearanceRefusal;
export type CoverageRequeueCheck = { check: string; passed: boolean };
export type CoverageRequeueChange = { document: string; field: string; from: unknown; to: unknown };
export type CoverageRequeueResult = {
  outcome: "would_requeue" | "requeued" | "already_requeued" | "refused";
  reason?: CoverageRequeueRefusal;
  checks: CoverageRequeueCheck[];
  changes: CoverageRequeueChange[];
  /** Facts the planner should see that do not stop the requeue. */
  flags: string[];
  audit?: { collection: string; id: string; digest: string };
};
export type CoverageRequeueApproval = { approvedBy: string; approvalEvidence: string };

const plain = (value: unknown) => (value === undefined ? null : value);
const del = () => admin.firestore.FieldValue.delete();
/** Wait fields the queue's wait handling writes; the requeued reading starts its wait window afresh. */
const WAIT_FIELDS = ["wait_reason", "wait_counted", "retry_after_ms", "first_claimed_at_ms"] as const;

/**
 * Requeue the reading named on `requestId`'s `capture_coverage_review`, or say why not. `apply` false (the default) is
 * a preview: it reads, runs every check and lists the changes, and writes nothing.
 */
export async function requeueExhaustedCoverageReview(requestId: string, options: { apply?: boolean;
  approval?: CoverageRequeueApproval; now?: number } = {}): Promise<CoverageRequeueResult> {
  if (!db) throw new Error("coverage_store_unavailable");
  const store = db;
  const apply = options.apply === true;
  const approval = options.approval;
  const checks: CoverageRequeueCheck[] = [];
  const refuse = (reason: CoverageRequeueRefusal, flags: string[] = []): CoverageRequeueResult =>
    ({ outcome: "refused", reason, checks, changes: [], flags });
  const record = (check: string, passed: boolean) => { checks.push({ check, passed }); return passed; };
  if (apply && !record("approval_given", Boolean(approval?.approvedBy.trim() && approval.approvalEvidence.trim())))
    return refuse("approval_required");
  // The same rights check the queue makes before each claim, before the transaction, but read-only: neither a preview
  // nor an apply ever converts a stored visit job (the site's link or the queue does that by itself).
  const authorization = await authorizeCaptureUpload(requestId, { readOnly: true });
  const authorized = authorization.allowed;
  const requestRef = store.collection("inboundRequests").doc(requestId);
  return store.runTransaction(async tx => {
    const requestSnap = await tx.get(requestRef);
    const request = requestSnap.data();
    if (!record("request_exists", Boolean(request))) return refuse("request_missing");
    const review = request!.capture_coverage_review;
    const reviewId = typeof review?.review_id === "string" ? review.review_id : null;
    // Idempotent: a reading already requeued is pending or running again; nothing changes.
    if (review?.state === REQUEUED_STATE && request!.capture_coverage_pending === true) {
      record("already_requeued", true);
      return { outcome: "already_requeued", checks, changes: [], flags: [] };
    }
    if (!record("review_marked_exhausted", review?.state === "review_required"
      && review?.reason === "automatic_review_attempts_exhausted" && Boolean(reviewId))) return refuse("not_exhausted");
    const jobRef = store.collection("captureCoverageReviews").doc(reviewId!);
    const [jobSnap, briefSnap] = await Promise.all([tx.get(jobRef), tx.get(store.collection("siteTaskBriefs").doc(requestId))]);
    const job = jobSnap.data();
    if (!record("review_job_exists", Boolean(job))) return refuse("review_job_missing");
    const binding = job!.binding;
    const params = request!.capture_coverage_request;
    // The job is this request's, its id is the one the queue derives from its binding, and any stored request names it.
    if (!record("review_job_matches_request", job!.requestId === requestId && typeof job!.captureId === "string"
      && binding?.capture_id === job!.captureId && humanDecisionDigest({ request_id: requestId, ...binding }) === reviewId
      && (!params || (params.requestId === requestId && params.captureId === job!.captureId)))) return refuse("review_job_mismatch");
    const now = options.now ?? Date.now();
    if (!record("review_not_completed", job!.state !== "completed")) return refuse("review_completed");
    if (!record("review_not_running_in_trusted_window",
      !(job!.state === "running" && now - job!.started_at < RUNNING_TRUSTED_MS))) return refuse("review_running");
    const attempts = typeof job!.attempts === "number" ? job!.attempts : 0;
    if (!record("attempts_used_up", attempts >= COVERAGE_REVIEW_MAX_ATTEMPTS)) return refuse("attempts_remaining");
    if (!record("no_reading_recorded", !request!.capture_coverage)) return refuse("coverage_already_recorded");
    if (!record("capture_still_current", !request!.active_capture_id || request!.active_capture_id === job!.captureId))
      return refuse("capture_superseded");
    // A history that cannot be read never resets the bound.
    if (!record("requeue_history_readable", job!.requeue_history === undefined || Array.isArray(job!.requeue_history)))
      return refuse("requeue_history_unreadable");
    const history: Record<string, unknown>[] = job!.requeue_history ?? [];
    const flags = history.length ? [`This reading was requeued ${history.length} time(s) before.`] : [];
    if (!record("requeue_bound", history.length < COVERAGE_REVIEW_MAX_REQUEUES)) return refuse("requeue_limit_reached");
    const clearance = coverageClearanceRefusal(request, briefSnap.data(), binding, job!.captureId);
    for (const name of ["recording_consent_not_current", "privacy_decision_not_proceeded", "capture_changed", "source_changed",
      "brief_changed"] as const) {
      // The function returns the first failing check: later ones are not known to pass, so they are recorded as not run.
      if (clearance === name) { record(`clearance:${name}`, false); return refuse(name, flags); }
      record(`clearance:${name}`, true);
    }
    if (authorization.holdReason === CAPTURE_MODE_NOT_CONVERTED) {
      record("capture_mode_converted", false);
      return refuse("capture_mode_not_converted", [...flags, CAPTURE_MODE_NOT_CONVERTED_DETAIL]);
    }
    if (!record("capture_upload_authorized", authorized)) return refuse("capture_not_authorized");

    const budgetRef = store.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: job!.captureId })}`);
    const budget = (await tx.get(budgetRef)).data();
    const pendingCall = budget?.pending_token
      ? (await tx.get(budgetRef.collection("calls").doc(String(budget.pending_token)))).data() : null;
    // The budget allows one model call per capture at a time and refuses a new one while any is recorded in flight.
    // A requeued reading would only wait on it, count its waits after 30 minutes and use up a requeue: refused instead.
    if (!record("no_model_call_in_flight", !budget?.pending_token)) {
      const owner = pendingCall?.review_id === reviewId ? "this reading's own earlier call"
        : pendingCall?.review_id ? "another reading of this capture" : pendingCall?.run_id ? "the site assessment" : "an unreadable call record";
      return refuse("model_call_in_flight", [...flags, `A model call for this capture is recorded in flight (${owner}, state ${
        String(pendingCall?.state ?? "missing")}). It clears when that call records its response, or when its owner has ended as failed or cancelled and the next call retires it; requeue after that.`]);
    }

    const nowIso = new Date(now).toISOString();
    const waiting = waitingMap(request);
    const prior = { state: plain(job!.state), attempts, ...Object.fromEntries(WAIT_FIELDS.map(field => [field, plain(job![field])])),
      claim_token_set: Boolean(job!.claim_token) };
    const auditPayload = { schema_version: "capture_coverage_requeue.v1", request_id: requestId, review_id: reviewId,
      capture_id: job!.captureId, requeue_number: history.length + 1, approved_by: approval?.approvedBy.trim() ?? null,
      approval_evidence: approval?.approvalEvidence.trim() ?? null, requeued_at_iso: nowIso, prior_job: prior,
      prior_review: { state: review.state, reason: review.reason }, checks,
      answer_notices_since_before: Object.fromEntries(Object.entries(waiting).map(([slot, entry]) => [slot, plain(entry?.since_iso)])) };
    const auditDigest = humanDecisionDigest(auditPayload);
    const historyEntry = { requeued_at_iso: nowIso, approved_by: auditPayload.approved_by,
      approval_evidence: auditPayload.approval_evidence, prior_attempts: attempts, prior_state: prior.state, audit_digest: auditDigest };
    const coverageRequest = params ?? { requestId, sceneId: job!.sceneId, captureId: job!.captureId };
    const requeuedReview = { review_id: reviewId, state: REQUEUED_STATE, reason: "owner_approved_requeue" };

    const jobDoc = `captureCoverageReviews/${reviewId}`, requestDoc = `inboundRequests/${requestId}`;
    const changes: CoverageRequeueChange[] = [
      { document: jobDoc, field: "attempts", from: attempts, to: 0 },
      { document: jobDoc, field: "state", from: prior.state, to: REQUEUED_STATE },
      ...WAIT_FIELDS.filter(field => job![field] !== undefined).map(field => ({ document: jobDoc, field, from: job![field], to: "(removed)" })),
      // A fresh claim token fences out any late write from an earlier claim of this reading.
      ...(job!.claim_token ? [{ document: jobDoc, field: "claim_token", from: "(set)", to: null }] : []),
      { document: jobDoc, field: "requeue_history", from: `${history.length} entries`, to: `${history.length + 1} entries` },
      { document: requestDoc, field: "capture_coverage_pending", from: plain(request!.capture_coverage_pending), to: true },
      ...(params ? [] : [{ document: requestDoc, field: "capture_coverage_request", from: null, to: coverageRequest }]),
      { document: requestDoc, field: "capture_coverage_review", from: { review_id: reviewId, state: review.state, reason: review.reason },
        to: requeuedReview },
      // An ending's email that waits for this reading gets the reading's own 24 hours again, from the requeue, so it does
      // not go out saying there is no paper check while the reading it waited for is about to run.
      ...Object.entries(waiting).map(([slot, entry]) => ({ document: requestDoc,
        field: `${ANSWER_NOTICES_WAITING_FIELD}.${slot}.since_iso`, from: plain(entry?.since_iso), to: nowIso })),
      { document: `${COVERAGE_REQUEUE_AUDIT_COLLECTION}/${auditDigest}`, field: "(new audit record)", from: null,
        to: `requeue ${history.length + 1} of at most ${COVERAGE_REVIEW_MAX_REQUEUES}` },
    ];
    const audit = { collection: COVERAGE_REQUEUE_AUDIT_COLLECTION, id: auditDigest, digest: auditDigest };
    if (!apply) return { outcome: "would_requeue", checks, changes, flags, audit };

    tx.set(jobRef, { attempts: 0, state: REQUEUED_STATE, claim_token: null, requeue_history: [...history, historyEntry],
      ...Object.fromEntries(WAIT_FIELDS.map(field => [field, del()])) }, { merge: true });
    tx.set(requestRef, { capture_coverage_pending: true, capture_coverage_request: coverageRequest,
      capture_coverage_review: requeuedReview,
      ...(Object.keys(waiting).length ? { [ANSWER_NOTICES_WAITING_FIELD]:
        Object.fromEntries(Object.keys(waiting).map(slot => [slot, { since_iso: nowIso }])) } : {}) }, { merge: true });
    tx.create(store.collection(COVERAGE_REQUEUE_AUDIT_COLLECTION).doc(auditDigest), { ...auditPayload, audit_digest: auditDigest });
    return { outcome: "requeued", checks, changes, flags, audit };
  });
}

/** The script's arguments: `<request-id> [--apply --approved-by <id> --approval-evidence <text>]`. */
export function parseRequeueArgs(argv: string[]): { requestId: string; apply: boolean; approval?: CoverageRequeueApproval } {
  const usage = "Expected <request-id> [--apply --approved-by <owner> --approval-evidence <text>]";
  let requestId: string | undefined, apply = false, approvedBy: string | undefined, approvalEvidence: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--apply") apply = true;
    else if (arg === "--approved-by" || arg === "--approval-evidence") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(usage);
      if (arg === "--approved-by") approvedBy = value; else approvalEvidence = value;
    } else if (!arg.startsWith("--") && !requestId) requestId = arg;
    else throw new Error(usage);
  }
  if (!requestId || !/^[A-Za-z0-9._-]{1,200}$/.test(requestId)) throw new Error(usage);
  if (apply && (!approvedBy?.trim() || !approvalEvidence?.trim()))
    throw new Error("--apply requires --approved-by and --approval-evidence");
  return { requestId, apply, ...(approvedBy && approvalEvidence ? { approval: { approvedBy, approvalEvidence } } : {}) };
}

/**
 * What the script prints. The changes name documents, fields and values of this one job only; the approval's own words
 * and who gave it are recorded in the audit record and never echoed, so nothing printed can carry an email address.
 */
export function printableRequeueResult(requestId: string, apply: boolean, result: CoverageRequeueResult) {
  return { mode: apply ? "apply" : "preview (dry run: nothing written)", request_id: requestId, outcome: result.outcome,
    ...(result.reason ? { refused_because: result.reason } : {}), checks: result.checks, changes: result.changes,
    flags: result.flags, ...(result.audit ? { audit: result.audit } : {}) };
}
