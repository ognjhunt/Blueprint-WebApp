import { ArrowDown, ArrowRight, LockKeyhole } from "lucide-react";

import {
  deploymentPrepInputs,
  deploymentPrepOutputs,
  deploymentPrepSteps,
} from "@/data/deploymentPrep";
import { cn } from "@/lib/utils";

type DeploymentWorkPackageProps = {
  className?: string;
};

export function DeploymentWorkPackage({
  className,
}: DeploymentWorkPackageProps) {
  return (
    <div
      className={cn(
        "grid gap-5 lg:grid-cols-[0.8fr_auto_1.4fr_auto_0.8fr] lg:items-stretch",
        className,
      )}
    >
      <PackageList
        eyebrow="Site sends"
        title="One real workflow"
        items={deploymentPrepInputs}
      />
      <FlowArrow />
      <div className="overflow-hidden rounded-lg bg-ink text-white">
        <div className="border-b border-white/12 px-6 py-5">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-brass">
            Blueprint does
          </p>
          <h3 className="mt-2 text-title-l font-semibold tracking-tight">
            The months 0–2 homework
          </h3>
        </div>
        <ol className="divide-y divide-white/12">
          {deploymentPrepSteps.map((step) => (
            <li
              key={step.number}
              className="grid grid-cols-[auto_1fr] gap-4 px-6 py-4"
            >
              <span className="font-mono text-micro text-brass">
                {step.number}
              </span>
              <span>
                <span className="block text-body-s font-semibold">
                  {step.title}
                </span>
                <span className="mt-1 block text-caption leading-6 text-ink-300">
                  {step.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <FlowArrow />
      <PackageList
        eyebrow="Team receives"
        title="A pre-deployment handoff"
        items={deploymentPrepOutputs}
      />
    </div>
  );
}

function PackageList({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: readonly string[];
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <p className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-title-m font-semibold tracking-tight text-ink-900">
        {title}
      </h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-caption leading-6 text-ink-500"
          >
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-action"
            />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-caption font-semibold text-ink-700">
        <LockKeyhole className="h-4 w-4 text-brass-deep" aria-hidden="true" />
        Access stays permissioned.
      </p>
    </section>
  );
}

function FlowArrow() {
  return (
    <div
      className="flex items-center justify-center text-ink-300"
      aria-hidden="true"
    >
      <ArrowDown className="h-5 w-5 lg:hidden" />
      <ArrowRight className="hidden h-5 w-5 lg:block" />
    </div>
  );
}
