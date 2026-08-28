import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import {
  calculateDeploymentFee,
  deploymentFee,
  evaluationFee,
  formatUsd,
  settlement,
  vendorFundedPilots,
} from "@/lib/deploymentPricing";

const MAX_ROBOTS = 500;

function clampInt(value: string, max: number) {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.floor(parsed)), max);
}

/**
 * Two charges, and a calculator whose only job is to show where the greater-of
 * flips — because that is the part people have to see once to trust.
 */
export function DeploymentPricingModel() {
  const [robots, setRobots] = useState("5");
  const robotCount = clampInt(robots, MAX_ROBOTS);

  const fee = useMemo(
    () => calculateDeploymentFee({ robots: robotCount, wonAfterEvaluating: true }),
    [robotCount],
  );

  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      {/* ---- the two charges ---- */}
      <div className="flex flex-col gap-6">
        <div className="runway-panel p-6 lg:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="runway-eyebrow">1 · Evaluation fee</p>
            <span className="runway-num text-[1.9rem] leading-none text-runway-text">
              {formatUsd(evaluationFee.amount)}
            </span>
          </div>
          <p className="mt-2 runway-meta">{evaluationFee.unit}</p>
          <p className="mt-4 text-[14px] leading-[1.65] text-runway-mute">
            Paid by every robot team that runs a real evaluation. Not a compute markup — it buys a
            captured task, a standardised test, and a scored result.
          </p>
          <ul className="mt-4 grid gap-2">
            {evaluationFee.includes.map((item) => (
              <li key={item} className="flex gap-3 text-[13.5px] leading-6 text-runway-body">
                <Check className="mt-[4px] h-4 w-4 shrink-0 text-runway-green" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-runway-line-soft pt-4 text-[12.5px] leading-6 text-runway-faint">
            {evaluationFee.creditRule}
          </p>
        </div>

        <div className="runway-panel p-6 lg:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="runway-eyebrow">2 · Deployment fee</p>
            <span className="runway-num text-right text-[1.35rem] leading-tight text-runway-text">
              {formatUsd(deploymentFee.floor)}
              <span className="text-runway-mute"> or </span>
              {formatUsd(deploymentFee.perRobot)}
              <span className="block text-[12px] text-runway-faint">whichever is greater</span>
            </span>
          </div>
          <p className="mt-2 runway-meta">{deploymentFee.unit} · per robot deployed</p>
          <p className="mt-4 text-[14px] leading-[1.65] text-runway-mute">{deploymentFee.whoPays}</p>
          <p className="mt-4 text-[13.5px] leading-[1.6] text-runway-body">
            {deploymentFee.verifiable}
          </p>
          <p className="mt-5 border-t border-runway-line-soft pt-4 text-[12.5px] leading-6 text-runway-faint">
            {deploymentFee.cumulative}
          </p>
        </div>
      </div>

      {/* ---- the calculator + the settlement note ---- */}
      <div className="flex flex-col gap-6">
        <div className="runway-panel p-6 lg:p-8">
          <p className="runway-eyebrow">What the winning team owes</p>

          <label className="mt-5 block">
            <span className="runway-label">Robots deployed on this task</span>
            <input
              className="runway-input runway-num"
              inputMode="numeric"
              value={robots}
              onChange={(event) => setRobots(event.target.value)}
              aria-label="Robots deployed on this task"
            />
          </label>

          <dl className="mt-6 border-t border-runway-line pt-4">
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-[13px] text-runway-mute">
                Floor{" "}
                <span className="runway-num text-runway-faint">
                  ({formatUsd(deploymentFee.floor)})
                </span>
              </dt>
              <dd
                className={`runway-num text-[13px] ${
                  fee.basis === "floor" ? "text-runway-signal" : "text-runway-faint"
                }`}
              >
                {formatUsd(deploymentFee.floor)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-[13px] text-runway-mute">
                Per robot{" "}
                <span className="runway-num text-runway-faint">
                  ({robotCount} × {formatUsd(deploymentFee.perRobot)})
                </span>
              </dt>
              <dd
                className={`runway-num text-[13px] ${
                  fee.basis === "per-robot" ? "text-runway-signal" : "text-runway-faint"
                }`}
              >
                {formatUsd(robotCount * deploymentFee.perRobot)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-runway-line-soft py-2">
              <dt className="text-[13px] text-runway-mute">Evaluation fee credited</dt>
              <dd className="runway-num text-[13px] text-runway-green">
                {fee.creditApplied > 0 ? `−${formatUsd(fee.creditApplied)}` : formatUsd(0)}
              </dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-runway-line pt-4">
              <dt className="font-display text-[15px] font-semibold uppercase tracking-[0.005em] text-runway-text">
                Owed to Blueprint
              </dt>
              <dd className="runway-num text-[1.7rem] leading-none text-runway-signal">
                {formatUsd(fee.dueNow)}
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
