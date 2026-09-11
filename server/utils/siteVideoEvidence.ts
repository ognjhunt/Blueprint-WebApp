/**
 * Running the footage reader, and deciding whether it is allowed to count yet.
 *
 * ## Shadow first, by default
 *
 * `BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED` turns the reader on. A second and
 * separate flag, `BLUEPRINT_SITE_VIDEO_EVIDENCE_APPLY`, decides whether what it
 * finds is allowed to move a verdict. Until that second flag is set the
 * evidence is written to the request, shown to whoever reviews it, and folded
 * into nothing — which is the only honest way to find out whether a model
 * watching a thirty-second clip agrees with the operators who have been making
 * these calls by hand.
 *
 * `shadow_would_have_changed_disposition` on the stored summary is the whole
 * point of that mode: it records what the reader *would* have done, so the
 * agreement rate is a query rather than a research project. Promote the second
 * flag only once that number justifies it.
 *
 * This mirrors the ladder in `server/agents/autoagent-promotion-policy.ts`
 * (`shadow_only` → `repo_local_canary` → …) rather than inventing a second
 * vocabulary for the same idea.
 */
import {
  applyVideoEvidence,
  lowerToCeiling,
  videoEvidenceCeiling,
  type TriageDisposition,
  type TriageResult,
  type VideoEvidenceReview,
} from "../../client/src/lib/gateTriage";
import { gateFields, specFields } from "../../client/src/data/siteTaskQualification";
import { runAgentTask } from "../agents/runtime";
import { isGeminiVideoConfigured, getGeminiVideoModel } from "../agents/provider-config";
import type {
  SiteVideoEvidenceInput,
  SiteVideoEvidenceOutput,
} from "../agents/tasks/site-video-evidence";
import { logger } from "../logger";
import type { InboundRequest, SiteVideoEvidenceSummary } from "../types/inbound-request";
import { isSiteVideoEvidenceApplied, isSiteVideoEvidenceEnabled } from "../config/env";

function nowIso() {
  return new Date().toISOString();
}

function emptySummary(
  status: SiteVideoEvidenceSummary["status"],
  errorCode: string | null,
): SiteVideoEvidenceSummary {
  return {
    status,
    footage_status: null,
    contradictions: [],
    corroborations: [],
    not_evidenced: [],
    measured_cycle_seconds: null,
    measured_cycle_band: null,
    people_relationship_to_work: null,
    privacy_flag: false,
    summary: null,
    error_code: errorCode,
    model: null,
    evaluated_at: nowIso(),
  };
}

/**
 * Reduce the reader's full output to the record we keep.
 *
 * Observations with `stance: "not_visible"` are dropped from both lists on
 * purpose: they are the honest majority answer and keeping them would bury the
 * two findings that matter under noise. What was looked for and not seen is
 * already carried, once, by `not_evidenced`.
 */
export function summariseVideoEvidence(
  output: SiteVideoEvidenceOutput,
  model: string,
): SiteVideoEvidenceSummary {
  const byStance = (stance: "contradicts" | "corroborates") =>
    output.observations
      .filter((observation) => observation.stance === stance)
      .map((observation) => ({
        field_id: observation.field_id,
        observation: observation.observation,
        confidence: observation.confidence,
      }));

  return {
    status: output.footage_status === "unusable" ? "unreadable" : "analysed",
    footage_status: output.footage_status,
    contradictions: byStance("contradicts"),
    corroborations: byStance("corroborates"),
    not_evidenced: output.not_evidenced,
    measured_cycle_seconds: output.cycle_measurement.median_cycle_seconds,
    measured_cycle_band: output.cycle_measurement.implied_band,
    people_relationship_to_work: output.people_present.relationship_to_work,
    privacy_flag: output.privacy_flag,
    summary: output.summary,
    error_code:
      output.footage_status === "unusable"
        ? output.footage_status_reason || "footage_unusable"
        : null,
    model,
    evaluated_at: nowIso(),
  };
}

/** The narrow slice of the summary the triage door accepts. */
export function toVideoEvidenceReview(
  summary: SiteVideoEvidenceSummary | null | undefined,
): VideoEvidenceReview | null {
  if (!summary || summary.status !== "analysed" || !summary.footage_status) {
    return null;
  }
  return {
    footageStatus: summary.footage_status,
    contradictions: summary.contradictions.map((item) => ({
      fieldId: item.field_id,
      observation: item.observation,
      confidence: item.confidence,
    })),
  };
}

/**
 * Fold footage into a full gate verdict, honouring the shadow flag.
 *
 * When shadowing, the returned triage is the untouched original and the caller
 * still learns — via `wouldHaveChangedDisposition` — what applying it would
 * have done.
 */
