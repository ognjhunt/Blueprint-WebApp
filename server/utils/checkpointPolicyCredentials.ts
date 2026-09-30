/** ADP-050/day 28: account-owned access to a private policy, separate from its public metadata. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { encryptBoundFieldValue, decryptBoundFieldValue } from "./field-encryption";
import type { BoundEncryptedField } from "../types/field-encryption";
import type { RobotCheckpoint } from "./robotCheckpoints";
import { validateIntegrationReference } from "./policyIntegration";

export const policyCredentialSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("registry"), username: z.string().min(1).max(512),
    secret: z.string().min(1).max(16384) }).strict(),
  z.object({ kind: z.literal("bearer"), token: z.string().min(1).max(16384)
    .refine((v) => !/[\r\n]/.test(v)) }).strict(),
]);
export type PolicyCredential = z.infer<typeof policyCredentialSchema>;
export const POLICY_CREDENTIAL_COLLECTION = "checkpointPolicyCredentials";
export interface PolicyCredentialRecord {
  schema_version: "blueprint.checkpoint_policy_credential.v1";
  credential_ref: string;
  team_id: string;
  owner_uid: string;
  checkpoint_id: string;
  runtime: string;
  reference: string;
  kind: PolicyCredential["kind"];
  encrypted_credential: BoundEncryptedField;
  expires_at_iso: string;
  revoked: boolean;
}
function binding(record: Omit<PolicyCredentialRecord, "encrypted_credential">): string {
  return [record.schema_version, record.credential_ref, record.team_id, record.owner_uid,
    record.checkpoint_id, record.runtime, record.reference, record.kind].join("\0");
}
export async function storeCheckpointPolicyCredential(params: {
  checkpoint: RobotCheckpoint; ownerUid: string; credential: PolicyCredential;
}) {
  if (!db) throw new Error("policy_credential_store_unavailable");
  if (process.env.NODE_ENV === "production" && !process.env.FIELD_ENCRYPTION_KMS_KEY_NAME?.trim()) {
    throw new Error("policy_credential_kms_required");
  }
  const { checkpoint: checkpoint, credential } = params;
  const compatible = credential.kind === "registry"
    ? ["container_image", "controller_adapter"].includes(checkpoint.runtime)
    : ["customer_hosted", "policy_endpoint"].includes(checkpoint.runtime);
  if (!compatible) throw new Error("policy_credential_runtime_mismatch");
  if (credential.kind === "bearer" && !validateIntegrationReference("customer_hosted", checkpoint.reference)) {
    throw new Error("policy_credential_https_endpoint_required");
  }
  const metadata = { schema_version: "blueprint.checkpoint_policy_credential.v1" as const,
    credential_ref: `policy-credential-${randomUUID()}`, team_id: checkpoint.teamId,
    owner_uid: params.ownerUid, checkpoint_id: checkpoint.checkpointId,
    runtime: checkpoint.runtime, reference: checkpoint.reference, kind: credential.kind,
    expires_at_iso: new Date(Date.now() + 30 * 86400000).toISOString(), revoked: false };
  const encrypted = await encryptBoundFieldValue(JSON.stringify(credential), binding(metadata));
  const policyCredential = { ref: metadata.credential_ref, kind: credential.kind,
    expiresAtIso: metadata.expires_at_iso };
  await db.runTransaction(async (transaction) => {
    const checkpointRef = db!.collection("robotCheckpoints").doc(checkpoint.checkpointId);
    const current = await transaction.get(checkpointRef);
    if (current.data()?.teamId !== checkpoint.teamId || current.data()?.reference !== checkpoint.reference
        || current.data()?.status === "retired") throw new Error("policy_credential_checkpoint_changed");
    transaction.create(db!.collection(POLICY_CREDENTIAL_COLLECTION).doc(metadata.credential_ref),
      { ...metadata, encrypted_credential: encrypted });
    const priorRef = current.data()?.policyCredential?.ref;
    if (typeof priorRef === "string") {
      transaction.update(db!.collection(POLICY_CREDENTIAL_COLLECTION).doc(priorRef), {
        revoked: true, encrypted_credential: admin.firestore.FieldValue.delete(),
      });
    }
    transaction.update(checkpointRef, { policyCredential, updatedAtIso: new Date().toISOString() });
  });
  return policyCredential;
}
export async function decryptCheckpointPolicyCredential(record: PolicyCredentialRecord): Promise<PolicyCredential> {
  if (record.revoked || Date.parse(record.expires_at_iso) <= Date.now()) {
    throw new Error("policy_credential_expired_or_revoked");
  }
  return policyCredentialSchema.parse(JSON.parse(
    await decryptBoundFieldValue(record.encrypted_credential, binding(record))));
}
export async function revokeCheckpointPolicyCredential(checkpoint: RobotCheckpoint): Promise<void> {
  if (!db || !checkpoint.policyCredential) return;
  await db.runTransaction(async (transaction) => {
    const ref = db!.collection("robotCheckpoints").doc(checkpoint.checkpointId);
    const current = await transaction.get(ref);
    if (current.data()?.teamId !== checkpoint.teamId
        || current.data()?.policyCredential?.ref !== checkpoint.policyCredential?.ref) {
      throw new Error("policy_credential_checkpoint_changed");
    }
    transaction.update(db!.collection(POLICY_CREDENTIAL_COLLECTION).doc(checkpoint.policyCredential!.ref), {
      revoked: true, encrypted_credential: admin.firestore.FieldValue.delete(),
    });
    transaction.update(ref, { policyCredential: admin.firestore.FieldValue.delete(), updatedAtIso: new Date().toISOString() });
  });
}
