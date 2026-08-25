import crypto from "node:crypto";
import {type NextFunction, type Request, type Response, Router} from "express";
import {z} from "zod";

import admin, {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {createPipelineSyncRateLimiter} from "../utils/pipelineSyncSecurity";
import {
  type StoredRegistryCredentialLease,
  decryptRegistryCredentialLease,
  publicRegistryCredentialLease,
} from "../utils/companyPolicyRegistryCredentialLease";
import {isBoundEncryptedField} from "../utils/field-encryption";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/);
const consumeSchema = z
  .object({
    schema_version: z.literal("company_policy_registry_credential_consume.v2"),
    tenant_id: identifier,
    run_id: identifier,
    submission_id: identifier,
    company_id: z.string().regex(/^[a-z0-9][a-z0-9_]{0,127}$/),
    contract_digest: digest,
    admission_id: identifier,
    admission_digest: digest,
    sandbox_attempt_id: identifier,
    sandbox_plan_digest: digest,
    pipeline_release_sha: z.string().regex(/^[0-9a-f]{40}$/),
    worker_identity: identifier,
    purpose: z.literal("pull_digest_pinned_company_policy_image"),
    image: z.string().regex(/^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$/),
  })
  .strict();

interface CredentialBrokerAuth {
  clientId: string;
  nonce: string;
}

type BrokerRequest = Request & {
  rawBody?: string;
  credentialBrokerAuth?: CredentialBrokerAuth;
};

function equalHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireCredentialBrokerSignature(
  req: BrokerRequest,
  res: Response,
  next: NextFunction,
) {
  const secret = String(process.env.COMPANY_POLICY_CREDENTIAL_BROKER_TOKEN || "").trim();
  if (!secret) {
    return res.status(503).json({ok: false, code: "credential_broker_secret_not_configured"});
  }
  const expectedClientId = String(
    process.env.COMPANY_POLICY_CREDENTIAL_BROKER_CLIENT_ID || "blueprint-policy-sandbox-worker",
  ).trim();
  const timestamp = String(req.header("X-Blueprint-Pipeline-Timestamp") || "").trim();
  const clientId = String(req.header("X-Blueprint-Pipeline-Client-Id") || "").trim();
  const nonce = String(req.header("X-Blueprint-Pipeline-Nonce") || "").trim();
  const signature = String(req.header("X-Blueprint-Pipeline-Signature") || "")
    .trim()
    .replace(/^sha256=/i, "");
  const timestampMs = Date.parse(timestamp);
  const maxSkewMs = Number(process.env.COMPANY_POLICY_CREDENTIAL_BROKER_MAX_SKEW_MS || 60_000);
  if (
    clientId !== expectedClientId
    || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(clientId)
    || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,191}$/.test(nonce)
    || !Number.isFinite(timestampMs)
    || !Number.isFinite(maxSkewMs)
    || maxSkewMs < 1
    || Math.abs(Date.now() - timestampMs) > maxSkewMs
    || !/^[0-9a-f]{64}$/.test(signature)
  ) {
    return res.status(401).json({ok: false, code: "credential_broker_signature_metadata_invalid"});
  }
  const body = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body ?? {});
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  if (!equalHex(signature, expected)) {
    return res.status(401).json({ok: false, code: "credential_broker_signature_invalid"});
  }
  req.credentialBrokerAuth = {clientId, nonce};
  next();
}

function leaseMatches(
  lease: StoredRegistryCredentialLease,
  leaseId: string,
  expected: z.infer<typeof consumeSchema>,
): boolean {
  return (
    lease.lease_id === leaseId
    && lease.tenant_id === expected.tenant_id
    && lease.run_id === expected.run_id
    && lease.submission_id === expected.submission_id
    && lease.company_id === expected.company_id
    && lease.contract_digest === expected.contract_digest
    && lease.image === expected.image
    && lease.admission_id === expected.admission_id
    && lease.admission_digest === expected.admission_digest
  );
}

