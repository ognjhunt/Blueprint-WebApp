import crypto from "node:crypto";
import {Router} from "express";
import {z} from "zod";

import admin, {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {csrfProtection} from "../middleware/csrf";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import {
  type CompanyPolicyCandidateHandoff,
} from "../utils/companyPolicyCandidateForwarding";
import {
  companyPolicyRegistryHost,
  normalizeCompanyPolicyContainerContract,
} from "../utils/companyPolicyContainerContract";
import {
  createRegistryCredentialLease,
  publicRegistryCredentialLease,
} from "../utils/companyPolicyRegistryCredentialLease";
import {canonicalArtifactDigest} from "../utils/taskCandidateContract";
import {skillTraceSchema} from "../utils/policyIntegration";

const router = Router();
const candidateRequestSchema = z
  .object({
    contract: z.unknown(),
    idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
  })
  .strict();

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function identity(res: {locals: Record<string, unknown>}) {
  const user = res.locals.firebaseUser as
    | {
        uid?: string;
        tenantId?: string;
        tenant_id?: string;
        companyId?: string;
        company_id?: string;
      }
    | undefined;
  return {
    uid: String(user?.uid || "").trim(),
    tenantId: String(user?.tenantId || user?.tenant_id || "").trim(),
    companyId: String(user?.companyId || user?.company_id || "").trim(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

// Un-tenanted Firebase accounts receive a stable account namespace. Explicit
// tenant claims must still match the authoritative owner on the stored run.
async function runIdentity(runId: string, res: {locals: Record<string, unknown>}, requireOpen = true) {
  const auth = identity(res);
  if (!auth.uid) return {ok: false as const, status: 401, code: "policy_candidate_identity_missing"};
  if (!db) return {ok: false as const, status: 503, code: "policy_candidate_store_not_configured"};
  const snapshot = await db.collection("robotEvalJobRequests").doc(runId).get();
  if (!snapshot.exists) return {ok: false as const, status: 404, code: "task_evaluation_run_not_found"};
  const data = (snapshot.data() || {}) as Record<string, unknown>;
  if (String(data.buyer_user_id || "") !== auth.uid) {
    return {ok: false as const, status: 403, code: "task_evaluation_run_owner_mismatch"};
  }
  const owner = asRecord(asRecord(data.decision_request || data.jobRequest).owner);
  const storedTenant = String(owner.tenant_id || "").trim();
  if (storedTenant !== auth.tenantId) {
    return {ok: false as const, status: 403, code: "task_evaluation_run_tenant_mismatch"};
  }
  if (requireOpen && !new Set(["submitted", "ready", "prepared_agent_execution"]).has(String(data.status || ""))) {
    return {ok: false as const, status: 409, code: "task_evaluation_run_not_open_for_candidates"};
  }
  const accountNamespace = `account_${sha256(auth.uid).slice(0, 40)}`;
  return {ok: true as const, data, auth: {
    uid: auth.uid, tenantId: auth.tenantId || accountNamespace,
    companyId: auth.companyId || accountNamespace,
  }};
}

router.get("/:runId/policy-candidate-context", verifyFirebaseToken, async (req, res) => {
  const run = await runIdentity(String(req.params.runId || "").trim(), res);
  if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});
  return res.json({ok: true, company_id: run.auth.companyId,
    claim_ceiling: "development_only", launch_authority_granted: false});
});

// ADP-011/day 7: attach intent to the owner's frozen task without inventing
// motor actions or allowing a submitted trace to supply its own outcome.
router.post("/:runId/skill-traces", verifyFirebaseToken, csrfProtection, async (req, res) => {
  const runId = String(req.params.runId || "").trim();
  const run = await runIdentity(runId, res);
  if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});
  const parsed = z.object({trace: skillTraceSchema,
    idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ok: false, code: "skill_trace_invalid"});
  const decision = asRecord(run.data.decision_request || run.data.jobRequest);
  const siteTask = asRecord(decision.site_task);
  const testbed = asRecord(decision.testbed);
  if (!siteTask.task_id || !testbed.digest_sha256) {
    return res.status(409).json({ok: false, code: "skill_trace_frozen_task_required"});
  }
  const traceId = `skill-trace-${sha256(`${run.auth.uid}\0${runId}\0${parsed.data.idempotency_key}`).slice(0, 40)}`;
  const record = {schema_version: "blueprint.task_skill_trace.v1", trace_id: traceId,
    run_id: runId, owner_uid: run.auth.uid, task_id: siteTask.task_id,
    testbed_digest: testbed.digest_sha256, trace: parsed.data.trace,
    evidence_scope: "submitted_skill_intent_only", motor_actions: [], task_success: null,
    execution_evidence_required: true};
  const ref = db!.collection("taskSkillTraces").doc(traceId);
  const stored = await db!.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return canonicalArtifactDigest(asRecord(existing.data()), "trace_digest")
      === canonicalArtifactDigest(record, "trace_digest");
    transaction.set(ref, record);
    return true;
  });
  if (!stored) return res.status(409).json({ok: false, code: "skill_trace_idempotency_conflict"});
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(201).json({ok: true, trace: record});
});

