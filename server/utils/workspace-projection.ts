import { createHash } from "node:crypto";
import type {
  TaskTerms,
  WorkspaceResult,
  WorkspaceTask,
} from "../../client/src/types/workspace";
import { teamJobAccess } from "./teamJobAccess";
import { hasQualifiedSimulationEvidence, type RunResultScoring } from "./runResultScoring";
import type { EpisodeOutcome } from "./agentRunResults";
import { sitePilotIntentFrom, siteVisitOptions } from "../../client/src/data/sitePilotIntent";

export function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function iso(value: unknown): string | null {
  if (typeof value === "string" && Number.isFinite(Date.parse(value)))
    return new Date(value).toISOString();
  if (value && typeof (value as any).toDate === "function")
    return (value as any).toDate().toISOString();
  return null;
}
export function teamAlias(taskId: string, uid: string): string {
  return `Team ${createHash("sha256").update(`${taskId}:${uid}`).digest("hex").slice(0, 8).toUpperCase()}`;
}
export function termsFor(record: Record<string, any>): TaskTerms {
  const terms = object(object(record.workspace_task).terms);
  return {
    successRate: number(terms.successRate),
    cycleTimeSeconds: number(terms.cycleTimeSeconds),
    pilotBudgetUsd: number(terms.pilotBudgetUsd),
    deploymentBudgetUsd: number(terms.deploymentBudgetUsd),
    targetDate: iso(terms.targetDate),
    successDefinition:
      text(terms.successDefinition) ||
      text(object(record.request).taskDescription),
  };
}
export function targetsMet(
  result: Pick<WorkspaceResult, "successRate" | "cycleTimeSeconds">,
  terms: TaskTerms,
): boolean | null {
  const checks: boolean[] = [];
  if (terms.successRate !== null) {
    if (result.successRate === null) return null;
    checks.push(result.successRate >= terms.successRate);
  }
  if (terms.cycleTimeSeconds !== null) {
    if (result.cycleTimeSeconds === null) return null;
    checks.push(result.cycleTimeSeconds <= terms.cycleTimeSeconds);
  }
  return checks.length ? checks.every(Boolean) : null;
}
// Whitelist metrics only. Never return another team's checkpoint, endpoint, name,
// email, raw artifact URLs, or private candidate configuration to a site.
export function projectWorkspaceResult(
  id: string,
  run: Record<string, any>,
  taskId: string,
  _terms: TaskTerms,
): WorkspaceResult {
  const benchmark = object(
    run.benchmark_projection ||
      object(run.pipeline_result).benchmark_projection,
  );
  const aggregates = Array.isArray(benchmark.policy_aggregates)
    ? benchmark.policy_aggregates
    : [];
  const metrics =
    benchmark.status === "complete" &&
    aggregates.length === 1 &&
    ["decided", "decision_available", "completed", "complete"].includes(
      text(run.status),
    )
      ? object(aggregates[0].metrics)
      : {};
  const success = number(object(metrics.full_task_success).estimate);
  const sampleCount = number(object(metrics.full_task_success).sample_count);
  const hasSamples =
    sampleCount !== null && sampleCount > 0 && Number.isInteger(sampleCount);
  // Efficiency is not cycle time. Only a separately named duration in seconds is admissible.
  const duration = object(object(run.pipeline_result).cycle_time_seconds);
  const cycle = duration.unit === "seconds" ? number(duration.estimate) : null;
  const result: WorkspaceResult = {
    id,
    teamAlias: teamAlias(taskId, text(run.buyer_user_id) || id),
    status: text(run.status) || "requested",
    successRate:
      hasSamples && success !== null && success >= 0 && success <= 1
        ? success * 100
        : null,
    cycleTimeSeconds: hasSamples && cycle !== null && cycle >= 0 ? cycle : null,
    sampleCount,
    evidenceLabel:
      object(benchmark.environment_summary).physics_authority === "real_robot"
        ? "Physical trial"
        : "Simulation",
    targetsMet: null,
    selected: false,
  };
  // Legacy benchmark metrics have no bound scene-qualification and scored-cell
  // contract. Retain observations without turning them into a site pass claim.
  return result;
}
export function projectWorkspaceTask(
  id: string,
  record: Record<string, any>,
): WorkspaceTask {
  const request = object(record.request),
    workspace = object(record.workspace_task),
    pilot = object(workspace.pilot);
  const match = object(record.site_match);
  // "Open for evaluations" means exactly what approved robot teams see: the
  // job library offers an evaluation and the opening page accepts a request.
  // Without a published card no team can see the job, so it reads "Private"
  // rather than an "In review" that never ends.
  const access = teamJobAccess(record);
  const published = access.evaluationAvailable;
  return {
    id,
    recordingPermissionWithdrawn: record.consent_revoked === true,
    recordingWithdrawalStatus: text(object(record.capture_withdrawal).state) || null,
    title: text(request.taskStatement) || "Untitled job",
    siteName: text(request.siteName) || "Your site",
    location: text(request.siteLocation),
    siteType: text(request.targetSiteType),
    status: workspace.archived
      ? "Closed"
      : pilot.state === "deployed"
        ? "Deployed"
        : pilot.state === "pilot_complete"
          ? "Pilot complete"
          : pilot.state === "pilot"
            ? "Pilot underway"
            : pilot.selectedResultId
              ? pilot.state === "invited"
                ? "Pilot invited"
                : "Pilot selected"
              : published
                ? "Open for evaluations"
                : access.reason === "not_listed"
                  ? "Private"
                  : "In review",
    nextStep: text(object(record.ops).next_step) || null,
    terms: termsFor(record),
    pilotIntent: sitePilotIntentFrom(workspace.pilotIntent),
    // The site's own choice on the start form: an anonymized card for
    // approved robot teams, or a private job.
    visibility:
      object(record.public_task_listing).enabled === true
        ? "anonymized"
        : "private",
    published,
    archived: workspace.archived === true,
    paused: workspace.paused === true,
    captureMode: request.capture_mode === "self_capture" || request.capture_mode === "site_visit"
      ? request.capture_mode
      : null,
    listing: {
      approved: object(record.public_task_listing).enabled === true,
      live:
        object(record.public_task_listing).enabled === true &&
        workspace.paused !== true &&
        workspace.archived !== true,
    },
    // Only teams that agreed, on record, to evaluate and pilot. The fit-only
    // `matchedCount` counts researched prospects and is never a site's number;
    // an older record without the supply count reads as unknown.
    potentialMatches: number(match.supplyMatchedCount),
    capture: null,
    results: [],
    pilot: {
      state: text(pilot.state) || "not_selected",
      selectedResultId: text(pilot.selectedResultId) || null,
      notes: text(pilot.notes) || null,
      siteVisitAnswer: siteVisitOptions.find((option) => option.value === pilot.siteVisitAnswer)?.value ?? null,
    },
    createdAt: iso(record.createdAt),
  };
}

