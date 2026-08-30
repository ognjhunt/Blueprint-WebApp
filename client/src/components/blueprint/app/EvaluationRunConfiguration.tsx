import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  Check,
  FlaskConical,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import type { EvaluationReadySetupView } from "@/lib/evaluationReadyRuns";

const candidateLabels = {
  pi05_droid: "π0.5 DROID",
  groot_n17_droid: "GR00T N1.7 DROID",
} as const;

const familyLabels: Record<string, string> = {
  canonical_anchor: "Canonical anchor",
  placement_approach: "Placement + approach",
  illumination: "Illumination",
  camera_sensor: "Camera + sensor",
  bounded_physics: "Bounded physics",
  pairwise: "Pairwise combinations",
  held_out: "Held-out combinations",
};

function LockedChoice({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
      <span className="flex size-8 shrink-0 items-center justify-center border border-line bg-inset text-ink-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body-s font-semibold text-ink-900">{label}</p>
        <p className="runway-num mt-0.5 truncate text-[0.68rem] text-ink-400">{value}</p>
      </div>
      <LockKeyhole className="size-3.5 text-ink-400" aria-label="Locked" />
    </div>
  );
}

function StepMarker({ number, label, active, complete }: { number: number; label: string; active: boolean; complete: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className={`runway-num flex size-6 shrink-0 items-center justify-center border text-[0.68rem] font-semibold ${active ? "border-runway-signal bg-runway-signal text-runway-signal-ink" : complete ? "border-proof-bd bg-proof-bg text-proof-fg" : "border-line text-ink-400"}`}>
        {complete ? <Check className="size-3.5" aria-hidden="true" /> : number}
      </span>
      <span className={`truncate text-caption font-semibold ${active ? "text-ink-900" : "text-ink-500"}`}>{label}</span>
    </li>
  );
}

