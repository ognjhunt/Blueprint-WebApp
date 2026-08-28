/**
 * Step 01 — the anonymous opportunity.
 *
 * Everything a robot team needs to decide whether to spend $1,000 finding out
 * if it can do the job: the technical envelope and the commercial envelope.
 * Nothing that identifies the operator.
 *
 * The commercial half is here deliberately. A team should know the opportunity
 * is real — budget approved, scale, timing — before it spends evaluation time.
 * What is NOT here is a pre-written robot contract: the team proposes the
 * economics at step 04, because feasibility determines what it can offer.
 */

import { Link } from "wouter";
import { Lock } from "lucide-react";

import { SEO } from "@/components/SEO";
import { BackLink, FieldRow, FlowRail, PreviewBanner, SectionRule } from "@/components/site/flow/FlowChrome";
import { disclosurePolicy, opportunity } from "@/data/opportunityFlow";
import { evaluationFee, formatUsd } from "@/lib/deploymentPricing";

export default function OpportunityAnonymous() {
  const { technical: tech, commercial: comm } = opportunity;

  return (
    <div className="min-h-screen bg-runway-deep text-runway-text">
      <SEO
        title={`${opportunity.id} · ${opportunity.title} | Blueprint preview`}
        description="Design preview of an anonymous Blueprint opportunity."
        noIndex
      />
      <PreviewBanner />
      <BackLink href="/internal/opportunity-board" label="Open evals" />
      <FlowRail current="view" />

      <header className="border-b border-runway-line px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[86rem] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="runway-num text-[15px] font-semibold tracking-[0.04em] text-runway-signal">
                {opportunity.id}
              </span>
              <span className="runway-chip runway-chip-neutral">Identity withheld until award</span>
              <span className="runway-chip runway-chip-open">
                Proposals close {opportunity.proposalsClose}
              </span>
            </div>
            <h1 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[0.005em]">
              {opportunity.title}
            </h1>
            <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-runway-mute">
              {opportunity.teaser}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <Link href={`/internal/opportunity-board/${opportunity.id}/package`} className="runway-cta">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Unlock package — {formatUsd(evaluationFee.amount)}
            </Link>
            <p className="runway-meta lg:text-right">
              Credited toward the award fee if you win
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[86rem] gap-10 px-6 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
        {/* ---- technical envelope ---- */}
        <section>
          <SectionRule index="01" title="Technical envelope" aside="Can your robot do it?" />
          <dl className="mt-5 border border-runway-line p-5 lg:p-6">
            <FieldRow label="Task" value={tech.task} />
            <FieldRow label="Objects" value={tech.objects} />
            <FieldRow
              label="Payload range"
              value={`${tech.payloadKg[0]}–${tech.payloadKg[1]} kg`}
              mono
            />
            <FieldRow label="Reach and stations" value={tech.reach} />
            <FieldRow label="Human cycle, median" value={`${tech.humanCycleSeconds}s · n=142`} mono />
            <FieldRow label="Throughput" value={`${tech.movesPerHour} moves / hour`} mono />
            <FieldRow label="Shifts" value={String(tech.shifts)} mono />
            <FieldRow label="Success gate" value={tech.successGate} mono />
            <FieldRow label="Environment" value={tech.environment} />
            <FieldRow label="Integrations" value={tech.integrations.join(" · ")} />
            <FieldRow label="Exceptions" value={tech.exceptions} last />
          </dl>
        </section>

        {/* ---- commercial envelope ---- */}
        <section>
          <SectionRule index="02" title="Commercial envelope" aside="Is it worth doing?" />
          <dl className="mt-5 border border-runway-line p-5 lg:p-6">
            <FieldRow
              label="Budget approved"
              value={comm.budgetApproved ? "Yes — allocated, with a named owner" : "Not yet"}
            />
            <FieldRow label="Pilot budget" value={comm.pilotBudget} mono />
            <FieldRow label="Preferred model" value={comm.preferredModel} />
            <FieldRow label="Target economics" value={comm.targetEconomics} />
            <FieldRow label="Initial scale" value={comm.initialScale} mono />
            <FieldRow label="Expansion potential" value={comm.expansionPotential} mono />
            <FieldRow label="Target deployment" value={comm.targetDeployment} mono />
            <FieldRow label="Procurement constraints" value={comm.procurementConstraints} last />
          </dl>
          <p className="mt-4 text-[13px] leading-[1.6] text-runway-faint">
            The site states the problem, the budget and the timing. You propose the solution and the
            exact economics at step 04 — feasibility is what determines what you can offer.
          </p>
        </section>
      </div>

      {/* ---- what is withheld ---- */}
      <div className="border-t border-runway-line bg-runway-black">
        <div className="mx-auto max-w-[86rem] px-6 py-9 lg:px-8">
          <SectionRule index="03" title="What is withheld, and why" />
          <div className="mt-5 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="bg-runway-deep p-5 lg:p-6">
              <p className="runway-eyebrow-muted">Held back until award</p>
              <ul className="mt-4 grid gap-[10px]">
                {opportunity.withheld.map((item) => (
                  <li key={item} className="flex gap-3 text-[13.5px] leading-[1.55] text-runway-mute">
                    <Lock className="mt-[3px] h-[13px] w-[13px] shrink-0 text-runway-faint" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-runway-deep p-5 lg:p-6">
              <p className="runway-eyebrow">{disclosurePolicy.headline}</p>
              <dl className="mt-4">
                {disclosurePolicy.rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className={`grid gap-1 py-[10px] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-5 ${
                      index < disclosurePolicy.rules.length - 1 ? "border-b border-runway-line-soft" : ""
                    }`}
                  >
                    <dt className="text-[13px] text-runway-text">
                      {rule.subject}
                      <span className="mt-[2px] block font-mono text-[9.5px] uppercase tracking-[0.1em] text-runway-signal">
                        {rule.state}
                      </span>
                    </dt>
                    <dd className="text-[12.5px] leading-[1.5] text-runway-mute">{rule.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
