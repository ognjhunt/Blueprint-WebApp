import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidClientError, InvalidGrantError, InvalidScopeError, InvalidTokenError, InvalidTargetError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

export const WORK_SCOPES = ["blueprint:runs:read", "blueprint:runs:prepare", "blueprint:runs:launch", "blueprint:runs:release"];
export const WORK_OAUTH_PATH = "/api/blueprint-work/oauth";
export const WORK_MCP_PATH = "/api/blueprint-work/mcp";
const ACCESS_SECONDS = 900;
const GRANT_SECONDS = 30 * 86400;
type Row = Record<string, any>;
export interface WorkTransaction {
  get(key: string): Promise<Row | undefined>;
  set(key: string, value: Row): void;
  delete(key: string): void;
}
export interface WorkStore {
  get(key: string): Promise<Row | undefined>;
  set(key: string, value: Row): Promise<void>;
  transaction<T>(action: (tx: WorkTransaction) => Promise<T>): Promise<T>;
}
export type WorkIdentity = { uid: string; tenantId: string | null; authTime: number };
export type CheckOperator = (identity: WorkIdentity) => Promise<boolean>;
export const workHash = (value: string) => createHash("sha256").update(value).digest("hex");
const opaque = () => randomBytes(32).toString("base64url");
const key = (kind: string, value: string) => `${kind}-${workHash(value)}`;
const scopesValid = (scopes: string[]) => scopes.length > 0 && scopes.every(s => WORK_SCOPES.includes(s));

// Never fetch client-controlled URLs or register arbitrary redirect destinations.
export function admittedWorkRedirect(value: string): boolean {
  try {
    const u = new URL(value);
    return u.origin === "https://chatgpt.com" && !u.search && !u.hash && !u.username && !u.password
      && (u.pathname === "/connector_platform_oauth_redirect"
        || /^\/connector\/oauth\/[A-Za-z0-9_-]{1,200}$/.test(u.pathname));
  } catch { return false; }
}

/** OAuth 2.1 transport over the existing Firebase operator identity. No passwords,
 * Firebase refresh tokens, provider keys, or plaintext OAuth tokens are persisted. */
