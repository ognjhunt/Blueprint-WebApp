import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useLocation, useParams } from "wouter";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { TaskSuccessContractPanel } from "@/components/blueprint/app/TaskSuccessContractPanel";
import { Field } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  createPolicyCanaryRun,
  fetchPolicyCanarySetup,
  type PolicyCanaryCandidate,
  type PolicyCanaryRobotPreset,
  type PolicyCanarySelection,
  type PolicyCanarySetupView,
} from "@/lib/policyCanaryRuns";
import {
  confirmTaskSuccessContractProposal,
  type AnyTaskSuccessContract,
} from "@/lib/articulatedTaskSuccessContract";

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
    return candidate.readiness.reason || "Not available yet.";
  }
  if (!compatible(candidate, robot)) return `Doesn't work with ${robot.display_name}.`;
  if (candidate.evaluation_objective_id === "g1_navigation_goal") {
    return "This task needs a confirmed movement goal and score before this policy can run.";
  }
  return null;
}

export default function PolicyCanarySetup() {
  const { sourceLaunchId = "" } = useParams<{ sourceLaunchId?: string }>();
  const decodedLaunchId = decodeURIComponent(sourceLaunchId);
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const [setup, setSetup] = useState<PolicyCanarySetupView | null>(null);
  const [robotId, setRobotId] = useState("");
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [interpretationConfirmed, setInterpretationConfirmed] = useState(false);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);
  const [confirmedSuccessContract, setConfirmedSuccessContract] = useState<AnyTaskSuccessContract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setupRequest = useRef(0);
  const runId = useMemo(() => stableRunId(decodedLaunchId), [decodedLaunchId]);

  useEffect(() => {
    if (!currentUser || !decodedLaunchId) return;
    let cancelled = false;
    const request = ++setupRequest.current;
    void fetchPolicyCanarySetup(currentUser, decodedLaunchId).then((value) => {
      if (cancelled || request !== setupRequest.current) return;
      setSetup(value);
      const firstRobot = value.robot_presets.find((robot) => robot.readiness.status === "verified_runnable");
      if (firstRobot) {
        setRobotId(firstRobot.robot_preset_id);
        setPolicyIds(firstRobot.policy_candidates.filter((policy) => !optionReason(policy, firstRobot)).slice(0, 2).map((policy) => policy.candidate_id));
      }
      setEmail(value.notification_recipient_email || "");
    }).catch((reason) => !cancelled && request === setupRequest.current && setError(reason instanceof Error ? reason.message : "This policy test isn't available."));
    return () => { cancelled = true; setupRequest.current++; };
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
    void confirmTaskSuccessContractProposal(
      setup.task_success_contract,
      setup.task_success_contract_confirmation_team_id,
    ).then((contract) => {
      if (!cancelled) setConfirmedSuccessContract(contract);
    }).catch(() => {
      if (!cancelled) {
        setConfirmedSuccessContract(null);
        setError("The success criteria couldn't be confirmed. Reload the page to try again.");
      }
    });
    return () => { cancelled = true; };
  }, [proposalConfirmed, setup]);

  const robot = setup?.robot_presets.find((item) => item.robot_preset_id === robotId) || null;
  const preset = setup?.episode_presets.find((item) => item.preset_id === "quick_10") || null;
  const canContinueSetup = Boolean(robot && policyIds.length === 2 && policyIds.every((id) => robot.policy_candidates.some((candidate) => candidate.candidate_id === id && !optionReason(candidate, robot))));

  async function changeRobot(choice: string) {
    if (!setup || !currentUser) return;
    const nextChoice = setup.available_setups.find((item) =>
      `${item.setup_digest}:${item.robot_preset_id}` === choice);
    if (!nextChoice) return;
    setConfirmed(false);
    setInterpretationConfirmed(false);
    setProposalConfirmed(false);
    setConfirmedSuccessContract(null);
    setPolicyIds([]);
    setError(null);
    const request = ++setupRequest.current;
    setSwitching(true);
    try {
      const value = nextChoice.setup_digest === setup.setup_digest
        ? setup
        : await fetchPolicyCanarySetup(currentUser, decodedLaunchId, {
          setupDigest: nextChoice.setup_digest,
          robotPresetId: nextChoice.robot_preset_id,
        });
      if (request !== setupRequest.current) return;
      const next = value.robot_presets.find((item) => item.robot_preset_id === nextChoice.robot_preset_id);
      if (!next || value.setup_digest !== nextChoice.setup_digest) throw new Error("The selected robot setup changed. Reload and try again.");
      setSetup(value);
      setRobotId(next.robot_preset_id);
      setPolicyIds(next.policy_candidates.filter((policy) => !optionReason(policy, next)).slice(0, 2).map((policy) => policy.candidate_id));
      setEmail(value.notification_recipient_email || "");
    } catch (reason) {
      if (request === setupRequest.current) setError(reason instanceof Error ? reason.message : "This robot setup isn't available.");
    } finally {
      if (request === setupRequest.current) setSwitching(false);
    }
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
    // The pair is unordered; list order is the one order a run is booked in.
    const [firstPolicy, secondPolicy] = robot.policy_candidates
      .map((candidate) => candidate.candidate_id)
      .filter((candidateId) => policyIds.includes(candidateId));
    const input: PolicyCanarySelection = {
      schema_version: "task_evaluation_policy_canary_selection.v1",
      run_kind: "internal_policy_canary",
      claim_ceiling: "diagnostic_policy_execution",
      run_id: runId,
      offering_digest: setup.offering_digest,
      setup_digest: setup.setup_digest,
      scene_revision_digest: setup.scene_revision_digest,
      robot_preset_id: robot.robot_preset_id,
      policy_candidate_ids: [firstPolicy, secondPolicy],
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
      setError(reason instanceof Error ? reason.message : "The policy test couldn't be started.");
      setSubmitting(false);
    }
  }

  const emailAllowed = Boolean(setup?.notification_recipient_options.includes(email.toLowerCase()));
  const canSubmit = canContinueSetup && confirmed && interpretationConfirmed && Boolean(confirmedSuccessContract) && emailAllowed && !submitting && !switching;
  const otherSizes = setup?.episode_presets.filter((item) => item.preset_id !== "quick_10" && item.availability !== "enabled") || [];

  return <AppShell active="packs" breadcrumb="tasks / policy test">
    <Helmet><title>Run a policy test · Blueprint</title><meta name="description" content="Run two policies on this task in simulation before the scene's checks pass." /></Helmet>
    <Link className="ws-back" href="/app/packs">← Tasks</Link>
    <header className="ws-heading"><div>
      <h1>Run a policy test</h1>
      {setup ? <p className="mt-2">{setup.offering.scene_id} · {setup.offering.task_id}</p> : null}
    </div></header>
    {!setup && !error ? <BuyerAppLoadingState /> : null}
    {error ? <BuyerAppErrorState message={error} /> : null}
    {setup && robot && preset ? <form className="ws-form flex flex-col gap-12" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
      <p className="max-w-3xl text-ink-700">
        This scene's control checks haven't passed yet, so the results are unqualified: they can't rank policies or
        promote the scene. Scenarios where a control check fails are left unscored, not counted against a policy.
      </p>

      <section aria-labelledby="policy-test-robot">
        <h2 id="policy-test-robot">Robot and policies</h2>
        <div className="ws-fields mt-5">
          <Field label="Robot" wide>
            <select value={`${setup.setup_digest}:${robot.robot_preset_id}`} disabled={switching} onChange={(event) => { void changeRobot(event.target.value); }}>
              {setup.available_setups.map((item) => <option key={`${item.setup_digest}:${item.robot_preset_id}`} value={`${item.setup_digest}:${item.robot_preset_id}`} disabled={item.readiness.status !== "verified_runnable" && item.setup_digest !== setup.setup_digest}>
                {item.display_name}{item.readiness.status === "verified_runnable" ? "" : " (unavailable)"}
              </option>)}
            </select>
          </Field>
        </div>
        {robot.readiness.status !== "verified_runnable" ? <p className="ws-note mt-4" role="status">{robot.readiness.reason}</p> : null}
        <fieldset className="mt-6">
          <legend className="text-sm">{robot.readiness.status === "verified_runnable" ? "Choose two policies" : "Policies for this robot"}</legend>
          {robot.policy_candidates.map((candidate) => {
            const reason = optionReason(candidate, robot);
            const checked = policyIds.includes(candidate.candidate_id);
            const disabled = Boolean(reason) || (!checked && policyIds.length >= 2);
            return <label key={candidate.candidate_id} className="ws-check">
              <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => setPolicyIds(event.target.checked ? [...policyIds, candidate.candidate_id] : policyIds.filter((id) => id !== candidate.candidate_id))} />
              <span>{candidate.display_name}{reason ? <span className="block text-sm text-ink-500">{reason}</span> : null}</span>
            </label>;
          })}
          {robot.readiness.status === "verified_runnable" ? <p className="ws-note">Both policies run the same scenarios with the same starting conditions and scoring.</p> : null}
        </fieldset>
      </section>

      {robot.readiness.status === "verified_runnable" ? <>
      <section aria-labelledby="policy-test-size">
        <h2 id="policy-test-size">Run size</h2>
        <p>
          {preset.episodes_per_policy} scenarios per policy: {preset.episodes_per_policy * 2} policy episodes, plus{" "}
          {preset.matrix.cells.length * 2} control episodes that don't block the run.
        </p>
        {otherSizes.length ? <p className="ws-note">Larger runs ({otherSizes.map((item) => `${item.episodes_per_policy} per policy`).join(", ")}) are coming later.</p> : null}
        <details className="mt-5">
          <summary>Scenarios</summary>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead><tr><th>Scenario</th><th>Seed</th><th>Set</th></tr></thead>
              <tbody>{preset.matrix.cells.map((cell, index) => <tr key={cell.cell_id}>
                <td>{index + 1}. {cell.label}</td>
                <td className="tabular-nums">{cell.seed}</td>
                <td>{cell.partition.replaceAll("_", " ")}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {preset.matrix.coverage_gaps.length ? <ul className="mt-3 text-sm">
            {preset.matrix.coverage_gaps.map((gap) => <li key={gap.family}>Not covered: {gap.family.replaceAll("_", " ")}. {gap.explanation} Replaced with {gap.deterministic_fallback_family.replaceAll("_", " ")}.</li>)}
          </ul> : null}
        </details>
      </section>

      <TaskSuccessContractPanel contract={setup.task_success_contract} confirmationTeamId={setup.task_success_contract_confirmation_team_id} proposalConfirmed={proposalConfirmed} onProposalConfirmed={setProposalConfirmed} />

      <section aria-labelledby="policy-test-start">
        <h2 id="policy-test-start">Start</h2>
        <dl className="ws-facts">
          <div><dt>Estimated time</dt><dd>{preset.estimate.duration_minutes.minimum}–{preset.estimate.duration_minutes.maximum} min</dd></div>
          <div><dt>Maximum cost</dt><dd>${preset.estimate.maximum_authorized_cost_usd.toFixed(2)}</dd></div>
          <div><dt>Time limit</dt><dd>{Math.round(preset.estimate.hard_ttl_seconds / 60)} min</dd></div>
        </dl>
        <div className="ws-fields mt-6">
          <Field
            label="Email me at"
            hint={emailAllowed
              ? "We email once when the test finishes, is blocked, or is cancelled."
              : `Use ${setup.notification_recipient_options.join(" or ") || "your account email"}.`}
            wide
          >
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        </div>
        <label className="ws-check">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I approve one simulator run with no retries, up to the maximum cost and time limit above, scored by the success criteria above, with unqualified results.</span>
        </label>
        <label className="ws-check">
          <input type="checkbox" checked={interpretationConfirmed} onChange={(event) => setInterpretationConfirmed(event.target.checked)} />
          <span>I allow an AI review of this run only: it receives the success criteria, traces, frames, and review videos, can't train on them or share them publicly, and has a separate $1.50 maximum.</span>
        </label>
        <div className="ws-form-actions">
          <button type="submit" className="ws-primary" disabled={!canSubmit}>{submitting ? "Starting…" : "Start policy test"}</button>
        </div>
      </section>
      </> : null}

      <details>
        <summary>Setup details</summary>
        <dl className="ws-facts">
          <div><dt>Scene revision</dt><dd className="break-all">{setup.scene_revision_digest}</dd></div>
          <div><dt>Setup</dt><dd className="break-all">{setup.setup_digest}</dd></div>
          <div><dt>Runtime image</dt><dd className="break-all">{robot.runtime_image.uri}</dd></div>
          <div><dt>Observations</dt><dd>{robot.observation_schema.cameras.join(", ")} · {robot.observation_schema.modalities.join(", ")}</dd></div>
          <div><dt>Actions</dt><dd>{robot.action_schema.space} · {robot.action_schema.control_hz} Hz</dd></div>
          <div><dt>Task family</dt><dd className="break-all">{robot.task_family_id}</dd></div>
          {robot.policy_candidates.map((candidate) => <div key={candidate.candidate_id}><dt>{candidate.display_name}</dt><dd className="break-all">{candidate.candidate_id} · {candidate.adapter_id} · {candidate.license_id}</dd></div>)}
          <div><dt>Scenario set</dt><dd className="break-all">{preset.matrix.matrix_digest}</dd></div>
          <div><dt>Estimate basis</dt><dd className="break-all">{preset.estimate.basis_digest} · {preset.estimate.as_of}</dd></div>
        </dl>
      </details>
    </form> : null}
  </AppShell>;
}
