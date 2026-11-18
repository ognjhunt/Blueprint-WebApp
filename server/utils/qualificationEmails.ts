/**
 * The one screening-time email a site still gets: "your job brief needs one
 * sentence about the job", when the brief it confirmed gives none.
 *
 * No email is sent about a job's kind or shape: an accepted job of any kind
 * is told what every accepted job is told (owner: "accept every job then
 * determine what is needed from there"). The "we can't simulate this kind of
 * job yet" and "on hold because it has more than one step" emails ended.
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
 * Every sentence below is fixed copy, so the same submission produces the
 * same email and the copy is reviewed once rather than spot-checked forever.
 */
import type { SiteTaskTriageSummary } from "../types/inbound-request";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import { UNCLEAR_BRIEF_ASK } from "./siteTaskScope";

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

/**
 * A confirmed brief that gives no sentence about the job (`taskBriefUnclear`): the site is asked for one, in the
 * job page's own words (`UNCLEAR_BRIEF_ASK`). Nothing about the job's kind, and no list of what our simulation
 * scores.
 */
export function buildBriefUnclearEmail(params: {
  firstName: string;
  jobUrl?: string | null;
}): QualificationEmail {
  const body = [
    emailGreeting(firstNameOf(params.firstName)),
    "",
    UNCLEAR_BRIEF_ASK.detail,
    "",
    `${UNCLEAR_BRIEF_ASK.nextStep}${params.jobUrl ? ` Your job page: ${params.jobUrl}` : ""}`,
    "",
    EMAIL_SIGN_OFF,
  ].join("\n");
  return { subject: "Your job brief needs one sentence about the job", body, variant: "not_yet" };
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
