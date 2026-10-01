import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FOUNDER_MAILBOX } from "./communications-contract";
import { FOUNDER_GMAIL_READ_SCOPE } from "./communications-connection";
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

export class FounderConsentError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
export type FounderConsentConfig = {
  ownerUid: string; clientId: string; callback: typeof FOUNDER_OAUTH_CALLBACK;
  approvalReference: string; grantMode: "temporary_testing" | "durable_reviewed";
};
export type FounderCredential = {
  version: "blueprint.founder-gmail-credential.v1";
  binding: typeof FOUNDER_CONNECTION_ID; mailbox: typeof FOUNDER_MAILBOX;
  clientId: string; refreshToken: string; scopes: [typeof FOUNDER_GMAIL_READ_SCOPE];
  ownerUid: string; approvalReference: string; consentedAt: number;
  grantMode: FounderConsentConfig["grantMode"]; usableUntil: number | null;
};
export interface FounderConsentPorts {
  flows: WorkStore;
  seal(plaintext: string, associatedData: string): Promise<unknown>;
  open(encrypted: unknown, associatedData: string): Promise<string>;
  checkOwner(identity: WorkIdentity): Promise<boolean>;
  // Missing writer blocks admission BEFORE obtaining a Google grant.
  storageReady(): Promise<boolean>;
  save(credential: FounderCredential, flowId: string): Promise<void>;
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
  async start(identity: WorkIdentity) {
    await this.owner(identity);
    if (!await this.ports.storageReady()) throw new FounderConsentError("founder_oauth_secure_storage_unavailable", 503);
    const state = opaque(), browser = opaque(), verifier = opaque(), id = hash(state);
    const secrets = await this.ports.seal(JSON.stringify({ verifier }), this.aad(id));
    await this.ports.flows.set(id, { phase: "awaiting_google", ownerUid: identity.uid,
      authTime: identity.authTime, tenantId: identity.tenantId, clientId: this.config.clientId,
      callback: this.config.callback, approvalReference: this.config.approvalReference,
      grantMode: this.config.grantMode, browserHash: hash(browser), secrets, expiresAt: this.now() + 600, expireAt: new Date((this.now() + 600) * 1000) });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.callback,
      response_type: "code", scope: FOUNDER_GMAIL_READ_SCOPE, access_type: "offline", prompt: "consent",
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
    if (!cookie) return { state: await this.ports.storageReady() ? "idle" : "binding_exists_or_storage_unavailable" };
    const browser = this.cookie(cookie);
    const row = this.binding(await this.ports.flows.get(browser.id), browser.browserHash);
    if (row.tenantId !== identity.tenantId || identity.authTime < row.authTime) throw new FounderConsentError("founder_oauth_owner_required", 403);
    return { state: row.phase };
  }
  async finish(identity: WorkIdentity, cookie: string) {
    await this.owner(identity);
    if (!await this.ports.storageReady()) throw new FounderConsentError("founder_oauth_secure_storage_unavailable", 503);
    const browser = this.cookie(cookie);
    const row = await this.ports.flows.transaction(async tx => {
      const current = this.binding(await tx.get(browser.id), browser.browserHash);
      if (current.tenantId !== identity.tenantId || identity.authTime < current.authTime) throw new FounderConsentError("founder_oauth_owner_required", 403);
      if (current.phase !== "awaiting_owner") throw new FounderConsentError("founder_oauth_exchange_already_claimed");
      // Persist claim BEFORE token POST; never repeat an uncertain exchange.
      tx.set(browser.id, { ...current, phase: "exchanging", secrets: null });
      return current;
    });
    try {
      const data = JSON.parse(await this.ports.open(row.secrets, this.aad(browser.id)));
      const token = await this.ports.exchange({ code: data.code, verifier: data.verifier,
        callback: this.config.callback, clientId: this.config.clientId });
      if (!token.refreshToken || !token.accessToken || token.scopes.length !== 1 || token.scopes[0] !== FOUNDER_GMAIL_READ_SCOPE) {
        throw new FounderConsentError("founder_oauth_scope_or_refresh_invalid");
      }
      const account = await this.ports.verify({ accessToken: token.accessToken });
      if (account.mailbox !== FOUNDER_MAILBOX || account.sender !== FOUNDER_MAILBOX) {
        throw new FounderConsentError("founder_oauth_identity_unverified");
      }
      await this.owner(identity); // Recheck revoked/disabled owner before durable write.
      if (this.now() >= row.expiresAt || !await this.ports.storageReady()) {
        throw new FounderConsentError("founder_oauth_authorization_expired");
      }
      const consentedAt = this.now();
      await this.ports.save({ version: "blueprint.founder-gmail-credential.v1", binding: FOUNDER_CONNECTION_ID,
        mailbox: FOUNDER_MAILBOX, clientId: this.config.clientId, refreshToken: token.refreshToken,
        scopes: [FOUNDER_GMAIL_READ_SCOPE], ownerUid: identity.uid, approvalReference: this.config.approvalReference,
        consentedAt, grantMode: this.config.grantMode,
        usableUntil: this.config.grantMode === "temporary_testing" ? consentedAt + 7 * 86400 : null }, browser.id);
      await this.ports.flows.set(browser.id, { ...row, phase: "connected_readonly", secrets: null });
      return { state: "connected_readonly", mailbox: FOUNDER_MAILBOX, sendsEnabled: false };
    } catch {
      // Provider error bodies can contain codes/tokens. Report a constant only.
      // No auto-revoke: that could invalidate a pre-existing ops/client grant.
      await this.ports.flows.set(browser.id, { ...row, phase: "failed_requires_new_owner_consent", secrets: null });
      throw new FounderConsentError("founder_oauth_exchange_failed_requires_new_owner_consent", 503);
    }
  }
}
