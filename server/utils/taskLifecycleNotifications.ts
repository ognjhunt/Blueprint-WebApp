/**
 * The site's emails about its job, and nothing else (owner, 2026-11-19: "SIMPLER THE BETTER").
 *
 * A site hears from us four times at most, each when something happens that it acts on or must know:
 * - `task_received`: we have its job, with the private link to its job page (the way back to it);
 * - `job_sent`: its job went to the approved deployment companies, once per job, with the count;
 * - `company_answered`: a deployment company answered, once per company and answer, never the company's name;
 * - `introduction_made_site`: it asked to meet a company, with that company's details.
 * Everything else (its video arrived, the simulation is ready, the first look is ready, a hold, an ending) is on its job
 * page, which says plainly where the job stands. Each email is read again at dispatch
 * (`taskLifecycleNotificationAuthority.ts`): a job withdrawn, hidden or no longer true by then is cancelled, never sent.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, type OutboxKind } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { finePrintLast } from "./emailLayout";
import { taskLifecycleNotificationIsCurrent } from "./taskLifecycleNotificationAuthority";
import { COMPANY_RESPONSE_LABELS, isCompanyResponseState, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { JOB_FACTS_NUDGE } from "../../client/src/lib/jobFacts";

export type TaskLifecycleMilestone = Extract<OutboxKind, "task_received" | "job_sent" | "company_answered" | "introduction_made_site">;

/** How a site stops sharing: the withdrawal is on its job page. */
export const HOW_TO_WITHDRAW = "To stop, open your job page, choose Job settings, then Stop using my video. Your job then leaves every company's view at once.";
/** The `job_sent` email's sentence (PACKAGE_E E4): one per job, with the count. */
export const jobSentSentence = (count: number) => Number.isInteger(count) && count > 0
  ? `Your job is with ${count} deployment ${count === 1 ? "company" : "companies"}.` : "Your job is with deployment companies.";
/** The one `job_sent` per job (PACKAGE_E E4): its event id (the company side's `AUTO_SEND_EVENT_ID`). */
export const JOB_SENT_EVENT_ID = "companies";

// Bare bones (2026-11-11): each notice says one thing in at most three short lines, then one button ("Label:\nURL").
const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string) => string }> = {
  task_received: {
    subject: "Your Blueprint job link",
    body: (url) => `We have your job.\n\nIf you haven't sent the video yet, send it from your job page. This link opens your job without a password, so please don't forward it.\n\nOpen your job:\n${url}`,
  },
  // Once per job (PACKAGE_E E4): when the job is first sent to the approved deployment companies. The detail is only
  // the count, a whole number; read again at dispatch: sent only while the job is visible. It says how to stop.
  job_sent: {
    subject: "Your job was sent to deployment companies",
    body: (url, detail) => `${jobSentSentence(Number(detail))} We don't share your name, address or contact details with a `
      + `deployment company unless you ask for an introduction to it. Your job page shows any answer.\n\n${HOW_TO_WITHDRAW}\n\nOpen your job:\n${url}`,
  },
  // One per company and answer, never the company's name or words: the detail is only a fixed label, and for
  // "Would need something" the one nudge toward the job page's quick questions (PACKAGE_E E1).
  company_answered: {
    subject: "A deployment company answered",
    body: (url, detail) => `A deployment company answered about your job: ${detail}. Your job page has the details.${
      detail === COMPANY_RESPONSE_LABELS.needs_something ? ` ${JOB_FACTS_NUDGE}` : ""}\n\nOpen your job:\n${url}`,
  },
  // The site asked for an introduction (PACKAGE_E E6). Built only by `buildIntroductionMadeSiteNotification`, whose
  // body is the introduced company's details; this entry is its fallback and never names anyone.
  introduction_made_site: {
    subject: "Meet the deployment company",
    body: (url) => `We've given them your details. Reply to them directly.\n\nOpen your job:\n${url}`,
  },
};

