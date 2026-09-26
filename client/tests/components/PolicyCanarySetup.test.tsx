import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PolicyCanarySetupView } from "@/lib/policyCanaryRuns";
import type { PacketPlanningSetup } from "@/lib/policyPacketPlanning";

const navigate = vi.fn();
const fetchPolicyCanarySetup = vi.fn();

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useLocation: () => ["/app/packs/scene-839873-launch/policy-canary", navigate],
  useParams: () => ({ sourceLaunchId: "scene-839873-launch" }),
}));
vi.mock("@/contexts/AuthContext", () => {
  const currentUser = { uid: "team-user-1", email: "team@tryblueprint.io" };
  return { useAuth: () => ({ currentUser, userData: { role: "ops" } }) };
});
vi.mock("@/lib/policyCanaryRuns", async () => {
  const actual = await vi.importActual<typeof import("@/lib/policyCanaryRuns")>("@/lib/policyCanaryRuns");
  return {
    ...actual,
    fetchPolicyCanarySetup,
    createPolicyCanaryRun: vi.fn(),
  };
});
vi.mock("@/lib/policyPairChoice", async () => {
  const actual = await vi.importActual<typeof import("@/lib/policyPairChoice")>("@/lib/policyPairChoice");
  return { ...actual, downloadPolicyPairChoice: vi.fn() };
});
vi.mock("@/lib/policyPacketPlanning", async () => {
  const actual = await vi.importActual<typeof import("@/lib/policyPacketPlanning")>("@/lib/policyPacketPlanning");
  return { ...actual, parsePacketPlanningSetup: vi.fn(), downloadPacketPolicyHandoff: vi.fn() };
});

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function setup(): PolicyCanarySetupView {
  const compatibility = {
    robot_preset_ids: ["franka_panda_robotiq_2f85_v1"],
    embodiment_ids: ["franka_panda_robotiq_2f85_v1"],
    observation_schema_ids: ["droid-observation-v1"],
    action_schema_ids: ["droid-action-v1"],
    simulator_runtime_ids: ["isaac-policy-v1"],
    task_family_ids: ["rigid-relocation-v1"],
  };
  const quick = {
    preset_id: "quick_10" as const,
    label: "Quick" as const,
    episodes_per_policy: 10 as const,
    availability: "enabled" as const,
    recommended: true,
    matrix: {
      matrix_digest: sha("a"),
      resolver_id: "quick-resolver",
      resolver_version: "v1",
      deterministic: true as const,
      cells: Array.from({ length: 10 }, (_, index) => ({
        cell_id: `cell-${index + 1}`,
        family: index < 2 ? "canonical_anchor" : "placement_approach",
        seed: 100 + index,
        partition: index === 9 ? "held_out" as const : "canonical" as const,
        label: `Deterministic cell ${index + 1}`,
        cell_digest: sha(String(index % 10)),
      })),
      expected_family_counts: { canonical_anchor: 2, placement_approach: 2 },
      coverage_gaps: [],
    },
    estimate: {
      duration_minutes: { minimum: 25, maximum: 45 },
      maximum_authorized_cost_usd: 4.25,
      hard_ttl_seconds: 3600,
      basis_digest: sha("b"),
      as_of: "2026-08-31T12:00:00.000Z",
    },
  };
  return {
    schema_version: "task_evaluation_policy_canary_setup.v1",
    source_launch_id: "scene-839873-launch",
    offering_digest: sha("c"),
    scene_revision_digest: sha("d"),
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
    registry_digest: sha("e"),
    available_setups: [{
      setup_digest: sha("9"),
      robot_preset_id: "franka_panda_robotiq_2f85_v1",
      display_name: "Franka Panda + Robotiq 2F-85",
      task_family_id: "rigid-relocation-v1",
      readiness: { status: "verified_runnable", receipt: { uri: "gs://receipt/robot", digest: sha("f") }, reason: null },
    }],
    robot_presets: [{
      robot_preset_id: "franka_panda_robotiq_2f85_v1",
      display_name: "Franka Panda + Robotiq 2F-85",
      embodiment_id: "franka_panda_robotiq_2f85_v1",
      task_family_id: "rigid-relocation-v1",
      simulator_runtime_id: "isaac-policy-v1",
      runtime_image: { uri: "registry.example/isaac@sha256", digest: sha("f") },
      observation_schema: { schema_id: "droid-observation-v1", cameras: ["external", "wrist"], modalities: ["rgb", "proprioception"] },
      action_schema: { schema_id: "droid-action-v1", space: "cartesian delta", control_hz: 15 },
      readiness: { status: "verified_runnable", receipt: { uri: "gs://receipt/robot", digest: sha("f") }, reason: null },
      policy_candidates: ["PI 0.5 DROID", "GR00T N1.7 DROID"].map((displayName, index) => ({
        candidate_id: index === 0 ? "pi05_droid" : "groot_n17_droid",
        display_name: displayName,
        checkpoint: { uri: `gs://checkpoint/${index}`, digest: sha(String(index + 1)) },
        adapter_id: `adapter-${index}`,
        license_id: "verified-internal-use",
        compatibility,
        readiness: { status: "verified_runnable", receipt: { uri: `gs://receipt/${index}`, digest: sha(String(index + 1)) }, reason: null },
      })),
    }],
    episode_presets: [
      quick,
      { ...quick, preset_id: "standard_100", label: "Standard", episodes_per_policy: 100, availability: "coming_later", recommended: false, matrix: { ...quick.matrix, cells: [] } },
      { ...quick, preset_id: "deep_500", label: "Deep", episodes_per_policy: 500, availability: "coming_later", recommended: false, matrix: { ...quick.matrix, cells: [] } },
    ],
    diagnostics: { zero_action: "nonblocking", deterministic_scripted_positive: "nonblocking" },
    task_success_contract: {
      schema_version: "rigid_task_success_contract.v1",
      scope: { site_id: "scene-839873", task_id: "simple-relocation" },
      provenance: { author_source: "compatibility_default", author_id: "blueprint:manipulation_strategy_defaults.v1", confirmation_status: "confirmed", confirmed_by_team_id: null, proposal_digest: null },
      criteria: {
        destination_containment: { mode: "required", position_bounds_world_m: { minimum: [0.41, -0.21, 0.72], maximum: [0.56, -0.06, 0.79] } },
        orientation: { mode: "ignored", reference_xyzw: [0, 0, 0, 1], tolerance_rad: 0.35 },
        support: { height_mode: "required", height_interval_m: [0.72, 0.79], contact_mode: "required" },
        terminal_task_contact: { mode: "cleared" },
        gripper_state: { mode: "ignored", threshold_m: null },
        settling: { mode: "required", window_samples: 8, position_tolerance_m: 0.01, orientation_tolerance_rad: 0.08 },
        safety: { mode: "required" },
        motion: { movement_epsilon_m: 0.002, minimum_translation_m: 0.08, minimum_lift_m: null },
        temporal_invariants: { schema_version: "rigid_task_event_ledger_expectation.v1", no_drop: { mode: "ignored", minimum_fall_m: 0.02 }, maximum_task_contact_force_n: null, forbidden_contact_classes: [], containment_excursions: "forbidden", workspace_excursions: "ignored", maximum_retries: null, maximum_regrasps: null },
      },
      contract_digest: sha("8"),
    },
    setup_digest: sha("9"),
    offering: { scene_id: "scene-839873", scene_version: "v1", task_id: "simple-relocation", task_version: "v1", task_kind: "rigid_relocation", task_strategy: "planar_push", controls_status: "configured_controls_pending" },
    notification_recipient_email: "team@tryblueprint.io",
    notification_recipient_options: ["team@tryblueprint.io"],
    task_success_contract_confirmation_team_id: "blueprint",
    warning: "Controls pending — results are unqualified.",
    proof_boundary: { controls_qualification_bypassed: false, result_is_unqualified: true, official_ranking_permitted: false, scene_promotion_permitted: false },
  };
}

