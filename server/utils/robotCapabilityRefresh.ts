/**
 * Trigger 3: a scheduled refresh that proposes and never writes.
 *
 * ## What it is for
 *
 * Most teams in the registry will be prospects — companies we researched, who
 * have told us nothing. Their capability fields are unknown, which is honest
 * and also means they can never be counted as a match. This loop reads their
 * public material and proposes values, so that a person reviewing a queue can
 * turn an unknown into a known in seconds rather than doing the reading
 * themselves.
 *
 * ## Why it targets unknowns rather than everything
 *
 * Re-reading a team whose fields are already known and well-graded produces
 * proposals a reviewer has to decline, which is worse than useless: it trains
 * whoever is reviewing to click through. So the loop picks teams with unknown
 * or weakly-graded hard constraints — precisely the fields that decide whether
 * a team can be matched at all — and leaves the rest alone.
 *
 * ## Nothing here writes to the registry
 *
 * Output goes to `robotTeamCapabilityProposals` with status `pending`. The only
 * path into the registry is `applyProposal`, which takes a reviewer id. An
 * inferred figure that auto-applied would be indistinguishable from a fact
 * inside a week.
 */
import {
  robotSpecFields,
  robotGateFields,
} from "../../client/src/data/robotTeamQualification";
import { runAgentTask } from "../agents/runtime";
import type {
  RobotCapabilityExtractionInput,
  RobotCapabilityExtractionOutput,
} from "../agents/tasks/robot-capability-extraction";
import { EXTRACTABLE_FIELDS } from "../agents/tasks/robot-capability-extraction";
import { isEnvFlagEnabled } from "../config/env";
import { logger } from "../logger";
import type {
  CapabilityProposal,
  RobotCapabilityField,
  RobotTeamRecord,
} from "../types/robot-team-registry";
import { fetchPublicText, toReadableText, PublicFetchError } from "./publicFetchGuard";
import {
  listMatchableRobotTeams,
  saveCapabilityProposals,
} from "./robotTeamRegistry";

/** The fields that decide whether a team can be matched at all. */
const HARD_FIELDS: RobotCapabilityField[] = [
  "payloadCapacity",
  "humanProximity",
  "budgetBand",
  "deploymentGeography",
];

/**
 * The allowed values per field, read off the intake definitions.
 *
 * Handing these to the model is what stops a proposal inventing a band. A value
 * outside this list is rejected on the way back in, so the worst a confused
 * model can do is produce nothing.
 */
export function buildAllowedValues(): Record<string, string[]> {
  const allowed: Record<string, string[]> = {};
  for (const field of robotSpecFields) {
    allowed[field.id] = field.options.map((option) => option.value);
  }
  for (const field of robotGateFields) {
    allowed[field.id] = field.options.map((option) => option.value);
  }
  return allowed;
}

export function needsRefresh(team: RobotTeamRecord): boolean {
  return HARD_FIELDS.some((field) => {
    const provenance = team.fieldProvenance[field];
    // Unknown, or known only because a model guessed last time.
    return !team.capability[field] || !provenance || provenance.grade === "inferred";
  });
}

/**
 * Drop anything the model proposed that is not a legal value for its field.
 *
 * A near-miss band is a wrong answer, not a close one: `"12kg"` is not
 * `"ten_to_twentyfive"`, and letting it through would put a value in the
 * registry that no comparison can read.
 */
export function validateProposals(
  output: RobotCapabilityExtractionOutput,
  allowed: Record<string, string[]>,
  team: RobotTeamRecord,
  runId: string,
): Omit<CapabilityProposal, "id" | "status" | "proposedAt">[] {
  const valid: Omit<CapabilityProposal, "id" | "status" | "proposedAt">[] = [];

  for (const proposal of output.proposals) {
    const options = allowed[proposal.field];
    if (!options || !options.includes(proposal.value)) {
      logger.warn(
        { robotTeamId: team.id, field: proposal.field, value: proposal.value },
        "Discarded a capability proposal with a value outside the field's enum",
      );
      continue;
    }

    const current = team.capability[proposal.field as RobotCapabilityField];
    // Proposing what is already there wastes a reviewer's attention.
    if (current === proposal.value) continue;

    valid.push({
      robotTeamId: team.id,
      field: proposal.field as RobotCapabilityField,
      currentValue: (current as string | number | null) ?? null,
      proposedValue: proposal.value,
      grade: proposal.grade,
      // The quote travels with the source so a reviewer can check the claim
      // without opening the page.
      source: `${proposal.source} — "${proposal.quote}"`,
      rationale: proposal.rationale,
      confidence: proposal.confidence,
      proposedBy: `robot_capability_extraction:${runId}`,
    });
  }

  return valid;
}

async function gatherSources(team: RobotTeamRecord) {
  if (!team.website) return [];
  try {
    const page = await fetchPublicText(team.website);
    return [{ url: page.url, title: team.name, text: toReadableText(page.text) }];
  } catch (error) {
    const code = error instanceof PublicFetchError ? error.code : "fetch_failed";
    logger.info(
      { robotTeamId: team.id, code },
      "Could not read a robot team's public page for capability refresh",
    );
    return [];
  }
}

export async function runRobotCapabilityRefreshLoop(params?: { limit?: number }) {
  if (!isEnvFlagEnabled("BLUEPRINT_ROBOT_CAPABILITY_REFRESH_ENABLED")) {
    return { processedCount: 0, failedCount: 0, reason: "lane_disabled" };
  }

  const limit = Math.max(1, Math.min(params?.limit ?? 5, 25));
  const teams = (await listMatchableRobotTeams({ limit: 200 }))
    .filter((team) => Boolean(team.website))
    .filter(needsRefresh)
    .slice(0, limit);

  const allowed = buildAllowedValues();
  let processedCount = 0;
  let failedCount = 0;
  let proposedCount = 0;

  for (const team of teams) {
    try {
      const sources = await gatherSources(team);
      if (!sources.length) continue;

      const input: RobotCapabilityExtractionInput = {
        robotTeamId: team.id,
        teamName: team.name,
        currentCapability: team.capability as Record<string, string | number | null>,
        sources,
        allowedValues: Object.fromEntries(
          EXTRACTABLE_FIELDS.map((field) => [field, allowed[field] ?? []]).filter(
            ([, options]) => (options as string[]).length,
          ),
        ),
      };

      const result = await runAgentTask<
        RobotCapabilityExtractionInput,
        RobotCapabilityExtractionOutput
      >({
        kind: "robot_capability_extraction",
        input,
        session_key: `robot-capability:${team.id}`,
        metadata: { robot_team_id: team.id },
      });

      if (result.status !== "completed" || !result.output) {
        failedCount += 1;
        continue;
      }

      const proposals = validateProposals(
        result.output,
        allowed,
        team,
        `${team.id}:${Date.now()}`,
      );
      proposedCount += await saveCapabilityProposals(proposals);
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      logger.warn(
        { err: error, robotTeamId: team.id },
        "Robot capability refresh failed for a team",
      );
    }
  }

  logger.info(
    { processedCount, failedCount, proposedCount },
    "Robot capability refresh loop completed",
  );
  return { processedCount, failedCount };
}
