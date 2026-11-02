/**
 * A bell for ops, on the channel ops already reads: a robot team asked to
 * evaluate a job, and the free evaluation waits on a founder's admission
 * (`/api/admin/free-evaluations/:requestId/admit`).
 *
 * The job record is the record; this is only the bell. It carries ids and an
 * admin link, never names, emails or job text. Each event rings once: a marker
 * document is created before the send, so a resubmitted request cannot ring
 * twice. A failed send is logged, not retried.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendSlackMessage } from "./slack";

export const PILOT_OPS_ALERTS_COLLECTION = "pilotOpsAlerts";

const ID = /^[A-Za-z0-9._:-]{1,200}$/;

function webhook(): string | null {
  return process.env.SLACK_INBOUND_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || null;
}

function appUrl(): string {
  return (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");
}

function safeId(value: string): string {
  return ID.test(value) ? value : "unrecognized-id";
}

async function ringOnce(key: string, text: string): Promise<{ sent: boolean; reason?: string }> {
  const url = webhook();
  if (!url) return { sent: false, reason: "webhook_unconfigured" };
  if (!db) return { sent: false, reason: "store_unavailable" };
  const ref = db.collection(PILOT_OPS_ALERTS_COLLECTION).doc(key.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 300));
  try {
    await ref.create({ key, createdAtIso: new Date().toISOString(), status: "sending" });
  } catch {
    return { sent: false, reason: "already_rung" };
  }
  const result = await sendSlackMessage(text, url).catch((error: unknown) => ({ sent: false, error }));
  await ref.set({ status: result.sent ? "sent" : "failed", settledAtIso: new Date().toISOString() }, { merge: true })
    .catch(() => undefined);
  if (!result.sent) logger.warn({ key }, "Pilot ops alert was not delivered to Slack");
  return { sent: result.sent };
}

export function evaluationAdmissionAlertText(params: { workspaceRequestId: string; jobId: string; teamIds: readonly string[] }): string {
  const teams = params.teamIds.length ? params.teamIds.map(id => `\`${safeId(id)}\``).join(", ") : "no account-bound team yet";
  return `:robot_face: *Robot team asked to evaluate a job — needs founder admission* — request \`${safeId(params.workspaceRequestId)}\`, `
    + `job \`${safeId(params.jobId)}\`, team ${teams}.\nAdmit: ${appUrl()}/admin/robot-team-access?evaluationRequest=${encodeURIComponent(safeId(params.workspaceRequestId))}`;
}

export async function alertOpsEvaluationNeedsAdmission(params: { workspaceRequestId: string; jobId: string; teamIds: readonly string[] }) {
  return ringOnce(`evaluation_admission:${params.workspaceRequestId}`, evaluationAdmissionAlertText(params));
}