export function EvaluationRunConfiguration({
  setup,
  submitting,
  onSubmit,
}: {
  setup: EvaluationReadySetupView;
  submitting: boolean;
  onSubmit: (configuration: { presetId: EvaluationReadySetupView["defaultPresetId"] }) => void;
}) {
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [presetId, setPresetId] = useState(setup.defaultPresetId);
  const preset = setup.presets.find((option) => option.presetId === presetId)
    ?? setup.presets[0];
  const canStart = preset?.availability === "available";
  const learnedEpisodes = preset?.episodeCounts.learnedEpisodeCount ?? 0;
  const controlEpisodes = preset?.episodeCounts.controlEpisodeCount ?? 0;
  const totalEpisodes = preset?.episodeCounts.totalEpisodeCount ?? 0;
  const estimate = preset?.estimate;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <ol className="grid grid-cols-2 gap-4 border-b border-line pb-4" aria-label="Evaluation setup progress">
          <StepMarker number={1} label="Configure" active={step === "configure"} complete={step === "review"} />
          <StepMarker number={2} label="Review + start" active={step === "review"} complete={false} />
        </ol>

        {step === "configure" ? (
          <>
            <section className="grid gap-px border border-line bg-line lg:grid-cols-2" aria-labelledby="locked-setup-title">
              <div className="bg-paper-0 p-5">
                <p className="runway-meta">01 · Hardware</p>
                <h2 id="locked-setup-title" className="mt-1 font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Franka + DROID</h2>
                <p className="mt-2 text-body-s text-ink-500">One controls-qualified robot setup. No adapter or runtime choice is needed.</p>
                <div className="mt-4">
                  <LockedChoice label="Franka Panda + Robotiq 2F-85" value={setup.embodimentId} icon={<Bot className="size-4" />} />
                </div>
              </div>
              <div className="bg-paper-0 p-5">
                <p className="runway-meta">02 · Frozen candidates</p>
                <h2 className="mt-1 font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Exactly two policies</h2>
                <p className="mt-2 text-body-s text-ink-500">Both receive the same resolved cells and unique seeds.</p>
                <div className="mt-4">
                  {setup.candidateIds.map((candidateId) => (
                    <LockedChoice key={candidateId} label={candidateLabels[candidateId]} value={candidateId} icon={<FlaskConical className="size-4" />} />
                  ))}
                </div>
              </div>
            </section>

            <section className="runway-panel p-5" aria-labelledby="matrix-title">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="runway-meta">03 · Variation matrix</p>
                  <h2 id="matrix-title" className="mt-1 font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Choose test depth</h2>
                  <p className="mt-2 max-w-2xl text-body-s text-ink-500">A scenario count always means the same deterministic, balanced cells and seeds for each policy. Blueprint chooses the cells; you choose only the depth.</p>
                </div>
                <StatusChip tone="proof" square>{preset?.scenarioCountPerPolicy ?? 0} paired scenarios</StatusChip>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Evaluation depth">
                {setup.presets.map((option) => {
                  const selected = option.presetId === presetId;
                  return <button key={option.presetId} type="button" role="radio" aria-checked={selected} disabled={option.availability !== "available"} onClick={() => setPresetId(option.presetId)} className={`min-h-32 border p-4 text-left transition-colors ${selected ? "border-runway-signal bg-runway-signal/[0.06]" : "border-line bg-paper-0"} disabled:cursor-not-allowed disabled:opacity-55`}>
                    <div className="flex items-center justify-between gap-2"><p className="text-body-s font-semibold text-ink-900">{option.label}</p><StatusChip tone={option.availability === "available" ? "proof" : "neutral"} square>{option.availability === "available" ? option.recommended ? "Recommended" : "Available" : "Later"}</StatusChip></div>
                    <p className="runway-num mt-3 text-title-l font-semibold text-ink-900">{option.scenarioCountPerPolicy}</p>
                    <p className="mt-1 text-caption text-ink-500">scenario cells per policy</p>
                  </button>;
                })}
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {preset?.familyCoverage.map((coverage) => <div key={coverage.family} className="border border-line-soft bg-inset px-3 py-2.5"><p className="text-caption font-semibold text-ink-700">{familyLabels[coverage.family]}</p><p className="runway-num mt-1 text-[0.66rem] text-ink-400">{coverage.scenarioCount} scenario{coverage.scenarioCount === 1 ? "" : "s"}</p></div>)}
              </div>
              <div className="mt-5 grid gap-2 border-t border-line-soft pt-4 sm:grid-cols-2"><p className="flex items-center gap-2 text-caption font-semibold text-ink-600"><Check className="size-3.5 text-proof-fg" aria-hidden="true" />Same cells + seeds for both policies</p><p className="flex items-center gap-2 text-caption font-semibold text-ink-600"><Check className="size-3.5 text-proof-fg" aria-hidden="true" />Zero-action + scripted-positive per cell</p></div>
            </section>

            <div className="flex justify-end"><Button type="button" onClick={() => setStep("review")} disabled={!canStart}>Review run <ArrowRight aria-hidden="true" /></Button></div>
          </>
        ) : (
          <>
            <section className="runway-panel p-5" aria-labelledby="review-run-title">
              <p className="runway-meta">Exact plan preview</p>
              <h2 id="review-run-title" className="mt-1 font-display text-title-l font-semibold uppercase tracking-[0.005em] text-ink-900">Ready to prepare</h2>
              <div className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
                <div className="bg-paper-0 p-4"><p className="runway-num text-title-l font-semibold text-ink-900">{learnedEpisodes}</p><p className="runway-meta mt-1">learned-policy episodes</p></div>
                <div className="bg-paper-0 p-4"><p className="runway-num text-title-l font-semibold text-ink-900">{controlEpisodes}</p><p className="runway-meta mt-1">control episodes</p></div>
                <div className="bg-paper-0 p-4"><p className="runway-num text-title-l font-semibold text-ink-900">{totalEpisodes}</p><p className="runway-meta mt-1">total episodes</p></div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Card pad="sm"><p className="text-body-s font-semibold text-ink-900">Zero-action control</p><p className="mt-1 text-caption text-ink-500">Runs in every scored cell and must not complete the task.</p></Card>
                <Card pad="sm"><p className="text-body-s font-semibold text-ink-900">Scripted-positive control</p><p className="mt-1 text-caption text-ink-500">Runs in every scored cell and must complete the task.</p></Card>
              </div>
              <div className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-2">
                <div className="bg-paper-0 p-4"><p className="runway-meta">Estimated time</p><p className="runway-num mt-1 text-body-s font-semibold text-ink-900">{estimate?.status === "estimated" ? `${estimate.durationMinutes.minimum}–${estimate.durationMinutes.maximum} min` : "Unavailable"}</p></div>
                <div className="bg-paper-0 p-4"><p className="runway-meta">Estimated cost</p><p className="runway-num mt-1 text-body-s font-semibold text-ink-900">{estimate?.status === "estimated" ? `$${estimate.costUsd.minimum.toFixed(2)}–$${estimate.costUsd.maximum.toFixed(2)}` : "Unavailable"}</p></div>
              </div>
              {estimate?.status === "estimated" ? <p className="runway-num mt-2 break-all text-[0.64rem] text-ink-400">Estimate basis {estimate.basisDigest} · {estimate.asOf}</p> : <p className="mt-2 text-caption text-ink-400">The server did not publish a time or cost estimate for this preset.</p>}
            </section>
            <ProofBoundary level="info" title="Start means seal the exact plan" icon={ShieldCheck}>
              Blueprint first persists and validates the digest-bound preparation at $0. Provider execution remains false until the separate controls-qualified activation gate releases this exact configuration.
            </ProofBoundary>
            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => setStep("configure")}><ArrowLeft aria-hidden="true" />Change depth</Button>
              <Button type="button" onClick={() => onSubmit({ presetId })} disabled={submitting || !canStart}>{submitting ? "Preparing…" : "Start evaluation"}</Button>
            </div>
          </>
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start" aria-label="Evaluation summary">
        <Card pad="md">
          <p className="runway-meta">Testbed</p>
          <p className="mt-2 text-body-s font-semibold text-ink-900">{setup.sceneLabel}</p>
          <p className="mt-1 text-caption text-ink-500">{setup.taskLabel}</p>
          <p className="runway-num mt-3 break-all text-[0.64rem] leading-4 text-ink-400">{setup.setupDigest}</p>
        </Card>
        <Card pad="md">
          <Bell className="size-4 text-ink-500" aria-hidden="true" />
          <p className="mt-3 text-body-s font-semibold text-ink-900">Results notification</p>
          <p className="mt-1 text-caption leading-5 text-ink-500">We’ll email the verified signed-in account when results are ready, with a private link back here.</p>
          {setup.notificationRecipient ? <p className="runway-num mt-2 text-[0.68rem] text-ink-500">{setup.notificationRecipient}</p> : null}
        </Card>
        <p className="text-caption leading-5 text-ink-400">No payment step. Team scope and recipient come from your authenticated account.</p>
      </aside>
    </div>
  );
}