export function foldVideoEvidenceIntoTriage(
  triage: TriageResult,
  summary: SiteVideoEvidenceSummary | null | undefined,
): { triage: TriageResult; applied: boolean; wouldHaveChangedDisposition: boolean } {
  const review = toVideoEvidenceReview(summary);
  const proposed = applyVideoEvidence(triage, review);
  const wouldHaveChangedDisposition = proposed.disposition !== triage.disposition;

  if (!isSiteVideoEvidenceApplied()) {
    return { triage, applied: false, wouldHaveChangedDisposition };
  }
  return { triage: proposed, applied: true, wouldHaveChangedDisposition };
}

/**
 * The same question against a stored summary rather than a live `TriageResult`.
 *
 * The worker only ever has `site_task_triage`, whose reasons were already
 * flattened to strings on write. Reconstructing a `TriageResult` from that to
 * ask one boolean would be fiction, so this asks the rule directly.
 */
export function measureVideoEvidenceEffect(
  disposition: TriageDisposition | null | undefined,
  summary: SiteVideoEvidenceSummary | null | undefined,
): { applied: boolean; wouldHaveChangedDisposition: boolean } {
  const ceiling = videoEvidenceCeiling(toVideoEvidenceReview(summary));
  const wouldHaveChangedDisposition = Boolean(
    disposition && lowerToCeiling(disposition, ceiling) !== disposition,
  );
  return { applied: isSiteVideoEvidenceApplied(), wouldHaveChangedDisposition };
}

/**
 * Turn stored enum tokens back into the words the operator actually chose.
 *
 * The model is asked whether the footage contradicts what the site said, so it
 * has to be shown what the site said. `objectVariety: "under_10"` is a database
 * value; "Fewer than ten" is the answer a person clicked, and it is the thing a
 * contradiction has to be judged against. Unknown ids and values pass through
 * as-is rather than being dropped — a value we cannot resolve is still evidence
 * the model should weigh, and silently discarding it would read as the question
 * never having been asked.
 */
export function resolveOperatorAnswerLabels(
  answers: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(answers)) {
    const field =
      gateFields.find((candidate) => candidate.id === fieldId) ??
      specFields.find((candidate) => candidate.id === fieldId);
    const option = field?.options.find((candidate) => candidate.value === value);
    resolved[fieldId] = option?.label ?? value;
  }
  return resolved;
}

/**
 * Read the footage attached to a request, if there is any and we are allowed to.
 *
 * Returns `null` when there is nothing to do — no link, lane off, no API key —
 * so the caller can tell "we did not look" from "we looked and saw nothing",
 * which are very different things to show a reviewer.
 */
export async function runSiteVideoEvidenceForRequest(
  request: Pick<InboundRequest, "requestId" | "request" | "site_task_triage">,
): Promise<SiteVideoEvidenceSummary | null> {
  const taskVideoUrl = request.request.taskVideoUrl?.trim();
  if (!taskVideoUrl) return null;
  if (!isSiteVideoEvidenceEnabled()) return null;

  if (!isGeminiVideoConfigured()) {
    logger.warn(
      { requestId: request.requestId },
      "Site video evidence enabled but no Gemini key is configured",
    );
    return emptySummary("skipped", "gemini_video_not_configured");
  }

  const operatorAnswers = resolveOperatorAnswerLabels({
    ...(request.request.siteTaskGates || {}),
    ...(request.request.siteTaskSpec || {}),
  });

  const input: SiteVideoEvidenceInput = {
    requestId: request.requestId,
    taskVideoUrl,
    taskDescription: request.request.taskDescription || null,
    whatGoesWrong: request.request.whatGoesWrong || null,
    operatorAnswers,
  };

  try {
    const result = await runAgentTask<SiteVideoEvidenceInput, SiteVideoEvidenceOutput>({
      kind: "site_video_evidence",
      input,
      session_key: `site-video:${request.requestId}`,
      metadata: { inbound_request_id: request.requestId },
    });

    if (result.status !== "completed" || !result.output) {
      const code = result.error?.split(":")[0] || "site_video_evidence_failed";
      // A link we could not read is the site's to fix and a reviewer's to
      // mention; it is never a mark against the submission.
      const unreadable = code.startsWith("video_");
      return emptySummary(unreadable ? "unreadable" : "failed", code);
    }

    return summariseVideoEvidence(result.output, result.model || getGeminiVideoModel());
  } catch (error) {
    logger.warn(
      { err: error, requestId: request.requestId },
      "Site video evidence run failed",
    );
    return emptySummary("failed", "site_video_evidence_exception");
  }
}
