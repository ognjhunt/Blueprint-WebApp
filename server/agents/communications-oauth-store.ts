import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { encryptBoundFieldValue, decryptBoundFieldValue } from "../utils/field-encryption";
import type { BoundEncryptedField } from "../types/field-encryption";
import { checkWorkOperator } from "../utils/blueprintWorkStore";
import { withTaskEvaluationLaunchStoreTimeout as bounded } from "../utils/taskEvaluationLaunchStore";
import type { WorkStore } from "../utils/blueprintWorkOAuth";
import { FounderGmailConsent, FOUNDER_CONNECTION_ID, FOUNDER_OAUTH_CALLBACK,
  founderScopesMatch, draftScopesMatch, type FounderCredential, type FounderConsentConfig, type FounderBindingSnapshot } from "./communications-oauth";
import { founderGoogleConsent } from "./communications-oauth-google";
import { FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE, FOUNDER_GMAIL_DRAFT_SCOPE } from "./communications-connection";
import { FOUNDER_MAILBOX, communicationsDigest } from "./communications-contract";

export const FOUNDER_OAUTH_FLOW_COLLECTION = "communicationsGmailOAuthFlows";
export const FOUNDER_CREDENTIAL_COLLECTION = "communicationsGmailCredentials";
export const FOUNDER_STORAGE = "bound-field-firestore-v1";
const aad = (ownerUid: string, clientId: string, flowId: string) => `${FOUNDER_CONNECTION_ID}:${ownerUid}:${clientId}:${flowId}`;
const encryptedStorageConfigured = () => process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE === FOUNDER_STORAGE
  && Boolean(process.env.FIELD_ENCRYPTION_KMS_KEY_NAME || process.env.FIELD_ENCRYPTION_MASTER_KEY);

/** Existing bound encryption + default-denied Firestore. No new vault/provider.
 * Selecting this adapter and installing client credentials remain owner actions. */
export function configuredFounderConsent(): FounderGmailConsent | null {
  const env = process.env;
  if (env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_ENABLED !== "true" || !dbAdmin || !encryptedStorageConfigured()
    || env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_REGISTERED_CALLBACK !== FOUNDER_OAUTH_CALLBACK
    || !env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID?.trim() || !env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET?.trim()
    || !env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim() || !env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF?.trim()
    || !["temporary_testing", "durable_reviewed"].includes(env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_GRANT_MODE || "")) return null;
  const config: FounderConsentConfig = { ownerUid: env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID,
    clientId: env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID.trim(), callback: FOUNDER_OAUTH_CALLBACK,
    approvalReference: env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF,
    draftApprovalReference: env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF,
    grantMode: env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_GRANT_MODE as FounderConsentConfig["grantMode"] };
  const db = dbAdmin, collection = db.collection(FOUNDER_OAUTH_FLOW_COLLECTION);
  const flows: WorkStore = {
    async get(id) { const row = await bounded(collection.doc(id).get()); return row.exists ? row.data() : undefined; },
    async set(id, value) { await bounded(collection.doc(id).set(value)); },
    async transaction(fn) { return bounded(db.runTransaction(async tx => fn({
      async get(id) { const row = await tx.get(collection.doc(id)); return row.exists ? row.data() : undefined; },
      set(id, value) { tx.set(collection.doc(id), value); }, delete(id) { tx.delete(collection.doc(id)); },
    }))); },
  };
  return new FounderGmailConsent(config, {
    flows, seal: encryptBoundFieldValue,
    open: (value, binding) => decryptBoundFieldValue(value as BoundEncryptedField, binding),
    checkOwner: async identity => {
      // Recheck control/approval/client drift and current revocable operator role,
      // including after Google verification and before credential persistence.
      return env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_ENABLED === "true"
        && env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID === config.ownerUid
        && env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID?.trim() === config.clientId
        && env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF === config.approvalReference
        && env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF === config.draftApprovalReference
        && env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_GRANT_MODE === config.grantMode
        && env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_REGISTERED_CALLBACK === config.callback
        && encryptedStorageConfigured() && await checkWorkOperator(identity);
    },
    async storageReady() {
      // Initial connect only: never overwrite an existing founder environment or
      // durable binding, much less any HUMAN_REPLY operations configuration.
      if (env.BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN?.trim()) return false;
      const row = await bounded(db.collection(FOUNDER_CREDENTIAL_COLLECTION).doc(FOUNDER_CONNECTION_ID).get());
      return encryptedStorageConfigured() && !row.exists;
    },
    async save(credential, flowId) { await saveFounderCredential(credential, flowId); },
    async currentBinding() {
      const ref = db.collection(FOUNDER_CREDENTIAL_COLLECTION).doc(FOUNDER_CONNECTION_ID);
      const row = await bounded(ref.get());
      if (!row.exists) return null;
      if (env.BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN?.trim()) throw new Error("founder_environment_binding_blocks_upgrade");
      return (await readFounderBinding(row.data()!)).snapshot;
    },
    async saveUpgrade(credential, flowId, previous) { await saveFounderUpgrade(credential, flowId, previous); },
    ...founderGoogleConsent(config.clientId, env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET.trim()),
  });
}

