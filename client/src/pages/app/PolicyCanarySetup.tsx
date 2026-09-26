import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useLocation, useParams } from "wouter";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { TaskSuccessContractPanel } from "@/components/blueprint/app/TaskSuccessContractPanel";
import { Field } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";
import { fetchG1TeamCampaignSetups, submitG1TeamCampaign } from "@/lib/nativeG1TeamCampaigns";
import { downloadPolicyPairChoice, makePolicyPairChoice } from "@/lib/policyPairChoice";
import {
  downloadPacketPolicyHandoff,
  makePacketPolicyHandoff,
  makePacketPolicyPairChoice,
  parsePacketPlanningSetup,
  type PacketPlanningSetup,
} from "@/lib/policyPacketPlanning";
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
  return `${(sourceLaunchId || "g1").slice(0, 80)}-policy-canary-${suffix}`
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
  const { currentUser, userData } = useAuth();
  const developmentAccess = userData?.role === "ops" || userData?.roles?.includes("ops")
    || userData?.role === "admin" || userData?.roles?.includes("admin") || false;
  const [, navigate] = useLocation();
  const [setup, setSetup] = useState<PolicyCanarySetupView | null>(null);
  const [packetSetup, setPacketSetup] = useState<PacketPlanningSetup | null>(null);
  const [managedPacketSetups, setManagedPacketSetups] = useState<PacketPlanningSetup[]>([]);
  const [managedPacket, setManagedPacket] = useState(false);
  const [g1CatalogLoading, setG1CatalogLoading] = useState(true);
  const [g1BudgetConfirmed, setG1BudgetConfirmed] = useState(false);
  const [g1IntentId, setG1IntentId] = useState<string | null>(null);
  const [robotId, setRobotId] = useState("");
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [movementPolicyIds, setMovementPolicyIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [interpretationConfirmed, setInterpretationConfirmed] = useState(false);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);
  const [confirmedSuccessContract, setConfirmedSuccessContract] = useState<AnyTaskSuccessContract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setupRequest = useRef(0);
  const g1AuthorizationExpiry = useRef<number | null>(null);
  const runId = useMemo(() => stableRunId(decodedLaunchId), [decodedLaunchId]);

  useEffect(() => {
    if (!currentUser || decodedLaunchId || packetSetup) return;
    let cancelled = false;
    void fetchG1TeamCampaignSetups(currentUser).then((setups) => {
      if (cancelled) return;
      setG1CatalogLoading(false);
      setManagedPacketSetups(setups);
      if (setups.length) {
        setPacketSetup(setups[0]);
        setRobotId(setups[0].robot_presets[0].robot_preset_id);
        setManagedPacket(true);
      }
    }).catch((reason) => {
      if (!cancelled) {
        setG1CatalogLoading(false);
        setError(reason instanceof Error ? reason.message : "G1 task setups are unavailable.");
      }
    });
    return () => { cancelled = true; };
  }, [currentUser, decodedLaunchId, packetSetup]);

  useEffect(() => {
    if (!currentUser || !decodedLaunchId || packetSetup) return;
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
  }, [currentUser, decodedLaunchId, packetSetup]);

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

  const activeSetup = packetSetup || setup;
  const robot = activeSetup?.robot_presets.find((item) => item.robot_preset_id === robotId) || null;
  const g1Packet = Boolean(packetSetup && robot?.embodiment_id === "unitree_g1_dex3_v1");
  const preset = setup?.episode_presets.find((item) => item.preset_id === "quick_10") || null;
  const availableSetups = packetSetup
    ? packetSetup.robot_presets.map((item) => ({
      setup_digest: packetSetup.setup_digest,
      robot_preset_id: item.robot_preset_id,
      display_name: item.display_name,
      task_family_id: item.task_family_id,
      readiness: item.readiness,
    }))
    : setup?.available_setups || [];
  const inspectOnly = Boolean(packetSetup || (robot && robot.readiness.status !== "verified_runnable"));
  const canContinueSetup = Boolean(robot && policyIds.length === 2 && policyIds.every((id) => robot.policy_candidates.some((candidate) => candidate.candidate_id === id && !optionReason(candidate, robot))));

  async function importPacketSetup(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const imported = await parsePacketPlanningSetup(await file.text());
      setupRequest.current++;
      setSetup(null);
      setPacketSetup(imported);
      setManagedPacket(false);
      setRobotId(imported.robot_presets[0].robot_preset_id);
      setPolicyIds([]);
      setMovementPolicyIds([]);
      setG1BudgetConfirmed(false);
      setG1IntentId(null);
      setConfirmed(false);
      setInterpretationConfirmed(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The packet setup could not be read.");
    }
  }

  async function changeRobot(choice: string) {
    if (packetSetup) {
      const next = packetSetup.robot_presets.find((item) =>
        `${packetSetup.setup_digest}:${item.robot_preset_id}` === choice);
      if (next) {
        setRobotId(next.robot_preset_id);
        setPolicyIds([]);
        setMovementPolicyIds([]);
      }
      return;
    }
    if (!setup || !currentUser) return;
    const nextChoice = setup.available_setups.find((item) =>
      `${item.setup_digest}:${item.robot_preset_id}` === choice);
    if (!nextChoice) return;
    setConfirmed(false);
    setInterpretationConfirmed(false);
    setProposalConfirmed(false);
    setConfirmedSuccessContract(null);
    setPolicyIds([]);
    setMovementPolicyIds([]);
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

  async function downloadChoice() {
    if (!robot) return;
    try {
      if (packetSetup) {
        const choice = await makePacketPolicyPairChoice(packetSetup, robot.robot_preset_id, policyIds);
        if (g1Packet && (choice.objective_id !== "task_success" || movementPolicyIds.length !== 2)) {
          throw new Error("Choose a book pair and a movement pair for the G1 campaign.");
        }
        const bookHandoff = await makePacketPolicyHandoff(packetSetup, choice);
        if (g1Packet) {
          const movementChoice = await makePacketPolicyPairChoice(packetSetup, robot.robot_preset_id, movementPolicyIds);
          if (movementChoice.objective_id !== "g1_navigation_goal") {
            throw new Error("The G1 movement pair must use the movement goal.");
          }
          const movementHandoff = await makePacketPolicyHandoff(packetSetup, movementChoice);
          downloadPacketPolicyHandoff(bookHandoff, packetSetup.task_id);
          downloadPacketPolicyHandoff(movementHandoff, packetSetup.task_id);
        } else {
          downloadPacketPolicyHandoff(bookHandoff, packetSetup.task_id);
        }
      } else if (setup) {
        downloadPolicyPairChoice(await makePolicyPairChoice(setup, robot, policyIds));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The policy pair could not be downloaded.");
    }
  }

  async function submitManagedG1() {
    if (!currentUser || !packetSetup || !robot || !g1Packet || !managedPacket
      || policyIds.length !== 2 || movementPolicyIds.length !== 2 || !g1BudgetConfirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const bookChoice = await makePacketPolicyPairChoice(packetSetup, robot.robot_preset_id, policyIds);
      const movementChoice = await makePacketPolicyPairChoice(packetSetup, robot.robot_preset_id, movementPolicyIds);
      if (bookChoice.objective_id !== "task_success" || movementChoice.objective_id !== "g1_navigation_goal") {
        throw new Error("Choose one book pair and one movement pair.");
      }
      const bookHandoff = await makePacketPolicyHandoff(packetSetup, bookChoice);
      const movementHandoff = await makePacketPolicyHandoff(packetSetup, movementChoice);
      g1AuthorizationExpiry.current ??= Date.now() / 1000 + 3600;
      const receipt = await submitG1TeamCampaign({
        currentUser, runId, setup: packetSetup, bookHandoff, movementHandoff,
        authorizationExpiresAtEpoch: g1AuthorizationExpiry.current,
      });
      setG1IntentId(receipt.intent_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The G1 campaign could not be queued.");
    } finally {
      setSubmitting(false);
    }
  }

  const emailAllowed = Boolean(setup?.notification_recipient_options.includes(email.toLowerCase()));
  const canSubmit = !packetSetup && !inspectOnly && canContinueSetup && confirmed && interpretationConfirmed && Boolean(confirmedSuccessContract) && emailAllowed && !submitting && !switching;
  const otherSizes = setup?.episode_presets.filter((item) => item.preset_id !== "quick_10" && item.availability !== "enabled") || [];

  return <AppShell active="packs" breadcrumb="tasks / policy test">
    <Helmet><title>Configure a policy test · Blueprint</title><meta name="description" content="Choose compatible robot policies for one task." /></Helmet>
    <Link className="ws-back" href="/app/packs">← Tasks</Link>
    <header className="ws-heading"><div>
      <h1>{g1Packet ? "Plan a G1 development campaign" : packetSetup ? "Plan a development policy pair" : "Run a policy test"}</h1>
      {packetSetup ? <p className="mt-2">{packetSetup.scene_id} · {packetSetup.task_id}</p>
        : setup ? <p className="mt-2">{setup.offering.scene_id} · {setup.offering.task_id}</p> : null}
    </div></header>
    {developmentAccess ? <section aria-labelledby="packet-planning-import" className="mb-8">
      <h2 id="packet-planning-import">Retained task packet</h2>
      <p className="ws-note mt-2">Choose an assigned G1 task packet or import a verified Pipeline planning setup for an exact task revision.</p>
      <Field label="Packet planning setup" wide>
        <input type="file" accept=".json,application/json" onChange={(event) => { void importPacketSetup(event.target.files?.[0]); }} />
      </Field>
      {packetSetup && decodedLaunchId ? <button type="button" className="ws-secondary mt-3" onClick={() => {
        setPacketSetup(null);
        setManagedPacket(false);
        setRobotId("");
        setPolicyIds([]);
        setMovementPolicyIds([]);
        setError(null);
      }}>Use published setup</button> : null}
    </section> : null}
    {managedPacketSetups.length > 1 && managedPacket ? <Field label="G1 task packet" wide>
      <select value={packetSetup?.setup_digest || ""} onChange={(event) => {
        const selected = managedPacketSetups.find((item) => item.setup_digest === event.target.value);
        if (!selected) return;
        setPacketSetup(selected);
        setRobotId(selected.robot_presets[0].robot_preset_id);
        setPolicyIds([]);
        setMovementPolicyIds([]);
        setG1BudgetConfirmed(false);
        setG1IntentId(null);
        g1AuthorizationExpiry.current = null;
      }}>
        {managedPacketSetups.map((item) => <option key={item.setup_digest} value={item.setup_digest}>
          {item.scene_id} · {item.task_id}
        </option>)}
      </select>
    </Field> : null}
    {!activeSetup && !error && decodedLaunchId ? <BuyerAppLoadingState /> : null}
    {!activeSetup && !error && !decodedLaunchId && g1CatalogLoading ? <BuyerAppLoadingState /> : null}
    {!activeSetup && !error && !decodedLaunchId && !g1CatalogLoading ? <p className="ws-note">No retained G1 task packet is assigned to this team.</p> : null}
    {error ? <BuyerAppErrorState message={error} /> : null}
    {activeSetup && robot && (packetSetup || preset) ? <form className="ws-form flex flex-col gap-12" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
      {!inspectOnly ? <p className="max-w-3xl text-ink-700">
        This scene's control checks haven't passed yet, so the results are unqualified: they can't rank policies or
        promote the scene. Scenarios where a control check fails are left unscored, not counted against a policy.
      </p> : null}

      <section aria-labelledby="policy-test-robot">
        <h2 id="policy-test-robot">Robot and policies</h2>
        <div className="ws-fields mt-5">
          <Field label="Robot" wide>
            <select value={`${activeSetup.setup_digest}:${robot.robot_preset_id}`} disabled={switching} onChange={(event) => { void changeRobot(event.target.value); }}>
              {availableSetups.map((item) => <option key={`${item.setup_digest}:${item.robot_preset_id}`} value={`${item.setup_digest}:${item.robot_preset_id}`}>
                {item.display_name}{item.readiness.status === "verified_runnable" ? "" : managedPacket && item.robot_preset_id === "unitree_g1_dex3_sonic_v1" ? " (development campaign)" : " (unavailable)"}
              </option>)}
            </select>
          </Field>
        </div>
        {robot.readiness.status !== "verified_runnable" ? <p className="ws-note mt-4" role="status">{robot.readiness.reason}{managedPacket && g1Packet ? " This development campaign can still be submitted for a bounded simulation; production readiness remains unproven." : ""}</p> : null}
        <fieldset className="mt-6">
          <legend className="text-sm">{g1Packet ? "Choose two book policies" : "Choose two policies"}</legend>
          {robot.policy_candidates.filter((candidate) => !g1Packet || (candidate.evaluation_objective_id || "task_success") === "task_success").map((candidate) => {
            const reason = optionReason(candidate, robot);
            const checked = policyIds.includes(candidate.candidate_id);
            const selectedPolicy = robot.policy_candidates.find((item) => policyIds.includes(item.candidate_id));
            const differentObjective = selectedPolicy && !checked
              && (selectedPolicy.evaluation_objective_id || "task_success") !== (candidate.evaluation_objective_id || "task_success");
            const disabled = !compatible(candidate, robot)
              || (!inspectOnly && Boolean(reason))
              || (!checked && (policyIds.length >= 2 || differentObjective));
            return <label key={candidate.candidate_id} className="ws-check">
              <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => setPolicyIds(event.target.checked ? [...policyIds, candidate.candidate_id] : policyIds.filter((id) => id !== candidate.candidate_id))} />
              <span>{candidate.display_name}{inspectOnly ? <span className="block text-sm text-ink-500">{candidate.evaluation_objective_id === "g1_navigation_goal" ? "Movement goal" : "Task success"}</span> : null}{reason ? <span className="block text-sm text-ink-500">{reason}</span> : null}</span>
            </label>;
          })}
          <p className="ws-note">{inspectOnly
            ? managedPacket && g1Packet
              ? "Choose both book and movement policies, then submit the bounded development campaign. Production policy ranking remains unavailable."
              : "Choose policies for the same objective to plan a pair. This robot and scene still need a verified execution profile before a run can start."
            : "Both policies run the same scenarios with the same starting conditions and scoring."}</p>
        </fieldset>
        {g1Packet ? <fieldset className="mt-6">
          <legend className="text-sm">Choose two movement policies</legend>
          {robot.policy_candidates.filter((candidate) => candidate.evaluation_objective_id === "g1_navigation_goal").map((candidate) => {
            const checked = movementPolicyIds.includes(candidate.candidate_id);
            return <label key={candidate.candidate_id} className="ws-check">
              <input type="checkbox" checked={checked} disabled={!compatible(candidate, robot) || (!checked && movementPolicyIds.length >= 2)} onChange={(event) => setMovementPolicyIds(event.target.checked ? [...movementPolicyIds, candidate.candidate_id] : movementPolicyIds.filter((id) => id !== candidate.candidate_id))} />
              <span>{candidate.display_name}<span className="block text-sm text-ink-500">Movement goal</span></span>
            </label>;
          })}
          <p className="ws-note">Both pairs use this G1 setup and exact retained task packet. Book placement and movement have separate objectives and scores.</p>
        </fieldset> : null}
      </section>

      {inspectOnly ? <section aria-labelledby="policy-test-inspection">
        <h2 id="policy-test-inspection">Selected policies</h2>
        <p>{policyIds.length === 2
          ? robot.policy_candidates.filter((candidate) => policyIds.includes(candidate.candidate_id)).map((candidate) => candidate.display_name).join(" and ")
          : "Choose two compatible policies above to inspect a pair."}</p>
        {g1Packet ? <p>Movement: {movementPolicyIds.length === 2
          ? robot.policy_candidates.filter((candidate) => movementPolicyIds.includes(candidate.candidate_id)).map((candidate) => candidate.display_name).join(" and ")
          : "Choose two movement policies above."}</p> : null}
        <p className="ws-note">{managedPacket
          ? "Submit this development choice to the controller. It checks the sealed packet, model rights, and spend admission before GPU work. Results remain private."
          : "Download this selection for the operator to bind to a sealed scene packet and reviewed model rights. No simulator run or payment starts."}</p>
        {packetSetup ? <p className="ws-note">Packet receipt: <span className="break-all">{packetSetup.source_packet_receipt_digest}</span></p> : null}
        <button type="button" className="ws-secondary mt-4" disabled={policyIds.length !== 2 || (g1Packet && movementPolicyIds.length !== 2) || switching} onClick={() => { void downloadChoice(); }}>{g1Packet ? "Download book and movement handoffs" : packetSetup ? "Download task handoff" : "Download pair choice"}</button>
        {managedPacket && g1Packet ? <div className="mt-5">
          <label className="ws-check"><input type="checkbox" checked={g1BudgetConfirmed} onChange={(event) => setG1BudgetConfirmed(event.target.checked)} />
            <span>I authorize one internal G1 simulation campaign with a maximum provider cost of $12, a four-hour hard limit, and no paid retry.</span></label>
          <button type="button" className="ws-primary mt-4" disabled={!g1BudgetConfirmed || policyIds.length !== 2 || movementPolicyIds.length !== 2 || submitting || Boolean(g1IntentId)} onClick={() => { void submitManagedG1(); }}>
            {submitting ? "Submitting…" : "Submit G1 development campaign"}
          </button>
          {g1IntentId ? <p role="status" className="ws-note mt-3">Request accepted as {g1IntentId}. GPU execution has not started yet; the controller will verify admission before launch.</p> : null}
        </div> : null}
      </section> : null}

      {setup && preset && !packetSetup && robot.readiness.status === "verified_runnable" ? <>
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
          {packetSetup ? <>
            <div><dt>Source packet</dt><dd className="break-all">{packetSetup.source_packet_receipt_digest}</dd></div>
            <div><dt>Declared task digest</dt><dd className="break-all">{packetSetup.source_declared_task_success_contract_digest}</dd></div>
            <div><dt>Confirmed task digest</dt><dd className="break-all">{packetSetup.task_success_contract_digest}</dd></div>
          </> : setup ? <div><dt>Scene revision</dt><dd className="break-all">{setup.scene_revision_digest}</dd></div> : null}
          <div><dt>Setup</dt><dd className="break-all">{activeSetup.setup_digest}</dd></div>
          <div><dt>Runtime image</dt><dd className="break-all">{robot.runtime_image.uri}</dd></div>
          <div><dt>Observations</dt><dd>{robot.observation_schema.cameras.join(", ")} · {robot.observation_schema.modalities.join(", ")}</dd></div>
          <div><dt>Actions</dt><dd>{robot.action_schema.space} · {robot.action_schema.control_hz} Hz</dd></div>
          <div><dt>Task family</dt><dd className="break-all">{robot.task_family_id}</dd></div>
          {robot.policy_candidates.map((candidate) => <div key={candidate.candidate_id}><dt>{candidate.display_name}</dt><dd className="break-all">{candidate.candidate_id} · {candidate.adapter_id} · {candidate.license_id}</dd></div>)}
          {!inspectOnly && preset ? <><div><dt>Scenario set</dt><dd className="break-all">{preset.matrix.matrix_digest}</dd></div>
          <div><dt>Estimate basis</dt><dd className="break-all">{preset.estimate.basis_digest} · {preset.estimate.as_of}</dd></div></> : null}
        </dl>
      </details>
    </form> : null}
  </AppShell>;
}
