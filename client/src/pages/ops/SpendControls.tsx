import { Helmet } from "@/lib/helmet";
import { AlertTriangle } from "lucide-react";

import {
  Card,
  MetricStat,
  ProofBoundary,
} from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import { cn } from "@/lib/utils";
import {
  SPEND_CATEGORIES,
  SPEND_METRICS,
  SPEND_THRESHOLD_BOUNDARY,
  type SpendCategory,
  type SpendFill,
} from "@/components/blueprint/ops/mockData";

/** Track-and-fill spend bar modeled on PolicyRankBar with signal fills. */
const fillClasses: Record<SpendFill, string> = {
  proof: "bg-proof-fg",
  warn: "bg-warn-fg",
  block: "bg-block-fg",
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function SpendBar({ category }: { category: SpendCategory }) {
  const ratio = clamp01(category.ratio);
  const pct = Math.round(ratio * 100);

  return (
    <div className="flex flex-col gap-2 py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-body-s font-semibold text-ink-900">
          {category.label}
        </span>
        <span className="shrink-0 font-mono text-[13px] text-ink-900">
          {category.amount}
          <span className="text-ink-400"> / {category.budget}</span>
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${category.label} spend`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[350ms] ease-out-bp",
            fillClasses[category.fill],
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] leading-snug text-ink-500">
          {category.caption}
        </span>
        <span className="shrink-0 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-400">
          {pct}% of ceiling
        </span>
      </div>
    </div>
  );
}

/**
 * SpendControls — OPS CONSOLE › Spend controls (/ops/spend).
 *
 * Four MetricStat tiles (committed MTD, monthly ceiling, headroom, cost per
 * package) → an over-threshold ProofBoundary (block) when a category exceeds
 * its ceiling → per-category spend bars with proof/warn/block fills and mono
 * amounts. Figures are committed estimates, not final invoiced amounts.
 *
 * Illustrative data only — there is no backend behind this surface.
 */
export default function SpendControls() {
  const overCount = SPEND_CATEGORIES.filter((c) => c.fill === "block").length;

  return (
    <>
      <Helmet>
        <title>Spend controls · Blueprint Ops</title>
        <meta
          name="description"
          content="Committed spend against the monthly ceiling, with per-category budgets and an over-threshold approval gate. Committed estimates, not final invoiced amounts."
        />
      </Helmet>

      <OpsShell
        active="spend"
        title="Spend controls"
        sub="June 2026 · $182k committed / $240k ceiling"
      >
        <div className="mx-auto flex max-w-[72rem] flex-col gap-6">
          {/* Metric tiles */}
          <Card pad="none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {SPEND_METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className={cn(
                    "p-5 border-line",
                    // top hairline between stacked rows
                    i > 0 && "border-t",
                    i === 1 && "sm:border-t-0",
                    i >= 2 && "lg:border-t-0",
                    // left hairline between tiles within a row
                    i % 2 === 1 && "sm:border-l",
                    i % 4 !== 0 && "lg:border-l",
                  )}
                >
                  <MetricStat
                    label={m.label}
                    value={m.value}
                    unit={m.unit}
                    delta={m.delta}
                    deltaTone={m.deltaTone}
                    caption={m.caption}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Over-threshold boundary */}
          {overCount > 0 && (
            <ProofBoundary
              level="block"
              title={SPEND_THRESHOLD_BOUNDARY.title}
              icon={AlertTriangle}
            >
              {SPEND_THRESHOLD_BOUNDARY.body}
            </ProofBoundary>
          )}

          {/* Per-category spend bars */}
          <Card
            eyebrow="Allocation"
            title="Spend by category"
            headerRight={
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-500">
                MTD vs ceiling
              </span>
            }
            pad="md"
          >
            <div className="flex flex-col divide-y divide-line-soft">
              {SPEND_CATEGORIES.map((category) => (
                <SpendBar key={category.id} category={category} />
              ))}
            </div>
          </Card>

          <p className="text-[13px] leading-snug text-ink-500">
            Amounts shown are committed estimates against the current month, not
            final invoiced totals. Categories at or over their ceiling require an
            operator approval before more spend is committed.
          </p>
        </div>
      </OpsShell>
    </>
  );
}