export async function saveFounderCredential(credential: FounderCredential, flowId: string) {
  if (!dbAdmin || !encryptedStorageConfigured()) throw new Error("founder_secure_storage_unavailable");
  if (credential.version !== "blueprint.founder-gmail-credential.v1" || !founderScopesMatch(credential.scopes)) throw new Error("founder_initial_binding_readonly_required");
  const encrypted = await encryptBoundFieldValue(JSON.stringify(credential), aad(credential.ownerUid, credential.clientId, flowId));
  const ref = dbAdmin.collection(FOUNDER_CREDENTIAL_COLLECTION).doc(FOUNDER_CONNECTION_ID);
  await bounded(dbAdmin.runTransaction(async tx => {
    const old = await tx.get(ref);
    if (old.exists) {
      if (old.data()?.flowId === flowId) return; // Same exact durable receipt only.
      throw new Error("founder_binding_exists_owner_replacement_required");
    }
    tx.create(ref, { version: credential.version, binding: FOUNDER_CONNECTION_ID, ownerUid: credential.ownerUid,
      clientId: credential.clientId, flowId, encrypted, consentedAt: credential.consentedAt,
      usableUntil: credential.usableUntil, scopes: credential.scopes, mailbox: credential.mailbox,
      approvalReference: credential.approvalReference, grantMode: credential.grantMode });
  }));
}

/** Only an explicit reviewed owner scope-upgrade flow can replace a binding.
 * Encrypt before the retryable transaction; commit binding and flow together. */