/**
 * Resolve the site's email from the encrypted request and queue one message per request and milestone. Calling this
 * again repairs a missed enqueue while the outbox document id prevents a duplicate.
 */
export async function enqueueTaskLifecycleNotification(params: { requestId: string; milestone: TaskLifecycleMilestone;
  eventId?: string }): Promise<{ enqueued: boolean; reason?: "store_unavailable" | "request_missing" | "contact_missing"
  | "consent_withdrawn" }> {
  if (!db) return { enqueued: false, reason: "store_unavailable" };
  const requestId = params.requestId.trim();
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return { enqueued: false, reason: "request_missing" };
  if (!(await taskLifecycleNotificationIsCurrent({ requestId, kind: params.milestone }))) return { enqueued: false, reason: "consent_withdrawn" };
  const to = String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { enqueued: false, reason: "contact_missing" };
  return enqueueOutbox(buildTaskLifecycleNotification({ ...params, requestId, to }));
}

export function buildTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  to: string;
  eventId?: string;
  captureUrl?: string;
  /** `company_answered` only: the company's answer; the email states its fixed label, nothing else of the company. */
  companyAnswerState?: CompanyResponseState;
  /** `job_sent` only: how many approved deployment companies the job was sent to. */
  companyCount?: number;
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (params.milestone === "company_answered" && !isCompanyResponseState(params.companyAnswerState)) {
    throw new Error("company_answer_state_invalid");
  }
  const message = copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  const detail = params.milestone === "company_answered" ? COMPANY_RESPONSE_LABELS[params.companyAnswerState!]
    : params.milestone === "job_sent" ? String(params.companyCount ?? "") : "";
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    to: params.to,
    subject: message.subject,
    body: finePrintLast(message.body(url, detail)),
    replyTo: "hello@tryblueprint.io",
  };
}

/** One line of a company's details for an email: no line breaks, bounded. */
function detailLine(value: unknown, max = 200): string {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max) : "";
}

/** The `introduction_made_site` email's subject and body (PACKAGE_E E6): the introduced company's own details, nothing else. */
export function introductionMadeSiteCopy(company: { name: string; contactName?: string | null; email: string; website?: string | null },
  url: string, answerLabel?: string | null): { subject: string; body: string } {
  const name = detailLine(company.name, 120) || "the deployment company";
  // The company's own stored answer, in its fixed label (review M2); with none, no answer is claimed.
  const label = detailLine(answerLabel, 60);
  const lines = [
    label ? `${name} answered ${label} about your job, and you asked us to introduce you.` : `You asked us to introduce you to ${name}.`,
    "",
    ...(detailLine(company.contactName) ? [`Contact: ${detailLine(company.contactName)}`] : []),
    `Email: ${detailLine(company.email)}`,
    ...(detailLine(company.website) ? [`Website: ${detailLine(company.website)}`] : []),
    "",
    "We've given them your details. Reply to them directly.",
    "",
    `Open your job:\n${url}`,
  ];
  return { subject: `Meet ${name}`, body: lines.join("\n") };
}

/**
 * The site's email when it asked for an introduction (PACKAGE_E E6), for `requestIntroduction` to queue inside its
 * transaction. One per company and job; read again at dispatch (`taskLifecycleNotificationAuthority.ts`): sent only
 * while the job is visible to companies and the introduction is on record.
 */
export function buildIntroductionMadeSiteNotification(params: { requestId: string; to: string; companyId: string;
  company: { name: string; contactName?: string | null; email: string; website?: string | null }; captureUrl?: string;
  answerLabel?: string | null }): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  const companyId = params.companyId.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  if (!companyId) throw new Error("introduction_company_invalid");
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const { subject, body } = introductionMadeSiteCopy(params.company, url, params.answerLabel);
  const companyEmail = detailLine(params.company.email);
  return { idempotencyKey: `${requestId}:introduction_made_site:${companyId}`, requestId, kind: "introduction_made_site",
    to: params.to, subject, body,
    // "Reply to them directly": a reply goes to the company.
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail) ? companyEmail : "hello@tryblueprint.io" };
}
