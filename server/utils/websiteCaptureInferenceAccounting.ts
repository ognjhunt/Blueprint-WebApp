/** Fixed-capture retained usage pricing. No dispatch, writes, or invoice claims. */
import { humanDecisionDigest as digest } from "./human-reply-admission";
import { advisoryJobId } from "./siteAssessmentContext";
import { browserPendingDecisionKey } from "./websiteBrowserPending";
import { hydrateAgentEvidence } from "../agents/private-evidence";
import { extractAgentCostTelemetry } from "./agentCostTelemetry";
import { priceSiteAssessmentUsage } from "../agents/adapters/site-assessment-budget";

type RecordData = Record<string, any>;
type Reader = {
  document(collection: "captureCoverageReviews" | "captureUploadSessions" | "siteAssessmentJobs" | "agentRuns", id: string): Promise<RecordData | null>;
  calls(budgetId: string, limit: number): Promise<Array<{ id: string; value: RecordData }>>;
};
const sha = (value: unknown) => `sha256:${digest(value)}`;
const hash = (value: unknown): string | null => typeof value === "string" && /^(?:sha256:)?[a-f0-9]{64}$/.test(value)
  ? value.startsWith("sha256:") ? value : `sha256:${value}` : null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const stableId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
const tokenId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const sum = (values: number[]) => Number(values.reduce((a, b) => a + b, 0).toFixed(12));

