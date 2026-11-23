/**
 * The site's emails about its job, and nothing else (owner, 2026-11-19: "SIMPLER THE BETTER").
 *
 * A site hears from us three times at most, each when something happens that it acts on or must know:
 * - `task_received`: we have its job, with the private link to its job page (the way back to it), that the job goes
 *   to approved deployment companies once the video is in, and how to stop. The separate "Your job is posted" email
 *   (`job_sent`) is no longer sent (ledger AL38, 2026-11-23);
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
import { INTRODUCIBLE_RESPONSE_STATES, SITE_RESPONSE_LABELS, isCompanyResponseState,
  type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { isApprovedCaptureRegion, isCaptureRegion } from "../../client/src/data/captureResidency";

export type TaskLifecycleMilestone = Extract<OutboxKind, "task_received" | "company_answered" | "introduction_made_site">;

/**
 * What the job link email says about sharing: the job goes to approved deployment companies once the video is in, and
 * how to stop. The way to stop is on the job page, whichever name it has there ("Stop using my video" or "Withdraw my
 * job", `jobOutlook.ts`); every company the job was sent to then gets the deletion notice (`withdrawalCompanyNotice.ts`).
 */
export const SHARING_AND_HOW_TO_STOP = "Once your video is in, your job goes to approved deployment companies. We don't share "
  + "your name, address or contact details with a deployment company unless you ask for an introduction to it. To stop, "
  + "open your job page and withdraw your job there. It then leaves every company's view at once, and each company it "
  + "was sent to is asked to delete any copy it saved.";

/** What the email may say about the site's job page, as the caller read it when it queued the email. */
type CopyContext = { outsideApprovedRegion: boolean; introductionOffered: boolean; questionOnPage: boolean };

const PRIVATE_LINK = "This link opens your job without a password, so please don't forward it.";
// A fixed answer label in plain text is quoted: "Tested it: can do" has a colon of its own.
const answered = (label: string) => label === SITE_RESPONSE_LABELS.interested ? "A deployment company applied to your job."
  : `A deployment company answered "${label}" about your job.`;

// Bare bones (2026-11-11): each notice says one thing in at most three short lines, then one button ("Label:\nURL").
const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string, context: CopyContext) => string }> = {
  task_received: {
    subject: "Your Blueprint job link",
    // A site outside the approved region can save its job but may not send a video yet (`captureResidency.ts`): its
    // link is issued for the job's description alone, so it is not asked for one.
    body: (url, _detail, { outsideApprovedRegion }) => outsideApprovedRegion
      ? `Your job is saved.\n\nWe can only take videos from sites in the United States for now, so please don't send a video yet. ${PRIVATE_LINK}\n\nOpen your job:\n${url}`
      : `Your job link is ready.\n\nA video is required to post your job. Use the link to send one or check your upload. ${PRIVATE_LINK}\n\n${SHARING_AND_HOW_TO_STOP}\n\nOpen your job:\n${url}`,
  },
  // Only the response label is included. The question and answer stay on the job page. The next step is named only
  // when the job page offers it for this answer: "Introduce us", or the box to answer the company's question.
  company_answered: {
    subject: "A deployment company answered",
    body: (url, detail, { introductionOffered, questionOnPage }) => `${
      detail === SITE_RESPONSE_LABELS.needs_something
        ? `A deployment company needs more details about your job. ${questionOnPage
          ? "Read their question and answer it on your job page." : "Your job page has the details."}`
        : `${answered(detail)} ${introductionOffered ? "To meet them, press Accept on your job page." : "Your job page has the details."}`
    }\n\nOpen your job:\n${url}`,
  },
  // The site asked for an introduction (PACKAGE_E E6). Built only by `buildIntroductionMadeSiteNotification`, whose
  // body is the introduced company's details; this entry is its fallback and never names anyone. After an
  // introduction the job page shows the company's details (`projectSiteCompanyActivity`).
  introduction_made_site: {
    subject: "Meet the deployment company",
    body: (url) => `We've given them your details. Their contact details are on your job page.\n\nOpen your job:\n${url}`,
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
  return enqueueOutbox(buildTaskLifecycleNotification({ ...params, requestId, to,
    captureRegion: snapshot.data()?.request?.capture_region }));
}

export function buildTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  to: string;
  eventId?: string;
  captureUrl?: string;
  /** `company_answered` only: the company's answer; the email states its fixed label, nothing else of the company. */
  companyAnswerState?: CompanyResponseState;
  /** `task_received` only: the job's saved capture region (`request.capture_region`). */
  captureRegion?: unknown;
  /**
   * `company_answered` only, for "Interested" or "Tested it: can do": the job page offers "Introduce us" beside this
   * answer (an answer that consents to it, `answerConsentsToIntroduction`, from a company not introduced yet).
   */
  introductionOffered?: boolean;
  /** `company_answered` only, for "Need more details": the job page shows the company's question with a box to answer it. */
  questionOnPage?: boolean;
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (params.milestone === "company_answered" && !isCompanyResponseState(params.companyAnswerState)) {
    throw new Error("company_answer_state_invalid");
  }
  const message = copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  const detail = params.milestone === "company_answered" ? SITE_RESPONSE_LABELS[params.companyAnswerState!]
    : "";
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    to: params.to,
    subject: message.subject,
    body: finePrintLast(message.body(url, detail, {
      // Only a known region that is not approved: a missing or unreadable one keeps the usual words.
      outsideApprovedRegion: isCaptureRegion(params.captureRegion) && !isApprovedCaptureRegion(params.captureRegion),
      introductionOffered: params.introductionOffered === true
        && INTRODUCIBLE_RESPONSE_STATES.includes(params.companyAnswerState as CompanyResponseState),
      questionOnPage: params.questionOnPage === true,
    })),
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
    label === SITE_RESPONSE_LABELS.interested ? `${name} applied to your job, and you accepted them.`
      : label ? `${name} answered "${label}" about your job, and you accepted them.` : `You accepted ${name}.`,
    "",
    ...(detailLine(company.contactName) ? [`Contact: ${detailLine(company.contactName)}`] : []),
    `Email: ${detailLine(company.email)}`,
    ...(detailLine(company.website) ? [`Website: ${detailLine(company.website)}`] : []),
    "",
    // A reply to this email reaches Blueprint (every outbox row is sent with Reply-To hello@, `captureOutbox.ts`).
    "We've given them your details. Write to them at the email above.",
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
    // Recorded on the row; dispatch sends every outbox row with Reply-To hello@ (`captureOutbox.ts`), so the email
    // says to write to the address it gives, not to reply.
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail) ? companyEmail : "hello@tryblueprint.io" };
}
