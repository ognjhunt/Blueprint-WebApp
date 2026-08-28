import { Link } from "wouter";

import { PREVIEW_NOTICE } from "@/data/opportunityBoardPreview";
import { flowSteps } from "@/data/opportunityFlow";

/** Non-dismissible: every screen in this flow renders invented data. */
export function PreviewBanner() {
  return (
    <div className="border-b border-runway-signal-dim bg-runway-signal/[0.07] px-6 py-3 lg:px-8">
      <p className="mx-auto flex max-w-[86rem] items-center gap-3 font-mono text-[10.5px] uppercase leading-[1.6] tracking-[0.1em] text-runway-signal">
        <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 rounded-full bg-runway-signal" />
        {PREVIEW_NOTICE}
      </p>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="border-b border-runway-line px-6 py-3 lg:px-8">
      <Link
        href={href}
        className="mx-auto block max-w-[86rem] font-mono text-[11px] uppercase tracking-[0.08em] text-runway-faint transition-colors hover:text-runway-signal"
      >
        ← {label}
      </Link>
    </div>
  );
}

/**
 * The five steps, with the current one lit. Present on every screen so a team
 * always knows what it has paid for and what happens next.
 */
export function FlowRail({ current }: { current: (typeof flowSteps)[number]["id"] }) {
  const currentIndex = flowSteps.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Opportunity process" className="border-b border-runway-line bg-runway-black">
      <ol className="mx-auto grid max-w-[86rem] gap-px bg-runway-line sm:grid-cols-3 lg:grid-cols-5">
        {flowSteps.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "now" : "next";
          return (
            <li
              key={step.id}
              aria-current={state === "now" ? "step" : undefined}
              className={`bg-runway-black px-5 py-4 ${state === "now" ? "bg-runway-raised" : ""}`}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={`runway-num text-[10px] tracking-[0.16em] ${
                    state === "done"
                      ? "text-runway-green"
                      : state === "now"
                        ? "text-runway-signal"
                        : "text-runway-faint"
                  }`}
                >
                  {step.step}
                </span>
                <span
                  className={`font-display text-[13px] font-semibold uppercase tracking-[0.005em] ${
                    state === "next" ? "text-runway-faint" : "text-runway-text"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-runway-faint">
                {step.actor} · {step.cost}
              </p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SectionRule({ index, title, aside }: { index: string; title: string; aside?: string }) {
  return (
    <div className="runway-rule-head">
      <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-runway-faint">
        {index} · {title}
      </h2>
      {aside ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-runway-signal">{aside}</span>
      ) : null}
    </div>
  );
}

export function FieldRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`grid gap-1 py-[11px] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-6 ${
        last ? "" : "border-b border-runway-line-soft"
      }`}
    >
      <dt className="text-[13px] leading-[1.5] text-runway-mute">{label}</dt>
      <dd className={`text-[13.5px] leading-[1.55] text-runway-body ${mono ? "runway-num" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