router.post(
  "/company-policy-registry-credential-leases/:leaseId/consume",
  rateLimiter,
  requireCredentialBrokerSignature,
  async (req: BrokerRequest, res) => {
    res.setHeader("Cache-Control", "no-store, private, max-age=0");
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
    const brokerAuth = req.credentialBrokerAuth;
    if (!brokerAuth) return res.status(401).json({ok: false, code: "credential_broker_identity_missing"});
    const leaseId = String(req.params.leaseId || "").trim();
    const ref = db.collection("companyPolicyRegistryCredentialLeases").doc(leaseId);
    const initial = await ref.get();
    if (!initial.exists) {
      return res.status(404).json({ok: false, code: "registry_credential_lease_not_found"});
    }
    const initialLease = (initial.data() || {}) as unknown as StoredRegistryCredentialLease;
    if (!leaseMatches(initialLease, leaseId, request.data)) {
      return res.status(409).json({ok: false, code: "registry_credential_lease_binding_mismatch"});
    }
    if (initialLease.status !== "active" || !isBoundEncryptedField(initialLease.encrypted_credential)) {
      return res.status(409).json({ok: false, code: "registry_credential_lease_already_consumed"});
    }
    if (Date.parse(initialLease.expires_at_iso) <= Date.now()) {
      return res.status(410).json({ok: false, code: "registry_credential_lease_expired"});
    }

    let credential: {registry_server: string; username: string; secret: string};
    try {
      credential = await decryptRegistryCredentialLease({
        lease: initialLease,
        context: {
          ownerUid: initialLease.owner_uid,
          tenantId: request.data.tenant_id,
          runId: request.data.run_id,
          companyId: request.data.company_id,
        },
      });
    } catch {
      return res.status(500).json({
        ok: false,
        code: "registry_credential_lease_decryption_failed_unconsumed",
        lease_id: leaseId,
        ciphertext_deleted: false,
      });
    }

    const consumedAt = new Date();
    const nonceDigest = crypto
      .createHash("sha256")
      .update(`${brokerAuth.clientId}\0${brokerAuth.nonce}`)
      .digest("hex");
    const nonceRef = db.collection("companyPolicyCredentialConsumeNonces").doc(nonceDigest);
    const transactionResult = await db.runTransaction(async (transaction) => {
      const [nonceSnapshot, leaseSnapshot] = await Promise.all([
        transaction.get(nonceRef),
        transaction.get(ref),
      ]);
      if (nonceSnapshot.exists) return {kind: "replayed_nonce" as const};
      if (!leaseSnapshot.exists) return {kind: "not_found" as const};
      const lease = (leaseSnapshot.data() || {}) as unknown as StoredRegistryCredentialLease;
      if (!leaseMatches(lease, leaseId, request.data)) return {kind: "binding_mismatch" as const};
      if (lease.status !== "active" || !isBoundEncryptedField(lease.encrypted_credential)) {
        return {kind: "already_consumed" as const};
      }
      if (Date.parse(lease.expires_at_iso) <= consumedAt.getTime()) return {kind: "expired" as const};
      transaction.set(nonceRef, {
        schema_version: "company_policy_credential_consume_nonce.v1",
        client_id_sha256: crypto.createHash("sha256").update(brokerAuth.clientId).digest("hex"),
        nonce_sha256: crypto.createHash("sha256").update(brokerAuth.nonce).digest("hex"),
        expires_at: admin.firestore.Timestamp.fromDate(new Date(consumedAt.getTime() + 120_000)),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(ref, {
        status: "consumed",
        consumed_at_iso: consumedAt.toISOString(),
        consumed_for: {
          admission_id: request.data.admission_id,
          admission_digest: request.data.admission_digest,
          sandbox_attempt_id: request.data.sandbox_attempt_id,
          sandbox_plan_digest: request.data.sandbox_plan_digest,
          pipeline_release_sha: request.data.pipeline_release_sha,
          worker_identity: request.data.worker_identity,
          purpose: request.data.purpose,
        },
        broker_client_id: brokerAuth.clientId,
        encrypted_credential: admin.firestore.FieldValue.delete(),
        ciphertext_deleted: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {kind: "consumed" as const, lease};
    });

    if (transactionResult.kind === "replayed_nonce") {
      return res.status(409).json({ok: false, code: "credential_broker_nonce_replayed"});
    }
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

    return res.json({
      ok: true,
      credential,
      lease_receipt: {
        ...publicRegistryCredentialLease({...transactionResult.lease, status: "consumed"}),
        status: "consumed",
        consumed_at_iso: consumedAt.toISOString(),
        ciphertext_deleted: true,
        consumed_for: request.data,
      },
    });
  },
);

export default router;
