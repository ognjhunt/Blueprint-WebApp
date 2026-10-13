/**
 * Raw records for one site job, reduced to the facts the job console shows.
 *
 * Pure: every read happens in `jobConsoleData.ts`, and this module only
 * interprets what it was handed. Missing fields read as unknown or absent,
 * never as a state nobody recorded.
 */
import { projectPilotCoordination } from "./pilotCoordination";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { iso, object, targetsMet, termsFor, text } from "./workspace-projection";
import type {
  BestRunSummary,
  BookingState,
  BriefState,
  CaptureState,
  JobFacts,
  ListingState,
  PendingAdmission,
  ProjectedRun,
  RecommendationState,
  RunOutcome,
  TimelineEntry,
  WithdrawalState,
} from "./jobConsoleStage";

export interface RawEvaluationRequest {
  id: string;
  record: Record<string, any>;
  /** Resolved from the requesting account's robot team, when one is bound. */
  teamName: string | null;
}

export interface RawRun {
  runId: string;
  teamId: string;
  state: string;
  evaluationPurpose?: string;
  requestedAtIso?: string | null;
  resolvedAtIso?: string | null;
  dispatch?: { startedAtIso?: string | null } | null;
  result?: {
    evidenceScope?: string;
    reportedAtIso?: string;
    observed?: {
      episodesRun?: number;
      episodesSucceeded?: number;
      successRate?: number | null;
      medianCycleSeconds?: number | null;
    };
  } | null;
}

export interface RawJobInputs {
  requestId: string;
  /** The stored request. Encrypted fields are not read from here. */
  record: Record<string, any>;
  /** Decrypted for the admin; null when decryption failed. */
  site: { siteName: string; siteLocation: string; company: string } | null;
  brief: Record<string, any> | null;
  /** `captureUploadSessions/walkthrough-<requestId>`, when it exists. */
  captureSession: Record<string, any> | null;
  evaluationRequests: RawEvaluationRequest[];
  runs: RawRun[];
  teamNames: ReadonlyMap<string, string>;
}


function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Site targets: the workspace terms, else the confirmed brief's success criteria. */
export function siteTargets(record: Record<string, any>, brief: Record<string, any> | null) {
  const terms = termsFor(record);
  const criteria = object(brief?.successCriteria);
  return {
    ...terms,
    successRate: terms.successRate ?? finite(criteria.successRate),
    cycleTimeSeconds: terms.cycleTimeSeconds ?? finite(criteria.cycleTimeSeconds),
  };
}

/** Site evaluations only: private team runs never belong to a site job. */
function isSiteRun(run: RawRun) {
  return run.evaluationPurpose === undefined || run.evaluationPurpose === "pilot";
}

export function projectRuns(inputs: Pick<RawJobInputs, "record" | "brief" | "runs" | "teamNames">): ProjectedRun[] {
  const terms = siteTargets(inputs.record, inputs.brief);
  return inputs.runs
    .filter((run) => isSiteRun(run) && ["requested", "completed", "blocked"].includes(run.state))
    .map((run) => {
      const observed = run.result?.observed;
      const episodesRun = finite(observed?.episodesRun);
      const hasSamples = episodesRun !== null && episodesRun > 0;
      const outcome: RunOutcome = hasSamples
        ? "reported"
        : run.state === "completed" || run.state === "blocked"
          ? "no_result"
          : run.dispatch?.startedAtIso ? "running" : "queued";
      const rate = hasSamples ? finite(observed?.successRate) : null;
      const successRatePct = rate === null ? null : Math.round(rate * 10000) / 100;
      const cycle = hasSamples ? finite(observed?.medianCycleSeconds) : null;
      const medianCycleSeconds = cycle !== null && cycle >= 0 ? cycle : null;
      return {
        runId: run.runId,
        teamId: run.teamId,
        teamName: inputs.teamNames.get(run.teamId) ?? null,
        outcome,
        episodesRun: hasSamples ? episodesRun : null,
        episodesSucceeded: hasSamples ? finite(observed?.episodesSucceeded) : null,
        successRatePct,
        medianCycleSeconds,
        meetsTarget: hasSamples ? targetsMet({ successRate: successRatePct, cycleTimeSeconds: medianCycleSeconds }, terms) : null,
        evidenceScope: typeof run.result?.evidenceScope === "string" ? run.result.evidenceScope : null,
        requestedAtIso: run.requestedAtIso ?? null,
        reportedAtIso: run.result?.reportedAtIso ?? run.resolvedAtIso ?? null,
      };
    })
    .sort((a, b) => (a.requestedAtIso || "").localeCompare(b.requestedAtIso || ""));
}

