/** Offline owner command. Preview by default; --apply can create ONE credential
 * in an explicitly named existing dedicated vault. Never run during cloud review. */
import OpenAI from "openai";
import { geminiResearchStore, geminiResearchArtifacts } from "../../server/utils/geminiResearchMcpStore";
import { geminiResearchControlSchema, GEMINI_RESEARCH_CONTROL_KEY } from "../../server/utils/geminiResearchMcp";
import { BlueprintWorkOAuth } from "../../server/utils/blueprintWorkOAuth";
import { checkWorkOperator, firestoreWorkStore } from "../../server/utils/blueprintWorkStore";
import { setupGeminiResearchCredential, type ResearchCredentialMetadata } from "../../server/utils/geminiResearchMcpSetup";
import { requireConfiguredEnvValue, getConfiguredEnvValue } from "../../server/config/env";

const args = process.argv.slice(2);
function option(name: string) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
async function main() {
  const setupKey = option("--setup-key"), vaultId = option("--vault-id"), uid = option("--operator-uid"), expiresAt = option("--expires-at");
  if (!setupKey || !vaultId || !uid || !expiresAt) throw new Error("research_setup_requires_setup_key_existing_vault_operator_uid_explicit_expiry");
  const control = geminiResearchControlSchema.parse(await geminiResearchStore.get(GEMINI_RESEARCH_CONTROL_KEY));
  const identity = { uid, tenantId: control.tenantId, authTime: Math.floor(Date.now() / 1000) };
  if (!control.enabled || control.actorUid !== uid || !await checkWorkOperator(identity))
    throw new Error("research_setup_verified_current_owner_required");
  const origin = getConfiguredEnvValue("BLUEPRINT_WORK_PUBLIC_ORIGIN") || "https://tryblueprint.io";
  const provider = new BlueprintWorkOAuth(firestoreWorkStore, origin, checkWorkOperator, undefined, geminiResearchStore);
  if (!args.includes("--apply")) {
    console.log(JSON.stringify({ state: "preview_only", setupKey, vaultId, actorUid: uid, requestedExpiresAt: expiresAt,
      controlExpiresAt: control.expiresAt, scopeRef: control.scopeRef, budgetRef: control.budgetRef,
      resource: provider.resource, scopes: ["blueprint:research:read", "blueprint:research:start"],
      newVaults: 0, savedAgentChanges: 0, providerTasks: 0 })); return;
  }
  // Existing SDK transport; current credential wire schema is verified against
  // Agents SDK3.22.1 / public vault docs. This repo's older TS SDK has no beta
  // Agents namespace, so use its public get/post transport with the beta header.
  process.env.DEBUG = "false"; // Pinned SDK debug mode can log request bodies containing write-only grant tokens.
  const client = new OpenAI({ apiKey: requireConfiguredEnvValue(["OPENAI_API_KEY"], "Existing Agents runtime"),
    maxRetries: 0, timeout: 45000 });
  const headers = { "OpenAI-Beta": "agents=v1" };
  const safe = (row: any): ResearchCredentialMetadata => ({ id: row.id, vault_id: row.vault_id,
    metadata: row.metadata || {}, auth: { type: row.auth?.type, mcp_server_url: row.auth?.mcp_server_url ?? null } });
  const inventory = async (id: string) => {
    const vault: any = await client.get(`/vaults/${encodeURIComponent(id)}`, { headers });
    const credentials: ResearchCredentialMetadata[] = []; let after: string | undefined;
    for (;;) {
      const page: any = await client.get(`/vaults/${encodeURIComponent(id)}/credentials`, { headers,
        query: { limit: 100, ...(after ? { after } : {}) } });
      if (!Array.isArray(page.data) || typeof page.has_more !== "boolean") throw new Error("research_setup_vault_inventory_invalid");
      credentials.push(...page.data.map(safe));
      if (!page.has_more) return { vaultId: vault.id, status: vault.status, complete: true, credentials };
      const last = page.data.at(-1)?.id;
      if (typeof last !== "string" || last === after) throw new Error("research_setup_vault_pagination_invalid");
      after = last;
    }
  };
  const result = await setupGeminiResearchCredential({ setupKey, vaultId, expiresAt }, identity, {
    provider, store: geminiResearchStore, artifacts: geminiResearchArtifacts, inventory,
    register: async (id, body) => safe(await client.post(`/vaults/${encodeURIComponent(id)}/credentials`, { headers, body })),
  });
  console.log(JSON.stringify(result)); // Safe IDs/receipt only, never token values.
}
main().catch(() => { console.error("research_setup_failed_inspect_original_company_claim_no_secret_output"); process.exitCode = 1; });
