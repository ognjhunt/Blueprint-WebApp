import { useState } from "react";

import type { EvaluationReadySetupView } from "@/lib/evaluationReadyRuns";
import { policyCandidateLabel } from "@/lib/policyCandidateLabels";

const familyLabels: Record<string, string> = {
  canonical_anchor: "Baseline",
  placement_approach: "Placement and approach",
  illumination: "Lighting",
  camera_sensor: "Camera and sensor",
  bounded_physics: "Physics",
  pairwise: "Combined",
  held_out: "Held out",
};

/** One page: the fixed robot and policies, a depth choice, the estimate, and start. */
export function EvaluationRunConfiguration({
  setup,
  submitting,
  onSubmit,
}: {
  setup: EvaluationReadySetupView;
  submitting: boolean;
  onSubmit: (configuration: { presetId: EvaluationReadySetupView["defaultPresetId"] }) => void;
}) {
  const [presetId, setPresetId] = useState(setup.defaultPresetId);
  const preset = setup.presets.find((option) => option.presetId === presetId) ?? setup.presets[0];
  const canStart = preset?.availability === "available";
  const estimate = preset?.estimate;

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <section aria-labelledby="setup-robot">
        <h2 id="setup-robot">Robot and policies</h2>
        <dl className="ws-facts">
          <div><dt>Robot</dt><dd>Franka Panda + Robotiq 2F-85</dd></div>
          <div><dt>Policies</dt><dd>{setup.candidateIds.map((id) => policyCandidateLabel(id)).join(" and ")}</dd></div>
        </dl>
        <p className="ws-note">Fixed for this task. Both policies run the same scenarios.</p>
      </section>

      <section aria-labelledby="setup-depth">
        <h2 id="setup-depth">How many scenarios?</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Evaluation depth">
          {setup.presets.map((option) => {
            const selected = option.presetId === presetId;
            const available = option.availability === "available";
            return (
              <button
                key={option.presetId}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!available}
                onClick={() => setPresetId(option.presetId)}
                className={`border p-4 text-left ${selected ? "border-[var(--ws-green)] bg-[var(--bp-paper-50)]" : "border-line"}`}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="mt-1 block text-sm text-ink-500">
                  {option.scenarioCountPerPolicy} per policy{available ? option.recommended ? " · recommended" : "" : " · coming later"}
                </span>
              </button>
            );
          })}
        </div>
        {preset ? (
          <p className="mt-4 text-sm">
            {preset.episodeCounts.learnedEpisodeCount} policy episodes + {preset.episodeCounts.controlEpisodeCount} control
            episodes = {preset.episodeCounts.totalEpisodeCount} total.
          </p>
        ) : null}
        <details className="mt-5">
          <summary>What the scenarios cover</summary>
          {preset?.familyCoverage.length ? (
            <ul className="text-sm">
              {preset.familyCoverage.map((coverage) => (
                <li key={coverage.family}>{familyLabels[coverage.family] || coverage.family}: {coverage.scenarioCount}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-sm">
            Blueprint picks the scenarios with a fixed rule before anything runs, never from results. Each larger depth
            includes every scenario from the smaller ones.
          </p>
          <p className="mt-2 text-sm">
            Every scenario also runs two control checks: a robot that does nothing, which must fail, and a scripted
            robot, which must succeed.
          </p>
        </details>
      </section>

      <section aria-labelledby="setup-start">
        <h2 id="setup-start">Start</h2>
        <dl className="ws-facts">
          <div>
            <dt>Estimated time</dt>
            <dd>{estimate?.status === "estimated" ? `${estimate.durationMinutes.minimum}–${estimate.durationMinutes.maximum} min` : "Not published"}</dd>
          </div>
          <div>
            <dt>Estimated cost</dt>
            <dd>{estimate?.status === "estimated" ? `$${estimate.costUsd.minimum.toFixed(2)}–$${estimate.costUsd.maximum.toFixed(2)}` : "Not published"}</dd>
          </div>
        </dl>
        <p className="ws-note">
          Starting saves this exact setup at no charge, and it runs once Blueprint releases it. We'll email{" "}
          {setup.notificationRecipient || "your account"} when the results are ready.
        </p>
        <button
          type="button"
          className="ws-primary mt-6"
          onClick={() => onSubmit({ presetId })}
          disabled={submitting || !canStart}
        >{submitting ? "Starting…" : "Start evaluation"}</button>
      </section>

      <details>
        <summary>Setup details</summary>
        <dl className="ws-facts">
          <div><dt>Setup</dt><dd className="break-all">{setup.setupDigest}</dd></div>
          <div><dt>Robot ID</dt><dd className="break-all">{setup.embodimentId}</dd></div>
          <div><dt>Policy IDs</dt><dd className="break-all">{setup.candidateIds.join(", ")}</dd></div>
          <div><dt>Scenario set</dt><dd className="break-all">{setup.matrixProfileId}</dd></div>
          {estimate?.status === "estimated" ? (
            <div><dt>Estimate basis</dt><dd className="break-all">{estimate.basisDigest} · {estimate.asOf}</dd></div>
          ) : null}
        </dl>
      </details>
    </div>
  );
}
