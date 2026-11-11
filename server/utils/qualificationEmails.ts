/**
 * The two replies a screened submission earns.
 *
 * ## Neither of these is written by a model
 *
 * Every sentence below is either fixed copy or a string the site's own answer
 * selected. `unblocks` on each blocking option in
 * `client/src/data/siteTaskQualification.ts` was authored precisely so a
 * rejection could name the change that would flip it; `ambiguity` on each
 * marginal option was authored to be a call agenda. Those strings are the
 * email. Generating prose over the top of them would add a hallucination
 * surface to the highest-volume outbound message in the funnel and improve
 * nothing.
 *
 * That also makes these deterministic: the same submission produces the same
 * email, which is what lets the copy be reviewed once rather than spot-checked
 * forever.
 *
 * ## Why "not yet" is the one that got the care
 *
 * It is the most common outcome and the one usually wasted. A generic no ends
 * the relationship; a no that names the condition and what would change it is a
 * reason to come back when the site reconfigures a cell or we open a metro.
 * `qualifyingConditions` is explicit that a failed gate is "disqualified until
 * that condition is engineered into place, which is itself a piece of work
 * someone can decide to fund" — so the email says that, plainly.
 */
import type { SiteTaskTriageSummary } from "../types/inbound-request";
import { footageSettlesAll } from "../../client/src/data/siteTaskQualification";
import { bookingUrl } from "./bookingLink";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import { SUPPORTED_TASK_LINES, taskScopeNotYet, taskScopeReasonSentence } from "./siteTaskScope";

/**
 * Where a booking link points, when one is warranted.
 *
 * ## When a call earns its place, and when it does not
 *
 * A call costs days of calendar latency and two people's synchronous time. That
 * is worth paying when the information cannot be got another way, or when the
 * person on the other end wants a human before they commit. It is not worth
 * paying to find out what a room looks like, because 45 seconds of footage
 * answers that better and in fifteen minutes.
 *
 * So booking links belong at commitment and at reassurance, and not at
 * discovery. The qualified reply used to open with one and no longer does: it
 * fires before any capture exists, so there was nothing to discuss that the
 * video does not show. `buildLetsTalkEmail` keeps one, but only for the open
 * questions footage cannot settle.
 */
export const CALENDLY_URL = bookingUrl();

