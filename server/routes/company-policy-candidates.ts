import crypto from "node:crypto";
import {Router} from "express";
import {z} from "zod";

import admin, {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {csrfProtection} from "../middleware/csrf";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import {
  type CompanyPolicyCandidateHandoff,
  forwardCompanyPolicyCandidateToPipeline,
} from "../utils/companyPolicyCandidateForwarding";
import {normalizeCompanyPolicyContainerContract} from "../utils/companyPolicyContainerContract";
import {
  createRegistryCredentialLease,
  publicRegistryCredentialLease,
} from "../utils/companyPolicyRegistryCredentialLease";

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
    | {uid?: string; tenantId?: string; tenant_id?: string}
    | undefined;
  return {
    uid: String(user?.uid || "").trim(),
    tenantId: String(user?.tenantId || user?.tenant_id || user?.uid || "").trim(),
  };
}

async function ownedRun(runId: string, ownerUid: string) {
  if (!db) return {ok: false as const, status: 503, code: "policy_candidate_store_not_configured"};
  const snapshot = await db.collection("robotEvalJobRequests").doc(runId).get();
  if (!snapshot.exists) return {ok: false as const, status: 404, code: "task_evaluation_run_not_found"};
  const data = (snapshot.data() || {}) as Record<string, unknown>;
  if (String(data.buyer_user_id || "") !== ownerUid) {
    return {ok: false as const, status: 403, code: "task_evaluation_run_owner_mismatch"};
  }
  return {ok: true as const, data};
}

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
  const auth = identity(res);
  if (!auth.uid || !auth.tenantId) {
    return res.status(401).json({ok: false, code: "policy_candidate_identity_missing"});
  }
  const runId = String(req.params.runId || "").trim();
  const run = await ownedRun(runId, auth.uid);
  if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});

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
  const submissionId = `policy-candidate-${sha256([
    auth.tenantId,
    auth.uid,
    runId,
    contract.contract_digest,
    request.data.idempotency_key,
  ].join("\u0000")).slice(0, 40)}`;
  const ref = db!.collection("companyPolicyCandidateSubmissions").doc(submissionId);
  const existing = await ref.get();
  if (existing.exists) {
    const data = (existing.data() || {}) as Record<string, unknown>;
    if (
      data.owner_uid !== auth.uid
      || data.run_id !== runId
      || data.contract_digest !== contract.contract_digest
      || data.idempotency_key_digest !== `sha256:${sha256(request.data.idempotency_key)}`
    ) {
      return res.status(409).json({ok: false, code: "policy_candidate_idempotency_conflict"});
    }
    return res.status(200).json({ok: true, already_exists: true, candidate: data});
  }

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
  if (!requiresCredential) {
    const pipelineHandoff = await forwardCompanyPolicyCandidateToPipeline(handoffFor(record));
    record.pipeline_handoff = pipelineHandoff;
    record.status = pipelineHandoff.accepted === true
      ? "admitted_no_spend"
      : pipelineHandoff.required === true
        ? "blocked_pipeline_handoff"
        : "contract_admitted_awaiting_pipeline_configuration";
  }
  await ref.set({
    ...record,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: false});
  return res.status(201).json({ok: true, already_exists: false, candidate: record});
});

router.put(
  "/:runId/policy-candidates/:submissionId/registry-credential",
  csrfProtection,
  verifyFirebaseToken,
  async (req, res) => {
    const auth = identity(res);
    const runId = String(req.params.runId || "").trim();
    const submissionId = String(req.params.submissionId || "").trim();
    if (!auth.uid || !auth.tenantId) {
      return res.status(401).json({ok: false, code: "policy_candidate_identity_missing"});
    }
    const run = await ownedRun(runId, auth.uid);
    if (!run.ok) return res.status(run.status).json({ok: false, code: run.code});
    const candidateRef = db!.collection("companyPolicyCandidateSubmissions").doc(submissionId);
    const candidateSnapshot = await candidateRef.get();
    if (!candidateSnapshot.exists) {
      return res.status(404).json({ok: false, code: "policy_candidate_not_found"});
    }
    const candidate = (candidateSnapshot.data() || {}) as Record<string, unknown>;
    if (candidate.owner_uid !== auth.uid || candidate.run_id !== runId) {
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
    const pipelineHandoff = await forwardCompanyPolicyCandidateToPipeline(
      handoffFor(updatedCandidate),
    );
    const status = pipelineHandoff.accepted === true
      ? "admitted_no_spend"
      : pipelineHandoff.required === true
        ? "blocked_pipeline_handoff"
        : "contract_admitted_awaiting_pipeline_configuration";
    await candidateRef.set({
      registry_credential_lease_id: lease.lease_id,
      credential_requirement: "leased",
      pipeline_handoff: pipelineHandoff,
      status,
      updated_at_iso: updatedCandidate.updated_at_iso,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return res.status(201).json({
      ok: true,
      status,
      credential_lease: publicRegistryCredentialLease(lease),
      pipeline_handoff: pipelineHandoff,
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    });
  },
);

router.get(
  "/:runId/policy-candidates/:submissionId",
  verifyFirebaseToken,
  async (req, res) => {
    const auth = identity(res);
    const runId = String(req.params.runId || "").trim();
    const submissionId = String(req.params.submissionId || "").trim();
    if (!db || !auth.uid) return res.status(503).json({ok: false, code: "policy_candidate_store_not_configured"});
    const snapshot = await db.collection("companyPolicyCandidateSubmissions").doc(submissionId).get();
    if (!snapshot.exists) return res.status(404).json({ok: false, code: "policy_candidate_not_found"});
    const candidate = (snapshot.data() || {}) as Record<string, unknown>;
    if (candidate.owner_uid !== auth.uid || candidate.run_id !== runId) {
      return res.status(403).json({ok: false, code: "policy_candidate_owner_mismatch"});
    }
    return res.json({ok: true, candidate});
  },
);

export default router;
