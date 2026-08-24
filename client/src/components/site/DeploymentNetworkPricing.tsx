import { useMemo, useState } from "react";
import { Calculator, Check, Landmark } from "lucide-react";

import {
  calculateDeploymentNetworkFee,
  DEPLOYMENT_NETWORK_RENEWAL_RATE,
  DEPLOYMENT_NETWORK_TIERS,
  formatPercent,
  formatUsd,
} from "@/lib/deploymentNetworkPricing";

const MAX_CALCULATOR_VALUE = 1_000_000_000;

function parsedRevenue(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, parsed), MAX_CALCULATOR_VALUE);
}

export function DeploymentNetworkPricing() {
  const [revenueInput, setRevenueInput] = useState("5000000");
  const calculation = useMemo(
    () => calculateDeploymentNetworkFee(parsedRevenue(revenueInput)),
    [revenueInput],
  );

  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-12">
      <div className="overflow-hidden rounded-md border border-runway-line bg-runway-panel">
        <div className="border-b border-runway-line bg-runway-panel p-6 text-runway-text lg:p-8">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-runway-signal">
            Site-paid · success-aligned
          </p>
          <h3 className="mt-4 font-display text-[clamp(2rem,3.5vw,3rem)] font-medium leading-none tracking-tight">
            5% deployment-network fee
          </h3>
          <p className="mt-4 max-w-[42rem] text-body-s leading-7 text-runway-mute">
            The contracting enterprise pays Blueprint separately. Robot
            providers receive their full negotiated amounts. Volume aggregates
            across every provider, site, and deployment during the customer
            account year.
          </p>
        </div>

        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Deployment network fee schedule</caption>
          <thead>
            <tr className="border-b border-runway-line bg-runway-raised text-micro font-semibold uppercase tracking-eyebrow text-runway-faint">
              <th scope="col" className="px-5 py-3">
                Collected revenue portion
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {DEPLOYMENT_NETWORK_TIERS.map((tier) => (
              <tr
                key={tier.key}
                className="border-b border-runway-line last:border-b-0"
              >
                <td className="px-5 py-4 text-body-s font-semibold text-runway-text">
                  {tier.label}
                </td>
                <td className="px-5 py-4 text-right font-mono text-body-s font-semibold text-runway-text">
                  {formatPercent(tier.rate)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-runway-line bg-runway-deep">
              <td className="px-5 py-4 text-body-s font-semibold text-runway-text">
                Renewal revenue
              </td>
              <td className="px-5 py-4 text-right font-mono text-body-s font-semibold text-runway-text">
                {formatPercent(DEPLOYMENT_NETWORK_RENEWAL_RATE)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="border-t border-runway-line px-5 py-4 text-caption leading-6 text-runway-mute">
          Tiers are marginal and aggregate across the enterprise customer’s
          account year. Fees use cash actually collected, not the original
          headline contract value. Refunds and SLA credits reduce the applicable
          volume; the tiers reset on the account anniversary.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <section
          className="rounded-md border border-runway-line bg-runway-panel p-6 lg:p-8"
          aria-labelledby="network-fee-calculator-title"
        >
          <div className="flex items-center gap-2 text-runway-signal">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            <h3
              id="network-fee-calculator-title"
              className="text-caption font-semibold uppercase tracking-eyebrow"
            >
              Fee calculator
            </h3>
          </div>
          <label
            htmlFor="deployment-revenue"
            className="mt-5 block text-caption font-semibold text-runway-text"
          >
            Enterprise provider revenue paid this account year
          </label>
          <div className="mt-2 flex h-12 items-center rounded-xs border border-runway-line bg-runway-panel px-3 focus-within:border-runway-signal focus-within:ring-2 focus-within:ring-runway-signal/50">
            <span
              aria-hidden="true"
              className="mr-1 font-mono text-body-s text-runway-faint"
            >
              $
            </span>
            <input
              id="deployment-revenue"
              type="number"
              min="0"
              max={MAX_CALCULATOR_VALUE}
              step="10000"
              inputMode="decimal"
              value={revenueInput}
              onChange={(event) => setRevenueInput(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-body-s font-semibold text-runway-text outline-none"
            />
          </div>

          <div className="mt-6 grid gap-px overflow-hidden rounded-sm border border-runway-line bg-runway-line sm:grid-cols-3">
            <div className="bg-runway-panel p-4">
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-runway-faint">
                Providers receive
              </p>
              <p className="mt-2 font-mono text-title-m font-semibold text-runway-text">
                {formatUsd(calculation.collectedRevenue)}
              </p>
            </div>
            <div className="bg-runway-panel p-4">
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-runway-faint">
                Blueprint fee
              </p>
              <p className="mt-2 font-mono text-title-m font-semibold text-runway-text">
                {formatUsd(calculation.fee)}
              </p>
            </div>
            <div className="bg-runway-panel p-4">
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-runway-faint">
                Effective rate
              </p>
              <p className="mt-2 font-mono text-title-m font-semibold text-runway-text">
                {formatPercent(calculation.effectiveRate)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-caption leading-6 text-runway-mute">
            Customer total:{" "}
            {formatUsd(calculation.collectedRevenue + calculation.fee)}.
            Provider amounts are not reduced, and separate deals do not reset
            the volume tiers.
          </p>
          <p className="mt-3 border-l-2 border-runway-signal pl-3 text-caption leading-6 text-runway-mute">
            Example: ten $500,000 deployments paid in one account year produce
            $5 million of provider revenue, a $170,000 Blueprint fee, and a 3.4%
            effective rate.
          </p>
        </section>

        <section
          className="rounded-md border border-runway-line bg-runway-panel p-6"
          aria-labelledby="who-pays-title"
        >
          <div className="flex items-center gap-2 text-runway-signal">
            <Landmark className="h-4 w-4" aria-hidden="true" />
            <h3
              id="who-pays-title"
              className="text-caption font-semibold uppercase tracking-eyebrow"
            >
              Who pays what
            </h3>
          </div>
          <ul className="mt-4 space-y-3">
            {[
              "The contracting enterprise pays the deployment-network fee on cumulative annual provider revenue.",
              "Robot teams pay no listing or matching fee and keep their full negotiated deployment price.",
              "Standard evaluations are included; unusually heavy compute is passed through at cost and bespoke training is scoped separately.",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-3 text-body-s leading-7 text-runway-mute"
              >
                <Check
                  className="mt-1 h-4 w-4 shrink-0 text-runway-signal"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
