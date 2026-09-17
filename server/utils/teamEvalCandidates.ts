/**
 * Every site on the platform, turned into "should this team run here".
 *
 * ## The inversion this implements
 *
 * `runSiteMatch` asks: a site arrived, which teams clear it? That question can
 * only be asked when a site arrives, which is why a robot team used to submit
 * its intake and then wait indefinitely for one to show up. That wait was the
 * single largest latency in the robot-team journey and it was pure inventory
 * mismatch — we already hold a library of reconstructed scenes.
 *
 * This module asks the question the other way round: a team has a checkpoint,
 * which of the sites we already have would teach them something? Same matcher,
 * same registry, opposite direction. A team that registers a checkpoint at noon
 * can have results by the evening without anybody else doing anything.
 *
 * ## Only real sites
 *
 * Candidates come from requests that actually cleared the screen and have a
 * reconstructed scene behind them. A site that failed its gates is not an
 * evaluation opportunity, and a site with no scene is not runnable — selling
 * either would be selling fake supply, which this repo forbids by name.
 */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { matchRobotTeam } from "../../client/src/lib/robotMatch";
import { getRobotTeam, toMatchCandidate } from "./robotTeamRegistry";
import { toSiteRequirement } from "./siteMatchRun";
import type { EvalCandidate } from "./evalSelection";
import type { InboundRequest } from "../types/inbound-request";
import { screeningRound, episodeRate } from "../../client/src/lib/episodePricing";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";

/**
 * What one screening run costs at the published rate.
 *
 * Read from `episodePricing` rather than restated, so the number an agent is
 * quoted and the number on the pricing page cannot drift apart.
 */
export function screeningRunCostUsd(): number {
  return Math.round(screeningRound.episodes * episodeRate * 100) / 100;
}

/**
 * How many episodes that quote buys.
 *
 * Recorded on the run alongside the price so a run that executed half its
 * episodes can be billed for half. Without it the only honest options are
 * charging the whole quote for partial work or giving partial work away, and
 * both are worse than arithmetic.
 */
export function screeningRunEpisodes(): number {
  return screeningRound.episodes;
}

/**
 * Whether a site has a scene a robot team could actually run in.
 *
 * The docstring below used to say "screened and reconstructed" and the function
 * only checked the first. So a qualified site with no scene was offered as
 * runnable supply, and a team could buy an evaluation against an environment
 * that did not exist.
 */
function hasBuiltScene(request: InboundRequest): boolean {
  return Boolean(request.pipeline?.artifacts?.worldlabs_world_manifest_uri);
}

/**
 * Requests that are real, screened, confirmed and reconstructed — the runnable
 * supply.
 *
 * ## Three conditions, and each one used to be missing or wrong
 *
 * `disposition === "qualified"` was the only filter. It is still necessary and
 * it was never sufficient:
 *
 * - **A scene has to exist.** Claimed in the old comment, never checked.
 * - **The operator has to have confirmed the brief.** Otherwise the gates are
 *   our reading of their evidence rather than their answers, and a verdict
 *   standing on our own reading is not a verdict. This is also what keeps text
 *   intake from inflating the catalogue: a description can start an assessment
 *   and can never, by itself, produce supply.
 * - **Every binding gate has to be answered**, which `qualified` already
 *   implies, and `assessReadiness` re-checks because this is the last place
 *   before a team is quoted a price for it.
 *
 * The disposition stays the indexed query and the rest is filtered in memory:
 * the query is already capped, and a three-field composite index for a check
 * that runs on at most 500 documents buys nothing.
 */
async function loadRunnableSites(limit: number): Promise<InboundRequest[]> {
  if (!db) return [];

  const snapshot = await db
    .collection("inboundRequests")
    .where("site_task_triage.disposition", "==", "qualified")
    .limit(Math.max(1, Math.min(limit, 500)))
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as InboundRequest)
    // A robot team's own submission is not a site to evaluate against.
    .filter((request) => request.request?.buyerType !== "robot_team")
    .filter((request) => {
      const readiness = assessReadiness({
        answers: (request.request?.siteTaskGates as Record<string, string> | null) ?? {},
        captureMode: request.request?.capture_mode ?? null,
        briefDrafted: true,
        briefConfirmed: Boolean(request.site_task_brief_confirmed_at),
        evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
        reconstructed: hasBuiltScene(request),
      });
      return readiness.isSupply;
    });
}

/**
 * Which task families this team already has results for.
 *
 * Feeds the novelty term in `evalSelection`: the fifteenth tote-to-pallet
 * warehouse teaches less than the first cold-storage room, whatever it scores.
 */
async function loadEvaluatedFamilies(teamId: string, checkpointId: string): Promise<{
  families: string[];
  scenesRun: Set<string>;
}> {
  if (!db) return { families: [], scenesRun: new Set() };

  const snapshot = await db
    .collection("evaluationRuns")
    .where("teamId", "==", teamId)
    .limit(500)
    .get();

  const families = new Set<string>();
  const scenesRun = new Set<string>();

  for (const doc of snapshot.docs) {
    const run = doc.data() as {
      taskFamily?: string | null;
      sceneId?: string | null;
      checkpointId?: string | null;
    };
    if (run.taskFamily) families.add(run.taskFamily);
    // Only this checkpoint's runs make a scene "already answered". A new
    // checkpoint against the same scene is a different question.
    if (run.sceneId && run.checkpointId === checkpointId) scenesRun.add(run.sceneId);
  }

  return { families: [...families], scenesRun };
}

/**
 * Build the candidate list for one team and checkpoint.
 *
 * Returns every runnable site with the match already computed, so the ranking
 * in `evalSelection` is a sort over facts rather than a second round of
 * matching.
 */
export async function buildTeamEvalCandidates(params: {
  teamId: string;
  checkpointId: string;
  limit?: number;
}): Promise<EvalCandidate[]> {
  const team = await getRobotTeam(params.teamId);
  if (!team) return [];

  const [sites, history] = await Promise.all([
    loadRunnableSites(params.limit ?? 200),
    loadEvaluatedFamilies(params.teamId, params.checkpointId),
  ]);

  const candidate = toMatchCandidate(team);
  const costUsd = screeningRunCostUsd();

  return sites.map((request) => {
    const match = matchRobotTeam(toSiteRequirement(request), candidate);
    const sceneId = request.requestId;
    const taskFamily =
      (request.request?.siteTaskSpec as Record<string, string> | null | undefined)?.taskFamily
      ?? null;

    return {
      sceneId,
      // The site's own name is not given to a robot team here. A team browsing
      // the catalogue is not yet a party to anything, and naming customers to
      // an unconfirmed counterparty would leak the relationship.
      siteLabel: request.request?.targetSiteType || "Site",
      match: {
        outcome: match.outcome,
        score: match.score,
        scored: match.scored,
        unknownHardConstraints: match.unknownHardConstraints,
      },
      costUsd,
      taskFamily,
      alreadyEvaluatedFamilies: history.families,
      alreadyRunForCheckpoint: history.scenesRun.has(sceneId),
    };
  });
}
