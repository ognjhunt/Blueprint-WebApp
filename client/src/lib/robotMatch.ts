/**
 * Matching a screened site task to robot teams.
 *
 * ## Code decides. No model runs here.
 *
 * Same rule as `gateTriage`, for the same reason and with more at stake. A
 * similarity score cannot tell you a robot lifts the thing; it can only tell
 * you the words rhyme. Embedding "heavy totes" near "high-payload manipulator"
 * and ranking by distance will confidently return a system that cannot lift
 * 18kg, and the failure is silent until somebody is on a call.
 *
 * So the comparison is arithmetic over declared bands. Every outcome names the
 * field, the requirement and the capability — "ruled out on payload: site needs
 * 10–25 kg, team tops out at 2–10 kg" — which is checkable by a reviewer,
 * replayable when a threshold moves, and honest enough to put in an email.
 *
 * ## Hard eliminates, soft ranks
 *
 * Cheapest no first, the same ordering the gates use. Payload, safety envelope
 * and budget remove a team outright; cycle time, throughput, success rate and
 * lighting only order whoever is left. A team that cannot work alongside people
 * at a site where people work alongside it is not a weaker match, it is not a
 * match.
 *
 * ## Unknown is not a pass
 *
 * The whole reason `BandComparison` has three values. A team with no payload
 * figure on record has not cleared the payload constraint — nobody has said
 * anything. Such a team is `provisional`: worth a look, never counted in "three
 * teams clear your payload". Reporting it as cleared is precisely how an
 * automated email ends up making a claim nobody made.
 */
import {
  bandScaleById,
  compareBand,
  type BandComparison,
  type BandScale,
} from "./capabilityBands";

/** Which registry field answers which scale, on each side. */
const SCALE_FIELDS: readonly {
  scaleId: string;
  siteField: string;
  robotField: string;
}[] = [
  { scaleId: "payload", siteField: "payloadWeight", robotField: "payloadCapacity" },
  { scaleId: "humanProximity", siteField: "humanProximity", robotField: "humanProximity" },
  { scaleId: "budget", siteField: "budgetBand", robotField: "budgetBand" },
  { scaleId: "cycleTime", siteField: "cycleTime", robotField: "cycleTime" },
  { scaleId: "volume", siteField: "volume", robotField: "dutyCycle" },
  {
    scaleId: "successRate",
    siteField: "successThreshold",
    robotField: "demonstratedSuccessRate",
  },
  { scaleId: "lighting", siteField: "lighting", robotField: "lighting" },
];

export interface MatchFinding {
  scaleId: string;
  label: string;
  weight: BandScale["weight"];
  comparison: BandComparison;
  /** The site's answer and the team's, as stored. */
  required: string | null;
  capability: string | null;
}

/**
 * `matched` — every hard constraint compared and cleared.
 * `provisional` — nothing ruled it out, but a hard constraint is unknown.
 * `ruled_out` — a hard constraint compared and came up short.
 */
export type MatchOutcome = "matched" | "provisional" | "ruled_out";

export interface MatchResult {
  robotTeamId: string;
  outcome: MatchOutcome;
  /**
   * Only meaningful for `matched` and `provisional`, and only ever used to
   * order them. It is a count of cleared soft constraints, not a probability,
   * and it is deliberately not a decimal that invites being read as one.
   */
  score: number;
  /** How many soft constraints were comparable at all. */
  scored: number;
  findings: readonly MatchFinding[];
  /** The hard constraints that removed this team, in the order checked. */
  ruledOutBy: readonly MatchFinding[];
  /** Hard constraints nobody has answered. Why a match is provisional. */
  unknownHardConstraints: readonly MatchFinding[];
}

export interface SiteRequirement {
  /** `siteTaskSpec` from the inbound request, keyed by spec field id. */
  spec: Readonly<Record<string, string>>;
  /** The metro the site sits in, from the service-area gate. */
  serviceArea?: string | null;
  taskFamily?: string | null;
}

export interface RobotCandidate {
  id: string;
  /**
   * Capability values already filtered to quotable grades by the caller. The
   * matcher never sees an inferred figure for an email-facing run, which is how
   * a model's guess is kept out of a claim.
   */
  capability: Readonly<Record<string, string | number | null | undefined>>;
  deploymentGeography?: string | null;
  taskFamily?: string | null;
}

function valueOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Geography is a hard constraint with its own shape.
 *
 * It is not a band — a team either deploys where the site is or it does not —
 * so it is compared by equality against the site's metro, and an unstated
 * geography is unknown rather than a pass.
 */
function compareGeography(site: SiteRequirement, candidate: RobotCandidate): MatchFinding {
  const required = valueOrNull(site.serviceArea);
  const capability = valueOrNull(candidate.deploymentGeography);
  let comparison: BandComparison = "unknown";
  if (required && capability) {
    comparison = capability === required || capability === "anywhere" ? "clears" : "short";
  }
  return {
    scaleId: "geography",
    label: "deployment geography",
    weight: "hard",
    comparison,
    required,
    capability,
  };
}

