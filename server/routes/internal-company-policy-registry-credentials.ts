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
const bindingFields = {
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
};
const claimSchema = z.object({
  schema_version: z.literal("company_policy_registry_credential_claim.v1"),
  ...bindingFields,
}).strict();
const acknowledgementSchema = z.object({
  schema_version: z.literal("company_policy_registry_credential_acknowledgement.v1"),
  ...bindingFields,
  delivery_id: identifier,
  image_pull_receipt_digest: digest,
  pulled_image_digest: digest,
}).strict();
type ClaimRequest = z.infer<typeof claimSchema>;
type AcknowledgementRequest = z.infer<typeof acknowledgementSchema>;

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

function requireCredentialBrokerSignature(req: BrokerRequest, res: Response, next: NextFunction) {
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
  expected: ClaimRequest | AcknowledgementRequest,
): boolean {
  return lease.lease_id === leaseId
    && lease.tenant_id === expected.tenant_id
    && lease.run_id === expected.run_id
    && lease.submission_id === expected.submission_id
    && lease.company_id === expected.company_id
    && lease.contract_digest === expected.contract_digest
    && lease.image === expected.image
    && lease.admission_id === expected.admission_id
    && lease.admission_digest === expected.admission_digest;
}

function claimBinding(request: ClaimRequest | AcknowledgementRequest): Record<string, unknown> {
  return {
    tenant_id: request.tenant_id,
    run_id: request.run_id,
    submission_id: request.submission_id,
    company_id: request.company_id,
    contract_digest: request.contract_digest,
    admission_id: request.admission_id,
    admission_digest: request.admission_digest,
    sandbox_attempt_id: request.sandbox_attempt_id,
    sandbox_plan_digest: request.sandbox_plan_digest,
    pipeline_release_sha: request.pipeline_release_sha,
    worker_identity: request.worker_identity,
    purpose: request.purpose,
    image: request.image,
  };
}

function exactRecordMatch(left: unknown, right: Record<string, unknown>): boolean {
  return Boolean(left) && typeof left === "object" && !Array.isArray(left)
    && JSON.stringify(left) === JSON.stringify(right);
}

function deliveryIdFor(leaseId: string, request: ClaimRequest | AcknowledgementRequest): string {
  const identity = JSON.stringify({lease_id: leaseId, ...claimBinding(request)});
  return `policy-registry-delivery-${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 48)}`;
}

function nonceReference(auth: CredentialBrokerAuth) {
  const nonceDigest = crypto.createHash("sha256")
    .update(`${auth.clientId}\0${auth.nonce}`)
    .digest("hex");
  return db!.collection("companyPolicyCredentialBrokerNonces").doc(nonceDigest);
}

