import { FOUNDER_MAILBOX } from "./communications-contract";

/** Founder secrets are independent of the human-blocker/ops mailbox. */
export const FOUNDER_GMAIL_BINDING_KEYS = [
  "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID",
  "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET",
  "BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN",
] as const;
export const FOUNDER_GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const FOUNDER_GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Preparation only. No client discovery, OAuth URL, token entry or grant. */
export function founderMailboxConnectionPlan(env: NodeJS.ProcessEnv = process.env) {
  const configured = FOUNDER_GMAIL_BINDING_KEYS.every(key => Boolean(env[key]?.trim()));
  return {
    account: FOUNDER_MAILBOX,
    binding: { state: configured ? "configured_unverified" : env.BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE === "bound-field-firestore-v1" ? "private_storage_selected_unverified" : "missing" },
    oauth: {
      state: "blocked",
      blocker: "existing_oauth_client_and_registered_callback_unverified",
      authorizationUrl: null,
      callbackUrl: null,
      initialScopes: [FOUNDER_GMAIL_READ_SCOPE],
      sendScopeAfterSeparateApproval: FOUNDER_GMAIL_SEND_SCOPE,
      dataAccess: "Google's read scope permits reading mailbox messages and settings. Blueprint retrieves only relevant full threads and exact sent-message receipts.",
      ownerAction: "Inspect the existing Google OAuth client's registered callback, audience and allowed scopes for nijel@tryblueprint.io. Provide only non-secret registration evidence before an owner-controlled consent flow is prepared.",
    },
    secretDestination: {
      provider: "Render",
      services: ["Blueprint-WebApp", "blueprint-webapp-worker"],
      keys: FOUNDER_GMAIL_BINDING_KEYS,
      ownerEntryOnly: true,
      logicalBinding: "communications-founder-gmail",
      credentialEntryRoute: null,
      storage: "pending_verified_shared_vault_contract",
    },
    mcp: {
      state: "pending_verified_project_and_shared_vault_auth",
      serverUrl: "https://gmailmcp.googleapis.com/mcp/v1",
      readTools: ["get_thread", "search_threads"],
      draftTools: ["create_draft", "list_drafts"],
      writeToolsEnabled: false,
      sendTool: null,
      documentationUrl: "https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server",
    },
    opsBindingPreserved: true,
    credentialsAccepted: false,
    grantStarted: false,
    sendsEnabled: env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true",
  };
}
