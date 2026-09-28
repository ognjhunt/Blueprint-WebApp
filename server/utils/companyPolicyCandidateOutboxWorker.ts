import crypto from "node:crypto";

import admin, {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {logger} from "../logger";
import {
  type CompanyPolicyCandidateHandoff,
  forwardCompanyPolicyCandidateToPipeline,
} from "./companyPolicyCandidateForwarding";
import {canonicalArtifactDigest} from "./taskCandidateContract";

const COLLECTION = "companyPolicyCandidateOutbox";
const CANDIDATE_COLLECTION = "companyPolicyCandidateSubmissions";
const CREDENTIAL_COLLECTION = "companyPolicyRegistryCredentialLeases";

function truthy(value: unknown) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function maximumAttempts() {
  const value = Number(process.env.COMPANY_POLICY_OUTBOX_MAX_ATTEMPTS || 12);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 50) : 12;
}

function retryDelayMs(attempt: number) {
  const configured = Number(process.env.COMPANY_POLICY_OUTBOX_RETRY_BASE_MS || 30_000);
  const base = Number.isFinite(configured) && configured >= 1_000 ? configured : 30_000;
  return Math.min(15 * 60_000, base * 2 ** Math.min(Math.max(attempt - 1, 0), 5));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function validateCompanyPolicyOutboxRecord(record: Record<string, unknown>): string[] {
  const blockers: string[] = [];
  if (record.schema_version !== "company_policy_candidate_outbox.v1") {
    blockers.push("company_policy_outbox_schema_invalid");
  }
  const handoff = asRecord(record.handoff);
  const digest = String(record.handoff_digest || "");
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    blockers.push("company_policy_outbox_handoff_digest_missing");
  } else if (canonicalArtifactDigest(handoff, "handoff_digest") !== digest) {
    blockers.push("company_policy_outbox_handoff_digest_mismatch");
  }
  if (
    handoff.schema_version !== "company_policy_container_admission_request.v1"
    || handoff.submission_id !== record.submission_id
    || handoff.launch_authority_granted !== false
    || handoff.provider_mutation_authorized !== false
    || handoff.claim_ceiling !== "development_only"
  ) blockers.push("company_policy_outbox_handoff_boundary_invalid");
  return [...new Set(blockers)].sort();
}

function terminalForwardBlockers(forward: Record<string, unknown>): string[] {
  const blockers = Array.isArray(forward.blockers)
    ? forward.blockers.map(String)
    : [];
  const terminalCodes = new Set([
    "company_policy_container_handoff_secret_carrier_detected",
    "company_policy_container_forward_url_not_https_or_loopback",
    "company_policy_container_forward_client_id_invalid",
  ]);
  const status = Number(forward.pipeline_status || 0);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return [...new Set([...blockers, `company_policy_pipeline_terminal_http_${status}`])].sort();
  }
  return blockers.filter((item) => terminalCodes.has(item)).sort();
}

export async function forwardStoredCompanyPolicyCandidate(
  record: Record<string, unknown>,
  forwarder = forwardCompanyPolicyCandidateToPipeline,
  nowMs = Date.now(),
) {
  const blockers = validateCompanyPolicyOutboxRecord(record);
  if (blockers.length) {
    return {
      status: "terminal_blocked",
      blockers,
      retryable: false,
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    };
  }
  const attempts = Number(record.attempt_count || 0);
  if (!Number.isInteger(attempts) || attempts < 0 || attempts >= maximumAttempts()) {
    return {
      status: "terminal_blocked",
      blockers: ["company_policy_outbox_retry_cap_reached"],
      retryable: false,
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    };
  }
  const nextAt = Date.parse(String(record.next_attempt_at_iso || ""));
  if (Number.isFinite(nextAt) && nextAt > nowMs) {
    return {status: String(record.status), skipped: true, retryable: true};
  }
  const forward = await forwarder(record.handoff as unknown as CompanyPolicyCandidateHandoff);
  const attemptCount = attempts + 1;
  if (forward.accepted === true) {
    return {
      status: "delivered",
      forward,
      attempt_count: attemptCount,
      next_attempt_at_iso: null,
      retryable: false,
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    };
  }
  const terminal = terminalForwardBlockers(forward);
  if (terminal.length) {
    return {
      status: "terminal_blocked",
      forward,
      blockers: terminal,
      attempt_count: attemptCount,
      next_attempt_at_iso: null,
      retryable: false,
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    };
  }
  return {
    status: "retry_pending",
    forward,
    blockers: Array.isArray(forward.blockers) ? forward.blockers : [],
    attempt_count: attemptCount,
    next_attempt_at_iso: new Date(nowMs + retryDelayMs(attemptCount)).toISOString(),
    retryable: true,
    launch_authority_granted: false,
    provider_mutation_authorized: false,
  };
}

