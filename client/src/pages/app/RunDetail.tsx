import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BenchmarkReportPanel } from "@/components/blueprint/app/BenchmarkReportPanel";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { Tag } from "@/components/workspace/WorkspaceUI";
import {
  runDisplayName,
  runStatusLabel,
  useBuyerAppRunDetail,
  type BuyerRunDetail,
} from "@/lib/buyerAppData";
import type { DecisionEnvelope, EvidenceArtifact } from "@/lib/decisionEvidence";

const outcomeLabels: Record<DecisionEnvelope["overall"]["outcome"], string> = {
  bounded_positive: "Yes, within the tested conditions",
  bounded_negative: "No, within the tested conditions",
  partial: "Partly answered",
  abstained: "No decision: the evidence couldn't decide",
  blocked: "Blocked",
  failed: "Failed",
};

const claimLabels: Record<DecisionEnvelope["claim_outcomes"][number]["outcome"], [string, "green" | "red" | "neutral"]> = {
  supported: ["Supported", "green"],
  not_supported: ["Not supported", "red"],
  inconclusive: ["Inconclusive", "neutral"],
  unsupported: ["Not testable here", "neutral"],
};

function downloadEnvelope(envelope: DecisionEnvelope) {
  const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${envelope.request_id}-decision-envelope.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function List({ values, empty = "None reported." }: { values: string[]; empty?: string }) {
  return values.length
    ? <ul className="list-disc pl-5">{values.map((value) => <li key={value}>{value}</li>)}</ul>
    : <p className="text-ink-500">{empty}</p>;
}

function Artifacts({ artifacts }: { artifacts: EvidenceArtifact[] }) {
  return <ul className="flex flex-col gap-2">
    {artifacts.map((artifact) => <li key={artifact.artifact_id}>
      {artifact.kind} <span className="text-ink-500">({artifact.evidence_class})</span>
      <span className="block break-all text-xs text-ink-500">{artifact.uri} · version {artifact.version} · {artifact.digest_sha256}</span>
    </li>)}
  </ul>;
}

/** The decision first, then the questions it answered; evidence and limits stay one click away. */
export function DecisionResult({ envelope }: { envelope: DecisionEnvelope }) {
  const outcome = envelope.overall.outcome;
  const physicalNeeded = envelope.physical_evidence.required
    || envelope.claim_outcomes.some((claim) => claim.physical_evidence_required);
  const next = envelope.next_cheapest_experiment;
  return (
    <div className="flex flex-col gap-10" data-testid="decision-result">
      <section aria-labelledby="run-decision">
        <p className="ws-kicker">Decision</p>
        <h2 id="run-decision">{outcomeLabels[outcome]}</h2>
        <p className="mt-2 max-w-3xl">{envelope.overall.summary}</p>
        {outcome === "abstained" ? <p className="mt-2 text-ink-600">No candidate or winner is inferred from this result.</p> : null}
        {envelope.overall.selected_candidate_ids.length ? <p className="mt-2 text-ink-600">
          Selected: {envelope.overall.selected_candidate_ids.join(", ")}. The decision carries no per-candidate score, so there is no ranking.
        </p> : null}
        {physicalNeeded ? <p className="mt-2 text-ink-600">A physical test is still needed before relying on this result.</p> : null}
      </section>

      {envelope.claim_outcomes.length ? <section aria-labelledby="run-claims">
        <h3 id="run-claims" className="text-lg">Questions answered</h3>
        <ul className="mt-3 flex flex-col">
          {envelope.claim_outcomes.map((claim) => {
            const [label, tone] = claimLabels[claim.outcome];
            return <li key={claim.claim_id} className="border-t border-line py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <strong className="font-medium">{claim.statement}</strong>
                <Tag tone={tone}>{label}</Tag>
              </div>
              <p className="mt-1">{claim.conclusion}</p>
              <p className="mt-1 text-sm text-ink-500">Uncertainty: {claim.uncertainty}</p>
            </li>;
          })}
        </ul>
      </section> : null}

      <section aria-labelledby="run-next">
        <h3 id="run-next" className="text-lg">Next step</h3>
        <p className="mt-2">{next.description}</p>
        <p className="mt-1 text-sm text-ink-500">
          {next.rationale}
          {[next.estimated_cost, next.estimated_time].filter(Boolean).length ? ` · ${[next.estimated_cost, next.estimated_time].filter(Boolean).join(" · ")}` : ""}
        </p>
      </section>

      <div>
        <details>
          <summary>Evidence and files</summary>
          <div className="flex flex-col gap-5 text-sm">
            <div>
              <h4 className="font-medium">How it was tested</h4>
              <ul className="mt-2 flex flex-col gap-2">
                {envelope.evidence_methods.map((method) => <li key={method.method_id}>
                  {method.name} <span className="text-ink-500">({method.evidence_class})</span>: {method.selection_reason}
                  <span className="block text-ink-500">Measured: {method.measured.join(", ") || "nothing reported"}</span>
                </li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Files</h4>
              <div className="mt-2"><Artifacts artifacts={envelope.artifacts} /></div>
            </div>
            <div>
              <h4 className="font-medium">Allowed uses</h4>
              <p className="mt-1">
                Evaluation: {envelope.permitted_evidence_uses.evaluation ? "eligible" : "not eligible"} ·
                Post-training: {envelope.permitted_evidence_uses.post_training ? "eligible" : "not eligible"}
              </p>
              <p className="mt-1 text-ink-500">{envelope.permitted_evidence_uses.reason} Having the files doesn't mean training happened or a policy improved.</p>
            </div>
            <p className="break-all text-xs text-ink-500">
              Testbed {envelope.testbed.testbed_id} · {envelope.testbed.version} · {envelope.testbed.digest_sha256} · Pipeline run {envelope.provenance.pipeline_run_id} · {envelope.provenance.generated_at_iso}
            </p>
            <button type="button" className="ws-link w-fit" onClick={() => downloadEnvelope(envelope)}>Download the decision (JSON)</button>
          </div>
        </details>
        <details>
          <summary>Limits of this result</summary>
          <div className="flex flex-col gap-5 text-sm">
            <div>
              <h4 className="font-medium">Tested conditions</h4>
              <div className="mt-1"><List values={envelope.validation_envelope.supported_conditions} /></div>
            </div>
            <div>
              <h4 className="font-medium">Not covered</h4>
              <div className="mt-1"><List values={envelope.validation_envelope.unsupported_conditions} /></div>
            </div>
            <div>
              <h4 className="font-medium">Coverage and uncertainty</h4>
              <p className="mt-1">{envelope.coverage.summary} {envelope.uncertainty.summary}</p>
              {envelope.uncertainty.sources.length ? <div className="mt-1"><List values={envelope.uncertainty.sources} /></div> : null}
            </div>
            <div>
              <h4 className="font-medium">Disagreements</h4>
              <p className="mt-1">{envelope.disagreements.summary}</p>
              {envelope.disagreements.items.length ? <div className="mt-1"><List values={envelope.disagreements.items.map((item) => item.description)} /></div> : null}
              {envelope.disagreements.correlated_evidence_warning ? <p className="mt-1">{envelope.disagreements.correlated_evidence_warning}</p> : null}
            </div>
            <div>
              <h4 className="font-medium">Physical test</h4>
              <p className="mt-1">{envelope.physical_evidence.required ? "Required." : "Not required for the supported claims."}</p>
              {envelope.physical_evidence.reasons.length ? <div className="mt-1"><List values={envelope.physical_evidence.reasons} /></div> : null}
            </div>
            <div>
              <h4 className="font-medium">What this result can't be used to claim</h4>
              <p className="mt-1">{envelope.claim_ceiling.summary}</p>
              {envelope.claim_ceiling.prohibited_claims.length ? <div className="mt-1"><List values={envelope.claim_ceiling.prohibited_claims} /></div> : null}
            </div>
            <p className="text-xs text-ink-500">Method profiles: {envelope.validation_envelope.method_profile_versions.join(", ") || "none reported"}</p>
          </div>
        </details>
      </div>
    </div>
  );
}

/** Also rendered inside a workspace evaluation's drawer, so it carries no page navigation. */
export function RunRecord({ run }: { run: BuyerRunDetail }) {
  const projection = run.decision_projection;
  return (
    <div className="flex flex-col gap-8">
      {projection?.supported ? <DecisionResult envelope={projection.envelope} /> : null}
      {projection && !projection.supported ? (
        <div className="ws-alert" role="status">
          <p>This result can't be shown yet: {projection.reason}</p>
        </div>
      ) : null}
      {!projection ? (
        <p>No decision yet. Current status: {runStatusLabel(run.status).toLowerCase()}.</p>
      ) : null}
      {run.error ? <p className="text-ink-600">Message: {String(run.error)}</p> : null}
      <div>
        {run.benchmark ? (
          <details>
            <summary>Benchmark details</summary>
            <BenchmarkReportPanel benchmark={run.benchmark} />
          </details>
        ) : null}
        <details>
          <summary>Run details</summary>
          <dl className="ws-facts">
            <div><dt>Request</dt><dd className="break-all">{run.request_id || run.job_id}</dd></div>
            {run.decision_id ? <div><dt>Decision</dt><dd className="break-all">{run.decision_id}</dd></div> : null}
            <div><dt>Status</dt><dd>{runStatusLabel(run.status)}</dd></div>
            {run.testbed_id ? <div><dt>Testbed</dt><dd className="break-all">{run.testbed_id}{run.testbed_version ? ` · ${run.testbed_version}` : ""}</dd></div> : null}
            <div><dt>Created</dt><dd>{run.created_at_iso || "Not recorded"}</dd></div>
            <div><dt>Last update</dt><dd>{run.updated_at_iso || "Not recorded"}</dd></div>
          </dl>
        </details>
      </div>
    </div>
  );
}

export default function RunDetail() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId || "";
  const { run, notFound, isLoading, error } = useBuyerAppRunDetail(runId);
  return (
    <AppShell active="runs" breadcrumb={`runs / ${runId || "unknown"}`}>
      <Helmet><title>{`${runId || "Run"} · Blueprint`}</title><meta name="description" content="An evaluation run's decision and evidence." /></Helmet>
      <Link className="ws-back" href="/app/runs">← All runs</Link>
      <header className="ws-heading">
        <div><h1>{run ? runDisplayName(run) : "Run"}</h1></div>
      </header>
      {isLoading ? <BuyerAppLoadingState /> : null}
      {!isLoading && error ? <BuyerAppErrorState message={error.message} /> : null}
      {!isLoading && !error && run ? <RunRecord run={run} /> : null}
      {!isLoading && !error && !run && notFound ? (
        <section className="ws-empty">
          <h2>Run not found</h2>
          <p>No run with this ID belongs to your account.</p>
          <Link className="ws-link" href="/app/runs">All runs</Link>
        </section>
      ) : null}
    </AppShell>
  );
}
