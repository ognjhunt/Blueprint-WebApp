import type { MetricStatProps } from "@/components/blueprint";
import type { BuyerRunRecord } from "@/lib/buyerAppData";

/**
 * The four-up run summary shown on both the Overview and the Runs workspace.
 *
 * Derivation only — it reads the records `useBuyerAppRuns()` already returned
 * and never fetches. Both pages render the same figures, so the buckets and
 * captions live here rather than being restated per page.
 */

/** Authorization through aggregation: every state between intake and a sealed result. */
const ACTIVE_RUN_STATES = [
  "submitted",
  "accepted",
  "planning",
  "awaiting_authorization",
  "running",
  "aggregating",
] as const;

export type RunSummaryMetric = {
  label: string;
  value: string;
  caption: string;
  deltaTone?: MetricStatProps["deltaTone"];
};

export function runSummaryMetrics(runs: BuyerRunRecord[]): RunSummaryMetric[] {
  const active = runs.filter((run) =>
    (ACTIVE_RUN_STATES as readonly string[]).includes(String(run.status)),
  );
  const decisions = runs.filter((run) => run.status === "decision_available");
  const abstained = runs.filter((run) => run.status === "abstained");

  return [
    {
      label: "Runs",
      value: String(runs.length),
      caption: "Owner-scoped decision records",
    },
    {
      label: "Active",
      value: String(active.length),
      caption: "Authorization through aggregation",
    },
    {
      label: "Decisions",
      value: String(decisions.length),
      caption: "Pipeline decision envelopes available",
    },
    {
      label: "Abstained",
      value: String(abstained.length),
      caption: "Evidence could not support the decision",
      deltaTone: abstained.length ? "warn" : undefined,
    },
  ];
}