export async function websiteCaptureInferenceAccounting(input: {
  requestId: string; captureId: string; sourceVideoDigest: string; record: RecordData; reader: Reader;
}) {
  const { requestId, captureId, record, reader } = input;
  const budgetId = `budget-${digest({ capture_id: captureId })}`;
  type Call = { call_digest: string; provider: "openai" | "gemini"; model: "gpt-6.1-sol" | "gemini-3.8-flash";
    state: "recorded" | "admitted" | "unknown"; source_digest: string; context_digest: string; run_digest: string | null;
    recorded_cost_usd: number | null; bounded_unknown_cost_usd: number | null; usage_digest: string | null };
  let calls: Call[] = [], ledgerStatus: "complete" | "missing" | "incomplete" | "invalid" | "unavailable" = "missing";
  let hiddenUnknowns = 1;
  const callTokens = new Map<string, { runId: string | null; callDigest: string }>();
  try {
    const budget = await reader.document("captureCoverageReviews", budgetId);
    if (budget) {
      if (budget.capture_id !== captureId || !Number.isSafeInteger(budget.calls) || budget.calls < 0) throw new Error("invalid");
      const stored = await reader.calls(budgetId, 65);
      if (stored.length > 64 || budget.calls !== stored.length || budget.historical_usage_status === "unreconciled") {
        ledgerStatus = "incomplete";
        hiddenUnknowns = Math.max(1, budget.calls - Math.min(stored.length, 64));
      } else { ledgerStatus = "complete"; hiddenUnknowns = 0; }
      calls = stored.slice(0, 64).map(({ id, value: call }) => {
        const source = hash(call.source_digest), context = hash(call.context_digest);
        if (!tokenId(id) || callTokens.has(id) || call.admission_token !== id || call.request_id !== requestId
          || call.capture_id !== captureId || call.schema_version !== "capture_inference_call.v1" || !source || !context
          || !["admitted", "recorded", "unknown"].includes(call.state)
          || !(call.provider === "openai" && call.model === "gpt-6.1-sol" || call.provider === "gemini" && call.model === "gemini-3.8-flash")
          || call.run_id !== null && !stableId(call.run_id)) throw new Error("invalid");
        const callDigest = sha({ collection: "captureCoverageReviews", budget_id: budgetId, call_id: id });
        callTokens.set(id, { runId: call.run_id, callDigest });
        let cost: number | null = null;
        // A retained reservation/exposure is never priced as actual usage. Reprice
        // the recorded raw counters and verify the retained monetary estimate.
        if (call.state === "recorded" && Number.isSafeInteger(call.recorded_at_ms) && call.recorded_at_ms > 0
          && finite(call.cost_estimate_usd)) {
          const priced = priceSiteAssessmentUsage(call.provider, call.raw_usage, call.recorded_at_ms);
          if (priced.cost_usd !== null && Math.abs(priced.cost_usd - call.cost_estimate_usd) <= 1e-9) cost = priced.cost_usd;
        }
        return { call_digest: callDigest, provider: call.provider, model: call.model, state: call.state,
          source_digest: source, context_digest: context, run_digest: call.run_id === null ? null : sha(call.run_id),
          recorded_cost_usd: cost, bounded_unknown_cost_usd: null,
          usage_digest: cost === null ? null : sha(call.raw_usage) };
      }).sort((a, b) => a.call_digest.localeCompare(b.call_digest));
    }
  } catch (error) {
    ledgerStatus = error instanceof Error && error.message === "invalid" ? "invalid" : "unavailable";
    calls = []; callTokens.clear(); hiddenUnknowns = 1;
  }

  let sourceKey: string | null = null;
  try {
    const session = await reader.document("captureUploadSessions", captureId), pending = session?.browser_pending_delivery;
    if (pending?.request_id === requestId && pending.capture_id === captureId && pending.scene_id === `site-${requestId}`
      && pending.state === "published" && !session?.browser_upload_reservation && !session?.browser_stored_upload)
      sourceKey = browserPendingDecisionKey(pending);
  } catch { /* Missing source evidence stays unknown. */ }
  const privacy = record.capture_privacy_source_bound_decision;
  const privacyBound = sourceKey !== null && privacy?.capture_id === captureId && privacy.producer_source?.kind === "browser_pending"
    && privacy.producer_source.key === sourceKey;
  const privacyStatus = privacyBound && privacy.outcome === "not_reviewed" ? "source_bound_not_reviewed"
    : privacyBound && ["cleared", "privacy_hold", "review_unavailable"].includes(privacy.outcome) ? "source_bound_reviewed" : "unknown";

  const linked: { status: "verified" | "not_linked" | "missing" | "mismatch" | "unavailable"; job_digest: string | null;
    run_digest: string | null; known_usage_cost_usd: number | null; ledger_overlap: "matched_call_ids" | "unknown" | "not_available" }
    = { status: "not_linked", job_digest: null, run_digest: null, known_usage_cost_usd: null, ledger_overlap: "not_available" };
  const proposal = record.website_scene_sponsorship?.assessment_preparation_proposal;
  const pointer = proposal?.request_id === requestId && proposal.capture_id === captureId ? proposal : record.site_advisory;
  if (pointer) {
    linked.status = "mismatch";
    if (typeof pointer.job_id === "string" && /^advisory-[a-f0-9]{64}$/.test(pointer.job_id)) {
      const jobId = pointer.job_id;
      linked.job_digest = sha(jobId);
      try {
        const job = await reader.document("siteAssessmentJobs", jobId);
        if (!job) linked.status = "missing";
        else if (job.schema_version === "site_assessment_job.v1" && job.request_id === requestId && job.capture_id === captureId
          && sourceKey !== null && job.source_key === sourceKey && hash(job.context_digest)
          && jobId === advisoryJobId(requestId, job.source_key, job.context_digest) && stableId(job.run_id)
          && pointer.source_key === job.source_key && pointer.context_digest === job.context_digest
          && (pointer.run_id === undefined || pointer.run_id === job.run_id)) {
          linked.run_digest = sha(job.run_id);
          const stored = await reader.document("agentRuns", job.run_id);
          if (!stored) linked.status = "missing";
          else if (stored.task_kind === "site_assessment" && stored.metadata?.capture_id === captureId
            && (!stored.agent_evidence_ref || Number.isSafeInteger(stored.agent_evidence_ref.bytes)
              && stored.agent_evidence_ref.bytes > 0 && stored.agent_evidence_ref.bytes <= 2_097_152)) {
            const run = await hydrateAgentEvidence(stored, { collection: "agentRuns", id: job.run_id });
            const source = run.artifacts?.source_admission;
            if (source?.request_id === requestId && source.capture_id === captureId && source.advisory_job_id === jobId
              && source.source_key === sourceKey && source.context_digest === job.context_digest
              && hash(source.video_sha256) === input.sourceVideoDigest) {
              linked.status = "verified"; linked.ledger_overlap = "unknown";
              const telemetry = extractAgentCostTelemetry({ ...run, id: job.run_id });
              const samples = run.artifacts?.usage_samples;
              const responses = run.artifacts?.provider_responses;
              if (telemetry.spend_accounting_status === "complete" && finite(telemetry.cost_estimate_usd)
                && Array.isArray(samples) && samples.length > 0 && samples.length <= 64
                && Array.isArray(responses) && responses.length === samples.length
                && samples.every((sample, index) => {
                  const response = responses[index];
                  if (!(response.provider === "openai" && response.model === "gpt-6.1-sol"
                    || response.provider === "gemini" && response.model === "gemini-3.8-flash")
                    || !Number.isSafeInteger(response.priced_at_ms) || response.priced_at_ms <= 0
                    || !sample.raw_usage || digest(sample.raw_usage) !== digest(response.usage)
                    || !finite(sample.estimated_total_cost_usd)) return false;
                  const priced = priceSiteAssessmentUsage(response.provider, response.usage, response.priced_at_ms);
                  return priced.cost_usd !== null && Math.abs(priced.cost_usd - sample.estimated_total_cost_usd) <= 1e-9;
                }) && Math.abs(sum(samples.map(sample => sample.estimated_total_cost_usd)) - telemetry.cost_estimate_usd) <= 1e-9)
                linked.known_usage_cost_usd = telemetry.cost_estimate_usd;
              const tokens = run.artifacts?.capture_inference_reservations?.map((row: any) => row.admission_token);
              const sameRun = [...callTokens.entries()].filter(([, row]) => row.runId === job.run_id);
              if (Array.isArray(tokens) && tokens.length > 0 && new Set(tokens).size === tokens.length
                && tokens.length === sameRun.length && tokens.every(token => tokenId(token) && callTokens.get(token)?.runId === job.run_id))
                linked.ledger_overlap = "matched_call_ids";
            }
          }
        }
      } catch { linked.status = "unavailable"; linked.known_usage_cost_usd = null; linked.ledger_overlap = "not_available"; }
    }
  }
  return { schema_version: "website_capture_inference_accounting.v1", request_id: requestId, capture_id: captureId,
    budget_digest: sha({ collection: "captureCoverageReviews", id: budgetId }), source_video_digest: input.sourceVideoDigest,
    ledger_status: ledgerStatus, known_usage_cost_usd: sum(calls.flatMap(call => call.recorded_cost_usd === null ? [] : [call.recorded_cost_usd])),
    bounded_unknown_cost_usd: 0, unbounded_unknown_call_count: hiddenUnknowns + calls.filter(call => call.recorded_cost_usd === null).length,
    calls, linked_assessment: linked, privacy: { status: privacyStatus, historical_cost_status: "unknown" },
    preparation_ledger_overlap: "not_established" };
}