export class BlueprintWorkOAuth implements OAuthServerProvider {
  // Ask the SDK to pass the verifier through. This provider validates S256
  // inside the transaction that consumes the code; PKCE is never bypassed.
  readonly skipLocalPkceValidation = true;
  readonly issuer: string;
  readonly resource: string;
  readonly clientsStore;
  constructor(readonly store: WorkStore, readonly origin: string,
    readonly checkOperator: CheckOperator, readonly now: () => number = () => Math.floor(Date.now() / 1000)) {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin) throw new Error("work_origin_requires_https_origin");
    this.issuer = origin + WORK_OAUTH_PATH;
    this.resource = origin + WORK_MCP_PATH;
    this.clientsStore = {
      getClient: async (id: string): Promise<OAuthClientInformationFull | undefined> =>
        await store.get(key("client", id)) as OAuthClientInformationFull | undefined,
      registerClient: async (client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">) => {
        if (client.token_endpoint_auth_method !== "none" || client.client_secret
          || !client.redirect_uris.length || client.redirect_uris.length > 3
          || !client.redirect_uris.every(admittedWorkRedirect)) throw new InvalidClientError("Only ChatGPT public PKCE clients are supported");
        const registered = { ...client, client_id: opaque(), client_id_issued_at: this.now(),
          client_name: "ChatGPT Blueprint Work", grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"], token_endpoint_auth_method: "none", scope: WORK_SCOPES.join(" ") };
        await store.set(key("client", registered.client_id), registered);
        return registered;
      },
    };
  }
  private target(resource?: URL) {
    if (resource?.href !== this.resource) throw new InvalidTargetError("Blueprint Work resource is required");
  }
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    this.target(params.resource);
    const scopes = params.scopes || [WORK_SCOPES[0]];
    if (!scopesValid(scopes)) throw new InvalidScopeError("Unsupported Blueprint scope");
    if (!client.redirect_uris.includes(params.redirectUri) || !admittedWorkRedirect(params.redirectUri)
      || !/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidGrantError("Invalid redirect or PKCE challenge");
    const flow = opaque();
    await this.store.set(key("flow", flow), { clientId: client.client_id, scopes, challenge: params.codeChallenge,
      redirectUri: params.redirectUri, state: params.state || null, resource: this.resource, expiresAt: this.now() + 600 });
    res.redirect(`${this.origin}/app/connect/chatgpt?flow=${flow}`);
  }
  async describeFlow(flow: string) {
    const row = await this.store.get(key("flow", flow));
    if (!row || row.expiresAt <= this.now()) throw new InvalidGrantError("Connection request expired");
    return { client_name: "ChatGPT Blueprint Work", scopes: row.scopes, expires_at: row.expiresAt,
      redirect_origin: "https://chatgpt.com" };
  }
  async approve(flow: string, identity: WorkIdentity, allow: boolean): Promise<string> {
    if (!await this.checkOperator(identity)) throw new InvalidGrantError("Verified Blueprint operator access required");
    const code = opaque();
    const row = await this.store.transaction(async tx => {
      const found = await tx.get(key("flow", flow));
      if (!found || found.expiresAt <= this.now()) throw new InvalidGrantError("Connection request expired or consumed");
      tx.delete(key("flow", flow));
      if (allow) tx.set(key("code", code), { ...found, identity, expiresAt: this.now() + 120 });
      return found;
    });
    const redirect = new URL(row.redirectUri);
    redirect.searchParams.set(allow ? "code" : "error", allow ? code : "access_denied");
    if (row.state) redirect.searchParams.set("state", row.state);
    redirect.searchParams.set("iss", this.issuer);
    return redirect.href;
  }
  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    const row = await this.store.get(key("code", code));
    if (!row || row.clientId !== client.client_id || row.expiresAt <= this.now()) throw new InvalidGrantError("Invalid authorization code");
    return row.challenge as string;
  }
  private tokens(tx: WorkTransaction, grantId: string, grant: Row): OAuthTokens {
    const access = opaque(), refresh = opaque();
    tx.set(key("access", access), { grantId, clientId: grant.clientId, scopes: grant.scopes,
      expiresAt: Math.min(this.now() + ACCESS_SECONDS, grant.expiresAt) });
    tx.set(key("refresh", refresh), { grantId, clientId: grant.clientId, scopes: grant.scopes,
      expiresAt: grant.expiresAt, used: false });
    return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: ACCESS_SECONDS,
      scope: grant.scopes.join(" ") };
  }
  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, verifier?: string,
    redirectUri?: string, resource?: URL) {
    this.target(resource);
    const row = await this.store.get(key("code", code));
    if (!row || !await this.checkOperator(row.identity)) throw new InvalidGrantError("Operator authorization unavailable");
    return this.store.transaction(async tx => {
      const found = await tx.get(key("code", code));
      const challenge = createHash("sha256").update(verifier || "").digest("base64url");
      if (!found || found.clientId !== client.client_id || found.expiresAt <= this.now()
        || found.redirectUri !== redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier || "")
        || challenge.length !== found.challenge.length
        || !timingSafeEqual(Buffer.from(challenge), Buffer.from(found.challenge))) throw new InvalidGrantError("Invalid code binding");
      const grantId = opaque();
      const grant = { clientId: client.client_id, identity: found.identity, scopes: found.scopes,
        resource: this.resource, expiresAt: this.now() + GRANT_SECONDS, revoked: false, createdAt: this.now() };
      tx.delete(key("code", code));
      tx.set(key("grant", grantId), grant);
      return this.tokens(tx, grantId, grant);
    });
  }
  async exchangeRefreshToken(client: OAuthClientInformationFull, refresh: string, scopes?: string[], resource?: URL) {
    this.target(resource);
    const row = await this.store.get(key("refresh", refresh));
    const grant = row && await this.store.get(key("grant", row.grantId));
    if (!grant || !await this.checkOperator(grant.identity)) throw new InvalidGrantError("Operator authorization unavailable");
    const result = await this.store.transaction(async tx => {
      const token = await tx.get(key("refresh", refresh));
      const current = token && await tx.get(key("grant", token.grantId));
      if (!token || !current || token.clientId !== client.client_id || current.revoked
        || token.expiresAt <= this.now() || current.expiresAt <= this.now()) throw new InvalidGrantError("Invalid refresh token");
      if (token.used) {
        tx.set(key("grant", token.grantId), { ...current, revoked: true });
        return null; // Commit family revocation before reporting token replay.
      }
      const selected = scopes || token.scopes;
      if (!scopesValid(selected) || selected.some(s => !token.scopes.includes(s))) throw new InvalidScopeError("Scope escalation refused");
      tx.set(key("refresh", refresh), { ...token, used: true });
      return this.tokens(tx, token.grantId, { ...current, scopes: selected });
    });
    if (!result) throw new InvalidGrantError("Refresh token replay; reconnect Blueprint");
    return result;
  }
  async verifyAccessToken(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InvalidTokenError("Invalid token");
    const row = await this.store.get(key("access", token));
    const grant = row && await this.store.get(key("grant", row.grantId));
    if (!row || !grant || row.expiresAt <= this.now() || grant.expiresAt <= this.now() || grant.revoked
      || grant.resource !== this.resource || !await this.checkOperator(grant.identity)) throw new InvalidTokenError("Expired or revoked Blueprint access");
    return { token, clientId: row.clientId, scopes: row.scopes as string[], expiresAt: row.expiresAt,
      resource: new URL(this.resource), extra: { identity: grant.identity, grantId: row.grantId } };
  }
  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    const row = await this.store.get(key("access", request.token)) || await this.store.get(key("refresh", request.token));
    if (!row || row.clientId !== client.client_id) return;
    await this.store.transaction(async tx => {
      const grant = await tx.get(key("grant", row.grantId));
      if (grant) tx.set(key("grant", row.grantId), { ...grant, revoked: true });
    });
  }
}