export async function processCompanyPolicyCandidateOutbox(limit = 10) {
  const firestore = db;
  if (!firestore) return {status: "blocked", blocker: "firestore_unavailable", processed: 0};
  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const status of ["pending", "retry_pending", "delivering"] as const) {
    const snapshot = await firestore.collection(COLLECTION).where("status", "==", status).limit(limit).get();
    docs.push(...snapshot.docs);
    if (docs.length >= limit) break;
  }
  let processed = 0;
  for (const doc of docs.slice(0, limit)) {
    const now = new Date();
    const deliveryLeaseId = `company-policy-outbox-${crypto.randomBytes(20).toString("hex")}`;
    const claimed = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(doc.ref);
      if (!snapshot.exists) return null;
      const record = (snapshot.data() || {}) as Record<string, unknown>;
      const state = String(record.status || "");
      const leaseExpires = Date.parse(String(record.delivery_lease_expires_at_iso || ""));
      if (state === "delivering" && (!Number.isFinite(leaseExpires) || leaseExpires > now.getTime())) return null;
      if (!new Set(["pending", "retry_pending", "delivering"]).has(state)) return null;
      const nextAt = Date.parse(String(record.next_attempt_at_iso || ""));
      if (Number.isFinite(nextAt) && nextAt > now.getTime()) return null;
      transaction.set(doc.ref, {
        status: "delivering",
        delivery_lease_id: deliveryLeaseId,
        delivery_lease_expires_at_iso: new Date(now.getTime() + 60_000).toISOString(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      return record;
    });
    if (!claimed) continue;

    const result = await forwardStoredCompanyPolicyCandidate(claimed, undefined, now.getTime());
    await firestore.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(doc.ref);
      if (!currentSnapshot.exists) return;
      const current = (currentSnapshot.data() || {}) as Record<string, unknown>;
      if (current.delivery_lease_id !== deliveryLeaseId || current.status !== "delivering") return;
      const submissionId = String(claimed.submission_id || "");
      const candidateRef = firestore.collection(CANDIDATE_COLLECTION).doc(submissionId);
      const nextCandidateStatus = result.status === "delivered"
        ? "admitted_no_spend"
        : result.status === "terminal_blocked"
          ? "blocked_pipeline_handoff"
          : "contract_admitted_awaiting_pipeline";
      transaction.set(doc.ref, {
        ...result,
        delivery_lease_id: admin.firestore.FieldValue.delete(),
        delivery_lease_expires_at_iso: admin.firestore.FieldValue.delete(),
        last_attempt_at_iso: now.toISOString(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      transaction.set(candidateRef, {
        pipeline_handoff: result.forward || null,
        status: nextCandidateStatus,
        updated_at_iso: now.toISOString(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      if (result.status === "delivered") {
        const handoff = asRecord(claimed.handoff);
        const leaseId = String(handoff.registry_credential_lease_id || "");
        const forward = asRecord(result.forward);
        if (leaseId) {
          transaction.set(firestore.collection(CREDENTIAL_COLLECTION).doc(leaseId), {
            admission_id: forward.admission_id,
            admission_digest: forward.admission_digest,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }
      }
    });
    processed += 1;
  }
  return {status: "completed", processed};
}

export function startCompanyPolicyCandidateOutboxWorker() {
  if (!truthy(process.env.BLUEPRINT_COMPANY_POLICY_OUTBOX_WORKER_ENABLED)) {
    return () => undefined;
  }
  const configured = Number(process.env.COMPANY_POLICY_OUTBOX_WORKER_INTERVAL_MS || 30_000);
  const intervalMs = Number.isFinite(configured) && configured >= 10_000 ? configured : 30_000;
  const run = () => {
    void processCompanyPolicyCandidateOutbox().catch((error) => {
      logger.error({err: error}, "Company policy candidate outbox delivery failed");
    });
  };
  const initial = setTimeout(run, 2_000);
  const interval = setInterval(run, intervalMs);
  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
