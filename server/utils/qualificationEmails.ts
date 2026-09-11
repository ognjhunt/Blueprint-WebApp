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
import type { MatchSummary } from "../../client/src/lib/robotMatch";
import type { SiteTaskTriageSummary } from "../types/inbound-request";

export const CALENDLY_URL = "https://calendly.com/blueprintar/30min";

export type QualificationEmail = {
  subject: string;
  body: string;
  /** Which branch produced this, for the action ledger and for tests. */
  variant: "not_yet" | "lets_talk" | "match_found" | "no_match_yet";
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
 * The reply a site earns by clearing the screen.
 *
 * This branch returned null until there was a matcher, and that was the honest
 * answer: a clean screen is not an offer, and "we will be in touch" is the kind
 * of sentence that means nothing. What makes it sayable is a count somebody can
 * check.
 *
 * Two shapes, and the second is not a failure:
 *
 * - Teams cleared the constraints → say how many and on what.
 * - Nobody cleared them → say which constraint did the eliminating and what
 *   would change it. That is the same not-yet discipline as a failed gate, one
 *   level up, and it is more useful to a site than silence.
 *
 * Only confirmed matches are counted. A team with an unanswered payload figure
 * is provisional and is deliberately excluded from "three teams clear your
 * payload" — see `MatchOutcome`. Counting it would make a claim nobody made.
 */
export function buildMatchEmail(params: {
  firstName: string;
  siteName?: string | null;
  summary: MatchSummary;
  calendlyUrl?: string;
}): QualificationEmail {
  const { firstName, siteName, summary } = params;
  const calendly = params.calendlyUrl || CALENDLY_URL;
  const site = siteName?.trim();
  const matched = summary.matched.length;
  const provisional = summary.provisional.length;

  if (matched > 0) {
    const body = [
      `Hi ${firstNameOf(firstName)},`,
      "",
      site
        ? `${site} clears the screen, and ${matched === 1 ? "one robot team on our list clears" : `${matched} robot teams on our list clear`} the constraints your task sets.`
        : `Your task clears the screen, and ${matched === 1 ? "one robot team on our list clears" : `${matched} robot teams on our list clear`} the constraints it sets.`,
      "",
      "That is a mechanical check against what each team has told us or demonstrated — payload, the safety envelope your access window implies, and the budget band you gave us. It is not a recommendation yet, and it is not an introduction: we confirm interest on their side before putting anyone in front of you.",
      provisional > 0
        ? `\n${provisional === 1 ? "One further team" : `${provisional} further teams`} might also fit, but we are missing a figure we would need to say so. We will ask them rather than guess.`
        : "",
      "",
      `The next step is a short call to agree scope: ${calendly}`,
      "",
      "— The Blueprint team",
    ]
      .filter(Boolean)
      .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
      .join("\n");

    return { subject: site ? `${site}: who clears your constraints` : "Who clears your constraints", body, variant: "match_found" };
  }

  const blockers = summary.commonBlockers.slice(0, 2);
  const body = [
    `Hi ${firstNameOf(firstName)},`,
    "",
    site
      ? `${site} clears our screening conditions — the site is workable. What it does not yet have is a robot team on our list that clears the constraints your task sets.`
      : "Your task clears our screening conditions. What it does not yet have is a robot team on our list that clears the constraints it sets.",
    "",
    blockers.length ? "Where it comes apart:" : "",
    blockers.length ? "" : "",
    blockers.length
      ? bulletList(
          blockers.map((blocker) =>
            blocker.count === 1
              ? `${blocker.label} — one team ruled out on this`
              : `${blocker.label} — ${blocker.count} teams ruled out on this`,
          ),
        )
      : "",
    "",
    "That is a statement about today's list, not about your task. The list grows, and a change on your side — a slower acceptable cycle, a different acceptance threshold — can also change the answer. Tell us if either moves and we will re-run it.",
    "",
    "We keep the task on file either way.",
    "",
    "— The Blueprint team",
  ]
    .filter(Boolean)
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  return {
    subject: site ? `${site}: no match on today's list` : "No match on today's list",
    body,
    variant: "no_match_yet",
  };
}

/**
 * Pick the reply for a verdict, or none.
 *
 * A clean screen still gets nothing when no match has been run: there is
 * genuinely nothing to say yet, and "we will be in touch" is worse than
 * silence. Pass `matches` and the branch can speak — see `buildMatchEmail`.
 *
 * `INBOUND_POLICY` is unchanged either way. Both match variants describe a
 * qualified site, which that policy always routes to a human, so a match email
 * is drafted and queued rather than sent automatically.
 */
export function buildQualificationEmail(params: {
  firstName: string;
  siteName?: string | null;
  triage: SiteTaskTriageSummary | null | undefined;
  /**
   * Present once the site has been matched against the registry. Absent means
   * the match has not run, which is different from "no teams matched" and is
   * why a clean screen still returns null without it.
   */
  matches?: MatchSummary | null;
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

  // A clean screen with a match run behind it can finally say something. With
  // no match run, it still says nothing rather than something vague.
  if (triage.disposition === "qualified" && params.matches) {
    return buildMatchEmail({
      firstName: params.firstName,
      siteName: params.siteName,
      summary: params.matches,
    });
  }

  return null;
}
