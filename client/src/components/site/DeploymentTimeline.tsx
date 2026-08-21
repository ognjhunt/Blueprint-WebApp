import { ArrowUpRight, Check } from "lucide-react";

import {
  deploymentPrepSources,
  publishedOemTimeline,
} from "@/data/deploymentPrep";
import { cn } from "@/lib/utils";

type DeploymentTimelineProps = {
  compact?: boolean;
  className?: string;
};

export function DeploymentTimeline({
  compact = false,
  className,
}: DeploymentTimelineProps) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-white",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-line bg-ink px-5 py-5 text-white sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-brass">
            Published OEM example
          </p>
          <h3 className="mt-2 text-title-l font-semibold tracking-tight">
            The path to scaled deployment is 6+ months.
          </h3>
        </div>
        <p className="max-w-[28rem] text-caption leading-6 text-ink-300">
          Agility calls this an illustrative Customer Acceleration Program
          timeline—not an industry average.
        </p>
      </div>

      <ol className="grid lg:grid-cols-4">
        {publishedOemTimeline.map((phase, index) => (
          <li
            key={phase.time}
            className={cn(
              "relative border-b border-line p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0",
              phase.blueprint
                ? "bg-action text-white"
                : "bg-white text-ink-900",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "font-mono text-micro font-semibold uppercase tracking-eyebrow",
                  phase.blueprint ? "text-white/72" : "text-ink-400",
                )}
              >
                {phase.time}
              </span>
              {phase.blueprint ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Blueprint
                </span>
              ) : null}
            </div>
            <p className="mt-5 text-title-m font-semibold tracking-tight">
              {phase.title}
            </p>
            {!compact ? (
              <p
                className={cn(
                  "mt-3 text-caption leading-6",
                  phase.blueprint ? "text-white/78" : "text-ink-500",
                )}
              >
                {phase.detail}
              </p>
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "absolute bottom-0 left-0 h-1",
                phase.blueprint
                  ? "w-full bg-brass"
                  : index === 1
                    ? "w-1/3 bg-ink-200"
                    : index === 2
                      ? "w-2/3 bg-ink-200"
                      : "w-full bg-ink-200",
              )}
            />
          </li>
        ))}
      </ol>

      {!compact ? (
        <figcaption className="flex flex-col gap-3 border-t border-line bg-canvas px-5 py-4 text-caption leading-6 text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span>
            Blueprint focuses on the homework before onsite commissioning. It
            does not replace months 2–6.
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-2">
            {[
              deploymentPrepSources.timeline,
              deploymentPrepSources.process,
            ].map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-ink-800 hover:text-action"
              >
                {source.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
