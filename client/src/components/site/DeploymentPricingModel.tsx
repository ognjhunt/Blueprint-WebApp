import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import {
  calculateTeamCost,
  chargeSummary,
  deploymentFee,
  evaluationFee,
  formatUsd,
  settlement,
  vendorFundedPilots,
} from "@/lib/deploymentPricing";

const MAX_TASKS = 99;

function clampInt(value: string, max: number) {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.floor(parsed)), max);
}

/** Two numbers, and a calculator that only has to add them up. */
export function DeploymentPricingModel() {
  const [evaluated, setEvaluated] = useState("3");
  const [won, setWon] = useState("1");

  const evaluatedCount = clampInt(evaluated, MAX_TASKS);
  const wonCount = Math.min(clampInt(won, MAX_TASKS), evaluatedCount);

  const cost = useMemo(
    () => calculateTeamCost({ evaluated: evaluatedCount, won: wonCount }),
    [evaluatedCount, wonCount],
  );

  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      {/* ---- the whole price list ---- */}
      <div className="flex flex-col gap-6">
        <div className="runway-panel overflow-hidden">
          <div className="border-b border-runway-line p-6 lg:p-8">
            <p className="runway-eyebrow">The whole price list</p>
            <p className="mt-3 text-[14px] leading-[1.65] text-runway-mute">{deploymentFee.rule}</p>
          </div>
          <dl>
            {chargeSummary.map((row, index) => (
              <div
                key={row.id}
                className={`flex items-baseline justify-between gap-4 px-6 py-5 lg:px-8 ${
                  index < chargeSummary.length - 1 ? "border-b border-runway-line-soft" : ""
                }`}
              >
                <dt className="text-[14px] leading-[1.5] text-runway-body">{row.label}</dt>
                <dd
                  className={`runway-num shrink-0 text-[1.5rem] leading-none ${
                    row.amount === 0 ? "text-runway-green" : "text-runway-text"
                  }`}
                >
                  {formatUsd(row.amount)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-runway-line bg-runway-black px-6 py-5 text-[13px] leading-[1.6] text-runway-faint lg:px-8">
            {deploymentFee.noExtras}
          </p>
        </div>

        <div className="border border-runway-line p-6 lg:p-8">
          <p className="runway-eyebrow">What the {formatUsd(evaluationFee.amount)} buys</p>
          <ul className="mt-4 grid gap-2">
            {evaluationFee.includes.map((item) => (
              <li key={item} className="flex gap-3 text-[13.5px] leading-6 text-runway-body">
                <Check className="mt-[4px] h-4 w-4 shrink-0 text-runway-green" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-runway-line-soft pt-4 text-[12.5px] leading-6 text-runway-faint">
            {evaluationFee.note}
          </p>
        </div>
      </div>

      {/* ---- the calculator + the notes ---- */}
      <div className="flex flex-col gap-6">
        <div className="runway-panel p-6 lg:p-8">
          <p className="runway-eyebrow">What a robot team owes</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="runway-label">Site-tasks evaluated</span>
              <input
                className="runway-input runway-num"
                inputMode="numeric"
                value={evaluated}
                onChange={(event) => setEvaluated(event.target.value)}
                aria-label="Site-tasks evaluated"
              />
            </label>
            <label className="block">
              <span className="runway-label">Of those, won</span>
              <input
                className="runway-input runway-num"
                inputMode="numeric"
                value={won}
                onChange={(event) => setWon(event.target.value)}
                aria-label="Of those, won"
              />
            </label>
          </div>

          <dl className="mt-6 border-t border-runway-line pt-4">
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-[13px] text-runway-mute">
                Evaluations{" "}
                <span className="runway-num text-runway-faint">
                  ({evaluatedCount} × {formatUsd(evaluationFee.amount)})
                </span>
              </dt>
              <dd className="runway-num text-[13px]">{formatUsd(cost.evaluations)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-runway-line-soft py-2">
              <dt className="text-[13px] text-runway-mute">
                On selection{" "}
                <span className="runway-num text-runway-faint">
                  ({wonCount} × {formatUsd(deploymentFee.total - evaluationFee.amount)})
                </span>
              </dt>
              <dd className="runway-num text-[13px]">{formatUsd(cost.selectionTopUp)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-runway-line pt-4">
              <dt className="font-display text-[15px] font-semibold uppercase tracking-[0.005em] text-runway-text">
                Total to Blueprint
              </dt>
              <dd className="runway-num text-[1.7rem] leading-none text-runway-signal">
                {formatUsd(cost.total)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[12px] leading-5 text-runway-faint">
            The site pays {formatUsd(0)}. Posted starting terms Blueprint intends to test, not an
            industry rate — no independent source establishes a market price for this service yet.
          </p>
        </div>

        <div className="border border-runway-line p-6 lg:p-8">
          <p className="runway-eyebrow">{vendorFundedPilots.label}</p>
          <p className="mt-3 text-[13.5px] leading-[1.65] text-runway-mute">
            {vendorFundedPilots.detail}
          </p>
          <p className="mt-5 border-t border-runway-line-soft pt-4 text-[13.5px] leading-[1.65] text-runway-mute">
            {settlement.today}
          </p>
        </div>
      </div>
    </div>
  );
}
