/** Read-only: runs on the existing Blueprint Render worker.
 * Environment-only checks are self-contained; private storage uses the compiled runtime reader.
 * No OAuth setup, credential export/write or paid call. */
import { pathToFileURL } from "node:url";
import { google } from "googleapis";

export const REQUESTED_MODEL = "gpt-6-luna";
export const DEFAULT_PROJECT = "proj_F2tFJuxLaovJru8RrtXRaqNj";
export const APPROVED_MAILBOX = "nijel@tryblueprint.io";
export const FOUNDER_GMAIL_BINDING_KEYS = ["BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID", "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET", "BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN"];

export async function communicationsPreflight({ env = process.env, fetchImpl = fetch, googleImpl = google, privateGmailLoader = async () => (await import("../dist/agents/communications-gmail.js")).existingFounderGmail() } = {}) {
  let modelDiscovery = { state: "blocked", reason: "existing_openai_binding_missing" };
  if (env.OPENAI_API_KEY) {
    try {
      const response = await fetchImpl(`https://api.openai.com/v1/models/${REQUESTED_MODEL}`, {
        method: "GET", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "OpenAI-Project": DEFAULT_PROJECT },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) modelDiscovery = { state: "blocked", reason: `model_discovery_http_${response.status}` };
      else if ((await response.json()).id !== REQUESTED_MODEL) modelDiscovery = { state: "blocked", reason: "requested_luna_model_unavailable" };
      else modelDiscovery = { state: "verified", model: REQUESTED_MODEL, project: DEFAULT_PROJECT };
    } catch { modelDiscovery = { state: "blocked", reason: "existing_openai_model_discovery_unverified" }; }
  }
  let mailbox = { state: "blocked", reason: "founder_gmail_binding_missing" };
  const [clientId, clientSecret, refreshToken] = FOUNDER_GMAIL_BINDING_KEYS.map(key => env[key]?.trim());
  const privateBinding = env.BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE === "bound-field-firestore-v1";
  if (clientId && clientSecret && (refreshToken || privateBinding)) {
    try {
      // Independent founder binding only. Never fall back to HUMAN_REPLY ops.
      // Transient API authentication only; no OAuth flow or persistent writes.
      const auth = new googleImpl.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      const gmail = refreshToken ? googleImpl.gmail({ version: "v1", auth }) : await privateGmailLoader();
      const profile = await gmail.users.getProfile({ userId: "me" }, { timeout: 15000 });
      if (profile.data.emailAddress?.trim().toLowerCase() !== APPROVED_MAILBOX) mailbox = { state: "blocked", reason: "founder_gmail_wrong_mailbox" };
      else {
        const sendAs = await gmail.users.settings.sendAs.list({ userId: "me" }, { timeout: 15000 });
        if (!sendAs.data.sendAs?.some(entry => entry.sendAsEmail?.toLowerCase() === APPROVED_MAILBOX && entry.verificationStatus === "accepted")) {
          mailbox = { state: "blocked", reason: "founder_sender_unverified_or_permission_missing" };
        } else mailbox = { state: "verified", mailbox: APPROVED_MAILBOX, sender: APPROVED_MAILBOX };
      }
    } catch (error) {
      const status = error?.response?.status;
      const oauth = error?.response?.data?.error;
      const reason = ["invalid_grant", "invalid_client", "unauthorized_client"].includes(oauth)
        ? `existing_gmail_${oauth}` : Number.isInteger(status) && status >= 400 && status <= 599
          ? `existing_gmail_http_${status}` : "existing_gmail_binding_or_permission_unverified";
      mailbox = { state: "blocked", reason };
    }
  }
  return { readonly: true, requestedModel: REQUESTED_MODEL, requestedProject: DEFAULT_PROJECT, approvedMailbox: APPROVED_MAILBOX,
    modelDiscovery, mailbox, agentsApiLunaInference: "unverified_no_session_created", gmailSendPermission: "unverified_no_send_attempted",
    paidInferenceAuthorized: false, sendAuthorized: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const status = await communicationsPreflight();
  console.log(JSON.stringify(status, null, 2));
  if (status.modelDiscovery.state !== "verified" || status.mailbox.state !== "verified") process.exitCode = 1;
}