/**
 * Task family is the coarsest filter, and deliberately soft.
 *
 * The robot intake calls it "the coarsest filter, applied before any of the
 * bands above", but the site side has no task-family dropdown — it has prose.
 * Until a site answers it structurally, treating a mismatch as elimination
 * would rule teams out on an inference. It ranks instead.
 */
function compareTaskFamily(site: SiteRequirement, candidate: RobotCandidate): MatchFinding {
  const required = valueOrNull(site.taskFamily);
  const capability = valueOrNull(candidate.taskFamily);
  let comparison: BandComparison = "unknown";
  if (required && capability) {
    comparison = capability === required ? "clears" : "short";
  }
  return {
    scaleId: "taskFamily",
    label: "task family",
    weight: "soft",
    comparison,
    required,
    capability,
  };
}

/** Compare one team against one site task. Pure, and the only decision-maker. */
export function matchRobotTeam(
  site: SiteRequirement,
  candidate: RobotCandidate,
): MatchResult {
  const findings: MatchFinding[] = [compareGeography(site, candidate)];

  for (const mapping of SCALE_FIELDS) {
    const scale = bandScaleById[mapping.scaleId];
    if (!scale) continue;
    const required = valueOrNull(site.spec[mapping.siteField]);
    const capability = valueOrNull(candidate.capability[mapping.robotField]);
    findings.push({
      scaleId: scale.id,
      label: scale.label,
      weight: scale.weight,
      comparison: compareBand(scale, required, capability),
      required,
      capability,
    });
  }

  findings.push(compareTaskFamily(site, candidate));

  const hard = findings.filter((finding) => finding.weight === "hard");
  const ruledOutBy = hard.filter((finding) => finding.comparison === "short");
  const unknownHardConstraints = hard.filter((finding) => finding.comparison === "unknown");

  const soft = findings.filter((finding) => finding.weight === "soft");
  const scored = soft.filter((finding) => finding.comparison !== "unknown").length;
  const score = soft.filter((finding) => finding.comparison === "clears").length;

  const outcome: MatchOutcome = ruledOutBy.length
    ? "ruled_out"
    : unknownHardConstraints.length
      ? "provisional"
      : "matched";

  return {
    robotTeamId: candidate.id,
    outcome,
    score,
    scored,
    findings,
    ruledOutBy,
    unknownHardConstraints,
  };
}

/**
 * Rank the survivors.
 *
 * Confirmed matches always sort above provisional ones, however well a
 * provisional team scores: "we checked and it clears" beats "we have no reason
 * to think it does not". Within a tier, more cleared soft constraints first,
 * then more constraints actually compared — a team we know seven things about
 * is a better introduction than one we know two about, at the same score.
 */
export function rankMatches(results: readonly MatchResult[]): MatchResult[] {
  const tier = (outcome: MatchOutcome) => (outcome === "matched" ? 0 : 1);
  return results
    .filter((result) => result.outcome !== "ruled_out")
    .slice()
    .sort((left, right) => {
      if (tier(left.outcome) !== tier(right.outcome)) {
        return tier(left.outcome) - tier(right.outcome);
      }
      if (right.score !== left.score) return right.score - left.score;
      return right.scored - left.scored;
    });
}

export interface MatchSummary {
  /** Teams where every hard constraint was checked and cleared. */
  matched: readonly MatchResult[];
  /** Teams nothing ruled out, but with a hard constraint unanswered. */
  provisional: readonly MatchResult[];
  ruledOut: readonly MatchResult[];
  /**
   * The hard constraints that eliminated the most teams, commonest first. This
   * is what makes a "nobody clears this" reply useful rather than a dead end:
   * it names the thing to change.
   */
  commonBlockers: readonly { scaleId: string; label: string; count: number }[];
}

export function summariseMatches(results: readonly MatchResult[]): MatchSummary {
  const ruledOut = results.filter((result) => result.outcome === "ruled_out");
  const ranked = rankMatches(results);

  const blockerCounts = new Map<string, { scaleId: string; label: string; count: number }>();
  for (const result of ruledOut) {
    for (const finding of result.ruledOutBy) {
      const existing = blockerCounts.get(finding.scaleId);
      if (existing) existing.count += 1;
      else
        blockerCounts.set(finding.scaleId, {
          scaleId: finding.scaleId,
          label: finding.label,
          count: 1,
        });
    }
  }

  return {
    matched: ranked.filter((result) => result.outcome === "matched"),
    provisional: ranked.filter((result) => result.outcome === "provisional"),
    ruledOut,
    commonBlockers: [...blockerCounts.values()].sort((left, right) => right.count - left.count),
  };
}
