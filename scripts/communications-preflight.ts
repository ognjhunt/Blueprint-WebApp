/** Read-only checks on the selected Blueprint host. Prints no credential values,
 * provider error bodies or mail contents. Never creates a session/draft/send. */
import { CommunicationsAgentsAPI } from "../server/agents/communications-api";
import { COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT, FOUNDER_MAILBOX } from "../server/agents/communications-contract";
import { verifyFounderMailbox } from "../server/agents/communications-gmail";

const safeCode = (error: unknown) => error instanceof Error && /^[a-z_][a-z0-9_]*$/.test(error.message)
  ? error.message : "existing_binding_or_permission_unverified";
const model = new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY, allowPaidInference: false });
const modelCheck = await model.preflight().then(value => ({ state: "verified", ...value }), error => ({ state: "blocked", reason: safeCode(error) }));
const mailboxCheck = await verifyFounderMailbox().then(value => ({ state: "verified", ...value }), error => ({ state: "blocked", reason: safeCode(error) }));
console.log(JSON.stringify({ readonly: true, requestedModel: COMMUNICATIONS_MODEL, requestedProject: COMMUNICATIONS_PROJECT,
  approvedMailbox: FOUNDER_MAILBOX, modelDiscovery: modelCheck, mailbox: mailboxCheck,
  agentsApiLunaInference: "unverified_no_session_created", gmailSendPermission: "unverified_no_send_attempted",
  paidInferenceAuthorized: false, sendAuthorized: false }, null, 2));
if (modelCheck.state !== "verified" || mailboxCheck.state !== "verified") process.exitCode = 1;
