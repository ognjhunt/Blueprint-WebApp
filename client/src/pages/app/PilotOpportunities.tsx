import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button, DataField, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { usePilotOpportunities, type PilotOpportunityRecord } from "@/lib/pilotOpportunities";

function OpportunityCard({ opportunity }: { opportunity: PilotOpportunityRecord }) {
  const approvedFull = opportunity.access_level === "shortlisted_confidential";
  return (
    <article className="overflow-hidden rounded-md border border-line bg-paper-0">
      <header className="flex flex-col gap-4 border-b border-line-soft p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink-400">
            {opportunity.opportunity_id}
          </p>
          <h2 className="mt-2 text-title-m font-semibold tracking-tight text-ink-900">
            {approvedFull ? opportunity.site_name || "Approved site opportunity" : opportunity.site_type || "Anonymized site opportunity"}
          </h2>
          <p className="mt-2 max-w-[48rem] text-body-s leading-7 text-ink-600">
            {opportunity.workflow}
          </p>
        </div>
        <StatusChip tone="proof" square>
          Evaluation candidate
        </StatusChip>
      </header>

      <div className="grid gap-px bg-line md:grid-cols-2">
        <div className="bg-paper-0">
          <DataField label="Access" value={approvedFull ? "Shortlisted confidential dossier" : "Operator-approved anonymized summary"} mono={false} />
          <DataField label="Site type" value={opportunity.site_type || "Not disclosed"} mono={false} />
          <DataField label="Standardized benchmark" value={opportunity.benchmark_profile} mono={false} />
          {approvedFull ? (
            <>
              <DataField label="Location" value={opportunity.site_location || "Held in dossier"} mono={false} />
              <DataField label="Objects and variability" value={opportunity.object_profile || "Not recorded"} mono={false} border={false} />
            </>
          ) : (
              <DataField label="Identity" value="Withheld by operator permission" mono={false} border={false} />
          )}
        </div>
        <div className="bg-paper-0">
          {approvedFull ? (
            <>
              <DataField label="Operations" value={opportunity.operational_profile || "Not recorded"} mono={false} />
              <DataField label="Integration" value={opportunity.integration_environment || "Not recorded"} mono={false} />
              <DataField label="Owner and rollout" value={opportunity.rollout_readiness || "Not recorded"} mono={false} border={false} />
            </>
          ) : (
            <DataField label="Approved summary" value={opportunity.anonymized_summary || opportunity.workflow} mono={false} border={false} />
          )}
        </div>
      </div>

      <div className="border-t border-line-soft p-5">
        <h3 className="text-caption font-semibold uppercase tracking-eyebrow text-brass-deep">
          Controlled evaluation and data use
        </h3>
        <div className="mt-4 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Evaluate existing policy", "Granted"],
            ["Adapt for this site", opportunity.data_use_permissions.siteSpecificAdaptation.replace(/_/g, " ")],
            ["Retain improvements", opportunity.data_use_permissions.retainImprovements.replace(/_/g, " ")],
            ["General model training", opportunity.data_use_permissions.generalModelTraining.replace(/_/g, " ")],
          ].map(([label, value]) => (
            <div key={label} className="bg-paper-0 p-4">
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">{label}</p>
              <p className="mt-2 text-body-s font-semibold capitalize text-ink-800">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 text-caption leading-6 text-ink-500 md:grid-cols-2">
          <p>
            Site-model files remain hosted inside Blueprint and are not downloadable. Submit an
            approved robot specification, policy/container, sensors, APIs, and performance assumptions
            for a controlled run.
          </p>
          <p>{opportunity.compute_responsibility}</p>
        </div>
        <p className="mt-3 border-t border-line-soft pt-3 text-caption leading-6 text-ink-500">
          The bounded run can report completion rate, expected cycle time, reach or collision
          failures, fleet and charging assumptions, unhandled edge cases, and estimated integration
          burden. Real-world acceptance testing is still required.
        </p>
      </div>

      <footer className="flex flex-col gap-4 border-t border-line-soft bg-inset p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[48rem] text-caption leading-6 text-ink-500">{opportunity.claim_ceiling}</p>
        <Button asChild variant="secondary" size="md" iconRight={<ArrowRight />}>
          <Link href="/app/runs/new">Request controlled evaluation</Link>
        </Button>
      </footer>
    </article>
  );
}

export default function PilotOpportunities() {
  const { opportunities, proofBoundary, isLoading, error } = usePilotOpportunities();

  return (
    <AppShell active="opportunities" breadcrumb="private opportunities">
      <Helmet>
        <title>Private pilot opportunities · Blueprint</title>
        <meta
          name="description"
          content="Permission-matched, gate-passed site opportunities for authenticated robot teams."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-7 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow tone="brass" rule>Permissioned network</Eyebrow>
            <h1 className="mt-3 text-[1.65rem] font-semibold tracking-tight text-ink-900">
              Pilot opportunities
            </h1>
            <p className="mt-2 max-w-[46rem] text-body-s leading-7 text-ink-500">
              Standardized site-task dossiers appear only after the operator&apos;s visibility choice,
              capture, rights, qualification, and explicit opportunity-review gates pass.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-caption font-semibold text-ink-500">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Authenticated robot teams only
          </span>
        </header>

        <section aria-label="Opportunity access ladder" className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["01", "Anonymized summary"],
            ["02", "Benchmark"],
            ["03", "Controlled evaluation"],
            ["04", "Shortlisted package"],
            ["05", "Separate training rights"],
          ].map(([index, label]) => (
            <div key={index} className="bg-paper-0 p-4">
              <p className="font-mono text-micro text-ink-400">{index}</p>
              <p className="mt-2 text-caption font-semibold text-ink-800">{label}</p>
            </div>
          ))}
        </section>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error && opportunities.length === 0 ? (
          <ProofBoundary level="info" title="No permission-matched opportunities" icon={ShieldCheck}>
            No site dossier currently passes every visibility, capture, rights, qualification, and
            opportunity-review gate for this robot-team account. Incomplete, private, rejected, and
            unmatched records remain hidden.
          </ProofBoundary>
        ) : null}
        {!isLoading && !error && opportunities.length > 0 ? (
          <section aria-label="Qualified pilot opportunities" className="flex flex-col gap-5">
            {opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.opportunity_id} opportunity={opportunity} />
            ))}
          </section>
        ) : null}
        {proofBoundary ? (
          <ProofBoundary level="info" title="Feed boundary" icon={ShieldCheck}>
            {proofBoundary}
          </ProofBoundary>
        ) : null}
      </div>
    </AppShell>
  );
}
