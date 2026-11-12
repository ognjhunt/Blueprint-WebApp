/**
 * The one screening-time email a site still gets: "we can't simulate this kind
 * of job yet".
 *
 * ## The four-conditions emails ended (owner decision 2026-11-11)
 *
 * The screen of four conditions still decides what it gates (scene grants and
 * visibility). It no longer writes to the site: the "not yet", "a short call
 * should settle this" and "your job cleared our screen / brief is confirmed"
 * replies were removed, along with the booking link they carried.
 *
 * ## Not written by a model
 *
 * Every sentence below is fixed copy or a string the site's own answer
 * selected, so the same submission produces the same email and the copy is
 * reviewed once rather than spot-checked forever.
 */
import type { SiteTaskTriageSummary } from "../types/inbound-request";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import { SUPPORTED_TASK_LINES, taskScopeNotYet, taskScopeReasonSentence } from "./siteTaskScope";

export type QualificationEmail = {
  subject: string;
  body: string;
  /** Which branch produced this, for the action ledger and for tests. */
  variant: "not_yet";
};

function firstNameOf(fullOrFirst: string): string {
  const trimmed = fullOrFirst.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * A job we cannot score in simulation yet, whatever its gate verdict.
 *
 * Names what the simulation scores today, so the site never waits on an
 * evaluation that would test a different task. Under the owner's rule the job
 * is accepted and held while we prepare an evaluation for its kind, and it
 * counts as demand for what to build next. A brief we could not read is asked
 * for one sentence instead: it is undescribed, not held (audit N3).
 */
export function buildTaskNotYetSupportedEmail(params: {
  firstName: string;
  siteName?: string | null;
  reason: unknown;
  jobUrl?: string | null;
}): QualificationEmail {
  const site = params.siteName?.trim();
  const notYet = taskScopeNotYet(params.reason);
  const unclear = params.reason === "unclear";
  const body = [
    emailGreeting(firstNameOf(params.firstName)),
    "",
    taskScopeReasonSentence(params.reason),
    "",
    "Today our simulation can score these kinds of job:",
    bulletList(SUPPORTED_TASK_LINES),
    "",
    unclear
      ? "We need to clarify the job before we can test it. Your job stays on file."
      : "We have accepted your job and are holding it while we prepare a simulation for its kind. We email you when we can build it.",
    "",
    unclear
      ? `${notYet.nextStep}${params.jobUrl ? ` Your job page: ${params.jobUrl}` : ""}`
      : `${params.reason === "multi_step" ? `${notYet.nextStep} ` : ""}If we read your job wrong, reply to this email.${params.jobUrl ? ` Your job page: ${params.jobUrl}` : ""}`,
    "",
    EMAIL_SIGN_OFF,
  ].join("\n");
  return { subject: unclear ? "Your job brief needs one sentence about the job" : "Your job: we are preparing its job packet",
    body, variant: "not_yet" };
}

/**
 * Whether the ended four-conditions screen would have emailed this verdict.
 *
 * The inbound workflow starts a model-written follow-up draft only where no
 * screening email went. Ending the email must not start a draft in its place,
 * so the workflow still asks this, with the rule the removed builder used:
 * a "not now" with a named blocker, any "needs a conversation", any "qualified".
 */
export function screeningEmailWouldHaveBeenSent(triage: Pick<SiteTaskTriageSummary, "disposition" | "blockers"> | null | undefined): boolean {
  if (!triage) return false;
  if (triage.disposition === "not_now") return (triage.blockers ?? []).some(Boolean);
  return triage.disposition === "needs_conversation" || triage.disposition === "qualified";
}
