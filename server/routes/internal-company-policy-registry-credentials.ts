import {Router} from "express";
import {z} from "zod";

import admin, {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {
  createPipelineSyncRateLimiter,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";
import {
  type StoredRegistryCredentialLease,
  decryptRegistryCredentialLease,
  publicRegistryCredentialLease,
} from "../utils/companyPolicyRegistryCredentialLease";
import {isBoundEncryptedField} from "../utils/field-encryption";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const consumeSchema = z
  .object({
    schema_version: z.literal("company_policy_registry_credential_consume.v1"),
    tenant_id: z.string().min(1).max(256),
    run_id: z.string().min(8).max(256),
    submission_id: z.string().min(8).max(256),
    company_id: z.string().min(1).max(128),
    contract_digest: digest,
    image: z.string().regex(/^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$/),
  })
  .strict();

function requirePipelineSignature(req: Parameters<typeof verifyPipelineSyncRequest>[0], res: any, next: () => void) {
  const verified = verifyPipelineSyncRequest(req);
  if (!verified.ok) {
    return res.status(verified.status).json({
      ok: false,
      code: verified.code,
      error: verified.message,
    });
  }
  next();
}

router.post(
  "/company-policy-registry-credential-leases/:leaseId/consume",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    if (!db) {
      return res.status(503).json({ok: false, code: "registry_credential_lease_store_not_configured"});
    }
    const request = consumeSchema.safeParse(req.body);
    if (!request.success) {
      return res.status(400).json({
        ok: false,
        code: "registry_credential_consume_request_invalid",
        errors: request.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`).sort(),
      });
    }
    const leaseId = String(req.params.leaseId || "").trim();
    const ref = db.collection("companyPolicyRegistryCredentialLeases").doc(leaseId);
    const consumedAt = new Date();
    const transactionResult = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return {kind: "not_found" as const};
      const lease = (snapshot.data() || {}) as unknown as StoredRegistryCredentialLease;
      const expected = request.data;
      if (
        lease.lease_id !== leaseId
        || lease.tenant_id !== expected.tenant_id
        || lease.run_id !== expected.run_id
        || lease.submission_id !== expected.submission_id
        || lease.company_id !== expected.company_id
        || lease.contract_digest !== expected.contract_digest
        || lease.image !== expected.image
      ) {
        return {kind: "binding_mismatch" as const};
      }
      if (lease.status !== "active" || !isBoundEncryptedField(lease.encrypted_credential)) {
        return {kind: "already_consumed" as const};
      }
      if (Date.parse(lease.expires_at_iso) <= consumedAt.getTime()) {
        transaction.update(ref, {
          status: "expired",
          encrypted_credential: admin.firestore.FieldValue.delete(),
          expired_at_iso: consumedAt.toISOString(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {kind: "expired" as const};
      }
      transaction.update(ref, {
        status: "consumed",
        consumed_at_iso: consumedAt.toISOString(),
        encrypted_credential: admin.firestore.FieldValue.delete(),
        ciphertext_deleted: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {kind: "consumed" as const, lease};
    });

    if (transactionResult.kind === "not_found") {
      return res.status(404).json({ok: false, code: "registry_credential_lease_not_found"});
    }
    if (transactionResult.kind === "binding_mismatch") {
      return res.status(409).json({ok: false, code: "registry_credential_lease_binding_mismatch"});
    }
    if (transactionResult.kind === "already_consumed") {
      return res.status(409).json({ok: false, code: "registry_credential_lease_already_consumed"});
    }
    if (transactionResult.kind === "expired") {
      return res.status(410).json({ok: false, code: "registry_credential_lease_expired"});
    }

    const lease = transactionResult.lease;
    try {
      const credential = await decryptRegistryCredentialLease({
        lease,
        context: {
          ownerUid: lease.owner_uid,
          tenantId: request.data.tenant_id,
          runId: request.data.run_id,
          companyId: request.data.company_id,
        },
      });
      return res.json({
        ok: true,
        credential,
        lease_receipt: {
          ...publicRegistryCredentialLease({...lease, status: "consumed"}),
          status: "consumed",
          consumed_at_iso: consumedAt.toISOString(),
          ciphertext_deleted: true,
        },
      });
    } catch {
      return res.status(500).json({
        ok: false,
        code: "registry_credential_lease_decryption_failed_after_consumption",
        lease_id: leaseId,
        ciphertext_deleted: true,
      });
    }
  },
);

export default router;
