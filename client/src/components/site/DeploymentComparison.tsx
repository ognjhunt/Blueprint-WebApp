import { Check, Minus } from "lucide-react";

import { diyComparisonRows } from "@/data/deploymentPrep";
import { cn } from "@/lib/utils";

type DeploymentComparisonProps = {
  className?: string;
};

export function DeploymentComparison({ className }: DeploymentComparisonProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-white",
        className,
      )}
    >
      <div className="hidden grid-cols-[0.24fr_0.38fr_0.38fr] border-b border-line bg-canvas text-micro font-semibold uppercase tracking-eyebrow text-ink-500 md:grid">
        <div className="px-5 py-4">The work</div>
        <div className="border-l border-line px-5 py-4">Do it yourself</div>
        <div className="border-l border-line bg-action px-5 py-4 text-white">
          Use Blueprint
        </div>
      </div>
      <dl>
        {diyComparisonRows.map((row) => (
          <div
            key={row.question}
            className="grid border-b border-line last:border-b-0 md:grid-cols-[0.24fr_0.38fr_0.38fr]"
          >
            <dt className="bg-canvas px-5 py-4 text-body-s font-semibold text-ink-900 md:bg-white md:py-5">
              {row.question}
            </dt>
            <dd className="flex gap-3 px-5 py-4 text-body-s leading-7 text-ink-500 md:border-l md:border-line md:py-5">
              <Minus
                className="mt-1.5 h-4 w-4 shrink-0 text-ink-300"
                aria-hidden="true"
              />
              <span>
                <span className="mb-1 block text-micro font-semibold uppercase tracking-eyebrow text-ink-400 md:hidden">
                  Do it yourself
                </span>
                {row.diy}
              </span>
            </dd>
            <dd className="flex gap-3 bg-info-bg px-5 py-4 text-body-s font-medium leading-7 text-ink-800 md:border-l md:border-line md:py-5">
              <Check
                className="mt-1.5 h-4 w-4 shrink-0 text-action"
                aria-hidden="true"
              />
              <span>
                <span className="mb-1 block text-micro font-semibold uppercase tracking-eyebrow text-action md:hidden">
                  Use Blueprint
                </span>
                {row.blueprint}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
