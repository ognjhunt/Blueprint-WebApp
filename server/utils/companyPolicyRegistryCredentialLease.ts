import crypto from "node:crypto";
import {z} from "zod";

import type {BoundEncryptedField} from "../types/field-encryption";
import {
  decryptBoundFieldValue,
  encryptBoundFieldValue,
  isBoundEncryptedField,
} from "./field-encryption";

export const REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION =
  "company_policy_registry_credential_lease.v1" as const;
export const REGISTRY_CREDENTIAL_LEASE_MAX_TTL_SECONDS = 15 * 60;
export const REGISTRY_CREDENTIAL_LEASE_MIN_TTL_SECONDS = 60;

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const image = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$/);

export const registryCredentialRequestSchema = z
  .object({
    schema_version: z.literal(REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION),
    submission_id: identifier,
    contract_digest: digest,
    image,
    registry_username: z.string().min(1).max(512),
    registry_secret: z.string().min(1).max(16_384),
    expires_in_seconds: z
      .number()
      .int()
      .min(REGISTRY_CREDENTIAL_LEASE_MIN_TTL_SECONDS)
      .max(REGISTRY_CREDENTIAL_LEASE_MAX_TTL_SECONDS),
    idempotency_key: identifier,
  })
  .strict();

export type RegistryCredentialRequest = z.infer<typeof registryCredentialRequestSchema>;

export interface RegistryCredentialLeaseContext {
  ownerUid: string;
  tenantId: string;
  runId: string;
  companyId: string;
}

export interface StoredRegistryCredentialLease {
  schema_version: typeof REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION;
  lease_id: string;
  owner_uid: string;
  tenant_id: string;
  run_id: string;
  submission_id: string;
  company_id: string;
  image: string;
  contract_digest: string;
  registry_server: string;
  encrypted_credential?: BoundEncryptedField;
  associated_data_sha256: string;
  idempotency_key_digest: string;
  request_fingerprint: string;
  admission_id?: string;
  admission_digest?: string;
  status: "active" | "claimed" | "consumed";
  single_use: true;
  created_at_iso: string;
  expires_at_iso: string;
  consumed_at_iso: string | null;
  claimed_at_iso?: string;
  claim_expires_at_iso?: string;
  delivery_id?: string;
  claimed_for?: Record<string, unknown>;
  consumed_for?: Record<string, unknown>;
  image_pull_receipt_digest?: string;
  pulled_image_digest?: string;
  ciphertext_deleted?: boolean;
}