/** The fields of an agent evaluation run this projection reads. Whitelist. */
export interface AgentRunForSite {
  runId: string;
  teamId: string;
  state: string;
  /** Beta L5: marks a team evaluation, from admission on. */
  teamEvaluationPurpose?: "scored";
  quotedEpisodes?: number;
  executionCaptureId?: string;
  executionAdmission?: { envelope: Record<string, unknown> };
  result?: {
    evidenceScope?: "development_only" | "simulation";
    /** Who scored the episodes; without an admitted statement, targets are never "met". */
    scoring?: RunResultScoring;
    /** A team evaluation's mark and per-episode outcomes, shown to the team that ran it. */
    evaluationPurpose?: "scored";
    episodeOutcomes?: EpisodeOutcome[];
    observed: {
      episodesRun: number;
      episodesSucceeded: number;
      successRate: number | null;
      medianCycleSeconds: number | null;
    };
  } | null;
}

/**
 * An agent run as a row in the site's results table.
 *
 * Same whitelist rule as `projectWorkspaceResult`: the site sees an alias, the
 * observed numbers, and the evidence label. Never the team's name, checkpoint
 * or reference. A queued run is shown as queued rather than hidden, because a
 * site that can see it is being screened is the point of the row.
 */
export function projectAgentRunResult(
  run: AgentRunForSite,
  taskId: string,
  terms: TaskTerms,
): WorkspaceResult {
  const observed = run.result?.observed ?? null;
  const hasSamples = Boolean(observed && observed.episodesRun > 0);
  const status = hasSamples
    ? "completed"
    : run.state === "blocked"
      ? "blocked"
      : run.state === "completed"
        ? "no_result"
        : run.state || "requested";
  const result: WorkspaceResult = {
    id: run.runId,
    teamAlias: teamAlias(taskId, run.teamId),
    status,
    successRate:
      hasSamples && Number.isInteger(observed!.episodesSucceeded) && observed!.episodesSucceeded >= 0
        && observed!.episodesSucceeded <= observed!.episodesRun
        ? observed!.episodesSucceeded / observed!.episodesRun * 100
        : null,
    cycleTimeSeconds:
      hasSamples && observed!.medianCycleSeconds !== null && Number.isFinite(observed!.medianCycleSeconds) && observed!.medianCycleSeconds > 0
        ? observed!.medianCycleSeconds
        : null,
    sampleCount: hasSamples ? observed!.episodesRun : null,
    evidenceLabel: run.result?.evidenceScope === "development_only" ? "Development simulation" : "Simulation",
    targetsMet: null,
    selected: false,
  };
  // A pass label uses the same scene qualification and complete episode
  // accounting as registry promotion; diagnostic observations remain visible.
  result.targetsMet = hasQualifiedSimulationEvidence(run) ? targetsMet(result, terms) : null;
  return result;
}
