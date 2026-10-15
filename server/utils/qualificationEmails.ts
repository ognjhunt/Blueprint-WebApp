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
  const site = siteName?.trim();

  const subject = "Your job, and what would have to change";

  const body = [
    emailGreeting(firstNameOf(firstName)),
    "",
    site
      ? `Thanks for describing the job at ${site}. We screen every site against four conditions before anyone commits engineering time, and this one does not clear all four today.`
      : "Thanks for describing the job. We screen every site against four conditions before anyone commits engineering time, and this one does not clear all four today.",
    "",
    blockers.length
      ? "Specifically:"
      : "One of the screening conditions does not hold at the site today.",
    blockers.length ? "" : "",
    blockers.length ? bulletList(blockers) : "",
    "",
    "That is a not-yet rather than a no, and the distinction is real. Each of those is a condition that can be engineered into place — it is work someone can decide to fund, and sites do. If any of it changes, reply to this email and we will pick the job back up from where it is now rather than starting over.",
    "",
    "We are keeping the job on file either way. No call needed for this answer — there is nothing a conversation would settle that the list above has not.",
    "",
    "Thanks for the detail you sent. It was more than most.",
    "",
    EMAIL_SIGN_OFF,
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  return { subject, body, variant: "not_yet" };
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
   */
  const footageAnswers =
    !triage.incomplete && footageSettlesAll(triage.open_question_field_ids);

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
    site
      ? `Thanks for describing the job at ${site}. It clears the conditions that can end a submission outright, and there ${openQuestions.length === 1 ? "is one thing" : `are ${openQuestions.length || "a few"} things`} a form genuinely cannot settle.`
      : `Thanks for describing the job. It clears the conditions that can end a submission outright, and there ${openQuestions.length === 1 ? "is one thing" : `are ${openQuestions.length || "a few"} things`} a form genuinely cannot settle.`,
    "",
    openQuestions.length
      ? footageAnswers
        ? "Here is what we could not tell from the form:"
        : "Here is the agenda, so the call is short:"
      : "",
    openQuestions.length ? "" : "",
    openQuestions.length ? bulletList(openQuestions) : "",
    "",
    triage.incomplete
      ? "A couple of the screening questions were left blank, so we will confirm those too rather than assuming."
      : "",
    "",
    footageAnswers
      ? "You do not need to book anything to settle this. Film that one work area on a phone for about 45 seconds and send it back — every question above is about the room itself, and the video shows it better than either of us could describe it."
      : `Thirty minutes, and you can book whenever suits: ${calendly}`,
    "",
    footageAnswers
      ? "If you would rather talk it through first, reply and we will find a time."
      : "If reading that list makes the answer obvious on your side, tell us and we will save us both the call.",
    "",
    EMAIL_SIGN_OFF,
  ]
    .filter(Boolean)
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
  /**
   * The site asked for someone to film it. Whether anyone can reach the site is
   * a human answer, so the email promises a reply rather than a visit, and
   * offers the site's own link first when there is one.
   */
  | { kind: "capturer_visit"; taskUrl?: string }
  /** Held. We say we are reviewing rather than inventing a next step. */
  | { kind: "held" };

function qualifiedNextStepLine(nextStep: QualifiedNextStep | undefined, calendly: string): string {
  if (nextStep?.kind === "self_capture") {
    return `Next, film the work area on a phone and upload it here: ${nextStep.uploadUrl}\n\nIt takes about a minute, and you do not need an app or a call.`;
  }
  if (nextStep?.kind === "capturer_visit") {
    // No city is named or assumed. Whether a visit is possible depends on where
    // the site is, and that is a person's answer, not a sentence in a template.
    const visit = "You asked for someone to film the work area. We will reply to tell you whether a visit is possible for your location and, if it is, to agree a time.";
    return nextStep.taskUrl
      ? `${visit} If you would rather not wait, you can film it yourself in about a minute on any phone: open ${nextStep.taskUrl} and choose "I'll film it myself instead".`
      : visit;
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
 * It says three things and nothing else: the screen passed, the one concrete
 * thing that happens next, and what follows once there is footage. What
 * follows is the product, stated the same way everywhere: invited robot teams
 * evaluate the job in a simulation built from the capture, Blueprint
 * recommends one team whose evaluation passed (or says plainly that none did),
 * and the site books that pilot in one step. Free during the beta.
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
   * review). No robot team can see or evaluate such a job, so the email must
   * not promise evaluations or a recommendation. Absent when the caller did
   * not read it, which keeps the listed job's wording.
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
      ? "Before we build the scene, create and verify your site account from your job page."
      : "",
    "",
    "Once we have footage of the work area:",
    "",
    bulletList(params.jobCardPublished === false ? [
      "We turn it into a 3D scene.",
      "Your job card is not published, so robot teams cannot see your job or evaluate it, and it cannot lead to a recommended pilot.",
      "To open it to the robot teams we have invited, publish its card from your job page. The card shows only the anonymized text you approve.",
    ] : [
      "We turn it into a 3D scene.",
      "Robot teams we have invited evaluate your job in a simulation built from that scene.",
      "If a team's evaluation passes, we recommend that one team, and you can book the pilot in one step. If no team passes, we tell you that plainly.",
    ]),
    "",
    "All of this is free during the beta. A simulation result is an estimate, not proof of how a robot will perform at your site or that it will be safe there.",
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
