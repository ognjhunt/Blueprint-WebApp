/**
 * Step 04 — the standardized deployment offer.
 *
 * One form, the same fields for every team. That is the whole point: the site
 * should compare like with like, not read five differently-shaped sales decks
 * and try to normalise them by hand.
 *
 * Payment authorisation is collected here, before the offer can be submitted,
 * so an award can be charged the moment the site selects — rather than after
 * the two parties have met and the fee has become unenforceable.
 */

import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { BackLink, FlowRail, PreviewBanner, SectionRule } from "@/components/site/flow/FlowChrome";
import { offerFields, opportunity, type OfferField } from "@/data/opportunityFlow";
import { awardFee, evaluationFee, formatUsd } from "@/lib/deploymentPricing";

const GROUPS: readonly { id: OfferField["group"]; label: string; index: string }[] = [
  { id: "capability", label: "Capability", index: "01" },
  { id: "plan", label: "Pilot plan", index: "02" },
  { id: "commercial", label: "Commercial terms", index: "03" },
  { id: "risk", label: "Risk, rights and support", index: "04" },
];

export default function OpportunityOffer() {
  const [authorised, setAuthorised] = useState(false);

  return (
    <div className="min-h-screen bg-runway-deep text-runway-text">
      <SEO
        title={`${opportunity.id} · Deployment offer | Blueprint preview`}
        description="Design preview of the standardized Blueprint deployment offer."
        noIndex
      />
      <PreviewBanner />
      <BackLink href={`/internal/opportunity-board/${opportunity.id}/package`} label="Deployment package" />
      <FlowRail current="offer" />

      <header className="border-b border-runway-line px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-[86rem]">
          <span className="runway-num text-[15px] font-semibold tracking-[0.04em] text-runway-signal">
            {opportunity.id}
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[0.005em]">
            Deployment offer
          </h1>
          <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-runway-mute">
            Every team answers these same fields. That is what lets the site compare capability,
            timing, economics and risk side by side instead of reading five different decks.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[86rem] gap-10 px-6 py-9 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <form className="flex flex-col gap-9" onSubmit={(event) => event.preventDefault()}>
          {GROUPS.map((group) => (
            <section key={group.id}>
              <SectionRule index={group.index} title={group.label} />
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {offerFields
                  .filter((field) => field.group === group.id)
                  .map((field) => (
                    <label key={field.id} className="block">
                      <span className="runway-label">{field.label}</span>
                      <input
                        className="runway-input"
                        placeholder={field.hint ?? ""}
                        aria-label={field.label}
                      />
                    </label>
                  ))}
              </div>
            </section>
          ))}
        </form>

        <aside className="flex flex-col gap-5">
          <div className="runway-panel p-5 lg:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-runway-signal" aria-hidden="true" />
              <p className="runway-eyebrow">Before you can submit</p>
            </div>
            <p className="mt-4 text-[13.5px] leading-[1.65] text-runway-mute">
              Blueprint collects a payment authorisation now so an award can be charged the moment
              the site selects. Nothing is charged unless you win.
            </p>

            <dl className="mt-5 border-t border-runway-line pt-4">
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[13px] text-runway-mute">Already paid to evaluate</dt>
                <dd className="runway-num text-[13px]">{formatUsd(evaluationFee.amount)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[13px] text-runway-mute">Charged only if you are awarded</dt>
                <dd className="runway-num text-[13px] text-runway-signal">
                  {formatUsd(awardFee.total - evaluationFee.amount)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-runway-line-soft py-2">
                <dt className="text-[13px] text-runway-mute">Total if you win</dt>
                <dd className="runway-num text-[13px]">{formatUsd(awardFee.total)}</dd>
              </div>
            </dl>

            <label className="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                checked={authorised}
                onChange={(event) => setAuthorised(event.target.checked)}
                className="mt-[3px] h-4 w-4 shrink-0 rounded-none border-runway-line-strong bg-runway-panel accent-runway-signal"
              />
              <span className="text-[13px] leading-[1.55] text-runway-body">
                I authorise the award fee on selection, and accept the non-circumvention and
                opportunity-attribution terms for {opportunity.id}.
              </span>
            </label>

            <button type="button" disabled={!authorised} className="runway-cta mt-5 w-full disabled:opacity-40">
              Submit offer
            </button>
            <p className="mt-3 text-[12px] leading-[1.5] text-runway-faint">
              {awardFee.refund}
            </p>
          </div>

          <div className="border border-runway-line p-5 lg:p-6">
            <p className="runway-eyebrow-muted">Who sees this</p>
            <p className="mt-3 text-[13px] leading-[1.6] text-runway-mute">
              The site sees your offer as a blind label — Team A, B or C — until it shortlists. Your
              name reveals then, because operating credibility is part of the decision. Other teams
              never see your offer at all.
            </p>
            <Link
              href={`/internal/opportunity-board/${opportunity.id}/offers`}
              className="runway-cta-ghost mt-5 w-full"
            >
              See the site&rsquo;s view
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
