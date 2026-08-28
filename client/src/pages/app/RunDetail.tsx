import { useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button, DataField, ProofBoundary, StatusChip, Tabs } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BenchmarkReportPanel } from "@/components/blueprint/app/BenchmarkReportPanel";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import {
  runDisplayName,
  runStatusLabel,
  runStatusTone,
  useBuyerAppRunDetail,
  type BuyerRunDetail,
} from "@/lib/buyerAppData";
import type { DecisionEnvelope, EvidenceArtifact } from "@/lib/decisionEvidence";

const outcomeLabels: Record<DecisionEnvelope["overall"]["outcome"], string> = {
  bounded_positive: "Bounded positive decision",
  bounded_negative: "Bounded negative decision",
  partial: "Partial decision",
  abstained: "Explicit abstention",
  blocked: "Blocked",
  failed: "Failed",
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">{title}</h2>
      <div className="runway-panel p-5">{children}</div>
    </section>
  );
}

function Tags({
  values,
  tone = "neutral",
  empty = "None reported",
}: {
  values: string[];
  tone?: "neutral" | "block";
  empty?: string;
}) {
  return values.length ? (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li
          key={value}
          className={
            tone === "block"
              ? "border border-block-bd bg-block-bg px-2 py-1 text-body-s text-block-fg"
              : "border border-line bg-inset px-2 py-1 text-body-s text-ink-700"
          }
        >
          {value}
        </li>
      ))}
    </ul>
  ) : <p className="text-body-s text-ink-500">{empty}</p>;
}

function ArtifactList({ artifacts }: { artifacts: EvidenceArtifact[] }) {
  return (
    <div className="space-y-3">
      {artifacts.map((artifact) => (
        <div key={artifact.artifact_id} className="border border-line-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-body-s text-ink-900">{artifact.kind}</strong>
            <span className="runway-num text-[0.7rem] text-ink-500">{artifact.evidence_class}</span>
          </div>
          <p className="runway-num mt-2 break-all text-[0.72rem] text-ink-600">{artifact.uri}</p>
          <p className="runway-num mt-1 text-[0.68rem] text-ink-400">version {artifact.version} · {artifact.digest_sha256}</p>
        </div>
      ))}
    </div>
  );
}

