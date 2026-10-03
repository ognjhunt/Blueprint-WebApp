import { BlueprintWorkOAuth, workHash, type WorkIdentity, type WorkStore } from "./blueprintWorkOAuth";
import { geminiResearchControlSchema, GEMINI_RESEARCH_CONTROL_KEY, type ResearchArtifacts } from "./geminiResearchMcp";

export type ResearchCredentialMetadata = { id: string; vault_id: string; metadata: Record<string, string>;
  auth: { type: string; mcp_server_url?: string | null } };
type Inventory = { vaultId: string; status: string; complete: boolean; credentials: ResearchCredentialMetadata[] };
type CredentialRequest = { name: string; metadata: Record<string, string>; auth: {
  type: "mcp_oauth"; mcp_server_url: string; access_token: string; expires_at: string;
  refresh: { token_endpoint: string; client_id: string; refresh_token: string; resource: string; scope: string;
    token_endpoint_auth: { type: "none" } } } };
/** Trusted operator provisioning only: never reachable through model tools.
 * Reuses existing OAuth hashed grants and the existing project vault. */
export async function setupGeminiResearchCredential(input: { setupKey: string; vaultId: string; expiresAt: string },
  identity: WorkIdentity, deps: { provider: BlueprintWorkOAuth; store: WorkStore; artifacts: ResearchArtifacts;
    inventory: (vaultId: string) => Promise<Inventory>;
    register: (vaultId: string, input: CredentialRequest) => Promise<ResearchCredentialMetadata>; clock?: () => Date }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(input.setupKey) || !/^vault_[A-Za-z0-9_-]{1,150}$/.test(input.vaultId)
    || !Number.isFinite(Date.parse(input.expiresAt)) || !await deps.provider.checkOperator(identity))
    throw new Error("research_setup_verified_operator_and_explicit_inputs_required");
  const parsed = geminiResearchControlSchema.safeParse(await deps.store.get(GEMINI_RESEARCH_CONTROL_KEY));
  if (!parsed.success || !parsed.data.enabled || parsed.data.actorUid !== identity.uid || parsed.data.tenantId !== identity.tenantId
    || Date.parse(parsed.data.expiresAt) <= (deps.clock || (() => new Date()))().getTime())
    throw new Error("research_setup_current_retained_authority_required");
  const controlDigest = workHash(JSON.stringify(parsed.data));
  const setupDigest = workHash(JSON.stringify({ ...input, actorUid: identity.uid, tenantId: identity.tenantId, controlDigest }));
  const claimKey = `credential-setup-${workHash(`${identity.tenantId ?? ""}:${identity.uid}:${input.setupKey}`)}`;
  const inventory = await deps.inventory(input.vaultId);
  if (!inventory.complete || inventory.vaultId !== input.vaultId || inventory.status !== "active" || inventory.credentials.length > 1)
    throw new Error("research_setup_existing_dedicated_vault_required");
  const claim = await deps.store.transaction(async tx => {
    const prior = await tx.get(claimKey);
    if (prior) {
      if (prior.setupDigest !== setupDigest) throw new Error("research_setup_original_claim_changed");
      return { create: false, row: prior };
    }
    if (inventory.credentials.length) throw new Error("research_setup_vault_has_unrelated_credential");
    const row = { schema: "blueprint.research-mcp-credential-setup.v1", setupDigest, setupKey: input.setupKey,
      actorUid: identity.uid, tenantId: identity.tenantId, vaultId: input.vaultId, controlDigest,
      requestedExpiresAt: input.expiresAt, createdAt: (deps.clock || (() => new Date()))().toISOString(),
      state: "claimed", credentialId: null, grantReference: null, receipt: null };
    tx.set(claimKey, row);
    return { create: true, row };
  });
  if (!claim.create) return observeSetup(claim.row, claimKey, inventory, deps);
  const grant = await deps.provider.mintResearchOperatorGrant(identity, { setupKey: input.setupKey, expiresAt: input.expiresAt });
  if (grant.controlDigest !== controlDigest) throw new Error("research_setup_authority_changed_during_mint");
  const claimed = { ...claim.row, state: "credential_submission_claimed", grantReference: grant.grantReference,
    authorityExpiresAt: new Date(grant.expiresAt * 1000).toISOString(), resource: deps.provider.resource };
  await deps.store.set(claimKey, claimed);
  // Never hand plaintext tokens to logs, output, Firestore or a secret file.
  // Fixed server-owned OAuth endpoints and exactly two research scopes.
  const fresh = await deps.inventory(input.vaultId);
  const actual = geminiResearchControlSchema.safeParse(await deps.store.get(GEMINI_RESEARCH_CONTROL_KEY));
  if (!fresh.complete || fresh.vaultId !== input.vaultId || fresh.status !== "active" || fresh.credentials.length || !actual.success
    || workHash(JSON.stringify(actual.data)) !== controlDigest || !await deps.provider.checkOperator(identity))
    throw new Error("research_setup_authority_or_vault_changed_before_submission");
  try {
    const credential = await deps.register(input.vaultId, { name: `Blueprint Gemini research ${input.setupKey}`,
      metadata: { blueprint_setup_digest: setupDigest, authority_expires_at: claimed.authorityExpiresAt,
        control_sha256: controlDigest, grant_reference: grant.grantReference },
      auth: { type: "mcp_oauth", mcp_server_url: deps.provider.resource, access_token: grant.tokens.access_token,
        expires_at: new Date((deps.provider.now() + grant.tokens.expires_in!) * 1000).toISOString(), refresh: {
          token_endpoint: `${deps.provider.issuer}/token`, client_id: grant.client.client_id,
          refresh_token: grant.tokens.refresh_token!, token_endpoint_auth: { type: "none" },
          resource: deps.provider.resource, scope: grant.tokens.scope!,
        } } });
    if (!/^credential_[A-Za-z0-9_-]{1,150}$/.test(credential.id) || credential.vault_id !== input.vaultId)
      throw new Error("research_setup_credential_ack_binding_invalid");
    await deps.store.set(claimKey, { ...claimed, credentialId: credential.id });
  } catch {
    return { state: "credential_ack_unknown", setup_digest: setupDigest,
      action: "Observe this setup key and existing vault only; do not register another credential or reset this claim." };
  }
  return observeSetup(await deps.store.get(claimKey), claimKey, await deps.inventory(input.vaultId), deps);
}
async function observeSetup(row: any, key: string, inventory: Inventory, deps: { provider: BlueprintWorkOAuth;
  store: WorkStore; artifacts: ResearchArtifacts }) {
  const matches = inventory.credentials.filter(c => c.metadata?.blueprint_setup_digest === row.setupDigest
    && c.metadata?.control_sha256 === row.controlDigest && c.metadata?.grant_reference === row.grantReference
    && c.metadata?.authority_expires_at === row.authorityExpiresAt && c.vault_id === row.vaultId && c.auth?.type === "mcp_oauth" && c.auth?.mcp_server_url === deps.provider.resource);
  if (!inventory.complete || inventory.vaultId !== row.vaultId || inventory.credentials.length !== 1 || matches.length !== 1 || inventory.status !== "active")
    return { state: "credential_ack_unknown", setup_digest: row.setupDigest,
      action: "No unique original credential is proven. GET observation only; never repeat credential registration." };
  const credential = matches[0];
  if (row.credentialId && row.credentialId !== credential.id) throw new Error("research_setup_credential_identity_changed");
  const receipt = { schema: "blueprint.research-mcp-credential-readback.v1", setupDigest: row.setupDigest,
    originalClaimCreatedAt: row.createdAt, controlDigest: row.controlDigest, actorUid: row.actorUid, tenantId: row.tenantId,
    vaultId: row.vaultId, credentialId: credential.id, authType: "mcp_oauth", resource: deps.provider.resource,
    grantReference: row.grantReference, authorityExpiresAt: row.authorityExpiresAt ?? null,
    scopes: ["blueprint:research:read", "blueprint:research:start"], completeVaultReadback: true,
    authenticatedToolUseProven: false, savedAgentChanged: false };
  const evidence = await deps.artifacts.retain(receipt);
  await deps.store.set(key, { ...row, state: "credential_readback_verified", credentialId: credential.id, receipt: evidence });
  return { state: "credential_readback_verified", credential_id: credential.id, vault_id: row.vaultId,
    resource: deps.provider.resource, receipt: evidence, authenticated_tool_use_proven: false };
}