function bestRun(runs: ProjectedRun[]): BestRunSummary | null {
  const rank = (run: ProjectedRun) => (run.meetsTarget === true ? 2 : run.meetsTarget === null ? 1 : 0);
  const best = runs
    .filter((run) => run.outcome === "reported")
    .sort((a, b) => rank(b) - rank(a)
      || (b.successRatePct ?? -1) - (a.successRatePct ?? -1)
      || (b.episodesRun ?? 0) - (a.episodesRun ?? 0))[0];
  return best ? {
    runId: best.runId, teamId: best.teamId, teamName: best.teamName,
    episodesRun: best.episodesRun ?? 0, episodesSucceeded: best.episodesSucceeded ?? 0,
    successRatePct: best.successRatePct, medianCycleSeconds: best.medianCycleSeconds,
    meetsTarget: best.meetsTarget,
  } : null;
}

export function briefStateOf(record: Record<string, any>, brief: Record<string, any> | null): BriefState {
  if (record.briefReviewPending === true) return "review_pending";
  if (!brief) return "none";
  return brief.confirmedAtIso || record.site_task_brief_confirmed_at ? "confirmed" : "draft";
}

export function captureStateOf(record: Record<string, any>, session: Record<string, any> | null): CaptureState {
  const reconstruction = text(object(session?.world_reconstruction).state);
  if (reconstruction === "ready") return "scene_ready";
  if (reconstruction === "failed") return "scene_failed";
  const coverage = object(record.capture_coverage);
  if (coverage.covers_scene === true) return "covered";
  if (coverage.covers_scene === false) return "coverage_short";
  const uploaded = Boolean(session?.immutable_upload_identity || session?.site_capture_bundle
    || session?.website_preparation || session?.world_reconstruction)
    || record.capture_coverage_pending === true || record.coverageReviewPending === true;
  return uploaded ? "uploaded" : "none";
}

export function listingStateOf(record: Record<string, any>): ListingState {
  const listing = record.public_task_listing;
  if (object(record.workspace_task).paused === true) return "paused";
  if (!listing || typeof listing !== "object") return "none";
  if (listing.enabled === true) return "live";
  if (listing.reviewRequired === true) return "review_required";
  return "hidden";
}

export function withdrawalStateOf(record: Record<string, any>): WithdrawalState {
  if (!projectWebsiteCaptureRights(record).consent_revoked) return "none";
  const withdrawal = object(record.capture_withdrawal);
  if (withdrawal.deletionConfirmed === true) return "complete";
  switch (withdrawal.state) {
    case "pipeline_acknowledged_cleanup_pending": return "cleanup_pending";
    case "cleanup_retained_legal_hold": return "legal_hold";
    case "local_cleanup_verified_external_pending": return "external_pending";
    default: return "requested";
  }
}

export function bookingOf(record: Record<string, any>): { state: BookingState; startsAt: string | null } {
  if (!record.pilot_booking) return { state: "none", startsAt: null };
  const coordination = projectPilotCoordination(record);
  if (!coordination) return { state: "booked", startsAt: null };
  return { state: coordination.state as BookingState, startsAt: "startsAt" in coordination ? String(coordination.startsAt) : null };
}

export function recommendationOf(record: Record<string, any>): JobFacts["recommendation"] {
  const proposal = record.pilot_recommendation;
  if (!proposal || typeof proposal !== "object") {
    return { state: "none", recommendationId: null, teamId: null, teamName: null, evaluationRunId: null };
  }
  const state: RecommendationState = proposal.reviewRequired === true ? "review_required" : "recommended";
  return {
    state,
    recommendationId: text(proposal.id) || null,
    teamId: text(proposal.teamId) || null,
    teamName: text(proposal.teamName) || null,
    evaluationRunId: text(proposal.evaluationRunId) || null,
  };
}

export function opsNoticeOf(record: Record<string, any>): JobFacts["opsNotice"] {
  const notice = record.ops_notice;
  if (!notice) return null;
  if (typeof notice !== "object") return { state: "open", summary: typeof notice === "string" ? notice : null };
  const summary = text(notice.summary) || text(notice.message) || text(notice.kind) || text(notice.reason);
  return { state: text(notice.state) || text(notice.status) || "open", summary: summary || null };
}

export function evaluationRequestAdmitted(record: Record<string, any>) {
  return Boolean(text(object(record.free_evaluation_handoff).runId));
}

function latest(values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort().pop() ?? null;
}

