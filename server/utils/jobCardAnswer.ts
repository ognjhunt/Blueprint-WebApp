/**
 * Blueprint's first look on a shared job, for approved deployment companies.
 *
 * Composed at read time from `loadSiteAnswer`: the headline, the job family, the sizes, weights and distances the
 * answer rests on, the pick and the runner-up (names, verdict, two published figures and the cited evidence), how sure
 * in one reason, and what the video could not tell. Never the site's name, address or contacts. Free text the video
 * reader wrote about other objects is replaced by the plain sentence. The answer is written to the site ("your
 * video"); here it is said about the site instead. If anything fails, the job goes out without it.
 */
import type { AnswerRobot, SiteAnswer } from "../../client/src/lib/siteAnswer";
import type { JobCardAnswerRobot, JobCardAnswerSummary } from "../../client/src/types/taskBrowse";
import { sharedJobListing } from "./taskListingDetails";
import { TIGHT_FIT_SENTENCE } from "../../client/src/lib/siteAnswer";
import { logger } from "../logger";

/**
 * The first look goes to companies with the job (2026-11-12, sharing is the service): a job listed under
 * `job-shared-2026-11-12` carries it. Who may see the job at all is still `teamJobAccess`; this never
 * widens it. Cards under the older share statements (v1 to v3) are no longer listed, so their gates are gone.
 */
export function jobCardAnswerShared(record: unknown): boolean {
  return sharedJobListing(record) !== null;
}

const SITE_WORDS: Array<[RegExp, string]> = [
  [/\bjobs like yours\b/g, "jobs like this one"],
  [/\byour two spots\b/g, "the two spots"],
  [/\byour object\b/g, "the object"],
  [/\bat your site\b/g, "at the site"],
  [/\bof your site\b/g, "of the site"],
  [/\byour site\b/g, "the site"],
  [/\bYour job\b/g, "The job"],
  [/\byour job\b/g, "the job"],
  [/\byour (video|work area|scene)\b/g, "the site's $1"],
  [/\bYour (video|work area|scene)\b/g, "The site's $1"],
];
/** The answer's sentence said about the site, for a company reading the card. */
export function aboutTheSite(sentence: string): string {
  return SITE_WORDS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), sentence);
}

const VERDICT_LABELS: Record<AnswerRobot["verdict"], string> = {
  fits: "Fits, checked in the scene rebuilt from the site's video",
  fits_on_paper: "Fits on paper",
  possible: "May fit",
  ruled_out: "Ruled out",
};
const OTHER_OBJECTS = "How many different objects the job handles:";
const httpsUrl = (value: unknown) => typeof value === "string" && /^https:\/\//.test(value);

function robotOf(robot: AnswerRobot | null): JobCardAnswerRobot | null {
  if (!robot) return null;
  return {
    manufacturer: robot.manufacturer, name: robot.name, verdictLabel: VERDICT_LABELS[robot.verdict] ?? "May fit",
    // Outcomes and figures only (a number and its unit, each at most a few words): the sentences say the site's
    // words ("your two spots") and stay on the site's page.
    checks: robot.checks.map(({ key, outcome, need, has, text }) => ({ key, outcome,
      // A passed check with little to spare: its sentence ends so (the composer's "tight fit").
      tight: outcome === "pass" && typeof text === "string" && text.endsWith(` ${TIGHT_FIT_SENTENCE}`),
      need: typeof need === "string" && /^[^a-z]*\d[\d\s.,–-]*(cm|m|kg|s)$/i.test(need.replace(/^about /, "")) ? need : null,
      has: typeof has === "string" && /^[^a-z]*\d[\d\s.,–-]*(cm|m|kg|s)$/i.test(has.replace(/^about /, "")) ? has : null })),
    specs: robot.specs.filter(spec => httpsUrl(spec.sourceUrl)).slice(0, 2)
      .map(({ label, display, sourceUrl }) => ({ label, display, sourceUrl })),
    evidence: robot.evidence.filter(row => httpsUrl(row.sourceUrl)).slice(0, 2)
      .map(({ level, scope, family, summary, quote, sourceUrl, sourceTitle, publisher, publishedOn }) =>
        ({ level, scope, family: scope === "family" ? family ?? null : null, summary, quote, sourceUrl, sourceTitle, publisher, publishedOn })),
  };
}

/** The card's answer from the site's answer. Pure. Null while the answer is not settled. */
export function projectJobCardAnswer(answer: SiteAnswer | null): JobCardAnswerSummary | null {
  if (!answer || (answer.state !== "ready" && answer.state !== "cannot_assess")) return null;
  const firstReason = answer.confidence.reasons[0];
  return {
    headline: aboutTheSite(answer.headline),
    sceneNote: answer.state === "ready" && answer.sceneNote ? aboutTheSite(answer.sceneNote).replace(/\byour own measurement\b/g, "the site's own measurement") : null,
    familyLabel: answer.job.familyLabel,
    // Sizes, weights and distances only: a figure with its unit, never words about the site.
    facts: answer.facts.filter(fact => /\d/.test(fact.display) && fact.display.length <= 60)
      .map(({ label, display, basis }) => ({ label, display, basis })),
    pick: robotOf(answer.pick),
    runnerUp: robotOf(answer.runnerUp),
    confidence: { level: answer.confidence.level, reason: firstReason ? aboutTheSite(firstReason) : null },
    unknowns: answer.unknowns.map(line => line.startsWith(OTHER_OBJECTS) ? "How many different objects the job handles." : line)
      .map(aboutTheSite),
    note: aboutTheSite(answer.note),
  };
}

/** The headline alone, for the browse list. */
export async function loadJobCardAnswerHeadline(id: string, record: unknown): Promise<string | null> {
  // The library's line is the card's own headline.
  return (await loadJobCardAnswer(id, record))?.headline ?? null;
}

/** The card's answer. Null without a shared job or on any failure. */
export async function loadJobCardAnswer(id: string, record: unknown): Promise<JobCardAnswerSummary | null> {
  return (await loadJobCardAnswerWithRobots(id, record)).summary;
}

/**
 * The same, with the site answer's two robots as they stand (for the first look's rows in words on the company's
 * page, `firstLookRowFromAnswerRobot`). Robots carry names, verdicts and checks only.
 */
export async function loadJobCardAnswerWithRobots(id: string, record: unknown):
  Promise<{ summary: JobCardAnswerSummary | null; robots: AnswerRobot[] }> {
  if (!jobCardAnswerShared(record)) return { summary: null, robots: [] };
  try {
    const { loadSiteAnswer } = await import("./siteAnswer");
    const answer = await loadSiteAnswer(id);
    if (!answer) return { summary: null, robots: [] };
    const robots = answer.state === "ready" || answer.state === "cannot_assess"
      ? [answer.pick, answer.runnerUp].filter((robot): robot is AnswerRobot => Boolean(robot)) : [];
    return { summary: projectJobCardAnswer(answer), robots };
  } catch (error) {
    logger.warn({ error, requestId: id }, "Could not compose the answer for a job card");
    return { summary: null, robots: [] };
  }
}