export type QualificationEmail = {
  subject: string;
  body: string;
  /** Which branch produced this, for the action ledger and for tests. */
  variant: "not_yet" | "lets_talk" | "qualified";
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
 * The deferral.
 *
 * Deliberately does not ask for a call. A site that fails a gate cannot be
 * talked past it, and booking thirty minutes to say so again wastes their time
 * and ours. The invitation is to come back when the named thing changes.
 */
export function buildNotYetEmail(params: {
  firstName: string;
  siteName?: string | null;
  triage: Pick<SiteTaskTriageSummary, "blockers">;
}): QualificationEmail {
  const { firstName, siteName, triage } = params;
  const blockers = triage.blockers.filter(Boolean);
  // Screening says "not now" only when a gate blocks (`triageGateAnswers`), so a reply always has a condition to
  // name; one without would end on an empty list, and is never built.
  if (!blockers.length) throw new Error("not_yet_email_without_blockers");
  const site = siteName?.trim();
  const counted = blockers.length === 1 ? "One of our screening conditions does not hold"
    : `${blockers.length === 2 ? "Two" : blockers.length === 3 ? "Three" : blockers.length} of our screening conditions do not hold`;

  const subject = "Your job, and what would have to change";

  // Bare bones (2026-11-11): one idea, the list, and the one thing the site can do.
  const body = [
    emailGreeting(firstNameOf(firstName)),
    "",
    site
      ? `Thanks for describing the job at ${site}. ${counted} there today:`
      : `Thanks for describing the job. ${counted} at the site today:`,
    "",
    bulletList(blockers),
    "",
    "That is a not-yet rather than a no. We keep your job on file; if any of this changes, reply to this email and we pick it back up. No call needed.",
    "",
    EMAIL_SIGN_OFF,
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  return { subject, body, variant: "not_yet" };
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
      : "We have accepted your job and are holding it while we prepare an evaluation for its kind. We email you when we can evaluate it.",
    "",
    unclear
      ? `${notYet.nextStep}${params.jobUrl ? ` Your job page: ${params.jobUrl}` : ""}`
      : `${params.reason === "multi_step" ? `${notYet.nextStep} ` : ""}If we read your job wrong, reply to this email.${params.jobUrl ? ` Your job page: ${params.jobUrl}` : ""}`,
    "",
    EMAIL_SIGN_OFF,
  ].join("\n");
  return { subject: unclear ? "Your job brief needs one sentence about the job" : "Your job: we are preparing its evaluation",
    body, variant: "not_yet" };
}

/**
 * The call, with its agenda already written.
 *
 * The open questions are marginal answers — the ones the form could not settle
 * by construction. Sending them ahead is the entire value: it turns a discovery
 * call into a short, specific one, and it lets the site decline if the list
 * makes the answer obvious to them.
 */
export function buildLetsTalkEmail(params: {
  firstName: string;
  siteName?: string | null;
  triage: Pick<
    SiteTaskTriageSummary,
    "open_questions" | "incomplete" | "open_question_field_ids"
  >;
  calendlyUrl?: string;
  /** The site's footage is already saved, so filming is not the way to settle it. */
  footageReceived?: boolean;
}): QualificationEmail {
  const { firstName, siteName, triage } = params;
  const calendly = params.calendlyUrl || bookingUrl();
  const openQuestions = triage.open_questions.filter(Boolean);
  const site = siteName?.trim();

  /**
   * A marginal answer about the room is a question footage settles, and asking
   * for a call to discuss what a camera would show is the expensive way to
   * learn it. A blank gate is not a marginal answer at all, so an incomplete
   * submission keeps the call: nobody described the thing we would be filming.
   * A site that already sent its footage keeps the call too: asking it to
   * film the room again would ask for what we have.
   */
  const footageAnswers = !params.footageReceived
    && !triage.incomplete && footageSettlesAll(triage.open_question_field_ids);

  const subject = footageAnswers
    ? site
      ? `${site}: 45 seconds of video should settle this`
      : "45 seconds of video should settle this"
    : site
      ? `${site}: a short call should settle this`
      : "A short call should settle this";

  const body = [
    emailGreeting(firstNameOf(firstName)),
    "",
    openQuestions.length
      ? footageAnswers ? "Here is what we could not tell from the form:" : "Here is the agenda, so the call is short:"
      : "There are a few things a form cannot settle.",
    "",
    openQuestions.length ? bulletList(openQuestions) : "",
    "",
    triage.incomplete ? "Some screening questions were left blank, so we will confirm those too." : "",
    "",
    footageAnswers
      ? "Film that one work area on a phone for about 45 seconds and send it back. Or reply, and we will find a time to talk."
      : `Book thirty minutes whenever suits: ${calendly} If the list makes the answer obvious on your side, tell us and we will save us both the call.`,
    "",
    EMAIL_SIGN_OFF,
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  return { subject, body, variant: "lets_talk" };
}

/**
 * What happens next for a site that cleared the screen.
 *
 * Mirrors `CaptureDispatchDecision` rather than restating it: the caller runs
 * the real decision and hands the outcome here, so the email cannot promise a
 * step the system did not take.
 */
export type QualifiedNextStep =
  /** An upload link was issued. The site films it themselves. */
  | { kind: "self_capture"; uploadUrl: string }
  /** Held. We say we are reviewing rather than inventing a next step. */
  | { kind: "held" }
  /** The walkthrough is already saved, so there is nothing to film. */
  | { kind: "footage_received"; taskUrl: string }
  /** Whether footage is saved could not be read. The job page says; the email does not guess. */
  | { kind: "job_page"; taskUrl: string };

function qualifiedNextStepLine(nextStep: QualifiedNextStep | undefined, calendly: string): string {
  if (nextStep?.kind === "footage_received") {
    return `We already have your footage of the work area, so you do not need to film anything. Your job page shows where it stands: ${nextStep.taskUrl}`;
  }
  if (nextStep?.kind === "job_page") {
    return `Your job page shows the next step: ${nextStep.taskUrl}`;
  }
  if (nextStep?.kind === "self_capture") {
    return `Next, film the work area on a phone and upload it here: ${nextStep.uploadUrl}\n\nIt takes about a minute, and you do not need an app or a call.`;
  }
  if (nextStep?.kind === "held") {
    // Deliberately no link and no promise. Something upstream wanted a person,
    // and inviting an upload we are not ready to process would be worse than
    // saying less.
    return "We are reviewing the details before we start a capture, and will come back to you shortly with what we need.";
  }
  // No decision passed: legacy callers and the non-intake paths. A booking link
  // is the honest fallback there, because nothing has been dispatched.
  return `The next step is a short call to plan the capture: ${calendly}`;
}

/**
 * The reply a site earns by clearing the screen.
 *
 * Names the recorded next action, then explains the job-first buying process.
 * Evidence methods are selected for the uncertainty that remains; receiving a
 * description does not promise a simulation, supplier availability or a pilot.
 *
 * ## Why no team counts
 *
 * This branch used to count the teams in our registry that "cleared the
 * constraints" and name the budget band the site had given. The public form
 * never asks for a budget, the registry counted prospects that had never opted
 * in, and a count of teams at screening is a promise about supply the system
 * cannot keep. `runSiteMatch` still runs as internal ops data; nothing from it
 * reaches this email, which is why it no longer takes a match summary at all.
 */
export function buildQualifiedEmail(params: {
  firstName: string;
  siteName?: string | null;
  /**
   * Where the site is in the flow. `brief_confirmed` is the reply to a site
   * that just confirmed its job brief; `screened` is the intake-time reply to
   * a site whose gate answers arrived with its submission.
   */
  stage?: "brief_confirmed" | "screened";
  /** What the system actually did with this submission, so the email can say it. */
  nextStep?: QualifiedNextStep;
  /** True when the site has not yet saved the job to a verified account. */
  accountNeeded?: boolean;
  /**
   * False when the job card is not published (kept private, hidden, or awaiting
   * review). No partner may discover it through the shared library. Private
   * assessment may continue, but provider sharing needs separate authorization.
   */
  jobCardPublished?: boolean;
  calendlyUrl?: string;
}): QualificationEmail {
  const { firstName, siteName } = params;
  const calendly = params.calendlyUrl || bookingUrl();
  const site = siteName?.trim();
  const confirmed = params.stage === "brief_confirmed";

  const opening = confirmed
    ? site
      ? `Thanks for confirming the job brief for ${site}. It clears our screening conditions.`
      : "Thanks for confirming your job brief. It clears our screening conditions."
    : site
      ? `Thanks for describing the job at ${site}. It clears our screening conditions.`
      : "Thanks for describing the job. It clears our screening conditions.";

  const body = [
    emailGreeting(firstNameOf(firstName)),
    "",
    opening,
    "",
    qualifiedNextStepLine(params.nextStep, calendly),
    "",
    params.accountNeeded
      ? "Before sending footage, create and verify your site account from your job page."
      : "",
    "",
    params.nextStep?.kind === "self_capture" ? "We need your video before the site assessment can start." : "",
    "",
    params.jobCardPublished === false
      ? "Your job card is not published, so partners cannot discover it through the shared library. We ask before sharing details with any partner. You can publish its card from your job page when you want approved partners to see it."
      : "",
    "",
    "You then see which robot most likely fits and which did best in the simulation, or “held” if we can't simulate that kind of job yet. You can then share the job with deployment companies we have approved. You agree any physical pilot's scope, price, timing and acceptance criteria directly with that company.",
    "",
    "Free during the beta. A simulation result is an estimate; it never certifies how a robot will perform at your site or that it will be safe there.",
    "",
    EMAIL_SIGN_OFF,
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  const subject = confirmed
    ? site ? `${site}: your job brief is confirmed` : "Your job brief is confirmed"
    : site ? `${site}: your job cleared our screen` : "Your job cleared our screen";

  return { subject, body, variant: "qualified" };
}

/**
 * Pick the reply for a verdict, or none.
 *
 * Each disposition keeps its meaning: `not_now` names the condition that
 * failed and what would change it, `needs_conversation` carries the open
 * questions, and `qualified` names the next step and what follows.
 *
 * `INBOUND_POLICY` is unchanged either way. The inbound workflow narrows it
 * only for these fixed, pre-reviewed variants — see `createInboundEmailPolicy`.
 */
export function buildQualificationEmail(params: {
  firstName: string;
  siteName?: string | null;
  triage: SiteTaskTriageSummary | null | undefined;
  stage?: "brief_confirmed" | "screened";
  /** The dispatch outcome, so the qualified branch can name a real next step. */
  nextStep?: QualifiedNextStep;
  accountNeeded?: boolean;
  jobCardPublished?: boolean;
}): QualificationEmail | null {
  const { triage } = params;
  if (!triage) return null;

  if (triage.disposition === "not_now") {
    // A record without a stored blocker (from before blockers were kept) has nothing to name: send nothing.
    if (!triage.blockers.some(Boolean)) return null;
    return buildNotYetEmail({
      firstName: params.firstName,
      siteName: params.siteName,
      triage,
    });
  }

  if (triage.disposition === "needs_conversation") {
    return buildLetsTalkEmail({
      firstName: params.firstName,
      siteName: params.siteName,
      triage,
      // A site whose footage is in, or may be, is never asked to film it again.
      footageReceived: params.nextStep?.kind === "footage_received" || params.nextStep?.kind === "job_page",
    });
  }

  if (triage.disposition === "qualified") {
    return buildQualifiedEmail({
      firstName: params.firstName,
      siteName: params.siteName,
      stage: params.stage,
      nextStep: params.nextStep,
      accountNeeded: params.accountNeeded,
      jobCardPublished: params.jobCardPublished,
    });
  }

  return null;
}
