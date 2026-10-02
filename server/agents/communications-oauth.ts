import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FOUNDER_MAILBOX } from "./communications-contract";
import { FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE, FOUNDER_GMAIL_DRAFT_SCOPE } from "./communications-connection";
import type { WorkIdentity, WorkStore } from "../utils/blueprintWorkOAuth";

export const FOUNDER_OAUTH_PREFIX = "/api/communications/gmail/oauth";
export const FOUNDER_OAUTH_CALLBACK = `https://tryblueprint.io${FOUNDER_OAUTH_PREFIX}/callback`;
export const FOUNDER_OAUTH_COOKIE = "__Secure-blueprint_founder_oauth";
export const FOUNDER_CONNECTION_ID = "communications-founder-gmail";
const opaque = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const seconds = () => Math.floor(Date.now() / 1000);
const matches = (left: string, right: string) => left.length === right.length
  && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const FAILURE_STAGES = ["secret_open", "token_exchange", "token_validation", "mailbox_verification",
  "owner_recheck", "storage_readiness", "credential_persistence", "connection_acknowledgement"] as const;
type FounderConsentFailureStage = typeof FAILURE_STAGES[number];
export const safeFounderConsentFailureStage = (value: unknown): FounderConsentFailureStage | undefined =>
  FAILURE_STAGES.find(stage => stage === value);
export class FounderConsentError extends Error {
  constructor(readonly code: string, readonly status = 400, readonly failureStage?: FounderConsentFailureStage) { super(code); }
}
export type FounderConsentConfig = {
  ownerUid: string; clientId: string; callback: typeof FOUNDER_OAUTH_CALLBACK;
  approvalReference: string; draftApprovalReference?: string; grantMode: "temporary_testing" | "durable_reviewed";
};
type FounderCredentialBase = {
  binding: typeof FOUNDER_CONNECTION_ID; mailbox: typeof FOUNDER_MAILBOX;
  clientId: string; refreshToken: string;
  ownerUid: string; approvalReference: string; consentedAt: number;
  grantMode: FounderConsentConfig["grantMode"]; usableUntil: number | null;
};
export type FounderCredential = FounderCredentialBase & (
  { version: "blueprint.founder-gmail-credential.v1"; scopes: [typeof FOUNDER_GMAIL_READ_SCOPE] }
  | { version: "blueprint.founder-gmail-credential.v2"; scopes: [typeof FOUNDER_GMAIL_READ_SCOPE, typeof FOUNDER_GMAIL_SEND_SCOPE];
    consentPurpose: "send_upgrade"; upgradedFromFlowId: string }
  | { version: "blueprint.founder-gmail-credential.v3"; scopes: string[];
    consentPurpose: "draft_upgrade"; upgradedFromFlowId: string; draftApprovalReference: string }
);
export type FounderBindingSnapshot = { flowId: string; revision: string; sendScopeGranted: boolean; draftScopeGranted?: boolean; scopes?: string[] };
export const founderScopesMatch = (scopes: unknown, sendUpgrade = false) => Array.isArray(scopes)
  && scopes.length === (sendUpgrade ? 2 : 1) && scopes.includes(FOUNDER_GMAIL_READ_SCOPE)
  && (!sendUpgrade || scopes.includes(FOUNDER_GMAIL_SEND_SCOPE));
export function draftScopesMatch(scopes: unknown, expected: string[]) {
  return Array.isArray(scopes) && scopes.length === expected.length && new Set(scopes).size === scopes.length
    && scopes.every(scope => expected.includes(scope)) && expected.includes(FOUNDER_GMAIL_READ_SCOPE)
    && expected.includes(FOUNDER_GMAIL_DRAFT_SCOPE)
    && expected.every(scope => [FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE, FOUNDER_GMAIL_DRAFT_SCOPE].includes(scope));
}
export interface FounderConsentPorts {
  flows: WorkStore;
  seal(plaintext: string, associatedData: string): Promise<unknown>;
  open(encrypted: unknown, associatedData: string): Promise<string>;
  checkOwner(identity: WorkIdentity): Promise<boolean>;
  // Missing writer blocks admission BEFORE obtaining a Google grant.
  storageReady(): Promise<boolean>;
  save(credential: FounderCredential, flowId: string): Promise<void>;
  currentBinding?(): Promise<FounderBindingSnapshot | null>;
  // Replacement and successful flow acknowledgement must commit atomically.
  saveUpgrade?(credential: FounderCredential, flowId: string, previous: FounderBindingSnapshot): Promise<void>;
  exchange(input: { code: string; verifier: string; callback: string; clientId: string }): Promise<{
    refreshToken: string; accessToken: string; scopes: string[];
  }>;
  verify(input: { accessToken: string }): Promise<{ mailbox: string; sender: string }>;
  now?: () => number;
}

