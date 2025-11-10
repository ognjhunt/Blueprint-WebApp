import { InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

import type { EnvironmentPolicy } from "@/data/content";

interface PolicyDetailPanelProps {
  policy: EnvironmentPolicy | null;
  onClear: () => void;
}

export function PolicyDetailPanel({ policy, onClear }: PolicyDetailPanelProps) {
  return (
    <aside className="order-first lg:order-last lg:sticky lg:top-24">
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Policy details</span>
          </div>
          {policy ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              aria-label="Close policy details"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {policy ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white">
                {policy.focus}
              </span>
              <h2 className="text-xl font-semibold text-slate-900">{policy.title}</h2>
              <p className="text-sm text-slate-600">{policy.summary}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">What it covers</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {policy.coverage.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span>{policy.cadence}</span>
              {policy.metric ? (
                <span className="text-sm font-medium normal-case tracking-normal text-slate-900">
                  {policy.metric}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Select a policy to learn more.</p>
            <p>
              Tap the <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700"><InformationCircleIcon className="h-4 w-4" aria-hidden="true" /> Read more</span> button on any policy card to bring the full coverage details into this panel.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