function sha256(value: string): string {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function credentialRequestFingerprint(request: RegistryCredentialRequest): string {
  const key = String(
    process.env.COMPANY_POLICY_CREDENTIAL_FINGERPRINT_KEY
      || (process.env.NODE_ENV === "production" ? "" : process.env.FIELD_ENCRYPTION_MASTER_KEY)
      || "",
  ).trim();
  if (!key) throw new Error("registry_credential_fingerprint_key_required");
  return `hmac-sha256:${crypto
    .createHmac("sha256", key)
    .update(JSON.stringify({
      submission_id: request.submission_id,
      contract_digest: request.contract_digest,
      image: request.image,
      registry_username: request.registry_username,
      registry_secret: request.registry_secret,
      expires_in_seconds: request.expires_in_seconds,
      idempotency_key: request.idempotency_key,
    }))
    .digest("hex")}`;
}

function registryServerForImage(imageRef: string): string {
  const repository = imageRef.split("@sha256:", 1)[0];
  const first = repository.split("/", 1)[0];
  return first.includes(".") || first.includes(":") || first === "localhost"
    ? first
    : "docker.io";
}

export function registryCredentialLeaseBinding(params: {
  context: RegistryCredentialLeaseContext;
  submissionId: string;
  contractDigest: string;
  image: string;
}): string {
  return [
    REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION,
    params.context.tenantId,
    params.context.ownerUid,
    params.context.runId,
    params.submissionId,
    params.context.companyId,
    params.image,
    params.contractDigest,
  ].join("\u0000");
}

export function registryCredentialLeaseId(params: {
  context: RegistryCredentialLeaseContext;
  request: RegistryCredentialRequest;
}): string {
  const identity = [
    registryCredentialLeaseBinding({
      context: params.context,
      submissionId: params.request.submission_id,
      contractDigest: params.request.contract_digest,
      image: params.request.image,
    }),
    params.request.idempotency_key,
  ].join("\u0000");
  return `policy-registry-lease-${sha256(identity).slice("sha256:".length, 54)}`;
}

export async function createRegistryCredentialLease(params: {
  context: RegistryCredentialLeaseContext;
  value: unknown;
  now?: Date;
}): Promise<
  | {ok: true; lease: StoredRegistryCredentialLease}
  | {
      ok: false;
      code: "registry_credential_request_invalid" | "registry_credential_kms_required";
      errors: string[];
    }
> {
  const parsed = registryCredentialRequestSchema.safeParse(params.value);
  if (!parsed.success) {
    return {
      ok: false,
      code: "registry_credential_request_invalid",
      errors: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "credential"}:${issue.code}`)
        .sort(),
    };
  }
  if (process.env.NODE_ENV === "production" && !String(process.env.FIELD_ENCRYPTION_KMS_KEY_NAME || "").trim()) {
    return {
      ok: false,
      code: "registry_credential_kms_required",
      errors: ["production_registry_credentials_require_kms"],
    };
  }
  const request = parsed.data;
  const now = params.now ?? new Date();
  const expires = new Date(now.getTime() + request.expires_in_seconds * 1000);
  const binding = registryCredentialLeaseBinding({
    context: params.context,
    submissionId: request.submission_id,
    contractDigest: request.contract_digest,
    image: request.image,
  });
  const credentialPayload = JSON.stringify({
    registry_server: registryServerForImage(request.image),
    username: request.registry_username,
    secret: request.registry_secret,
  });
  const encrypted = await encryptBoundFieldValue(credentialPayload, binding);
  return {
    ok: true,
    lease: {
      schema_version: REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION,
      lease_id: registryCredentialLeaseId({context: params.context, request}),
      owner_uid: params.context.ownerUid,
      tenant_id: params.context.tenantId,
      run_id: params.context.runId,
      submission_id: request.submission_id,
      company_id: params.context.companyId,
      image: request.image,
      contract_digest: request.contract_digest,
      registry_server: registryServerForImage(request.image),
      encrypted_credential: encrypted,
      associated_data_sha256: encrypted.associatedDataSha256,
      idempotency_key_digest: sha256(request.idempotency_key),
      request_fingerprint: credentialRequestFingerprint(request),
      status: "active",
      single_use: true,
      created_at_iso: now.toISOString(),
      expires_at_iso: expires.toISOString(),
      consumed_at_iso: null,
    },
  };
}

export function publicRegistryCredentialLease(
  lease: StoredRegistryCredentialLease | Record<string, unknown>,
) {
  return {
    schema_version: lease.schema_version,
    lease_id: lease.lease_id,
    run_id: lease.run_id,
    submission_id: lease.submission_id,
    company_id: lease.company_id,
    image: lease.image,
    contract_digest: lease.contract_digest,
    registry_server: lease.registry_server,
    status: lease.status,
    single_use: lease.single_use,
    created_at_iso: lease.created_at_iso,
    expires_at_iso: lease.expires_at_iso,
    consumed_at_iso: lease.consumed_at_iso ?? null,
  };
}

export async function decryptRegistryCredentialLease(params: {
  lease: StoredRegistryCredentialLease;
  context: RegistryCredentialLeaseContext;
}): Promise<{registry_server: string; username: string; secret: string}> {
  if (!isBoundEncryptedField(params.lease.encrypted_credential)) {
    throw new Error("registry_credential_lease_ciphertext_invalid");
  }
  const binding = registryCredentialLeaseBinding({
    context: params.context,
    submissionId: params.lease.submission_id,
    contractDigest: params.lease.contract_digest,
    image: params.lease.image,
  });
  const plaintext = await decryptBoundFieldValue(
    params.lease.encrypted_credential,
    binding,
  );
  const parsed = z
    .object({
      registry_server: z.string().min(1),
      username: z.string().min(1),
      secret: z.string().min(1),
    })
    .strict()
    .parse(JSON.parse(plaintext));
  if (parsed.registry_server !== params.lease.registry_server) {
    throw new Error("registry_credential_lease_registry_mismatch");
  }
  return parsed;
}