router.get("/:runId/skill-traces", verifyFirebaseToken, async (req, res) => {
  const runId = String(req.params.runId || "").trim();
  const run = await runIdentity(runId, res, false);
  if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});
  const records = await db!.collection("taskSkillTraces").where("run_id", "==", runId).limit(128).get();
  res.setHeader("Cache-Control", "private, no-store");
  return res.json({ok: true, traces: records.docs.map((doc) => doc.data()).filter((row) => row.owner_uid === run.auth.uid)});
});

function handoffFor(record: Record<string, unknown>): CompanyPolicyCandidateHandoff {
  return {
    schema_version: "company_policy_container_admission_request.v1",
    tenant_id: String(record.tenant_id),
    run_id: String(record.run_id),
    submission_id: String(record.submission_id),
    company_id: String(record.company_id),
    contract_digest: String(record.contract_digest),
    contract: record.contract as Record<string, unknown>,
    registry_credential_lease_id: record.registry_credential_lease_id
      ? String(record.registry_credential_lease_id)
      : null,
    claim_ceiling: "development_only",
    launch_authority_granted: false,
    provider_mutation_authorized: false,
  };
}

router.post("/:runId/policy-candidates", csrfProtection, verifyFirebaseToken, async (req, res) => {
  const runId = String(req.params.runId || "").trim();
  const run = await runIdentity(runId, res);
  if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});
  const auth = run.auth;

  const request = candidateRequestSchema.safeParse(req.body);
  if (!request.success) {
    return res.status(400).json({
      ok: false,
      code: "policy_candidate_request_invalid",
      errors: request.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`).sort(),
    });
  }
  const normalized = normalizeCompanyPolicyContainerContract(request.data.contract);
  if (!normalized.ok) {
    return res.status(400).json({ok: false, code: normalized.code, errors: normalized.errors});
  }
  const contract = normalized.contract;
  if (contract.company_id !== auth.companyId) {
    return res.status(403).json({ok: false, code: "policy_candidate_company_identity_mismatch"});
  }
  const allowedRegistries = new Set(
    String(process.env.COMPANY_POLICY_ALLOWED_REGISTRIES || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const registryHost = companyPolicyRegistryHost(contract.container.image);
  if (!allowedRegistries.size) {
    return res.status(503).json({ok: false, code: "company_policy_registry_allowlist_not_configured"});
  }
  if (!registryHost || !allowedRegistries.has(registryHost)) {
    return res.status(403).json({ok: false, code: "company_policy_registry_not_allowed"});
  }
  const submissionId = `policy-candidate-${sha256([
    auth.tenantId,
    auth.uid,
    runId,
    contract.contract_digest,
    request.data.idempotency_key,
  ].join("\u0000")).slice(0, 40)}`;
  const ref = db!.collection("companyPolicyCandidateSubmissions").doc(submissionId);
  const outboxRef = db!.collection("companyPolicyCandidateOutbox").doc(submissionId);

  const now = new Date().toISOString();
  const requiresCredential = contract.container.visibility === "private";
  const record: Record<string, unknown> = {
    schema_version: "company_policy_candidate_submission.v1",
    submission_id: submissionId,
    owner_uid: auth.uid,
    tenant_id: auth.tenantId,
    run_id: runId,
    company_id: contract.company_id,
    policy_id: contract.policy_id,
    image: contract.container.image,
    contract_digest: contract.contract_digest,
    contract,
    idempotency_key_digest: `sha256:${sha256(request.data.idempotency_key)}`,
    credential_requirement: requiresCredential ? "required" : "not_required",
    registry_credential_lease_id: null,
    status: requiresCredential
      ? "contract_admitted_awaiting_registry_credential"
      : "contract_admitted_awaiting_pipeline",
    claim_ceiling: "development_only",
    launch_authority_granted: false,
    provider_mutation_authorized: false,
    created_at_iso: now,
    updated_at_iso: now,
  };
  const staged = await db!.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      const data = (existing.data() || {}) as Record<string, unknown>;
      if (
        data.owner_uid !== auth.uid
        || data.tenant_id !== auth.tenantId
        || data.company_id !== auth.companyId
        || data.run_id !== runId
        || data.contract_digest !== contract.contract_digest
        || data.idempotency_key_digest !== `sha256:${sha256(request.data.idempotency_key)}`
      ) throw new Error("policy_candidate_idempotency_conflict");
      return {created: false, candidate: data};
    }
    transaction.set(ref, {
      ...record,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (!requiresCredential) {
      const handoff = handoffFor(record);
      transaction.set(outboxRef, {
        schema_version: "company_policy_candidate_outbox.v1",
        submission_id: submissionId,
        handoff,
        handoff_digest: canonicalArtifactDigest(
          handoff as unknown as Record<string, unknown>,
          "handoff_digest",
        ),
        status: "pending",
        attempt_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return {created: true, candidate: record};
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "policy_candidate_idempotency_conflict") {
      return null;
    }
    throw error;
  });
  if (!staged) return res.status(409).json({ok: false, code: "policy_candidate_idempotency_conflict"});
  return res.status(staged.created ? 201 : 200).json({
    ok: true,
    already_exists: !staged.created,
    candidate: staged.candidate,
  });
});

router.put(
  "/:runId/policy-candidates/:submissionId/registry-credential",
  csrfProtection,
  verifyFirebaseToken,
  async (req, res) => {
    const runId = String(req.params.runId || "").trim();
    const submissionId = String(req.params.submissionId || "").trim();
    const run = await runIdentity(runId, res);
    if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});
    const auth = run.auth;
    const candidateRef = db!.collection("companyPolicyCandidateSubmissions").doc(submissionId);
    const candidateSnapshot = await candidateRef.get();
    if (!candidateSnapshot.exists) {
      return res.status(404).json({ok: false, code: "policy_candidate_not_found"});
    }
    const candidate = (candidateSnapshot.data() || {}) as Record<string, unknown>;
    if (
      candidate.owner_uid !== auth.uid
      || candidate.tenant_id !== auth.tenantId
      || candidate.company_id !== auth.companyId
      || candidate.run_id !== runId
    ) {
      return res.status(403).json({ok: false, code: "policy_candidate_owner_mismatch"});
    }
    if (candidate.credential_requirement !== "required") {
      return res.status(409).json({ok: false, code: "registry_credential_not_required"});
    }
    if (
      req.body?.submission_id !== submissionId
      || req.body?.contract_digest !== candidate.contract_digest
      || req.body?.image !== candidate.image
    ) {
      return res.status(409).json({ok: false, code: "registry_credential_candidate_binding_mismatch"});
    }
    const created = await createRegistryCredentialLease({
      context: {
        ownerUid: auth.uid,
        tenantId: auth.tenantId,
        runId,
        companyId: String(candidate.company_id),
      },
      value: req.body,
    });
    if (!created.ok) {
      return res.status(400).json({ok: false, code: created.code, errors: created.errors});
    }
    const leaseRef = db!.collection("companyPolicyRegistryCredentialLeases").doc(created.lease.lease_id);
    let lease = created.lease as unknown as Record<string, unknown>;
    try {
      await db!.runTransaction(async (transaction) => {
        const existing = await transaction.get(leaseRef);
        if (existing.exists) {
          const data = (existing.data() || {}) as Record<string, unknown>;
          if (
            data.owner_uid !== auth.uid
            || data.run_id !== runId
            || data.submission_id !== submissionId
            || data.idempotency_key_digest !== created.lease.idempotency_key_digest
            || data.request_fingerprint !== created.lease.request_fingerprint
          ) {
            throw new Error("registry_credential_lease_idempotency_conflict");
          }
          if (data.status !== "active") {
            throw new Error("registry_credential_lease_not_active");
          }
          lease = data;
          return;
        }
        transaction.set(leaseRef, {
          ...created.lease,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          expires_at: admin.firestore.Timestamp.fromDate(
            new Date(created.lease.expires_at_iso),
          ),
        });
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "registry_credential_lease_conflict";
      if (code === "registry_credential_lease_idempotency_conflict" || code === "registry_credential_lease_not_active") {
        return res.status(409).json({ok: false, code});
      }
      throw error;
    }

    const updatedCandidate = {
      ...candidate,
      registry_credential_lease_id: lease.lease_id,
      credential_requirement: "leased",
      updated_at_iso: new Date().toISOString(),
    };
    const outboxRef = db!.collection("companyPolicyCandidateOutbox").doc(submissionId);
    const handoff = handoffFor(updatedCandidate);
    await db!.runTransaction(async (transaction) => {
      transaction.set(candidateRef, {
      registry_credential_lease_id: lease.lease_id,
      credential_requirement: "leased",
      status: "contract_admitted_awaiting_pipeline",
      updated_at_iso: updatedCandidate.updated_at_iso,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      transaction.set(outboxRef, {
        schema_version: "company_policy_candidate_outbox.v1",
        submission_id: submissionId,
        handoff,
        handoff_digest: canonicalArtifactDigest(
          handoff as unknown as Record<string, unknown>,
          "handoff_digest",
        ),
        status: "pending",
        attempt_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });
    return res.status(201).json({
      ok: true,
      status: "contract_admitted_awaiting_pipeline",
      credential_lease: publicRegistryCredentialLease(lease),
      pipeline_handoff: {
        status: "pending",
        performed: false,
        accepted: false,
        required: true,
        blockers: [],
      },
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    });
  },
);

router.get(
  "/:runId/policy-candidates/:submissionId",
  verifyFirebaseToken,
  async (req, res) => {
    const runId = String(req.params.runId || "").trim();
    const submissionId = String(req.params.submissionId || "").trim();
    const run = await runIdentity(runId, res, false);
    if (!run.ok) return res.status(run.status).json({ok: false,
      code: run.status === 403 ? "policy_candidate_owner_mismatch" : run.code});
    const auth = run.auth;
    const snapshot = await db!.collection("companyPolicyCandidateSubmissions").doc(submissionId).get();
    if (!snapshot.exists) return res.status(404).json({ok: false, code: "policy_candidate_not_found"});
    const candidate = (snapshot.data() || {}) as Record<string, unknown>;
    if (
      candidate.owner_uid !== auth.uid
      || candidate.tenant_id !== auth.tenantId
      || candidate.company_id !== auth.companyId
      || candidate.run_id !== runId
    ) {
      return res.status(403).json({ok: false, code: "policy_candidate_owner_mismatch"});
    }
    return res.json({ok: true, candidate});
  },
);

export default router;
