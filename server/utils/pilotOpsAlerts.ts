/**
 * A bell for ops, on the channel ops already reads: a site asked Blueprint to
 * find a deployment company, or an approved company responded about such a job.
 *
 * The job record is the record; this is only the bell. It carries ids and
 * Blueprint's own short text, never a site's email or contact. Each event rings once: a marker
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

/** One line of Blueprint's own answer text for the bell: no newlines, no code marks, bounded. */
function answerLine(value: string | null | undefined): string {
  return String(value ?? "").replace(/[\r\n`*_~<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || "none";
}

export type IntroductionRequestAlert = { requestId: string; headline: string | null; pick: string | null;
  familyLabel?: string | null; runnerUp?: string | null };

export function introductionRequestAlertText(params: IntroductionRequestAlert): string {
  return `:handshake: *A site asked Blueprint to find a deployment company* — job \`${safeId(params.requestId)}\`.\n`
    + `Job: ${answerLine(params.familyLabel)}\nFirst look: ${answerLine(params.headline)}\nPick: ${answerLine(params.pick)}\n`
    + `Runner-up: ${answerLine(params.runnerUp)}\n`
    + "Its card is in the job library. No deployment company has been emailed; whether to alert them is your decision.";
}

/** A site pressed "Find a deployment company for this job". Rings once per job; it contacts no outside company. */
export async function alertOpsIntroductionRequested(params: IntroductionRequestAlert) {
  return ringOnce(`introduction_request:${params.requestId}`, introductionRequestAlertText(params));
}

export function companyResponseAlertText(params: { requestId: string; company: string | null; state: string; headline: string | null }): string {
  const said = params.state === "declined" ? "declined" : params.state === "needs_something" ? "would need something" : "is interested";
  return `:incoming_envelope: *An approved company responded about a job its site asked us to find a deployment company for* — `
    + `job \`${safeId(params.requestId)}\`.\nCompany: ${answerLine(params.company)} (${said})\nFirst look: ${answerLine(params.headline)}\n`
    + "A person at Blueprint makes the introduction. The site is told the answer under an alias, never the company's name; nothing was sent to the company.";
}

/**
 * An approved company first responded on the card of a job whose site asked to find a deployment
 * company. Rings once per company and job; it emails no company (the site's own email says only an alias and the answer).
 */
export async function alertOpsCompanyResponded(params: { requestId: string; companyKey: string; company: string | null;
  state: string; headline: string | null }) {
  return ringOnce(`company_response:${params.requestId}:${params.companyKey}`, companyResponseAlertText(params));
}
