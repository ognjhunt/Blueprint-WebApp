/** Job-bound credential delivery to the trusted worker after a funded run is claimed. */
import { Router } from "express";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { agentExecutionAdmissionDigest } from "../utils/agentExecutionAdmission";
import { reservationTtlMs, type EvalRunRecord } from "../utils/agentRunRecord";
import { normalizeCompanyPolicyContainerContract } from "../utils/companyPolicyContainerContract";
import { createRegistryCredentialLease, registryCredentialLeaseId, publicRegistryCredentialLease,
  type StoredRegistryCredentialLease } from "../utils/companyPolicyRegistryCredentialLease";
import { POLICY_CREDENTIAL_COLLECTION, decryptCheckpointPolicyCredential,
  type PolicyCredentialRecord } from "../utils/checkpointPolicyCredentials";

const router = Router();
const schema = z.object({
  action: z.enum(["access", "registry_lease", "bind_admission"]),
  job_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
  canonical_request_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  tenant_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/).optional(),
  contract: z.record(z.unknown()).optional(),
  admission_receipt: z.record(z.unknown()).optional(),
}).strict();
const object = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};

router.post("/checkpoint-policy-credentials/:credentialRef", createPipelineSyncRateLimiter(), async (req, res) => {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ code: auth.code });
  // Credential delivery always requires the signed worker path, even where legacy token auth is allowed.
  if (!req.header("X-Blueprint-Pipeline-Signature")) return res.status(401).json({ code: "policy_credential_signature_required" });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !db) return res.status(parsed.success ? 503 : 400).json({ code: "policy_credential_request_invalid" });
  const data = parsed.data;
  const credentialRef = String(req.params.credentialRef);
  if (!/^policy-credential-[0-9a-f-]{36}$/.test(credentialRef)) return res.status(400).json({ code: "policy_credential_reference_invalid" });
  try {
    const secretSnapshot = await db.collection(POLICY_CREDENTIAL_COLLECTION).doc(credentialRef).get();
    if (!secretSnapshot.exists) return res.status(404).json({ code: "policy_credential_not_found" });
    const record = secretSnapshot.data() as PolicyCredentialRecord;
    const checkpoint = (await db.collection("robotCheckpoints").doc(record.checkpoint_id).get()).data();
    const runs = await db.collection("evaluationRuns")
      .where("executionAdmission.envelope.canonical_execution_request.job_id", "==", data.job_id).get();
    const active = runs.docs.map((doc) => doc.data() as EvalRunRecord).filter((run) =>
      run.state === "requested" && !run.moneyResolved && !run.cancellationRequested
      && Boolean(run.dispatch?.pipelineRunId)
      && Date.parse(run.requestedAtIso) + reservationTtlMs() > Date.now());
    if (active.length !== 1) return res.status(409).json({ code: "policy_credential_claimed_run_required" });
    const run = active[0];
    const canonical = object(run.executionAdmission?.envelope.canonical_execution_request);
    const packageValue = object(canonical.policy_package);
    const payload = object(packageValue.policy_api_endpoint || packageValue.docker_container || packageValue.sim_controller_plugin);
    if (record.credential_ref !== credentialRef || record.team_id !== run.teamId
        || record.checkpoint_id !== run.checkpointId || checkpoint?.teamId !== run.teamId
        || checkpoint?.policyCredential?.ref !== credentialRef || checkpoint?.reference !== record.reference
        || checkpoint?.status === "retired" || object(canonical.customer).id !== run.teamId
        || object(canonical.robot_profile).robot_profile_id !== record.checkpoint_id
        || object(canonical.execution_authorization).authorized_by_user_id !== record.owner_uid
        || agentExecutionAdmissionDigest(canonical) !== data.canonical_request_digest
        || payload.credential_ref !== credentialRef || payload.credential_kind !== record.kind
        || (payload.endpoint_url || payload.image_ref) !== record.reference) {
      return res.status(409).json({ code: "policy_credential_job_binding_mismatch" });
    }
    const credential = await decryptCheckpointPolicyCredential(record);
    if (data.action === "access") {
      return res.json({ ok: true, job_id: data.job_id, canonical_request_digest: data.canonical_request_digest,
        credential_ref: credentialRef, kind: credential.kind,
        ...(credential.kind === "bearer" ? { credential: { job_id: data.job_id,
          endpoint_url: record.reference, bearer_token: credential.token } } : {}) });
    }
    if (credential.kind !== "registry" || !data.contract || !data.tenant_id) {
      return res.status(409).json({ code: "policy_registry_credential_required" });
    }
    const normalized = normalizeCompanyPolicyContainerContract(data.contract);
    if (!normalized.ok || normalized.contract.container.image !== record.reference
        || normalized.contract.container.visibility !== "private") {
      return res.status(409).json({ code: "policy_registry_contract_mismatch" });
    }
    const contract = normalized.contract;
    const context = { ownerUid: record.owner_uid, tenantId: data.tenant_id,
      runId: data.job_id, companyId: contract.company_id };
    const registryRequest = { schema_version: "company_policy_registry_credential_lease.v1" as const,
        submission_id: record.checkpoint_id, contract_digest: contract.contract_digest,
        image: record.reference, registry_username: credential.username, registry_secret: credential.secret,
        expires_in_seconds: 900, idempotency_key: `checkpoint-pull-${credentialRef}-${data.job_id}` };
    const leaseId = registryCredentialLeaseId({ context, request: registryRequest });
    const leaseRef = db.collection("companyPolicyRegistryCredentialLeases").doc(leaseId);
    if (data.action === "registry_lease") {
      const issued = await createRegistryCredentialLease({ context, value: registryRequest });
      if (!issued.ok) return res.status(409).json({ code: issued.code });
      const lease = await db.runTransaction(async (transaction) => {
        const old = await transaction.get(leaseRef);
        if (old.exists) {
          const prior = old.data() as StoredRegistryCredentialLease;
          if (prior.status !== "active" || Date.parse(prior.expires_at_iso) <= Date.now()
              || prior.request_fingerprint !== issued.lease.request_fingerprint) throw new Error("lease_not_active");
          return prior;
        }
        transaction.create(leaseRef, issued.lease);
        return issued.lease;
      });
      return res.json({ ok: true, job_id: data.job_id, canonical_request_digest: data.canonical_request_digest,
        lease: publicRegistryCredentialLease(lease) });
    }
    const receipt = object(data.admission_receipt);
    const identity = { tenant_id: data.tenant_id, run_id: data.job_id,
      submission_id: record.checkpoint_id, company_id: contract.company_id, contract_digest: contract.contract_digest };
    const admissionRequest = { schema_version: "company_policy_container_admission_request.v1", ...identity,
      contract, registry_credential_lease_id: leaseId,
      claim_ceiling: "development_only", launch_authority_granted: false, provider_mutation_authorized: false };
    const requestDigest = agentExecutionAdmissionDigest(admissionRequest);
    const admissionId = "company-policy-admission-" + agentExecutionAdmissionDigest(identity).slice(7, 47);
    const admissionDigest = agentExecutionAdmissionDigest({ identity, request_digest: requestDigest });
    if (receipt.status !== "admitted_no_spend" || receipt.accepted !== true
        || receipt.admission_id !== admissionId || receipt.admission_digest !== admissionDigest
        || receipt.request_digest !== requestDigest || receipt.registry_credential_lease_id !== leaseId) {
      return res.status(409).json({ code: "policy_registry_admission_mismatch" });
    }
    await db.runTransaction(async (transaction) => {
      const old = await transaction.get(leaseRef);
      const prior = old.data() as StoredRegistryCredentialLease | undefined;
      if (!prior || prior.status !== "active" || Date.parse(prior.expires_at_iso) <= Date.now()
          || (prior.admission_id && prior.admission_id !== admissionId)
          || (prior.admission_digest && prior.admission_digest !== admissionDigest)) throw new Error("lease_binding_conflict");
      transaction.update(leaseRef, { admission_id: admissionId, admission_digest: admissionDigest });
    });
    return res.json({ ok: true, lease_id: leaseId, admission_id: admissionId });
  } catch {
    // Never log or echo the request/secret/decryption exception.
    return res.status(409).json({ code: "policy_credential_delivery_unavailable" });
  }
});
export default router;
