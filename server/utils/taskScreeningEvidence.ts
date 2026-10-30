import { createHash } from "node:crypto";
import { loadManagedJobEvidence, type ManagedJobEvidenceSummary } from "./jobManagedEvaluation";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";

const LIMIT = "Recorded task simulation only; it does not establish physical performance, safety, hardware supply, or a deployment company's proprietary policy access.";

/** Host-supplied scope only. The model cannot select another request, task or capture. */
export type TaskScreeningScope = { requestId: string; briefDigest: string | null; captureId: string };

export function taskScreeningEvidence(scope: TaskScreeningScope, rows: ManagedJobEvidenceSummary[], observedAt: string) {
  const seenTasks = new Set<string>();
  const runs = rows.filter(row => {
    const source = row.screening?.provenance?.source;
    if (!row.current || !source || source.capture_id !== scope.captureId || seenTasks.has(source.task_id)) return false;
    // Canonical readback is newest-campaign first. Older campaigns remain in
    // the workspace history; they must not override a fresh registration's status.
    seenTasks.add(source.task_id); return true;
  })
    .map(row => ({ run_id: row.runId, state: row.state, ...row.screening! }));
  const statements: Record<string, string> = {};
  for (const run of runs) for (const candidate of run.candidates) {
    const provenance = run.provenance!;
    statements[`${run.run_id}:${candidate.candidateId}`] =
      `Pipeline publication ${provenance.publication_digest}, generated ${provenance.generated_at}, reports `
      + `${candidate.name} (${candidate.candidateId}, configuration ${candidate.configurationDigest}) for task ${provenance.source.task_id} `
      + `in capture ${provenance.source.capture_id}: status ${candidate.state}; ${candidate.scored}/${candidate.planned} episodes scored, `
      + `${candidate.succeeded} succeeded, ${candidate.failed} failed, ${candidate.void} unscorable. `
      + `Recorded reasons: ${candidate.blockers.length ? candidate.blockers.join(", ") : "none"}. `
      + (candidate.scored ? "These are bounded simulation outcomes for this task. " : "No scored task outcome is established by this row. ")
      + LIMIT;
  }
  // Only complete qualified sentences are citable. Selecting a bare status or
  // success count cannot discard the publication's scope and evidence ceiling.
  const content = { current: true, content: { candidate_statements: statements } };
  const readback = { request_id: scope.requestId, capture_id: scope.captureId, brief_digest: scope.briefDigest,
    observed_at: observedAt, coverage: "latest_current_screening_campaign_per_task_within_latest_20_job_run_records" as const,
    status: runs.length ? "recorded" as const : "unavailable" as const,
    unavailable_reason: runs.length ? null : "current_task_screening_not_found_in_readback",
    limitation: LIMIT, runs };
  return { ...readback, evidence_source: runs.length ? {
    source_id: `taskScreening:${crossRuntimeDigest(readback).slice("sha256:".length)}`,
    kind: "knowledge" as const, canonical_ref: `taskEvaluationPolicyRuns?job_id=${scope.requestId}#${crossRuntimeDigest(readback)}`,
    sha256: createHash("sha256").update(JSON.stringify(content)).digest("hex"), checked_at: observedAt, content,
  } : null };
}

export type TaskScreeningReadback = ReturnType<typeof taskScreeningEvidence>;

/** Reuses canonical publication, task, capture, source and current consent validation. */
export async function readCurrentTaskScreening(scope: TaskScreeningScope): Promise<TaskScreeningReadback> {
  const unavailable = (reason: string) => ({ ...taskScreeningEvidence(scope, [], new Date().toISOString()), unavailable_reason: reason });
  if (!scope.briefDigest) return unavailable("current_task_brief_unavailable");
  try {
    return taskScreeningEvidence(scope, await loadManagedJobEvidence(scope.requestId, scope.briefDigest), new Date().toISOString());
  } catch {
    return unavailable("current_task_screening_readback_unavailable");
  }
}
