/**
 * Step 05 — the site compares offers, shortlists, and awards.
 *
 * Three states in one screen, because they are one decision:
 *
 *   blind      — offers as Team A/B/C, so capability is judged before brand
 *   shortlist  — names reveal, because operating credibility is part of it
 *   awarded    — the fee is charged and the site's identity unlocks
 *
 * The comparison is only possible because every team answered the same fields.
 */

import { useState } from "react";
import { Check, Lock, Unlock } from "lucide-react";

import { SEO } from "@/components/SEO";
import { BackLink, FlowRail, PreviewBanner, SectionRule } from "@/components/site/flow/FlowChrome";
import {
  circumventionControls,
  circumventionNote,
  opportunity,
  submittedOffers,
  unlockedOnAward,
  type SubmittedOffer,
} from "@/data/opportunityFlow";
import { awardFee, evaluationFee, formatUsd } from "@/lib/deploymentPricing";

type Stage = "blind" | "shortlist" | "awarded";

const ROWS: readonly { label: string; get: (offer: SubmittedOffer) => string; mono?: boolean }[] = [
  {
    label: "Can do it today",
    get: (o) => (o.canDoToday === "yes" ? "Yes" : o.canDoToday === "not-yet" ? "Not yet" : "No"),
  },
  { label: "Evaluation score", get: (o) => `${o.score} / 100`, mono: true },
  { label: "Cycle time", get: (o) => (o.cycleSeconds === null ? "—" : `${o.cycleSeconds}s`), mono: true },
  { label: "Uptime", get: (o) => (o.uptimePct === null ? "—" : `${o.uptimePct}%`), mono: true },
  { label: "Robots", get: (o) => (o.robots === null ? "—" : String(o.robots)), mono: true },
  {
    label: "Pilot start",
    get: (o) => (o.pilotStartWeeks === null ? "—" : `${o.pilotStartWeeks} weeks`),
    mono: true,
  },
  {
    label: "Pilot length",
    get: (o) => (o.pilotLengthDays === null ? "—" : `${o.pilotLengthDays} days`),
    mono: true,
  },
  { label: "Who pays whom", get: (o) => o.whoPays },
  { label: "Deployment price", get: (o) => o.price, mono: true },
  { label: "Term and model", get: (o) => o.term },
  { label: "Integration", get: (o) => o.integration },
  { label: "Main risk", get: (o) => o.risk },
  { label: "Data rights", get: (o) => o.dataRights },
  { label: "Support", get: (o) => o.support },
  { label: "Insurance and safety", get: (o) => o.insurance },
  { label: "References", get: (o) => o.references },
];

