/**
 * The robot-team registry.
 *
 * ## Why a registry and not a document
 *
 * Matching a site task to a robot is constraint satisfaction, not similarity. A
 * system either lifts 18kg or it does not, and a prose document an agent
 * re-reads per lead cannot answer that reproducibly: it is unversioned,
 * unqueryable, drifts silently, cannot be tested, and costs more on every lead.
 * The two intakes were built with mirrored enums precisely so the comparison
 * could be mechanical — this is the store that makes it so.
 *
 * ## Provenance is per field, and it is load-bearing
 *
 * Two populations live here with very different trust. A team that applied
 * through `/contact/robot-team` told us their own numbers. A team we want to
 * approach has numbers we read off a press release. `CLAUDE.md` is explicit
 * that third-party deployments are never implied to be Blueprint customers or
 * Blueprint-prepared work, and that every public figure carries a primary
 * source and an evidence grade. A registry that blurs "they told us" with "we
 * inferred" will eventually put a fabricated capability in an outbound email.
 *
 * So every field carries its own source, grade and observation date, and
 * `inferred` never reaches a claim — `matchTrustFloor` in the matcher treats it
 * as unknown for anything the site will read.
 */

/**
 * How a single capability figure came to be known.
 *
 * Ordered by how much weight a claim can carry:
 *
 * - `measured`      — Blueprint ran the evaluation. Beats anything claimed.
 * - `self_reported` — the team's own intake answer. Theirs to stand behind.
 * - `published`     — a primary source we can cite, in the sense `deploymentMarket.ts`
 *                     uses the word: a named document, not a vibe.
 * - `inferred`      — a model's reading of public material. Useful for
 *                     prioritising outreach, never quotable to a site.
 */
export type CapabilityGrade = "measured" | "self_reported" | "published" | "inferred";

/** The grades that may appear in something a site operator reads. */
export const QUOTABLE_GRADES: readonly CapabilityGrade[] = [
  "measured",
  "self_reported",
  "published",
];

export interface FieldProvenance {
  grade: CapabilityGrade;
  /**
   * Where it came from. An intake request id, an evaluation run id, or a URL
   * for published material. Required — a grade without a source is a rumour
   * with a label on it.
   */
  source: string;
  observedAt: string;
  /** Set when a model proposed this value; names the task run that did. */
  proposedBy?: string | null;
}

/**
 * What a team can do, in the same bands the site intake asks about.
 *
 * Every field is nullable and every one means "nobody has told us" when null.
 * The enums are the ones in `client/src/data/robotTeamQualification.ts`; the
 * two numeric fields have no intake question yet and come from evaluation
 * records or published specs.
 */
export interface RobotCapability {
  payloadCapacity?: string | null;
  humanProximity?: string | null;
  cycleTime?: string | null;
  dutyCycle?: string | null;
  demonstratedSuccessRate?: string | null;
  lighting?: string | null;
  budgetBand?: string | null;
  objectHandling?: string | null;
  taskFamily?: string | null;
  embodiment?: string | null;
  /** Physical envelope. Not asked at intake; sourced from specs or a run. */
  reachM?: number | null;
  pathWidthM?: number | null;
  /** Where the team will actually deploy, matched against the site's metro. */
  deploymentGeography?: string | null;
}

export type RobotCapabilityField = keyof RobotCapability;

/**
 * Where a team sits with us.
 *
 * `prospect` is the one to be careful with: it means we researched them and
 * they have not agreed to anything. Nothing about a prospect may be described
 * to a site as a Blueprint relationship.
 */
export type RobotTeamStatus = "applied" | "prospect" | "engaged" | "declined";

export interface RobotTeamRecord {
  id: string;
  name: string;
  /** Present when the team reached us through the robot-team intake. */
  inboundRequestId?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  status: RobotTeamStatus;
  capability: RobotCapability;
  fieldProvenance: Partial<Record<RobotCapabilityField, FieldProvenance>>;
  /** The team's own words, kept for a human rather than for matching. */
  capabilityDescription?: string | null;
  evidenceBar?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A model's proposal to change a field, awaiting review.
 *
 * Nothing here auto-applies. The extraction agent reads public material and
 * writes proposals; a person accepts them. That is the same split the footage
 * reader uses — the model produces evidence, code and people decide — and it
 * is what keeps an inferred number from quietly becoming a claim.
 */
export interface CapabilityProposal {
  id: string;
  robotTeamId: string;
  field: RobotCapabilityField;
  /** What the registry holds now, so a reviewer sees the change, not the claim. */
  currentValue: string | number | null;
  proposedValue: string | number | null;
  grade: CapabilityGrade;
  source: string;
  /** The model's reasoning, for the reviewer. Never shown to a site. */
  rationale: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  proposedBy: string;
  proposedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export const ROBOT_TEAMS_COLLECTION = "robotTeams";
export const CAPABILITY_PROPOSALS_COLLECTION = "robotTeamCapabilityProposals";
