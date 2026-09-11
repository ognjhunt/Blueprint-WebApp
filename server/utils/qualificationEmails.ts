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

export const CALENDLY_URL = "https://calendly.com/blueprintar/30min";

export type QualificationEmail = {
  subject: string;
  body: string;
  /** Which branch produced this, for the action ledger and for tests. */
  variant: "not_yet" | "lets_talk";
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

  const subject = "Your task, and what would have to change";

  const body = [
    `Hi ${firstNameOf(firstName)},`,
    "",
    site
      ? `Thanks for describing the task at ${site}. We screen every site against four conditions before anyone commits engineering time, and this one does not clear all four today.`
      : "Thanks for describing the task. We screen every site against four conditions before anyone commits engineering time, and this one does not clear all four today.",
    "",
    blockers.length
      ? "Specifically:"
      : "One of the screening conditions does not hold at the site today.",
    blockers.length ? "" : "",
    blockers.length ? bulletList(blockers) : "",
    "",
    "That is a not-yet rather than a no, and the distinction is real. Each of those is a condition that can be engineered into place — it is work someone can decide to fund, and sites do. If any of it changes, reply to this email and we will pick the task back up from where it is now rather than starting over.",
    "",
    "We are keeping the task on file either way. No call needed for this answer — there is nothing a conversation would settle that the list above has not.",
    "",
    "Thanks for the detail you sent. It was more than most.",
    "",
    "— The Blueprint team",
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
  triage: Pick<SiteTaskTriageSummary, "open_questions" | "incomplete">;
  calendlyUrl?: string;
}): QualificationEmail {
  const { firstName, siteName, triage } = params;
  const calendly = params.calendlyUrl || CALENDLY_URL;
  const openQuestions = triage.open_questions.filter(Boolean);
  const site = siteName?.trim();

  const subject = site
    ? `${site}: a short call should settle this`
    : "A short call should settle this";

  const body = [
    `Hi ${firstNameOf(firstName)},`,
    "",
    site
      ? `Thanks for describing the task at ${site}. It clears the conditions that can end a submission outright, and there ${openQuestions.length === 1 ? "is one thing" : `are ${openQuestions.length || "a few"} things`} a form genuinely cannot settle.`
      : `Thanks for describing the task. It clears the conditions that can end a submission outright, and there ${openQuestions.length === 1 ? "is one thing" : `are ${openQuestions.length || "a few"} things`} a form genuinely cannot settle.`,
    "",
    openQuestions.length ? "Here is the agenda, so the call is short:" : "",
    openQuestions.length ? "" : "",
    openQuestions.length ? bulletList(openQuestions) : "",
    "",
    triage.incomplete
      ? "A couple of the screening questions were left blank, so we will confirm those too rather than assuming."
      : "",
    "",
    `Thirty minutes, and you can book whenever suits: ${calendly}`,
    "",
    "If reading that list makes the answer obvious on your side, tell us and we will save us both the call.",
    "",
    "— The Blueprint team",
  ]
    .filter(Boolean)
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  return { subject, body, variant: "lets_talk" };
}

/**
 * Pick the reply for a verdict, or none.
 *
 * `qualified` deliberately gets nothing here. A site that clears the screen is
 * not owed an automated congratulation — the next real step is a match against
 * robot teams, which is a human's call and often a no. `INBOUND_POLICY` already
 * refuses to auto-send on the good outcomes; this returning `null` is the same
 * judgement made one layer earlier.
 */
export function buildQualificationEmail(params: {
  firstName: string;
  siteName?: string | null;
  triage: SiteTaskTriageSummary | null | undefined;
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

  return null;
}