/** Gmail-only adapter. Secrets cross injected server ports, never API responses. */
export class FounderGmailConsent {
  private now: () => number;
  constructor(readonly config: FounderConsentConfig, readonly ports: FounderConsentPorts) {
    if (config.callback !== FOUNDER_OAUTH_CALLBACK || !config.ownerUid || !config.clientId
      || !/^[A-Za-z0-9_.:-]{1,200}$/.test(config.approvalReference)
      || !["temporary_testing", "durable_reviewed"].includes(config.grantMode)) {
      throw new FounderConsentError("founder_oauth_configuration_unverified", 503);
    }
    this.now = ports.now || seconds;
  }
  private aad(id: string) { return `${FOUNDER_CONNECTION_ID}:${this.config.ownerUid}:${id}`; }
  private async owner(identity: WorkIdentity) {
    if (identity.uid !== this.config.ownerUid || identity.tenantId !== null
      || !Number.isFinite(identity.authTime) || identity.authTime <= 0 || !await this.ports.checkOwner(identity)) {
      throw new FounderConsentError("founder_oauth_owner_required", 403);
    }
  }
  private cookie(value: string) {
    const parts = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(value);
    if (!parts) throw new FounderConsentError("founder_oauth_browser_binding_invalid");
    return { state: parts[1], id: hash(parts[1]), browserHash: hash(parts[2]) };
  }
  private binding(row: Record<string, any> | undefined, browserHash: string) {
    if (!row || row.expiresAt <= this.now() || row.ownerUid !== this.config.ownerUid
      || row.clientId !== this.config.clientId || row.callback !== this.config.callback
      || row.approvalReference !== this.config.approvalReference || row.grantMode !== this.config.grantMode
      || !matches(String(row.browserHash), browserHash)) throw new FounderConsentError("founder_oauth_flow_invalid");
    return row;
  }
  async start(identity: WorkIdentity, purpose: "read_only" | "send_upgrade" | "draft_upgrade" = "read_only") {
    await this.owner(identity);
    if (!["read_only", "send_upgrade", "draft_upgrade"].includes(purpose)) throw new FounderConsentError("founder_oauth_purpose_invalid");
    const upgrade = purpose !== "read_only", draftUpgrade = purpose === "draft_upgrade";
    if (draftUpgrade && !/^[A-Za-z0-9_.:-]{1,200}$/.test(this.config.draftApprovalReference ?? "")) throw new FounderConsentError("founder_draft_consent_not_authorized", 503);
    const previous = upgrade ? await this.ports.currentBinding?.() : null;
    if (upgrade ? !previous || (draftUpgrade ? previous.draftScopeGranted : previous.sendScopeGranted) || !this.ports.saveUpgrade : !await this.ports.storageReady()) {
      throw new FounderConsentError("founder_oauth_secure_storage_unavailable", 503);
    }
    if (draftUpgrade && !founderScopesMatch(previous!.scopes, previous!.sendScopeGranted)) throw new FounderConsentError("founder_existing_scope_unverified", 503);
    const state = opaque(), browser = opaque(), verifier = opaque(), id = hash(state);
    const secrets = await this.ports.seal(JSON.stringify({ verifier }), this.aad(id));
    await this.ports.flows.set(id, { phase: "awaiting_google", ownerUid: identity.uid,
      authTime: identity.authTime, tenantId: identity.tenantId, clientId: this.config.clientId,
      callback: this.config.callback, approvalReference: this.config.approvalReference,
      grantMode: this.config.grantMode, ...(upgrade ? { purpose, previousBinding: previous, ...(draftUpgrade ? { draftApprovalReference: this.config.draftApprovalReference } : {}) } : {}),
      browserHash: hash(browser), secrets, expiresAt: this.now() + 600, expireAt: new Date((this.now() + 600) * 1000) });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.callback,
      response_type: "code", scope: draftUpgrade ? [...(previous!.scopes ?? [FOUNDER_GMAIL_READ_SCOPE]), FOUNDER_GMAIL_DRAFT_SCOPE].join(" ")
        : purpose === "send_upgrade" ? `${FOUNDER_GMAIL_READ_SCOPE} ${FOUNDER_GMAIL_SEND_SCOPE}` : FOUNDER_GMAIL_READ_SCOPE,
      access_type: "offline", prompt: "consent",
      include_granted_scopes: "false", login_hint: FOUNDER_MAILBOX, state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    return { authorizationUrl: url.href, cookie: `${state}.${browser}` };
  }
  async callback(input: { state: string; code?: string; denied?: boolean }, cookie: string) {
    const browser = this.cookie(cookie);
    if (!matches(input.state, browser.state)) throw new FounderConsentError("founder_oauth_state_invalid");
    if (!input.denied && (!input.code || input.code.length > 4096 || /[\x00-\x20\x7f]/.test(input.code))) {
      throw new FounderConsentError("founder_oauth_code_invalid");
    }
    // Decrypt outside the transaction; the consuming transaction checks the
    // original ciphertext too. No network or secrets appear in retryable txs.
    const row = this.binding(await this.ports.flows.get(browser.id), browser.browserHash);
    if (row.phase !== "awaiting_google") throw new FounderConsentError("founder_oauth_state_consumed");
    await this.owner({ uid: row.ownerUid, tenantId: row.tenantId, authTime: row.authTime });
    const original = JSON.stringify(row.secrets);
    const plaintext = JSON.parse(await this.ports.open(row.secrets, this.aad(browser.id)));
    const sealed = input.denied ? null : await this.ports.seal(JSON.stringify({ verifier: plaintext.verifier, code: input.code }), this.aad(browser.id));
    await this.ports.flows.transaction(async tx => {
      const current = this.binding(await tx.get(browser.id), browser.browserHash);
      if (current.phase !== "awaiting_google" || JSON.stringify(current.secrets) !== original) {
        throw new FounderConsentError("founder_oauth_state_consumed");
      }
      tx.set(browser.id, { ...current, phase: input.denied ? "denied" : "awaiting_owner", secrets: sealed });
    });
  }
  async status(identity: WorkIdentity, cookie: string) {
    await this.owner(identity);
    const binding = await this.ports.currentBinding?.();
    const capability = binding ? { sendScopeGranted: binding.sendScopeGranted, sendUpgradeAvailable: !binding.sendScopeGranted, draftScopeGranted: binding.draftScopeGranted === true,
      draftUpgradeAvailable: !binding.draftScopeGranted && Boolean(this.config.draftApprovalReference) } : {};
    if (!cookie) return { state: binding ? binding.draftScopeGranted ? "connected_draft_capable" : binding.sendScopeGranted ? "connected_send_capable" : "connected_readonly"
      : await this.ports.storageReady() ? "idle" : "binding_exists_or_storage_unavailable", ...capability };
    const browser = this.cookie(cookie);
    const row = this.binding(await this.ports.flows.get(browser.id), browser.browserHash);
    if (row.tenantId !== identity.tenantId || identity.authTime < row.authTime) throw new FounderConsentError("founder_oauth_owner_required", 403);
    const failureStage = row.phase === "failed_requires_new_owner_consent" ? safeFounderConsentFailureStage(row.failureStage) : undefined;
    return { state: row.phase, ...capability, ...(row.purpose === "send_upgrade" || row.purpose === "draft_upgrade" ? { purpose: row.purpose } : {}), ...(failureStage ? { failureStage } : {}) };
  }
  async finish(identity: WorkIdentity, cookie: string, purpose: "read_only" | "send_upgrade" | "draft_upgrade" = "read_only") {
    await this.owner(identity);
    const sendUpgrade = purpose === "send_upgrade", draftUpgrade = purpose === "draft_upgrade", upgrade = sendUpgrade || draftUpgrade;
    if (draftUpgrade && !/^[A-Za-z0-9_.:-]{1,200}$/.test(this.config.draftApprovalReference ?? "")) throw new FounderConsentError("founder_draft_consent_not_authorized", 503);
    if (upgrade ? !this.ports.currentBinding || !this.ports.saveUpgrade : !await this.ports.storageReady()) {
      throw new FounderConsentError("founder_oauth_secure_storage_unavailable", 503);
    }
    const browser = this.cookie(cookie);
    const row = await this.ports.flows.transaction(async tx => {
      const current = this.binding(await tx.get(browser.id), browser.browserHash);
      if ((current.purpose || "read_only") !== purpose || (draftUpgrade && current.draftApprovalReference !== this.config.draftApprovalReference)) throw new FounderConsentError("founder_oauth_purpose_mismatch");
      if (current.tenantId !== identity.tenantId || identity.authTime < current.authTime) throw new FounderConsentError("founder_oauth_owner_required", 403);
      if (current.phase !== "awaiting_owner") throw new FounderConsentError("founder_oauth_exchange_already_claimed");
      // Persist claim BEFORE token POST; never repeat an uncertain exchange.
      tx.set(browser.id, { ...current, phase: "exchanging", secrets: null });
      return current;
    });
    let failureStage: FounderConsentFailureStage = "secret_open";
    try {
      const data = JSON.parse(await this.ports.open(row.secrets, this.aad(browser.id)));
      failureStage = "token_exchange";
      const token = await this.ports.exchange({ code: data.code, verifier: data.verifier,
        callback: this.config.callback, clientId: this.config.clientId });
      failureStage = "token_validation";
      const expectedScopes = draftUpgrade ? [...(row.previousBinding.scopes ?? [FOUNDER_GMAIL_READ_SCOPE]), FOUNDER_GMAIL_DRAFT_SCOPE] : null;
      if (!token.refreshToken || !token.accessToken || (expectedScopes ? !draftScopesMatch(token.scopes, expectedScopes) : !founderScopesMatch(token.scopes, sendUpgrade))) {
        throw new FounderConsentError("founder_oauth_scope_or_refresh_invalid");
      }
      failureStage = "mailbox_verification";
      const account = await this.ports.verify({ accessToken: token.accessToken });
      if (account.mailbox !== FOUNDER_MAILBOX || account.sender !== FOUNDER_MAILBOX) {
        throw new FounderConsentError("founder_oauth_identity_unverified");
      }
      failureStage = "owner_recheck";
      await this.owner(identity); // Recheck revoked/disabled owner before durable write.
      failureStage = "storage_readiness";
      const currentBinding = upgrade ? await this.ports.currentBinding!() : null;
      if (this.now() >= row.expiresAt || (upgrade ? !currentBinding || (draftUpgrade ? currentBinding.draftScopeGranted : currentBinding.sendScopeGranted)
        || currentBinding.revision !== row.previousBinding?.revision || currentBinding.flowId !== row.previousBinding?.flowId : !await this.ports.storageReady())) {
        throw new FounderConsentError("founder_oauth_authorization_expired");
      }
      const consentedAt = this.now();
      failureStage = "credential_persistence";
      const credential: FounderCredentialBase = { binding: FOUNDER_CONNECTION_ID,
        mailbox: FOUNDER_MAILBOX, clientId: this.config.clientId, refreshToken: token.refreshToken,
        ownerUid: identity.uid, approvalReference: this.config.approvalReference,
        consentedAt, grantMode: this.config.grantMode,
        usableUntil: this.config.grantMode === "temporary_testing" ? consentedAt + 7 * 86400 : null };
      if (draftUpgrade) {
        await this.ports.saveUpgrade!({ ...credential, version: "blueprint.founder-gmail-credential.v3", scopes: expectedScopes!, consentPurpose: "draft_upgrade", upgradedFromFlowId: row.previousBinding.flowId, draftApprovalReference: this.config.draftApprovalReference! }, browser.id, row.previousBinding);
        return { state: "connected_draft_capable", mailbox: FOUNDER_MAILBOX, draftScopeGranted: true, draftWritesEnabled: false, sendsEnabled: false };
      }
      if (sendUpgrade) {
        await this.ports.saveUpgrade!({ ...credential, version: "blueprint.founder-gmail-credential.v2",
          scopes: [FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE], consentPurpose: "send_upgrade", upgradedFromFlowId: row.previousBinding.flowId }, browser.id, row.previousBinding);
        return { state: "connected_send_capable", mailbox: FOUNDER_MAILBOX, sendScopeGranted: true, messagePolicyRequired: true, sendsEnabled: false };
      }
      await this.ports.save({ ...credential, version: "blueprint.founder-gmail-credential.v1", scopes: [FOUNDER_GMAIL_READ_SCOPE] }, browser.id);
      failureStage = "connection_acknowledgement";
      await this.ports.flows.set(browser.id, { ...row, phase: "connected_readonly", secrets: null });
      return { state: "connected_readonly", mailbox: FOUNDER_MAILBOX, sendsEnabled: false };
    } catch {
      // Provider error bodies can contain codes/tokens. Report constants only.
      // No auto-revoke: that could invalidate a pre-existing ops/client grant.
      if (upgrade) {
        const committed = await this.ports.flows.transaction(async tx => {
          const current = await tx.get(browser.id);
          if (current?.phase === (draftUpgrade ? "connected_draft_capable" : "connected_send_capable")) return true;
          if (current?.phase === "exchanging") tx.set(browser.id, { ...current, phase: "failed_requires_new_owner_consent", secrets: null, failureStage });
          return false;
        });
        if (committed && draftUpgrade) return { state: "connected_draft_capable", mailbox: FOUNDER_MAILBOX, draftScopeGranted: true, draftWritesEnabled: false, sendsEnabled: false };
        if (committed) return { state: "connected_send_capable", mailbox: FOUNDER_MAILBOX, sendScopeGranted: true, messagePolicyRequired: true, sendsEnabled: false };
      } else await this.ports.flows.set(browser.id, { ...row, phase: "failed_requires_new_owner_consent", secrets: null, failureStage });
      throw new FounderConsentError("founder_oauth_exchange_failed_requires_new_owner_consent", 503, failureStage);
    }
  }
}
