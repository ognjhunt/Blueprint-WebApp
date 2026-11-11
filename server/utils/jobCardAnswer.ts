/**
 * Blueprint's answer on a job card, for approved deployment companies.
 *
 * ## Only with the site's choice
 *
 * A card carries the answer only when the site pressed "Find a deployment
 * company for this job" and its choice was recorded under the statement that
 * names the answer (`introduction_request.statement_version`, see
 * `client/src/lib/jobCardAnswerConsent.ts`) AND the card's current listing
 * consent (`public_task_listing.consentVersion`) is that same statement. The
 * older card checkbox does not mention the answer, so a card listed or re-saved
 * under it never carries one, and an `introduction_request` stored before the
 * statement was recorded never does either. Who may see the card at all is still `teamJobAccess`; this never
 * widens it.
 *
 * ## What it carries
 *
 * Composed at read time from `loadSiteAnswer`: the headline, the job family,
 * the sizes, weights and distances the answer rests on, the pick and the
 * runner-up (names, verdict, two published figures and the cited evidence),
 * how sure in one reason, and what the video could not tell. Never the site's
 * own sentence, name, address, contacts or video. Free text the video reader
 * wrote about other objects is replaced by the plain sentence.
 *
 * The answer is written to the site ("your video"); on the card it is said
 * about the site instead. If anything fails, the card goes out without it.
 */
import type { AnswerRobot, SiteAnswer } from "../../client/src/lib/siteAnswer";
import type { JobCardAnswerRobot, JobCardAnswerSummary } from "../../client/src/types/taskBrowse";
import { isJobCardAnswerStatementVersion } from "../../client/src/lib/jobCardAnswerConsent";
import { testHeadline, testResultOf, type SimulationProof } from "../../client/src/lib/simulationProof";
import { TIGHT_FIT_SENTENCE } from "../../client/src/lib/siteAnswer";
import { logger } from "../logger";

/**
 * The site chose, under the statement that names the answer, to share it with the card, and the card is
 * still listed under that statement. Both must hold: the request records the choice, and the listing's
 * CURRENT consent records what the card shares now. When the site later re-saves its card under the older
 * box ("Manage opportunity sharing"), the card's consent no longer names the answer and it stops carrying it.
 */
export function jobCardAnswerShared(record: unknown): boolean {
  const stored = record as { introduction_request?: Record<string, unknown>; public_task_listing?: Record<string, unknown> } | null | undefined;
  const intro = stored?.introduction_request;
  const listing = stored?.public_task_listing;
  return Boolean(intro) && typeof intro!.requested_at_iso === "string" && Boolean(intro!.requested_at_iso)
    && isJobCardAnswerStatementVersion(intro!.statement_version)
    && Boolean(listing) && isJobCardAnswerStatementVersion(listing!.consentVersion);
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
export function projectJobCardAnswer(answer: SiteAnswer | null, simulation: string | null = null,
  proof: SimulationProof | null = null): JobCardAnswerSummary | null {
  if (!answer || (answer.state !== "ready" && answer.state !== "cannot_assess")) return null;
  const firstReason = answer.confidence.reasons[0];
  // The card carries the headline the site sees: the simulation test's result when there is one, else the paper check.
  const result = answer.state === "ready" ? testResultOf(proof) : null;
  const test: JobCardAnswerSummary["test"] = result ? {
    kind: result.kind, wording: result.kind === "winner" ? result.wording : null,
    entered: result.kind === "testing" ? result.entered : proof!.options.entered,
    setupFlag: result.kind === "testing" ? false : result.setupFlag,
    options: proof!.options.options.map(option => ({ label: option.label, maker: option.maker, succeeded: option.succeeded,
      scored: option.scored, furthestText: option.furthestText })),
  } : null;
  const headline = testHeadline(result);
  return {
    headline: aboutTheSite(headline ?? answer.headline),
    test,
    familyLabel: answer.job.familyLabel,
    // Sizes, weights and distances only: a figure with its unit, never words about the site.
    facts: answer.facts.filter(fact => /\d/.test(fact.display) && fact.display.length <= 60)
      .map(({ label, display, basis }) => ({ label, display, basis })),
    pick: robotOf(answer.pick),
    runnerUp: robotOf(answer.runnerUp),
    confidence: { level: answer.confidence.level, reason: firstReason ? aboutTheSite(firstReason) : null },
    unknowns: answer.unknowns.map(line => line.startsWith(OTHER_OBJECTS) ? "How many different objects the job handles." : line)
      .map(aboutTheSite),
    simulation: simulation && !result ? aboutTheSite(simulation) : null,
    note: aboutTheSite(answer.note),
  };
}

/** The headline alone, for the browse list. */
export async function loadJobCardAnswerHeadline(id: string, record: unknown): Promise<string | null> {
  // The library's line is the card's own headline, the test result when there is one.
  return (await loadJobCardAnswer(id, record))?.headline ?? null;
}

/**
 * The card's answer with one line from the simulation, when the site's
 * evaluation summary has one. Null without the site's choice or on any failure.
 */
export async function loadJobCardAnswer(id: string, record: unknown): Promise<JobCardAnswerSummary | null> {
  if (!jobCardAnswerShared(record)) return null;
  try {
    const { loadSiteAnswer } = await import("./siteAnswer");
    const answer = await loadSiteAnswer(id);
    if (!answer) return null;
    let simulation: string | null = null;
    let proof: SimulationProof | null = null;
    try {
      const [{ readSiteManagedEvidence }, { projectSimulationProof }] = await Promise.all([
        import("./siteManagedEvidence"), import("../../client/src/lib/simulationProof")]);
      const { managedEvidence } = await readSiteManagedEvidence(id);
      proof = projectSimulationProof({ evaluation: managedEvidence as never, pick: answer.pick });
      simulation = proof.state === "not_started" ? null : proof.headline;
    } catch (error) {
      logger.warn({ error, requestId: id }, "Could not read the simulation line for a job card");
    }
    return projectJobCardAnswer(answer, simulation, proof);
  } catch (error) {
    logger.warn({ error, requestId: id }, "Could not compose the answer for a job card");
    return null;
  }
}