describe("PolicyCanarySetup", () => {
  beforeEach(() => {
    navigate.mockReset();
    fetchPolicyCanarySetup.mockReset().mockResolvedValue(setup());
  });

  it("imports a retained task packet and downloads a planning pair without starting a run", async () => {
    const { parsePacketPlanningSetup, downloadPacketPolicyHandoff } = await import("@/lib/policyPacketPlanning");
    const { createPolicyCanaryRun } = await import("@/lib/policyCanaryRuns");
    vi.mocked(createPolicyCanaryRun).mockReset();
    vi.mocked(downloadPacketPolicyHandoff).mockReset();
    const published = setup();
    const robot = published.robot_presets[0];
    robot.robot_preset_id = "unitree_g1_dex3_sonic_v1";
    robot.embodiment_id = "unitree_g1_dex3_v1";
    robot.display_name = "Unitree G1 + Dex3 / SONIC";
    robot.readiness = { status: "unavailable", receipt: null, reason: "Live episode required." };
    robot.policy_candidates = robot.policy_candidates.map((candidate, index) => ({
      ...candidate,
      candidate_id: `g1_manipulation_${index}`,
      display_name: `G1 manipulation ${index + 1}`,
      evaluation_objective_id: "task_success" as const,
      compatibility: {
        ...candidate.compatibility,
        robot_preset_ids: [robot.robot_preset_id],
        embodiment_ids: [robot.embodiment_id],
      },
      readiness: { status: "unavailable" as const, receipt: null, reason: "Live episode required." },
    }));
    robot.policy_candidates.push(...robot.policy_candidates.map((candidate, index) => ({
      ...candidate,
      candidate_id: `g1_movement_${index}`,
      display_name: `G1 movement ${index + 1}`,
      evaluation_objective_id: "g1_navigation_goal" as const,
    })));
    const packet = {
      schema_version: "task_evaluation_packet_planning_setup.v1",
      claim_ceiling: "planning_only",
      scene_id: "interiorgs-841757",
      task_id: "scene-841757-book-to-marked-area",
      source_packet_receipt_digest: sha("a"),
      source_packet_request_digest: sha("b"),
      source_scene_plan_digest: sha("c"),
      source_declared_task_success_contract_digest: sha("d"),
      task_success_contract: {
        ...published.task_success_contract,
        scope: { site_id: "interiorgs-841757", task_id: "scene-841757-book-to-marked-area" },
      },
      task_success_contract_digest: published.task_success_contract.contract_digest,
      robot_presets: [robot],
      setup_digest: sha("e"),
    } as PacketPlanningSetup;
    vi.mocked(parsePacketPlanningSetup).mockResolvedValue(packet);
    const file = new File(["{}"], "packet.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => "{}" });
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);
    fireEvent.change(screen.getByLabelText("Packet planning setup"), { target: { files: [file] } });
    await screen.findByText("interiorgs-841757 · scene-841757-book-to-marked-area");
    expect(screen.getByRole("heading", { level: 1, name: "Plan a G1 development campaign" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /G1 manipulation 1/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /G1 manipulation 2/ }));
    const download = screen.getByRole("button", { name: "Download book and movement handoffs" });
    expect(download).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /G1 movement 1/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /G1 movement 2/ }));
    expect(download).toHaveProperty("disabled", false);
    fireEvent.click(download);
    await waitFor(() => expect(vi.mocked(downloadPacketPolicyHandoff)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(downloadPacketPolicyHandoff)).toHaveBeenNthCalledWith(1, expect.objectContaining({
      schema_version: "task_evaluation_packet_policy_handoff.v1",
      claim_ceiling: "planning_only",
      setup: packet,
      choice: expect.objectContaining({
        setup_digest: sha("e"),
        robot_preset_id: robot.robot_preset_id,
        policy_candidate_ids: ["g1_manipulation_0", "g1_manipulation_1"],
        objective_id: "task_success",
      }),
      handoff_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    }), packet.task_id);
    expect(vi.mocked(downloadPacketPolicyHandoff)).toHaveBeenNthCalledWith(2, expect.objectContaining({
      schema_version: "task_evaluation_packet_policy_handoff.v1",
      claim_ceiling: "planning_only",
      setup: packet,
      choice: expect.objectContaining({
        setup_digest: sha("e"),
        robot_preset_id: robot.robot_preset_id,
        policy_candidate_ids: ["g1_movement_0", "g1_movement_1"],
        objective_id: "g1_navigation_goal",
      }),
      handoff_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    }), packet.task_id);
    expect(screen.queryByRole("button", { name: "Start policy test" })).toBeNull();
    expect(vi.mocked(createPolicyCanaryRun)).not.toHaveBeenCalled();
  });

  it("shows the Scene 839873 two-policy quick run on one plain page", async () => {
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);

    await waitFor(() => expect(screen.getByText("scene-839873 · simple-relocation")).toBeTruthy());
    expect(screen.getByRole("heading", { level: 1, name: "Run a policy test" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Tasks" }).getAttribute("href")).toBe("/app/packs");
    expect(screen.queryByText(/internal policy canary|internal recipient|policy canary/i)).toBeNull();
    // The unqualified boundary is stated once, in plain words.
    expect(screen.getAllByText(/results are unqualified/i)).toHaveLength(1);

    expect(screen.getByRole("checkbox", { name: "PI 0.5 DROID" })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "GR00T N1.7 DROID" })).toHaveProperty("checked", true);
    expect(screen.getByText(/10 scenarios per policy: 20 policy episodes, plus\s+20 control episodes/)).toBeTruthy();

    const scenarios = screen.getByText("Scenarios", { selector: "summary" }).closest("details")!;
    expect(scenarios.open).toBe(false);
    expect(within(scenarios).getByText("10. Deterministic cell 10")).toBeTruthy();

    expect(screen.getByRole("heading", { name: "Task success criteria" })).toBeTruthy();
    expect(screen.getByText("Eventual placement")).toBeTruthy();
    // Already-confirmed rules stay one click away; only a proposal opens them for review.
    expect(screen.getByText(/^The \d+ rules$/, { selector: "summary" }).closest("details")!.open).toBe(false);
    expect(screen.getByDisplayValue("team@tryblueprint.io")).toBeTruthy();
    expect(screen.getByText("$4.25")).toBeTruthy();
    expect(screen.getByText(/AI review of this run only/)).toBeTruthy();
    expect(screen.getByText(/separate \$1\.50 maximum/i)).toBeTruthy();

    // Raw runtime and policy identifiers stay in the closed details drawer.
    const details = screen.getByText("Setup details", { selector: "summary" }).closest("details")!;
    expect(details.open).toBe(false);
    expect(within(details).getByText("registry.example/isaac@sha256")).toBeTruthy();
    expect(within(details).getByText(/pi05_droid · adapter-0 · verified-internal-use/)).toBeTruthy();
  });

  it("starts only after both approvals and routes to the run's progress", async () => {
    const { createPolicyCanaryRun } = await import("@/lib/policyCanaryRuns");
    vi.mocked(createPolicyCanaryRun).mockResolvedValue({ run: { run_id: "scene-839873-launch-policy-canary-1" } } as any);
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);

    const start = await screen.findByRole("button", { name: "Start policy test" });
    expect(start).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve one simulator run/ }));
    expect(start).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I allow an AI review/ }));
    expect(start).toHaveProperty("disabled", false);

    fireEvent.change(screen.getByLabelText(/Email me at/), { target: { value: "someone@example.com" } });
    expect(start).toHaveProperty("disabled", true);
    expect(screen.getByText("Use team@tryblueprint.io.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Email me at/), { target: { value: "team@tryblueprint.io" } });

    fireEvent.click(start);
    await waitFor(() => expect(createPolicyCanaryRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createPolicyCanaryRun).mock.calls[0][0].input).toMatchObject({
      run_kind: "internal_policy_canary",
      policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
      episode_preset_id: "quick_10",
      notification: { email: "team@tryblueprint.io" },
      authorization: { maximum_cost_usd: 4.25, maximum_provider_allocations: 1, retry_cap: 0 },
      episode_interpretation: { provider_training_authorized: false, public_redistribution_authorized: false, maximum_cost_usd: 1.5 },
      confirm_unqualified_execution: true,
    });
    expect(navigate).toHaveBeenCalledWith("/app/evaluation-runs/scene-839873-launch-policy-canary-1");
  });

  it("lists policies that aren't offered yet with the reason, and books the pair in list order", async () => {
    const value = setup();
    const [pi05] = value.robot_presets[0].policy_candidates;
    value.robot_presets[0].policy_candidates.push(
      { ...pi05, candidate_id: "cosmos3_nano_policy_droid", display_name: "Cosmos 3 Nano Policy DROID",
        readiness: { status: "unavailable", receipt: null, reason: "Coming soon. It is being connected to our simulator and checked on a reference task before it can run." } },
      { ...pi05, candidate_id: "molmoact2_droid", display_name: "MolmoAct 2 DROID",
        readiness: { status: "unavailable", receipt: null, reason: "Not offered yet. Its license is being reviewed for use in a paid service." } },
    );
    fetchPolicyCanarySetup.mockResolvedValue(value);
    const { createPolicyCanaryRun } = await import("@/lib/policyCanaryRuns");
    vi.mocked(createPolicyCanaryRun).mockReset().mockResolvedValue({ run: { run_id: "run-2" } } as any);
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);

    const cosmos = await screen.findByRole("checkbox", { name: /Cosmos 3 Nano Policy DROID/ });
    expect(cosmos).toHaveProperty("disabled", true);
    expect(screen.getByText(/^Coming soon\./)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /MolmoAct 2 DROID/ })).toHaveProperty("disabled", true);
    expect(screen.getByText(/license is being reviewed/)).toBeTruthy();

    // Untick and re-tick π0.5: the run is still booked in list order.
    const pi = screen.getByRole("checkbox", { name: "PI 0.5 DROID" });
    fireEvent.click(pi);
    fireEvent.click(pi);
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve one simulator run/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I allow an AI review/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start policy test" }));
    await waitFor(() => expect(createPolicyCanaryRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createPolicyCanaryRun).mock.calls[0][0].input.policy_candidate_ids)
      .toEqual(["pi05_droid", "groot_n17_droid"]);
  });

  it("loads G1's sealed setup and clears Franka approvals before booking", async () => {
    const franka = setup();
    const g1 = setup();
    g1.setup_digest = sha("7");
    const robot = g1.robot_presets[0];
    robot.robot_preset_id = "unitree_g1_v1";
    robot.embodiment_id = "unitree_g1_v1";
    robot.display_name = "Unitree G1";
    robot.policy_candidates = robot.policy_candidates.map((candidate, index) => ({
      ...candidate,
      candidate_id: `g1_policy_${index}`,
      display_name: `G1 policy ${index + 1}`,
      compatibility: {
        ...candidate.compatibility,
        robot_preset_ids: ["unitree_g1_v1"],
        embodiment_ids: ["unitree_g1_v1"],
      },
    }));
    const choices = [franka.available_setups[0], {
      setup_digest: g1.setup_digest,
      robot_preset_id: robot.robot_preset_id,
      display_name: robot.display_name,
      task_family_id: robot.task_family_id,
      readiness: robot.readiness,
    }];
    franka.available_setups = choices;
    g1.available_setups = choices;
    fetchPolicyCanarySetup.mockImplementation(async (_user, _launch, selection) => selection ? g1 : franka);
    const { createPolicyCanaryRun } = await import("@/lib/policyCanaryRuns");
    vi.mocked(createPolicyCanaryRun).mockReset().mockResolvedValue({ run: { run_id: "g1-run" } } as any);
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);

    await screen.findByRole("checkbox", { name: "PI 0.5 DROID" });
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve one simulator run/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I allow an AI review/ }));
    fireEvent.change(screen.getByLabelText("Robot"), { target: { value: `${sha("7")}:unitree_g1_v1` } });
    await screen.findByRole("checkbox", { name: "G1 policy 1" });
    expect(fetchPolicyCanarySetup).toHaveBeenCalledWith(expect.anything(), "scene-839873-launch", {
      setupDigest: sha("7"), robotPresetId: "unitree_g1_v1",
    });
    expect(screen.queryByRole("checkbox", { name: "PI 0.5 DROID" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /I approve one simulator run/ })).toHaveProperty("checked", false);
    expect(screen.getByRole("checkbox", { name: /I allow an AI review/ })).toHaveProperty("checked", false);
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve one simulator run/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I allow an AI review/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start policy test" }));
    await waitFor(() => expect(createPolicyCanaryRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createPolicyCanaryRun).mock.calls[0][0].input).toMatchObject({
      setup_digest: sha("7"),
      robot_preset_id: "unitree_g1_v1",
      policy_candidate_ids: ["g1_policy_0", "g1_policy_1"],
    });
  });

  it("inspects an unavailable G1 pair from another setup without starting a run", async () => {
    const franka = setup();
    const g1 = setup();
    g1.setup_digest = sha("7");
    const robot = g1.robot_presets[0];
    robot.robot_preset_id = "unitree_g1_dex3_sonic_v1";
    robot.embodiment_id = "unitree_g1_dex3_v1";
    robot.display_name = "Unitree G1 + Dex3 / SONIC";
    robot.readiness = { status: "unavailable", receipt: null, reason: "No verified G1 episode for this scene." };
    const base = robot.policy_candidates[0];
    robot.policy_candidates = [
      ["G1 DP manipulation", "task_success"],
      ["G1 π0.5 manipulation", "task_success"],
      ["G1 DP navigation", "g1_navigation_goal"],
      ["G1 π0.5 navigation", "g1_navigation_goal"],
    ].map(([displayName, objective], index) => ({
      ...base,
      candidate_id: `g1_policy_${index}`,
      display_name: displayName,
      evaluation_objective_id: objective as "task_success" | "g1_navigation_goal",
      compatibility: {
        ...base.compatibility,
        robot_preset_ids: [robot.robot_preset_id],
        embodiment_ids: [robot.embodiment_id],
      },
      readiness: { status: "unavailable" as const, receipt: null, reason: "Checkpoint episode required." },
    }));
    const choices = [franka.available_setups[0], {
      setup_digest: g1.setup_digest,
      robot_preset_id: robot.robot_preset_id,
      display_name: robot.display_name,
      task_family_id: robot.task_family_id,
      readiness: robot.readiness,
    }];
    franka.available_setups = choices;
    g1.available_setups = choices;
    fetchPolicyCanarySetup.mockImplementation(async (_user, _launch, selection) => selection ? g1 : franka);
    const { createPolicyCanaryRun } = await import("@/lib/policyCanaryRuns");
    vi.mocked(createPolicyCanaryRun).mockReset();
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);

    await screen.findByRole("checkbox", { name: "PI 0.5 DROID" });
    const g1Option = screen.getByRole("option", { name: /Unitree G1 \+ Dex3/ });
    expect(g1Option).toHaveProperty("disabled", false);
    fireEvent.change(screen.getByLabelText("Robot"), {
      target: { value: `${sha("7")}:${robot.robot_preset_id}` },
    });
    const dp = await screen.findByRole("checkbox", { name: /G1 DP manipulation/ });
    const pi = screen.getByRole("checkbox", { name: /G1 π0\.5 manipulation/ });
    const navigation = screen.getByRole("checkbox", { name: /G1 DP navigation/ });
    expect(dp).toHaveProperty("disabled", false);
    fireEvent.click(dp);
    expect(navigation).toHaveProperty("disabled", true);
    fireEvent.click(pi);
    expect(screen.getByText("G1 DP manipulation and G1 π0.5 manipulation")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download pair choice" }));
    const { downloadPolicyPairChoice } = await import("@/lib/policyPairChoice");
    await waitFor(() => expect(vi.mocked(downloadPolicyPairChoice)).toHaveBeenCalledWith(expect.objectContaining({
      schema_version: "task_evaluation_policy_pair_choice.v1",
      claim_ceiling: "planning_only",
      setup_digest: sha("7"),
      robot_preset_id: robot.robot_preset_id,
      policy_candidate_ids: ["g1_policy_0", "g1_policy_1"],
      objective_id: "task_success",
      // Python Pipeline's canonical_digest for these exact transport fields.
      choice_digest: "sha256:0dc73178c9ebe710c6e4cdf07d68ce9cee217f3ad1c5efd1f4d4273a19e5c1e4",
    })));
    expect(screen.queryByRole("button", { name: "Start policy test" })).toBeNull();
    expect(screen.queryByText(/10 scenarios per policy/)).toBeNull();
    expect(vi.mocked(createPolicyCanaryRun)).not.toHaveBeenCalled();
  });
});
