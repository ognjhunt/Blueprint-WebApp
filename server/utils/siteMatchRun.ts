/**
 * Running a screened site task against the registry.
 *
 * ## Only for a site that cleared the screen
 *
 * Matching a blocked site is work with no consumer: the reply it gets names the
 * failed condition and does not mention teams, and running the matcher anyway
 * would put a list of candidates on a record that must not imply one. So this
 * returns null for anything but `qualified`.
 *
 * ## Quotable figures only
 *
 * Candidates are built with `toMatchCandidate`, which strips every field graded
 * `inferred` before the matcher sees it. A team whose payload we only guessed
 * at therefore reads as `provisional` rather than as a confirmed match, and
 * cannot be counted in an email. That is the whole provenance rule expressed in
 * one call, and it is why the email can say "clears" and mean it.
 */
import {
  matchRobotTeam,
  summariseMatches,
  type MatchSummary,
  type SiteRequirement,
} from "../../client/src/lib/robotMatch";
import { logger } from "../logger";
import type { InboundRequest } from "../types/inbound-request";
import { listMatchableRobotTeams, toMatchCandidate } from "./robotTeamRegistry";

/** A compact, storable record of a match run, for a reviewer and for the email. */
export interface SiteMatchSummaryRecord {
  matchedCount: number;
  provisionalCount: number;
  ruledOutCount: number;
  matchedTeamIds: string[];
  provisionalTeamIds: string[];
  commonBlockers: { scaleId: string; label: string; count: number }[];
  evaluatedAt: string;
}

export function toSiteRequirement(request: InboundRequest): SiteRequirement {
  return {
    spec: (request.request.siteTaskSpec || {}) as Record<string, string>,
    serviceArea: request.request.siteTaskGates?.serviceArea ?? null,
    // The site intake has no task-family dropdown, only prose, so this stays
    // null rather than being inferred. `compareTaskFamily` treats it as unknown
    // and ranks on it only when both sides have actually answered.
    taskFamily: null,
  };
}

export function summariseForStorage(summary: MatchSummary): SiteMatchSummaryRecord {
  return {
    matchedCount: summary.matched.length,
    provisionalCount: summary.provisional.length,
    ruledOutCount: summary.ruledOut.length,
    matchedTeamIds: summary.matched.map((result) => result.robotTeamId),
    provisionalTeamIds: summary.provisional.map((result) => result.robotTeamId),
    commonBlockers: [...summary.commonBlockers],
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Match one screened request against every team we would put in front of a site.
 *
 * Returns null when there is nothing to match — a site that did not clear the
 * screen, or an empty registry. An empty registry deliberately does not produce
 * a "nobody matched" result: that sentence would be true and useless, and it
 * would read to a site as a judgement about their task rather than about our
 * list being empty.
 */
export async function runSiteMatch(
  request: InboundRequest,
): Promise<MatchSummary | null> {
  if (request.site_task_triage?.disposition !== "qualified") return null;

  const teams = await listMatchableRobotTeams();
  if (!teams.length) {
    logger.info(
      { requestId: request.requestId },
      "Site cleared the screen but the robot-team registry is empty; no match run",
    );
    return null;
  }

  const site = toSiteRequirement(request);
  const results = teams.map((team) => matchRobotTeam(site, toMatchCandidate(team)));
  const summary = summariseMatches(results);

  logger.info(
    {
      requestId: request.requestId,
      matched: summary.matched.length,
      provisional: summary.provisional.length,
      ruledOut: summary.ruledOut.length,
    },
    "Site match run completed",
  );

  return summary;
}