function writeNonce(
  transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  auth: CredentialBrokerAuth,
  now: Date,
) {
  transaction.set(ref, {
    schema_version: "company_policy_credential_broker_nonce.v1",
    client_id_sha256: crypto.createHash("sha256").update(auth.clientId).digest("hex"),
    nonce_sha256: crypto.createHash("sha256").update(auth.nonce).digest("hex"),
    expires_at: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 120_000)),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

router.post(
  "/company-policy-registry-credential-leases/:leaseId/claim",
  rateLimiter,
  requireCredentialBrokerSignature,
  async (req: BrokerRequest, res) => {
    res.setHeader("Cache-Control", "no-store, private, max-age=0");
    res.setHeader("Pragma", "no-cache");
    if (!db) return res.status(503).json({ok: false, code: "registry_credential_lease_store_not_configured"});
    const request = claimSchema.safeParse(req.body);
    if (!request.success) {
      return res.status(400).json({
        ok: false,
        code: "registry_credential_claim_request_invalid",
        errors: request.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`).sort(),
      });
    }
    const brokerAuth = req.credentialBrokerAuth;
    if (!brokerAuth) return res.status(401).json({ok: false, code: "credential_broker_identity_missing"});
    const leaseId = String(req.params.leaseId || "").trim();
    const ref = db.collection("companyPolicyRegistryCredentialLeases").doc(leaseId);
    const nonceRef = nonceReference(brokerAuth);
    const claimedAt = new Date();
    const deliveryId = deliveryIdFor(leaseId, request.data);
    const expectedBinding = claimBinding(request.data);
    const transactionResult = await db.runTransaction(async (transaction) => {
      const [nonceSnapshot, leaseSnapshot] = await Promise.all([
        transaction.get(nonceRef),
        transaction.get(ref),
      ]);
      if (nonceSnapshot.exists) return {kind: "replayed_nonce" as const};
      if (!leaseSnapshot.exists) return {kind: "not_found" as const};
      const lease = (leaseSnapshot.data() || {}) as unknown as StoredRegistryCredentialLease;
      if (!leaseMatches(lease, leaseId, request.data)) return {kind: "binding_mismatch" as const};
      if (Date.parse(lease.expires_at_iso) <= claimedAt.getTime()) return {kind: "expired" as const};
      if (lease.status === "consumed") return {kind: "already_consumed" as const};
      if (!isBoundEncryptedField(lease.encrypted_credential)) return {kind: "ciphertext_missing" as const};
      if (lease.status === "claimed") {
        if (lease.delivery_id !== deliveryId || !exactRecordMatch(lease.claimed_for, expectedBinding)) {
          return {kind: "already_claimed" as const};
        }
        if (Date.parse(String(lease.claim_expires_at_iso || "")) <= claimedAt.getTime()) {
          return {kind: "claim_expired" as const};
        }
        writeNonce(transaction, nonceRef, brokerAuth, claimedAt);
        return {kind: "redelivered" as const, lease};
      }
      if (lease.status !== "active") return {kind: "invalid_status" as const};
      const claimExpiresAt = new Date(Math.min(
        Date.parse(lease.expires_at_iso),
        claimedAt.getTime() + 120_000,
      )).toISOString();
      writeNonce(transaction, nonceRef, brokerAuth, claimedAt);
      transaction.update(ref, {
        status: "claimed",
        claimed_at_iso: claimedAt.toISOString(),
        claim_expires_at_iso: claimExpiresAt,
        delivery_id: deliveryId,
        claimed_for: expectedBinding,
        broker_client_id: brokerAuth.clientId,
        ciphertext_deleted: false,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {kind: "claimed" as const, lease, claimExpiresAt};
    });

    if (transactionResult.kind === "replayed_nonce") return res.status(409).json({ok: false, code: "credential_broker_nonce_replayed"});
    if (transactionResult.kind === "not_found") return res.status(404).json({ok: false, code: "registry_credential_lease_not_found"});
    if (transactionResult.kind === "binding_mismatch") return res.status(409).json({ok: false, code: "registry_credential_lease_binding_mismatch"});
    if (transactionResult.kind === "expired") return res.status(410).json({ok: false, code: "registry_credential_lease_expired"});
    if (transactionResult.kind === "claim_expired") return res.status(410).json({ok: false, code: "registry_credential_delivery_claim_expired"});
    if (transactionResult.kind === "already_claimed") return res.status(409).json({ok: false, code: "registry_credential_lease_claimed_by_different_worker"});
    if (transactionResult.kind === "already_consumed") return res.status(409).json({ok: false, code: "registry_credential_lease_already_consumed"});
    if (transactionResult.kind === "ciphertext_missing" || transactionResult.kind === "invalid_status") {
      return res.status(409).json({ok: false, code: "registry_credential_lease_not_claimable"});
    }

    let credential: {registry_server: string; username: string; secret: string};
    try {
      credential = await decryptRegistryCredentialLease({
        lease: transactionResult.lease,
        context: {
          ownerUid: transactionResult.lease.owner_uid,
          tenantId: request.data.tenant_id,
          runId: request.data.run_id,
          companyId: request.data.company_id,
        },
      });
    } catch {
      return res.status(500).json({
        ok: false,
        code: "registry_credential_lease_decryption_failed_claim_retained",
        lease_id: leaseId,
        ciphertext_deleted: false,
      });
    }
    const claimExpiresAt = transactionResult.kind === "claimed"
      ? transactionResult.claimExpiresAt
      : String(transactionResult.lease.claim_expires_at_iso);
    return res.json({
      ok: true,
      credential,
      delivery_receipt: {
        ...publicRegistryCredentialLease({...transactionResult.lease, status: "claimed"}),
        status: "claimed",
        delivery_id: deliveryId,
        claimed_at_iso: transactionResult.kind === "claimed"
          ? claimedAt.toISOString()
          : transactionResult.lease.claimed_at_iso,
        claim_expires_at_iso: claimExpiresAt,
        ciphertext_deleted: false,
        redelivered_after_response_loss: transactionResult.kind === "redelivered",
        claimed_for: expectedBinding,
      },
    });
  },
);

router.post(
  "/company-policy-registry-credential-leases/:leaseId/acknowledge",
  rateLimiter,
  requireCredentialBrokerSignature,
  async (req: BrokerRequest, res) => {
    res.setHeader("Cache-Control", "no-store, private, max-age=0");
    res.setHeader("Pragma", "no-cache");
    if (!db) return res.status(503).json({ok: false, code: "registry_credential_lease_store_not_configured"});
    const request = acknowledgementSchema.safeParse(req.body);
    if (!request.success) {
      return res.status(400).json({
        ok: false,
        code: "registry_credential_acknowledgement_request_invalid",
        errors: request.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`).sort(),
      });
    }
    const brokerAuth = req.credentialBrokerAuth;
    if (!brokerAuth) return res.status(401).json({ok: false, code: "credential_broker_identity_missing"});
    const expectedImageDigest = `sha256:${request.data.image.split("@sha256:", 2)[1]}`;
    if (request.data.pulled_image_digest !== expectedImageDigest) {
      return res.status(409).json({ok: false, code: "registry_credential_acknowledgement_image_digest_mismatch"});
    }
    const leaseId = String(req.params.leaseId || "").trim();
    const expectedDeliveryId = deliveryIdFor(leaseId, request.data);
    if (request.data.delivery_id !== expectedDeliveryId) {
      return res.status(409).json({ok: false, code: "registry_credential_delivery_id_mismatch"});
    }
    const ref = db.collection("companyPolicyRegistryCredentialLeases").doc(leaseId);
    const nonceRef = nonceReference(brokerAuth);
    const acknowledgedAt = new Date();
    const expectedBinding = claimBinding(request.data);
    const transactionResult = await db.runTransaction(async (transaction) => {
      const [nonceSnapshot, leaseSnapshot] = await Promise.all([
        transaction.get(nonceRef),
        transaction.get(ref),
      ]);
      if (nonceSnapshot.exists) return {kind: "replayed_nonce" as const};
      if (!leaseSnapshot.exists) return {kind: "not_found" as const};
      const lease = (leaseSnapshot.data() || {}) as unknown as StoredRegistryCredentialLease;
      if (!leaseMatches(lease, leaseId, request.data)) return {kind: "binding_mismatch" as const};
      if (lease.status === "consumed") {
        if (!exactRecordMatch(lease.consumed_for, request.data)) return {kind: "consumed_mismatch" as const};
        writeNonce(transaction, nonceRef, brokerAuth, acknowledgedAt);
        return {kind: "already_acknowledged" as const, lease};
      }
      if (
        lease.status !== "claimed"
        || lease.delivery_id !== request.data.delivery_id
        || !exactRecordMatch(lease.claimed_for, expectedBinding)
      ) return {kind: "not_claimed" as const};
      if (Date.parse(String(lease.claim_expires_at_iso || "")) <= acknowledgedAt.getTime()) {
        return {kind: "claim_expired" as const};
      }
      if (!isBoundEncryptedField(lease.encrypted_credential)) return {kind: "ciphertext_missing" as const};
      writeNonce(transaction, nonceRef, brokerAuth, acknowledgedAt);
      transaction.update(ref, {
        status: "consumed",
        consumed_at_iso: acknowledgedAt.toISOString(),
        consumed_for: request.data,
        image_pull_receipt_digest: request.data.image_pull_receipt_digest,
        pulled_image_digest: request.data.pulled_image_digest,
        encrypted_credential: admin.firestore.FieldValue.delete(),
        ciphertext_deleted: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {kind: "acknowledged" as const, lease};
    });

    if (transactionResult.kind === "replayed_nonce") return res.status(409).json({ok: false, code: "credential_broker_nonce_replayed"});
    if (transactionResult.kind === "not_found") return res.status(404).json({ok: false, code: "registry_credential_lease_not_found"});
    if (transactionResult.kind === "binding_mismatch") return res.status(409).json({ok: false, code: "registry_credential_lease_binding_mismatch"});
    if (transactionResult.kind === "not_claimed" || transactionResult.kind === "ciphertext_missing") {
      return res.status(409).json({ok: false, code: "registry_credential_lease_not_claimed"});
    }
    if (transactionResult.kind === "claim_expired") return res.status(410).json({ok: false, code: "registry_credential_delivery_claim_expired"});
    if (transactionResult.kind === "consumed_mismatch") return res.status(409).json({ok: false, code: "registry_credential_acknowledgement_conflict"});
    return res.json({
      ok: true,
      lease_receipt: {
        ...publicRegistryCredentialLease({...transactionResult.lease, status: "consumed"}),
        status: "consumed",
        delivery_id: request.data.delivery_id,
        consumed_at_iso: transactionResult.kind === "acknowledged"
          ? acknowledgedAt.toISOString()
          : transactionResult.lease.consumed_at_iso,
        image_pull_receipt_digest: request.data.image_pull_receipt_digest,
        pulled_image_digest: request.data.pulled_image_digest,
        ciphertext_deleted: true,
        idempotent_replay: transactionResult.kind === "already_acknowledged",
        consumed_for: request.data,
      },
    });
  },
);

export default router;