export function projectJobFacts(inputs: RawJobInputs): JobFacts {
  const { record, brief } = inputs;
  const runs = projectRuns(inputs);
  const pending: PendingAdmission[] = [];
  let admitted = 0;
  for (const request of inputs.evaluationRequests) {
    if (evaluationRequestAdmitted(request.record)) { admitted += 1; continue; }
    pending.push({
      requestId: request.id,
      teamName: request.teamName,
      setupName: text(object(request.record.workspace_evaluation).setupName) || null,
    });
  }
  const reported = runs.filter((run) => run.outcome === "reported");
  const recommendation = recommendationOf(record);
  const booking = bookingOf(record);
  const coverage = object(record.capture_coverage);
  const createdAtIso = iso(record.createdAt);
  return {
    requestId: inputs.requestId,
    createdAtIso,
    siteName: inputs.site?.siteName || "Unreadable site name",
    siteLocation: inputs.site?.siteLocation || "",
    company: inputs.site?.company || "",
    claimed: Boolean(text(record.account_owner_uid)),
    archived: object(record.workspace_task).archived === true,
    brief: {
      state: briefStateOf(record, brief),
      unresolvedGates: Array.isArray(brief?.unresolved) ? brief!.unresolved.length : 0,
    },
    capture: {
      state: captureStateOf(record, inputs.captureSession),
      missingViews: Array.isArray(coverage.missing_coverage) ? coverage.missing_coverage.map(String) : [],
    },
    listing: { state: listingStateOf(record) },
    evaluations: { total: inputs.evaluationRequests.length, pendingAdmission: pending.length, admitted, pending },
    runs: {
      queued: runs.filter((run) => run.outcome === "queued").length,
      running: runs.filter((run) => run.outcome === "running").length,
      reported: reported.length,
      noResult: runs.filter((run) => run.outcome === "no_result").length,
      passing: reported.filter((run) => run.meetsTarget === true).length,
      belowTarget: reported.filter((run) => run.meetsTarget === false).length,
      untargeted: reported.filter((run) => run.meetsTarget === null).length,
      best: bestRun(runs),
    },
    recommendation,
    booking,
    withdrawal: { state: withdrawalStateOf(record) },
    opsNotice: opsNoticeOf(record),
    lastActivityIso: latest([
      createdAtIso,
      iso(record.updatedAt) ?? iso(record.updated_at),
      text(brief?.confirmedAtIso) || null,
      text(brief?.draftedAtIso) || null,
      text(object(record.public_task_listing).approvedAtIso) || null,
      text(object(record.pilot_recommendation).recommendedAtIso) || null,
      text(object(record.pilot_booking).acceptedAtIso) || null,
      text(object(record.capture_withdrawal).requestedAtIso) || null,
      ...inputs.evaluationRequests.map((request) => iso(object(request.record.workspace_evaluation).submittedAt) ?? iso(request.record.createdAt)),
      ...runs.flatMap((run) => [run.requestedAtIso, run.reportedAtIso]),
    ]),
  };
}

/** The loop's milestones for one job, in order, marked done where a record shows it. */
export function buildJobTimeline(inputs: RawJobInputs, facts: JobFacts): TimelineEntry[] {
  const { record, brief } = inputs;
  const firstRequest = inputs.evaluationRequests
    .map((request) => iso(object(request.record.workspace_evaluation).submittedAt) ?? iso(request.record.createdAt))
    .filter(Boolean).sort()[0] ?? null;
  const runs = projectRuns(inputs);
  const firstReport = runs.map((run) => (run.outcome === "reported" ? run.reportedAtIso : null)).filter(Boolean).sort()[0] ?? null;
  const entries: TimelineEntry[] = [
    { key: "created", label: "Job received", atIso: facts.createdAtIso, done: true },
    { key: "brief", label: "Brief confirmed", atIso: text(brief?.confirmedAtIso) || iso(record.site_task_brief_confirmed_at), done: facts.brief.state === "confirmed" },
    { key: "capture", label: "Capture received", atIso: null, done: facts.capture.state !== "none" },
    { key: "coverage", label: "Coverage confirmed", atIso: null, done: ["covered", "scene_ready"].includes(facts.capture.state) },
    { key: "listing", label: "Public card live", atIso: text(object(record.public_task_listing).wentLiveIso) || null, done: facts.listing.state === "live" },
    { key: "requested", label: "Evaluation requested", atIso: firstRequest, done: facts.evaluations.total > 0 },
    { key: "admitted", label: "Free evaluation admitted", atIso: null, done: facts.evaluations.admitted > 0 },
    { key: "reported", label: "Evaluation reported", atIso: firstReport, done: facts.runs.reported > 0 },
    { key: "recommended", label: "Team recommended", atIso: text(object(record.pilot_recommendation).recommendedAtIso) || null, done: facts.recommendation.state !== "none" },
    { key: "booked", label: "Site booked the pilot", atIso: text(object(record.pilot_booking).acceptedAtIso) || null, done: facts.booking.state !== "none" },
    { key: "scheduled", label: "Pilot scheduled", atIso: facts.booking.startsAt, done: facts.booking.state === "scheduled" },
  ];
  if (facts.withdrawal.state !== "none") {
    entries.push({ key: "withdrawn", label: "Recording withdrawn", atIso: text(object(record.capture_withdrawal).requestedAtIso) || null, done: true });
  }
  return entries;
}
