import { useMemo, useState } from "react";
import { Check, Gauge, Lock } from "lucide-react";

import {
  attributionTerms,
  calculateDeploymentCost,
  deploymentFees,
  evaluationCredit,
  formatBand,
  formatUsd,
  recurringValue,
  revenueShareAlternative,
} from "@/lib/deploymentPricing";

const MAX_ROBOTS = 500;
const MAX_MONTHS = 60;

function clampInt(value: string, max: number) {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.floor(parsed)), max);
}

/**
 * The model, priced on the two units either party can count: an activated
 * site-task and an active robot-month. The calculator exists to show that the
 * evaluation credit makes a team that deploys pay nothing extra for it.
 */
export function DeploymentPricingModel() {
  const [robots, setRobots] = useState("3");
  const [months, setMonths] = useState("12");
  const [creditPaid, setCreditPaid] = useState(true);

  const robotCount = clampInt(robots, MAX_ROBOTS);
  const monthCount = clampInt(months, MAX_MONTHS);

  const cost = useMemo(
    () =>
      calculateDeploymentCost({
        robots: robotCount,
        months: monthCount,
        evaluationCreditPaid: creditPaid,
        bound: "low",
      }),
    [robotCount, monthCount, creditPaid],
  );

  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      {/* ---- the schedule ---- */}
      <div className="runway-panel overflow-hidden">
        <div className="border-b border-runway-line p-6 lg:p-8">
          <p className="runway-eyebrow">Observable units · not a contract percentage</p>
          <h3 className="mt-4 font-display text-[clamp(1.9rem,3.2vw,2.7rem)] font-semibold uppercase leading-none tracking-[0.005em]">
            Pay when robots work
          </h3>
          <p className="mt-4 max-w-[42rem] text-body-s leading-7 text-runway-mute">
            Blueprint bills an activated site-task and an active robot-month. Both are countable
            by either party from the deployment record, which is what keeps the fee out of a
            dispute about somebody else&rsquo;s confidential contract value.
          </p>
        </div>

        <dl>
          <div className="flex items-baseline justify-between gap-4 border-b border-runway-line-soft px-6 py-4 lg:px-8">
            <div>
              <dt className="text-[14px] font-semibold text-runway-text">Evaluation credit</dt>
              <dd className="mt-1 text-[13px] leading-6 text-runway-mute">
                {evaluationCredit.unit}. Returned in full against deployment.
              </dd>
            </div>
            <span className="runway-num shrink-0 text-[15px] text-runway-text">
              {formatBand(evaluationCredit.low, evaluationCredit.high)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-runway-line-soft px-6 py-4 lg:px-8">
            <div>
              <dt className="text-[14px] font-semibold text-runway-text">Deployment activation</dt>
              <dd className="mt-1 text-[13px] leading-6 text-runway-mute">
                {deploymentFees.activation.detail}
              </dd>
            </div>
            <span className="runway-num shrink-0 text-[15px] text-runway-text">
              {formatUsd(deploymentFees.activation.amount)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-6 py-4 lg:px-8">
            <div>
              <dt className="text-[14px] font-semibold text-runway-text">Active robot-month</dt>
              <dd className="mt-1 text-[13px] leading-6 text-runway-mute">
                {deploymentFees.robotMonth.detail}
              </dd>
            </div>
            <span className="runway-num shrink-0 text-[15px] text-runway-text">
              {formatBand(deploymentFees.robotMonth.low, deploymentFees.robotMonth.high)}
            </span>
          </div>
        </dl>

        <div className="border-t border-runway-line bg-runway-black px-6 py-5 lg:px-8">
          <p className="runway-meta">Where a percentage applies instead</p>
          <p className="mt-2 text-[13px] leading-6 text-runway-mute">
            {Math.round(revenueShareAlternative.firstYearLow * 100)}&ndash;
            {Math.round(revenueShareAlternative.firstYearHigh * 100)}% of first-year revenue,
            offered only where Blueprint controls invoicing or receives audited reporting.{" "}
            {revenueShareAlternative.renewalNote}
          </p>
        </div>
      </div>

      {/* ---- the calculator ---- */}
      <div className="flex flex-col gap-6">
        <div className="runway-panel p-6 lg:p-8">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-runway-signal" aria-hidden="true" />
            <p className="runway-eyebrow">What a deployment costs</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="runway-label">Active robots</span>
              <input
                className="runway-input runway-num"
                inputMode="numeric"
                value={robots}
                onChange={(event) => setRobots(event.target.value)}
                aria-label="Active robots"
              />
            </label>
            <label className="block">
              <span className="runway-label">Months</span>
              <input
                className="runway-input runway-num"
                inputMode="numeric"
                value={months}
                onChange={(event) => setMonths(event.target.value)}
                aria-label="Months"
              />
            </label>
          </div>

          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={creditPaid}
              onChange={(event) => setCreditPaid(event.target.checked)}
              className="mt-[3px] h-4 w-4 shrink-0 rounded-none border-runway-line-strong bg-runway-panel accent-runway-signal"
            />
            <span className="text-[13px] leading-6 text-runway-mute">
              This team already paid an evaluation credit on this site-task
            </span>
          </label>

          <dl className="mt-6 border-t border-runway-line pt-4">
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-[13px] text-runway-mute">Activation</dt>
              <dd className="runway-num text-[13px]">{formatUsd(cost.activation)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-[13px] text-runway-mute">
                Robot-months{" "}
                <span className="runway-num text-runway-faint">
                  ({robotCount} &times; {monthCount})
                </span>
              </dt>
              <dd className="runway-num text-[13px]">{formatUsd(cost.robotMonths)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-runway-line-soft py-2">
              <dt className="text-[13px] text-runway-mute">Evaluation credit returned</dt>
              <dd className="runway-num text-[13px] text-runway-green">
                {cost.creditApplied > 0 ? `−${formatUsd(cost.creditApplied)}` : formatUsd(0)}
              </dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-runway-line pt-4">
              <dt className="font-display text-[15px] font-semibold uppercase tracking-[0.005em] text-runway-text">
                Total to Blueprint
              </dt>
              <dd className="runway-num text-[1.6rem] leading-none text-runway-signal">
                {formatUsd(cost.total)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[12px] leading-5 text-runway-faint">
            Modelled at the low end of each posted band. These are Blueprint&rsquo;s starting
            terms under test, not an industry rate — no independent source establishes a market
            price for this service yet.
          </p>
        </div>

        <div className="border border-runway-line p-6 lg:p-8">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-runway-signal" aria-hidden="true" />
            <p className="runway-eyebrow">What the recurring fee buys</p>
          </div>
          <ul className="mt-4 grid gap-3">
            {recurringValue.map((item) => (
              <li key={item.id} className="flex gap-3">
                <Check className="mt-[3px] h-4 w-4 shrink-0 text-runway-green" aria-hidden="true" />
                <span className="text-[13.5px] leading-6 text-runway-mute">
                  <strong className="font-semibold text-runway-text">{item.label}.</strong>{" "}
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-runway-line-soft pt-4 text-[12.5px] leading-6 text-runway-faint">
            Before identifiable detail is released both parties sign an opportunity-specific
            acknowledgment covering {attributionTerms.length} points: attribution, reporting and
            audit. That is the backstop. The maintained product above is the reason to stay.
          </p>
        </div>
      </div>
    </div>
  );
}