export default function OpportunityOffers() {
  const [stage, setStage] = useState<Stage>("blind");
  const [awarded, setAwarded] = useState<string | null>(null);

  const visible =
    stage === "blind" ? submittedOffers : submittedOffers.filter((offer) => offer.shortlisted);

  return (
    <div className="min-h-screen bg-runway-deep text-runway-text">
      <SEO
        title={`${opportunity.id} · Compare offers | Blueprint preview`}
        description="Design preview of the Blueprint offer comparison and award."
        noIndex
      />
      <PreviewBanner />
      <BackLink href="/internal/opportunity-board" label="My listings" />
      <FlowRail current="award" />

      <header className="border-b border-runway-line px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="runway-num text-[15px] font-semibold tracking-[0.04em] text-runway-signal">
              {opportunity.id}
            </span>
            <h1 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[0.005em]">
              {submittedOffers.length} offers, one form
            </h1>
            <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-runway-mute">
              Every team answered the same fields against the same captured task, so these columns
              are directly comparable. You pay Blueprint nothing at any point.
            </p>
          </div>

          {/* stage control */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {(["blind", "shortlist", "awarded"] as Stage[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStage(value)}
                aria-pressed={stage === value}
                className={`border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors ${
                  stage === value
                    ? "border-runway-signal text-runway-signal"
                    : "border-runway-line-strong text-runway-mute hover:border-runway-signal hover:text-runway-signal"
                }`}
              >
                {value === "blind" ? "Blind" : value === "shortlist" ? "Shortlisted" : "Awarded"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[92rem] px-6 py-9 lg:px-8">
        <p className="runway-meta mb-4">
          {stage === "blind"
            ? "Names hidden — judge the capability first"
            : stage === "shortlist"
              ? "Shortlisted: names revealed, because operating credibility is part of the decision"
              : "Awarded — the fee is charged and the identity unlocks to the winner"}
        </p>

        <div className="overflow-x-auto">
          <table className="runway-table min-w-[58rem]">
            <caption className="sr-only">Submitted deployment offers, compared field by field</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[190px]">Field</th>
                {visible.map((offer) => (
                  <th key={offer.blindLabel} scope="col">
                    {stage === "blind" ? offer.blindLabel : offer.teamName}
                    <span className="mt-[3px] block font-mono text-[9.5px] uppercase tracking-[0.1em] text-runway-mute">
                      {offer.embodiment}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="text-runway-mute">{row.label}</td>
                  {visible.map((offer) => (
                    <td key={offer.blindLabel + row.label}>
                      <span className={row.mono ? "runway-num text-[12.5px]" : undefined}>
                        {row.get(offer)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="font-semibold text-runway-text">Decision</td>
                {visible.map((offer) => (
                  <td key={offer.blindLabel + "-action"}>
                    {awarded === offer.teamName ? (
                      <span className="runway-chip runway-chip-live">Awarded</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAwarded(offer.teamName);
                          setStage("awarded");
                        }}
                        className="runway-cta-ghost min-h-0 px-4 py-2 text-[12px]"
                      >
                        Select {stage === "blind" ? offer.blindLabel : offer.teamName.split(" ")[0]}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ---- what awarding does ---- */}
        <div className="mt-10 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="bg-runway-black p-5 lg:p-6">
            <div className="flex items-center gap-2">
              {awarded ? (
                <Unlock className="h-4 w-4 text-runway-green" aria-hidden="true" />
              ) : (
                <Lock className="h-4 w-4 text-runway-faint" aria-hidden="true" />
              )}
              <p className={awarded ? "runway-eyebrow" : "runway-eyebrow-muted"}>
                {awarded ? `Unlocked to ${awarded}` : "Unlocks to the winner on award"}
              </p>
            </div>
            <ul className="mt-4 grid gap-[10px]">
              {unlockedOnAward.map((item) => (
                <li key={item} className="flex gap-3 text-[13.5px] leading-[1.55] text-runway-body">
                  <Check
                    className={`mt-[3px] h-[14px] w-[14px] shrink-0 ${
                      awarded ? "text-runway-green" : "text-runway-faint"
                    }`}
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <dl className="mt-5 border-t border-runway-line pt-4">
              <div className="flex items-baseline justify-between gap-4 py-1">
                <dt className="text-[13px] text-runway-mute">Charged to the winner on award</dt>
                <dd className="runway-num text-[13px] text-runway-signal">
                  {formatUsd(awardFee.total - evaluationFee.amount)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-1">
                <dt className="text-[13px] text-runway-mute">Charged to the site</dt>
                <dd className="runway-num text-[13px] text-runway-green">{formatUsd(0)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[12.5px] leading-[1.6] text-runway-faint">
              If the winner declines or does not pay, the award passes to the next team and nothing
              unlocks. {awardFee.refund}
            </p>
          </div>

          <div className="bg-runway-black p-5 lg:p-6">
            <p className="runway-eyebrow-muted">Why this holds together</p>
            <ul className="mt-4 grid gap-[9px]">
              {circumventionControls.map((control) => (
                <li
                  key={control.id}
                  className="flex gap-3 text-[13px] leading-[1.5] text-runway-mute"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-runway-signal"
                  />
                  {control.label}
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-runway-line-soft pt-4 text-[12.5px] leading-[1.6] text-runway-faint">
              Deliberate collusion can never be eliminated — once people meet, secrecy is over.{" "}
              {circumventionNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