export function DecisionResult({ envelope }: { envelope: DecisionEnvelope }) {
  const [tab, setTab] = useState("decision");
  const isAbstention = envelope.overall.outcome === "abstained";
  const selectedCandidates = envelope.overall.selected_candidate_ids;

  return (
    <div className="flex flex-col gap-6" data-testid="decision-result">
      <ProofBoundary
        level={isAbstention ? "block" : envelope.overall.outcome === "partial" ? "info" : "proof"}
        title={outcomeLabels[envelope.overall.outcome]}
        icon={isAbstention ? ShieldAlert : ShieldCheck}
      >
        <p className="font-semibold">{envelope.overall.summary}</p>
        {isAbstention ? <p className="mt-2">No candidate or winner is inferred from this result.</p> : null}
      </ProofBoundary>

      <Tabs
        aria-label="Decision envelope"
        value={tab}
        onChange={setTab}
        items={[
          { value: "decision", label: "Decision" },
          { value: "evidence", label: "Evidence", count: envelope.artifacts.length },
          { value: "limits", label: "Limits" },
        ]}
      />

      {tab === "decision" ? (
        <div className="flex flex-col gap-6">
          <Section title="Scope and requested decision">
            <DataField label="Question" value={envelope.requested_decision} mono={false} />
            <DataField label="Testbed" value={`${envelope.testbed.testbed_id} · ${envelope.testbed.version}`} />
            <DataField label="Testbed digest" value={envelope.testbed.digest_sha256} border={false} />
          </Section>

          {selectedCandidates.length ? (
            <Section title="Candidates the evidence selected">
              <Tags values={selectedCandidates} />
              <p className="mt-3 text-body-s text-ink-500">
                The envelope records which candidates were selected. It carries no
                per-candidate score, so no ranking is shown here.
              </p>
            </Section>
          ) : null}

          <Section title="Claims answered, rejected, and unresolved">
            <div className="space-y-4">
              {envelope.claim_outcomes.map((claim) => (
                <article key={claim.claim_id} className="border-l-2 border-runway-signal pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-ink-900">{claim.statement}</h3>
                    <StatusChip tone={claim.outcome === "supported" ? "proof" : claim.outcome === "not_supported" ? "block" : "warn"} square>{claim.outcome.replace(/_/g, " ")}</StatusChip>
                  </div>
                  <p className="mt-1 text-body-s text-ink-700">{claim.conclusion}</p>
                  <p className="mt-1 text-body-s text-ink-500">Uncertainty: {claim.uncertainty}</p>
                  {claim.physical_evidence_required ? <p className="mt-1 text-body-s font-semibold text-runway-signal">Physical evidence remains necessary.</p> : null}
                </article>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "evidence" ? (
        <div className="flex flex-col gap-6">
          <Section title="Evidence methods selected and why">
            <div className="space-y-4">
              {envelope.evidence_methods.map((method) => (
                <article key={method.method_id}>
                  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-ink-900">{method.name}</h3><span className="runway-num text-[0.7rem] text-ink-500">{method.evidence_class}</span></div>
                  <p className="mt-1 text-body-s text-ink-700">{method.selection_reason}</p>
                  <p className="mt-1 text-body-s text-ink-500">Measured: {method.measured.join(", ") || "Nothing reported"}</p>
                  <p className="runway-num mt-1 text-[0.68rem] text-ink-400">Qualification {method.qualification_profile_ref.version} · {method.qualification_profile_ref.digest_sha256}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section title="Evidence provenance and exact artifacts">
            <ArtifactList artifacts={envelope.artifacts} />
            <p className="runway-num mt-4 text-[0.7rem] text-ink-500">Pipeline run {envelope.provenance.pipeline_run_id} · {envelope.provenance.generated_at_iso}</p>
          </Section>

          <Section title="Permitted evidence uses">
            <p className="text-body-s text-ink-700">{envelope.permitted_evidence_uses.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip tone={envelope.permitted_evidence_uses.evaluation ? "proof" : "block"} square>Evaluation {envelope.permitted_evidence_uses.evaluation ? "eligible" : "not eligible"}</StatusChip>
              <StatusChip tone={envelope.permitted_evidence_uses.post_training ? "proof" : "neutral"} square>Post-training {envelope.permitted_evidence_uses.post_training ? "eligible" : "not eligible"}</StatusChip>
            </div>
            <p className="mt-3 text-body-s font-semibold text-ink-700">This export does not prove that training happened or that a policy improved.</p>
          </Section>
        </div>
      ) : null}

      {tab === "limits" ? (
        <div className="flex flex-col gap-6">
          <Section title="Validation envelope and unsupported conditions">
            <h3 className="mb-2 font-display text-body-s font-semibold uppercase tracking-[0.005em] text-ink-800">Supported conditions</h3>
            <Tags values={envelope.validation_envelope.supported_conditions} />
            <h3 className="mb-2 mt-4 font-display text-body-s font-semibold uppercase tracking-[0.005em] text-ink-800">Unsupported conditions</h3>
            <Tags values={envelope.validation_envelope.unsupported_conditions} tone="block" />
            <p className="runway-num mt-4 text-[0.7rem] text-ink-500">Profiles: {envelope.validation_envelope.method_profile_versions.join(", ")}</p>
          </Section>

          <Section title="Coverage and uncertainty">
            <p className="text-body-s text-ink-700">{envelope.coverage.summary}</p>
            <p className="mt-3 text-body-s text-ink-700">{envelope.uncertainty.summary}</p>
            <div className="mt-3"><Tags values={envelope.uncertainty.sources} /></div>
          </Section>

          <Section title="Disagreements and correlated evidence">
            <p className="text-body-s text-ink-700">{envelope.disagreements.summary}</p>
            {envelope.disagreements.items.map((item) => <p key={`${item.claim_id}-${item.description}`} className="mt-2 border-l-2 border-runway-signal-dim pl-3 text-body-s text-ink-700">{item.description}</p>)}
            {envelope.disagreements.correlated_evidence_warning ? <p className="mt-3 border border-runway-signal-dim bg-runway-signal/[0.06] p-3 text-body-s font-semibold text-runway-mute">{envelope.disagreements.correlated_evidence_warning}</p> : null}
          </Section>

          <Section title="Physical evidence still needed">
            <p className="font-semibold text-ink-900">{envelope.physical_evidence.required ? "Required" : "Not required for the supported claims"}</p>
            <div className="mt-3"><Tags values={envelope.physical_evidence.reasons} empty="No remaining reason reported." /></div>
            {envelope.physical_evidence.authoritative_join_ids.length ? <p className="runway-num mt-3 text-[0.7rem] text-ink-500">Joined outcomes: {envelope.physical_evidence.authoritative_join_ids.join(", ")}</p> : null}
          </Section>

          <Section title="Next cheapest experiment">
            <p className="text-[15px] font-semibold text-ink-900">{envelope.next_cheapest_experiment.description}</p>
            <p className="mt-2 text-body-s text-ink-700">{envelope.next_cheapest_experiment.rationale}</p>
            <p className="runway-num mt-2 text-body-s text-ink-500">{[envelope.next_cheapest_experiment.estimated_cost, envelope.next_cheapest_experiment.estimated_time].filter(Boolean).join(" · ") || "Cost and timing not reported"}</p>
          </Section>

          <ProofBoundary level="warn" title="Claim ceiling">
            <p className="font-semibold text-ink-900">{envelope.claim_ceiling.level.replace(/_/g, " ")}</p>
            <p className="mt-2">{envelope.claim_ceiling.summary}</p>
            <h3 className="mb-2 mt-4 font-display text-body-s font-semibold uppercase tracking-[0.005em] text-ink-800">This result does not support</h3>
            <Tags values={envelope.claim_ceiling.prohibited_claims} tone="block" />
          </ProofBoundary>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="action" iconLeft={<Download />} onClick={() => downloadEnvelope(envelope)}>
          Export decision envelope
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app/runs">Back to runs</Link>
        </Button>
      </div>
    </div>
  );
}

function RunRecord({ run }: { run: BuyerRunDetail }) {
  const projection = run.decision_projection;
  return (
    <>
      <section className="runway-panel px-4">
        <DataField label="Request ID" value={run.request_id || run.job_id} />
        {run.decision_id ? <DataField label="Decision ID" value={run.decision_id} /> : null}
        <DataField label="Status" value={runStatusLabel(run.status)} mono={false} trailing={<StatusChip tone={runStatusTone(run.status)} square>{runStatusLabel(run.status)}</StatusChip>} />
        {run.testbed_id ? <DataField label="Testbed" value={`${run.testbed_id}${run.testbed_version ? ` · ${run.testbed_version}` : ""}`} /> : null}
        <DataField label="Created" value={run.created_at_iso || "Not recorded"} />
        <DataField label="Last update" value={run.updated_at_iso || "Not recorded"} border={Boolean(run.error)} />
        {run.error ? <DataField label="Run message" value={String(run.error)} border={false} /> : null}
      </section>

      {projection?.supported ? <DecisionResult envelope={projection.envelope} /> : null}
      {projection && !projection.supported ? (
        <ProofBoundary level="block" title="Unsupported Pipeline result" icon={ShieldAlert}>
          Blueprint kept the state visible and did not render it as success. {projection.reason}
        </ProofBoundary>
      ) : null}
      {!projection ? (
        <ProofBoundary level="info" title="Decision not available yet" icon={ShieldCheck}>
          This is a durable request record, not a fabricated result. The current state is {runStatusLabel(run.status)}.
        </ProofBoundary>
      ) : null}
      {run.benchmark ? <BenchmarkReportPanel benchmark={run.benchmark} /> : null}
    </>
  );
}

function RunNotFound({ runId }: { runId: string }) {
  return (
    <>
      <ProofBoundary level="block" title="Run record not available" icon={ShieldAlert}>
        Blueprint did not find a Task Evaluation Run owned by this account for {runId}. No sample decision is substituted.
      </ProofBoundary>
      <Button asChild variant="secondary" className="w-fit"><Link href="/app/runs">Return to runs</Link></Button>
    </>
  );
}

export default function RunDetail() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId || "";
  const { run, notFound, isLoading, error } = useBuyerAppRunDetail(runId);
  return (
    <AppShell active="runs" breadcrumb={`runs / ${runId || "unknown"}`}>
      <Helmet><title>{`${runId || "unknown"} · Task Evaluation Run · Blueprint`}</title><meta name="description" content="Protected Task Evaluation Run decision and evidence detail." /></Helmet>
      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href="/app/runs" className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />All Task Evaluation Runs</Link>
        <header className="border-b border-line pb-6"><h1 className="font-display text-[1.55rem] font-semibold uppercase tracking-[0.005em] text-ink-900">{run ? runDisplayName(run) : "Run record not available"}</h1><p className="mt-2 text-body-s text-ink-500">Decision, evidence envelope, unknowns, and provenance from the stored owner-scoped record.</p></header>
        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error && run ? <RunRecord run={run} /> : null}
        {!isLoading && !error && !run && notFound ? <RunNotFound runId={runId} /> : null}
      </div>
    </AppShell>
  );
}
