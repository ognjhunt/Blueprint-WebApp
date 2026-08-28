/**
 * Steps 02–03 — the unlocked deployment package.
 *
 * What $1,000 opens. Still de-identified: the package is everything needed to
 * answer "can our robot do this job?", with nothing that answers "whose job is
 * it?". Watermarking and access logging are stated on the page rather than
 * buried in terms, because they are the reason a site is willing to hand this
 * over at all.
 */

import { Link } from "wouter";
import { Check, Eye, FileWarning } from "lucide-react";

import { SEO } from "@/components/SEO";
import { BackLink, FlowRail, PreviewBanner, SectionRule } from "@/components/site/flow/FlowChrome";
import { deploymentPackage, opportunity, packageControls } from "@/data/opportunityFlow";
import { evaluationFee, formatUsd } from "@/lib/deploymentPricing";

export default function OpportunityPackage() {
  return (
    <div className="min-h-screen bg-runway-deep text-runway-text">
      <SEO
        title={`${opportunity.id} · Deployment package | Blueprint preview`}
        description="Design preview of an unlocked Blueprint deployment package."
        noIndex
      />
      <PreviewBanner />
      <BackLink href={`/internal/opportunity-board/${opportunity.id}/anonymous`} label="Opportunity" />
      <FlowRail current="evaluate" />

      <header className="border-b border-runway-line px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[86rem] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="runway-num text-[15px] font-semibold tracking-[0.04em] text-runway-signal">
                {opportunity.id}
              </span>
              <span className="runway-chip runway-chip-live">
                Package unlocked · {formatUsd(evaluationFee.amount)} paid
              </span>
              <span className="runway-chip runway-chip-neutral">Site still de-identified</span>
            </div>
            <h1 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[0.005em]">
              Deployment package
            </h1>
            <p className="mt-3 max-w-[64ch] text-[15px] leading-[1.6] text-runway-mute">
              Everything needed to answer whether your robot can do this job. Nothing that answers
              whose job it is — that unlocks only if you are awarded the work.
            </p>
          </div>
          <Link href={`/internal/opportunity-board/${opportunity.id}/offer`} className="runway-cta shrink-0">
            Submit deployment offer
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[86rem] px-6 py-9 lg:px-8">
        <SectionRule index="01" title="What is in the package" />
        <div className="mt-5 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-3">
          {deploymentPackage.map((item) => (
            <div key={item.id} className="bg-runway-panel p-5 lg:p-6">
              <div className="flex items-baseline gap-2">
                <Check className="h-4 w-4 shrink-0 translate-y-[2px] text-runway-green" aria-hidden="true" />
                <h3 className="font-display text-[15px] font-semibold uppercase tracking-[0.005em] text-runway-text">
                  {item.label}
                </h3>
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-runway-mute">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="bg-runway-black p-5 lg:p-6">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-runway-signal" aria-hidden="true" />
              <p className="runway-eyebrow">How this package is controlled</p>
            </div>
            <ul className="mt-4 grid gap-[10px]">
              {packageControls.map((control) => (
                <li key={control} className="flex gap-3 text-[13.5px] leading-[1.55] text-runway-body">
                  <span
                    aria-hidden="true"
                    className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-runway-signal"
                  />
                  {control}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-runway-black p-5 lg:p-6">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-runway-faint" aria-hidden="true" />
              <p className="runway-eyebrow-muted">Your evaluation is yours</p>
            </div>
            <p className="mt-4 text-[13.5px] leading-[1.65] text-runway-mute">
              Nobody — not the site, not another team — sees your result, or that you evaluated at
              all, unless you submit an offer. A team that runs the evaluation and walks away leaves
              no public trace.
            </p>
            <p className="mt-4 text-[13.5px] leading-[1.65] text-runway-mute">
              Run up to 500 episodes against the twin. The rubric that scores them is the same one
              that scores the on-site week and the pilot gate, so a result here means something
              later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
