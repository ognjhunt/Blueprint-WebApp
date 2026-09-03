import { useEffect, useMemo, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Check, ShieldAlert } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { TaskSuccessContractPanel } from "@/components/blueprint/app/TaskSuccessContractPanel";
import { useAuth } from "@/contexts/AuthContext";
import {
  createPolicyCanaryRun,
  fetchPolicyCanarySetup,
  type PolicyCanaryCandidate,
  type PolicyCanaryEpisodePreset,
  type PolicyCanaryRobotPreset,
  type PolicyCanarySelection,
  type PolicyCanarySetupView,
} from "@/lib/policyCanaryRuns";
import {
  confirmRigidTaskSuccessContractProposal,
  type RigidTaskSuccessContract,
} from "@/lib/rigidTaskSuccessContract";

type WizardStep = "setup" | "run_size" | "confirm";
const steps: Array<{ id: WizardStep; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "run_size", label: "Run size" },
  { id: "confirm", label: "Confirm" },
];

function stableRunId(sourceLaunchId: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${sourceLaunchId.slice(0, 80)}-policy-canary-${suffix}`
    .replace(/[^A-Za-z0-9._:-]/g, "-");
}

function compatible(candidate: PolicyCanaryCandidate, robot: PolicyCanaryRobotPreset) {
  const contract = candidate.compatibility;
  return contract.robot_preset_ids.includes(robot.robot_preset_id)
    && contract.embodiment_ids.includes(robot.embodiment_id)
    && contract.observation_schema_ids.includes(robot.observation_schema.schema_id)
    && contract.action_schema_ids.includes(robot.action_schema.schema_id)
    && contract.simulator_runtime_ids.includes(robot.simulator_runtime_id)
    && contract.task_family_ids.includes(robot.task_family_id);
}

function optionReason(candidate: PolicyCanaryCandidate, robot: PolicyCanaryRobotPreset) {
  if (candidate.readiness.status !== "verified_runnable") {
    return candidate.readiness.reason || "No verified runnable readiness receipt.";
  }
  if (!compatible(candidate, robot)) {
    return `Incompatible with ${robot.display_name}: ${robot.observation_schema.schema_id} observations and ${robot.action_schema.schema_id} actions are required.`;
  }
  return null;
}

function SetupStep({
  setup,
  robot,
  selectedPolicyIds,
  onRobot,
  onPolicies,
}: {
  setup: PolicyCanarySetupView;
  robot: PolicyCanaryRobotPreset;
  selectedPolicyIds: string[];
  onRobot: (id: string) => void;
  onPolicies: (ids: string[]) => void;
}) {
  return <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
    <div>
      <div className="mb-5 border-b border-line pb-4">
        <p className="runway-meta">Configured scene and task</p>
        <p className="mt-1 text-body-s font-semibold text-ink-900">{setup.offering.scene_id} · {setup.offering.task_id}</p>
        <p className="mt-1 text-caption text-ink-500">{setup.offering.task_strategy.replaceAll("_", " ")} · {setup.offering.controls_status.replaceAll("_", " ")}</p>
        <p className="runway-num mt-1 break-all text-[0.66rem] text-ink-400">Revision {setup.scene_revision_digest}</p>
      </div>
      <label className="runway-label" htmlFor="policy-canary-robot">Robot / embodiment</label>
      <select id="policy-canary-robot" className="runway-input" value={robot.robot_preset_id} onChange={(event) => onRobot(event.target.value)}>
        {setup.robot_presets.map((preset) => <option key={preset.robot_preset_id} value={preset.robot_preset_id} disabled={preset.readiness.status !== "verified_runnable"}>
          {preset.display_name}{preset.readiness.status === "verified_runnable" ? "" : ` — ${preset.readiness.reason || "unavailable"}`}
        </option>)}
      </select>
      <dl className="mt-4 grid gap-2 text-caption text-ink-600">
        <div><dt className="runway-meta">Runtime image</dt><dd className="runway-num break-all">{robot.runtime_image.uri}</dd></div>
        <div><dt className="runway-meta">Observations</dt><dd>{robot.observation_schema.cameras.join(" · ")} · {robot.observation_schema.modalities.join(" · ")}</dd></div>
        <div><dt className="runway-meta">Actions</dt><dd>{robot.action_schema.space} · {robot.action_schema.control_hz} Hz</dd></div>
        <div><dt className="runway-meta">Task family</dt><dd className="runway-num">{robot.task_family_id}</dd></div>
      </dl>
    </div>
    <fieldset>
      <legend className="runway-label">Select exactly two learned policies</legend>
      <div className="mt-2 divide-y divide-line border-y border-line">
        {robot.policy_candidates.map((candidate) => {
          const reason = optionReason(candidate, robot);
          const checked = selectedPolicyIds.includes(candidate.candidate_id);
          const disabled = Boolean(reason) || (!checked && selectedPolicyIds.length >= 2);
          return <label key={candidate.candidate_id} className={`flex gap-3 py-4 ${disabled && !checked ? "text-ink-400" : "text-ink-800"}`}>
            <input type="checkbox" className="mt-1 size-4" checked={checked} disabled={disabled} onChange={(event) => onPolicies(event.target.checked ? [...selectedPolicyIds, candidate.candidate_id] : selectedPolicyIds.filter((id) => id !== candidate.candidate_id))} />
            <span className="min-w-0"><span className="block text-body-s font-semibold">{candidate.display_name}</span><span className="runway-num mt-1 block break-all text-[0.68rem]">{candidate.candidate_id} · {candidate.adapter_id}</span><span className="mt-1 block text-caption">{reason || `Verified runnable · ${candidate.license_id}`}</span></span>
          </label>;
        })}
      </div>
      <p className="mt-2 text-caption text-ink-500">{selectedPolicyIds.length} of 2 policies selected. Both receive identical cells, seeds, resets, observations, cameras, timing, and deterministic scoring.</p>
    </fieldset>
  </section>;
}

function RunSizeStep({ preset, presets }: { preset: PolicyCanaryEpisodePreset; presets: PolicyCanaryEpisodePreset[] }) {
  return <section className="flex flex-col gap-6">
    <div className="grid gap-3 md:grid-cols-3">
      {presets.map((item) => <Card key={item.preset_id} pad="md" className={item.preset_id === preset.preset_id ? "border-runway-signal" : ""}>
        <div className="flex items-center justify-between gap-2"><h2 className="font-display text-title-m font-semibold uppercase text-ink-900">{item.label}</h2><StatusChip tone={item.availability === "enabled" ? "proof" : "neutral"} square>{item.availability === "enabled" ? "Available" : "Coming later"}</StatusChip></div>
        <p className="mt-3 text-body-s font-semibold text-ink-800">{item.episodes_per_policy} episodes per policy{item.recommended ? " — recommended" : ""}</p>
        <p className="mt-1 text-caption text-ink-500">{item.episodes_per_policy * 2} learned-policy rollouts total</p>
      </Card>)}
    </div>
    <dl className="grid gap-px border border-line bg-line sm:grid-cols-4" aria-label="Quick canary totals">
      {[["Policies", "2"], ["Episodes each", "10"], ["Learned rollouts", "20"], ["Diagnostic controls", "20 nonblocking"]].map(([label, value]) => <div key={label} className="bg-paper-0 px-4 py-3"><dt className="runway-meta">{label}</dt><dd className="runway-num mt-1 text-body font-semibold text-ink-900">{value}</dd></div>)}
    </dl>
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[42rem] border-collapse text-left text-caption">
        <thead className="bg-runway-black"><tr><th className="runway-meta px-3 py-2">Cell</th><th className="runway-meta px-3 py-2">Coverage</th><th className="runway-meta px-3 py-2">Seed</th><th className="runway-meta px-3 py-2">Partition</th></tr></thead>
        <tbody>{preset.matrix.cells.map((cell, index) => <tr key={cell.cell_id} className="border-t border-line-soft"><td className="runway-num px-3 py-2">{index + 1}. {cell.cell_id}</td><td className="px-3 py-2">{cell.label}</td><td className="runway-num px-3 py-2">{cell.seed}</td><td className="px-3 py-2">{cell.partition.replaceAll("_", " ")}</td></tr>)}</tbody>
      </table>
    </div>
    {preset.matrix.coverage_gaps.length ? <ProofBoundary level="warn" title="Typed coverage gaps">{preset.matrix.coverage_gaps.map((gap) => `${gap.family}: ${gap.explanation} Fallback: ${gap.deterministic_fallback_family}.`).join(" ")}</ProofBoundary> : null}
    <p className="runway-num break-all text-[0.68rem] text-ink-400">Matrix {preset.matrix.matrix_digest}</p>
  </section>;
}

export default function PolicyCanarySetup() {
  const { sourceLaunchId = "" } = useParams<{ sourceLaunchId?: string }>();
  const decodedLaunchId = decodeURIComponent(sourceLaunchId);
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const [setup, setSetup] = useState<PolicyCanarySetupView | null>(null);
  const [step, setStep] = useState<WizardStep>("setup");
  const [robotId, setRobotId] = useState("");
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [interpretationConfirmed, setInterpretationConfirmed] = useState(false);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);
  const [confirmedSuccessContract, setConfirmedSuccessContract] = useState<RigidTaskSuccessContract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useMemo(() => stableRunId(decodedLaunchId), [decodedLaunchId]);

  useEffect(() => {
    if (!currentUser || !decodedLaunchId) return;
    let cancelled = false;
    void fetchPolicyCanarySetup(currentUser, decodedLaunchId).then((value) => {
      if (cancelled) return;
      setSetup(value);
      const firstRobot = value.robot_presets.find((robot) => robot.readiness.status === "verified_runnable");
      if (firstRobot) {
        setRobotId(firstRobot.robot_preset_id);
        setPolicyIds(firstRobot.policy_candidates.filter((policy) => !optionReason(policy, firstRobot)).slice(0, 2).map((policy) => policy.candidate_id));
      }
      setEmail(value.notification_recipient_email || "");
    }).catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Policy canary setup is unavailable"));
    return () => { cancelled = true; };
  }, [currentUser, decodedLaunchId]);

  useEffect(() => {
    if (!setup) {
      setConfirmedSuccessContract(null);
      return;
    }
    if (setup.task_success_contract.provenance.confirmation_status === "confirmed") {
      setConfirmedSuccessContract(setup.task_success_contract);
      return;
    }
    if (!proposalConfirmed) {
      setConfirmedSuccessContract(null);
      return;
    }
    let cancelled = false;
    void confirmRigidTaskSuccessContractProposal(
      setup.task_success_contract,
      setup.task_success_contract_confirmation_team_id,
    ).then((contract) => {
      if (!cancelled) setConfirmedSuccessContract(contract);
    }).catch(() => {
      if (!cancelled) {
        setConfirmedSuccessContract(null);
        setError("The confirmed task success contract could not be sealed.");
      }
    });
    return () => { cancelled = true; };
  }, [proposalConfirmed, setup]);

  const robot = setup?.robot_presets.find((item) => item.robot_preset_id === robotId) || null;
  const preset = setup?.episode_presets.find((item) => item.preset_id === "quick_10") || null;
  const canContinueSetup = Boolean(robot && policyIds.length === 2 && policyIds.every((id) => robot.policy_candidates.some((candidate) => candidate.candidate_id === id && !optionReason(candidate, robot))));

  function changeRobot(nextId: string) {
    if (!setup) return;
    const next = setup.robot_presets.find((item) => item.robot_preset_id === nextId);
    if (!next) return;
    setRobotId(nextId);
    setPolicyIds(next.policy_candidates.filter((policy) => !optionReason(policy, next)).slice(0, 2).map((policy) => policy.candidate_id));
  }

  async function submit() {
    if (
      !currentUser
      || !setup
      || !robot
      || !preset
      || policyIds.length !== 2
      || !confirmedSuccessContract
      || !interpretationConfirmed
    ) return;
    setSubmitting(true);
    setError(null);
    const input: PolicyCanarySelection = {
      schema_version: "task_evaluation_policy_canary_selection.v1",
      run_kind: "internal_policy_canary",
      claim_ceiling: "diagnostic_policy_execution",
      run_id: runId,
      offering_digest: setup.offering_digest,
      setup_digest: setup.setup_digest,
      scene_revision_digest: setup.scene_revision_digest,
      robot_preset_id: robot.robot_preset_id,
      policy_candidate_ids: [policyIds[0], policyIds[1]],
      episode_preset_id: "quick_10",
      variation_matrix_digest: preset.matrix.matrix_digest,
      task_success_contract: confirmedSuccessContract,
      notification: { email, notify_on: ["completed", "blocked", "cancelled"] },
      authorization: { maximum_cost_usd: preset.estimate.maximum_authorized_cost_usd, hard_ttl_seconds: preset.estimate.hard_ttl_seconds, maximum_provider_allocations: 1, retry_cap: 0 },
      episode_interpretation: { enabled: true, external_disclosure_authorized: true, provider_training_authorized: false, public_redistribution_authorized: false, maximum_cost_usd: 1.5 },
      confirm_unqualified_execution: true,
    };
    try {
      const receipt = await createPolicyCanaryRun({ currentUser, sourceLaunchId: setup.source_launch_id, input });
      navigate(`/app/evaluation-runs/${encodeURIComponent(receipt.run.run_id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Policy canary submission failed");
      setSubmitting(false);
    }
  }

  return <AppShell active="runs" breadcrumb="testbeds / policy canary">
    <Helmet><title>Run policy canary · Blueprint</title><meta name="description" content="Configure an internal unqualified two-policy canary." /></Helmet>
    <div className="mx-auto flex max-w-[80rem] flex-col gap-6 px-4 py-8 lg:px-8">
      <Link href="/app/packs" className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="size-4" />Back to testbeds</Link>
      <header className="border-b border-line pb-5"><p className="runway-meta text-runway-signal">Internal policy canary</p><h1 className="mt-2 font-display text-[1.65rem] font-semibold uppercase text-ink-900">Run real policies on the configured scene</h1><p className="mt-2 text-body-s text-ink-500">Real learned-policy execution can begin while scientific controls remain pending. This run stays diagnostic and cannot rank policies or promote the scene.</p></header>
      <ProofBoundary level="warn" title="Controls pending — results are unqualified" icon={ShieldAlert}>Raw actions, observations, state, contacts, failures, and media remain inspectable. Failed controls mark affected outcomes uninterpretable; they do not become policy-quality failures.</ProofBoundary>
      <ol className="grid grid-cols-3 gap-px border border-line bg-line" aria-label="Policy canary steps">{steps.map((item, index) => <li key={item.id} className={`bg-paper-0 px-3 py-3 text-caption font-semibold ${item.id === step ? "text-ink-900" : "text-ink-400"}`}>{index + 1}. {item.label}</li>)}</ol>
      {!setup && !error ? <BuyerAppLoadingState /> : null}
      {error ? <BuyerAppErrorState message={error} /> : null}
      {setup && robot && preset ? <div className="runway-panel p-5 md:p-7">
        {step === "setup" ? <SetupStep setup={setup} robot={robot} selectedPolicyIds={policyIds} onRobot={changeRobot} onPolicies={setPolicyIds} /> : null}
        {step === "run_size" ? <RunSizeStep preset={preset} presets={setup.episode_presets} /> : null}
        {step === "confirm" ? <section className="flex flex-col gap-6"><div className="grid gap-6 lg:grid-cols-[1fr_0.72fr]"><div><h2 className="font-display text-title-m font-semibold uppercase text-ink-900">Confirm immutable plan</h2><dl className="mt-4 grid gap-3 text-body-s"><div><dt className="runway-meta">Scene revision</dt><dd className="runway-num break-all">{setup.offering.scene_id} · {setup.scene_revision_digest}</dd></div><div><dt className="runway-meta">Robot</dt><dd>{robot.display_name}</dd></div><div><dt className="runway-meta">Policies</dt><dd>{policyIds.map((id) => robot.policy_candidates.find((candidate) => candidate.candidate_id === id)?.display_name || id).join(" vs ")}</dd></div><div><dt className="runway-meta">Run</dt><dd>10 cells per policy · 20 learned rollouts · 20 nonblocking diagnostic controls</dd></div><div><dt className="runway-meta">Estimate</dt><dd>{preset.estimate.duration_minutes.minimum}–{preset.estimate.duration_minutes.maximum} min · maximum ${preset.estimate.maximum_authorized_cost_usd.toFixed(2)} · TTL {Math.round(preset.estimate.hard_ttl_seconds / 60)} min</dd></div></dl></div><div><label className="runway-label" htmlFor="policy-canary-email">Notification email</label><input id="policy-canary-email" type="email" className="runway-input" value={email} onChange={(event) => setEmail(event.target.value)} /><p className="mt-2 text-caption text-ink-500">We notify this server-approved internal recipient once when the run is ready, blocked, or cancelled.</p><label className="mt-5 flex gap-3 text-body-s text-ink-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4" /><span>I authorize one provider allocation, retry cap 0, the displayed cost/TTL ceiling, the exact task success contract below, and an unqualified diagnostic run.</span></label><label className="mt-4 flex gap-3 text-body-s text-ink-700"><input type="checkbox" checked={interpretationConfirmed} onChange={(event) => setInterpretationConfirmed(event.target.checked)} className="mt-1 size-4" /><span>I authorize the independent episode interpreter to receive the listed task contract, traces, lossless frames, and review videos for this run only, with provider training and public redistribution disabled and a separate $1.50 maximum.</span></label></div></div><TaskSuccessContractPanel contract={setup.task_success_contract} confirmationTeamId={setup.task_success_contract_confirmation_team_id} proposalConfirmed={proposalConfirmed} onProposalConfirmed={setProposalConfirmed} /></section> : null}
        <div className="mt-7 flex items-center justify-between border-t border-line pt-5"><Button type="button" variant="secondary" disabled={step === "setup" || submitting} onClick={() => setStep(step === "confirm" ? "run_size" : "setup")}>Back</Button>{step !== "confirm" ? <Button type="button" variant="action" iconRight={<ArrowRight />} disabled={step === "setup" && !canContinueSetup} onClick={() => setStep(step === "setup" ? "run_size" : "confirm")}>Continue</Button> : <Button type="button" variant="action" iconLeft={<Check />} disabled={!confirmed || !interpretationConfirmed || !confirmedSuccessContract || submitting || !setup.notification_recipient_options.includes(email.toLowerCase())} onClick={() => void submit()}>{submitting ? "Submitting once…" : "Submit policy canary"}</Button>}</div>
      </div> : null}
    </div>
  </AppShell>;
}