export async function saveFounderUpgrade(credential: FounderCredential, flowId: string, previous: FounderBindingSnapshot) {
  if (!dbAdmin || !encryptedStorageConfigured() || process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN?.trim()) throw new Error("founder_secure_storage_unavailable");
  const draftUpgrade = credential.version === "blueprint.founder-gmail-credential.v3";
  const scopeValid = draftUpgrade ? credential.consentPurpose === "draft_upgrade" && !previous.draftScopeGranted
    && /^[A-Za-z0-9_.:-]{1,200}$/.test(credential.draftApprovalReference)
    && draftScopesMatch(credential.scopes, [...(previous.scopes ?? [FOUNDER_GMAIL_READ_SCOPE]), FOUNDER_GMAIL_DRAFT_SCOPE])
    && credential.draftApprovalReference === process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF
    : credential.version === "blueprint.founder-gmail-credential.v2" && credential.consentPurpose === "send_upgrade"
      && founderScopesMatch(credential.scopes, true) && !previous.sendScopeGranted;
  if (!scopeValid || credential.version === "blueprint.founder-gmail-credential.v1"
    || credential.upgradedFromFlowId !== previous.flowId
    || credential.clientId !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID?.trim()
    || credential.ownerUid !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID
    || credential.mailbox !== FOUNDER_MAILBOX || credential.binding !== FOUNDER_CONNECTION_ID) throw new Error("founder_scope_upgrade_invalid");
  const encrypted = await encryptBoundFieldValue(JSON.stringify(credential), aad(credential.ownerUid, credential.clientId, flowId));
  const ref = dbAdmin.collection(FOUNDER_CREDENTIAL_COLLECTION).doc(FOUNDER_CONNECTION_ID);
  const flowRef = dbAdmin.collection(FOUNDER_OAUTH_FLOW_COLLECTION).doc(flowId);
  await bounded(dbAdmin.runTransaction(async tx => {
    const [old, flow] = await Promise.all([tx.get(ref), tx.get(flowRef)]);
    const current = old.data(), attempt = flow.data();
    if (current?.flowId === flowId && current.version === credential.version && attempt?.phase === (draftUpgrade ? "connected_draft_capable" : "connected_send_capable")) return;
    if (!old.exists || communicationsDigest(current) !== previous.revision || current?.flowId !== previous.flowId
      || (draftUpgrade ? !["blueprint.founder-gmail-credential.v1", "blueprint.founder-gmail-credential.v2"].includes(current.version)
        || communicationsDigest(current.scopes) !== communicationsDigest(previous.scopes ?? [FOUNDER_GMAIL_READ_SCOPE])
        : current.version !== "blueprint.founder-gmail-credential.v1" || !founderScopesMatch(current.scopes))
      || attempt?.phase !== "exchanging" || attempt.purpose !== (draftUpgrade ? "draft_upgrade" : "send_upgrade")
      || (draftUpgrade && attempt.draftApprovalReference !== credential.draftApprovalReference)
      || attempt.previousBinding?.revision !== previous.revision || attempt.previousBinding?.flowId !== previous.flowId
      || attempt.ownerUid !== credential.ownerUid || attempt.clientId !== credential.clientId
      || attempt.approvalReference !== credential.approvalReference || attempt.grantMode !== credential.grantMode
      || attempt.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("founder_send_upgrade_binding_changed");
    tx.set(ref, { version: credential.version, binding: FOUNDER_CONNECTION_ID, ownerUid: credential.ownerUid,
      clientId: credential.clientId, flowId, encrypted, consentedAt: credential.consentedAt,
      usableUntil: credential.usableUntil, scopes: credential.scopes, mailbox: credential.mailbox,
      approvalReference: credential.approvalReference, grantMode: credential.grantMode,
      consentPurpose: credential.consentPurpose, upgradedFromFlowId: credential.upgradedFromFlowId,
      ...(draftUpgrade ? { draftApprovalReference: credential.draftApprovalReference } : {}) });
    // A successful draft upgrade becomes a durable private recovery receipt;
    // the former ten-minute OAuth TTL must not remove the old encrypted binding.
    const { expireAt: _oauthTtl, ...recoveryFlow } = attempt;
    tx.set(flowRef, { ...(draftUpgrade ? recoveryFlow : attempt), ...(draftUpgrade ? { previousCredential: current } : {}), phase: draftUpgrade ? "connected_draft_capable" : "connected_send_capable", secrets: null });
  }));
}

async function readFounderBinding(data: Record<string, any>): Promise<{ credential: FounderCredential; snapshot: FounderBindingSnapshot }> {
  if (!data.flowId || !data.ownerUid || data.ownerUid !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID
    || data.clientId !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID?.trim()) throw new Error("founder_gmail_credential_binding_invalid");
  const credential = JSON.parse(await decryptBoundFieldValue(data.encrypted, aad(data.ownerUid, data.clientId, data.flowId))) as FounderCredential;
  const draftScopeGranted = credential.version === "blueprint.founder-gmail-credential.v3"
    && credential.consentPurpose === "draft_upgrade" && Boolean(credential.upgradedFromFlowId)
    && data.version === credential.version && data.consentPurpose === credential.consentPurpose
    && data.upgradedFromFlowId === credential.upgradedFromFlowId && data.draftApprovalReference === credential.draftApprovalReference
    && Boolean(credential.draftApprovalReference) && communicationsDigest(data.scopes) === communicationsDigest(credential.scopes)
    && draftScopesMatch(credential.scopes, credential.scopes);
  const legacySendScopeGranted = credential.version === "blueprint.founder-gmail-credential.v2"
    && credential.consentPurpose === "send_upgrade" && Boolean(credential.upgradedFromFlowId)
    && data.version === credential.version && data.consentPurpose === credential.consentPurpose
    && data.upgradedFromFlowId === credential.upgradedFromFlowId && founderScopesMatch(credential.scopes, true);
  const sendScopeGranted = legacySendScopeGranted || draftScopeGranted && credential.scopes.includes(FOUNDER_GMAIL_SEND_SCOPE);
  if ((credential.version !== "blueprint.founder-gmail-credential.v1" || !founderScopesMatch(credential.scopes)) && !legacySendScopeGranted && !draftScopeGranted
    || credential.binding !== FOUNDER_CONNECTION_ID || credential.mailbox !== FOUNDER_MAILBOX
    || credential.clientId !== data.clientId || credential.ownerUid !== data.ownerUid || !credential.refreshToken
    || !["temporary_testing", "durable_reviewed"].includes(credential.grantMode)
    || (credential.grantMode === "temporary_testing" && (!credential.usableUntil || credential.usableUntil <= Math.floor(Date.now() / 1000)))) {
    throw new Error("founder_gmail_credential_invalid_or_expired");
  }
  return { credential, snapshot: { flowId: data.flowId, revision: communicationsDigest(data), sendScopeGranted, draftScopeGranted, scopes: credential.scopes } };
}

/** Capability check only; it never calls Gmail or returns credential material. */
export async function requireFounderSendCapability(): Promise<void> {
  if (process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN?.trim()) throw new Error("founder_send_scope_unverified");
  const credential = await readFounderCredential();
  if (!credential.scopes.includes(FOUNDER_GMAIL_SEND_SCOPE)) throw new Error("founder_send_scope_unverified");
}

/** Separate compose consent never substitutes for draft-write authorization. */
export async function requireFounderDraftCapability(): Promise<void> {
  if (process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN?.trim()) throw new Error("founder_draft_scope_unverified");
  const credential = await readFounderCredential();
  if (credential.version !== "blueprint.founder-gmail-credential.v3" || !credential.scopes.includes(FOUNDER_GMAIL_DRAFT_SCOPE)
    || credential.draftApprovalReference !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF) throw new Error("founder_draft_scope_unverified");
}

/** Private runtime reader; no API response ever contains this credential. */
export async function readFounderCredential(): Promise<FounderCredential> {
  try {
  if (!dbAdmin || !encryptedStorageConfigured()) throw new Error("founder_gmail_binding_missing");
  const row = await bounded(dbAdmin.collection(FOUNDER_CREDENTIAL_COLLECTION).doc(FOUNDER_CONNECTION_ID).get());
  if (!row.exists) throw new Error("founder_gmail_binding_missing");
  return (await readFounderBinding(row.data()!)).credential;
  } catch (error) {
    const safe = ["founder_gmail_binding_missing", "founder_gmail_credential_binding_invalid", "founder_gmail_credential_invalid_or_expired"];
    throw new Error(error instanceof Error && safe.includes(error.message) ? error.message : "founder_gmail_credential_unverified");
  }
}
