import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sites from "@/pages/Sites";
import SiteDetail from "@/pages/SiteDetail";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sites", () => {
  it("renders the captured-site library with the expected filters and CTAs", () => {
    render(<Sites />);

    expect(
      screen.getByRole("heading", {
        name: /Browse captured sites for robot evaluation\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search sites, tasks, locations, or use cases/i),
    ).toBeInTheDocument();

    for (const label of ["Site type", "Task pack", "Readiness", "Access", "Region"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    const harborviewCard = screen
      .getByRole("heading", { name: /Harborview Grocery Distribution Annex/i })
      .closest("article");
    expect(harborviewCard).not.toBeNull();
    expect(within(harborviewCard as HTMLElement).getByText(/500 ready/i)).toBeInTheDocument();
    expect(within(harborviewCard as HTMLElement).getByRole("link", { name: /View site/i })).toHaveAttribute(
      "href",
      "/sites/sw-chi-01",
    );
    expect(
      within(harborviewCard as HTMLElement).getByText(/Materialization/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByText(/Site, task, scenario, eval, and threshold manifests attached/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByText(/CPU setup manifests present/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByText(/Awaiting policy\/container\/trace\/demo\/plugin evidence/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByRole("link", {
        name: /Run simulator evaluation/i,
      }),
    ).toHaveAttribute("href", "/sites/sw-chi-01#simulator-evaluation");
  });

  it("posts a Unitree G1 MuJoCo simulator request from the one-page site flow", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "queued_for_pipeline",
        pipelineForward: {
          status: "forwarded",
          accepted: true,
          performed: true,
          pipeline_status: "staged_for_control_plane",
        },
      }),
    } as Response);

    render(<SiteDetail params={{ slug: "sw-chi-01" }} />);

    expect(screen.getByText(/Unitree G1 MuJoCo simulator evaluation request/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Navigate to a spot/i)).toBeChecked();
    expect(screen.getByText(/Blueprint chooses the fastest\/cheapest available simulator worker/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Run simulator evaluation$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/robot-eval/job-requests",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body || "{}"));
    expect(body.schema_version).toBe("robot_eval_job_request.v1");
    expect(body.buyer_request_id).toBe(
      "buyer-request-sw-chi-01-walk-to-target-blueprint-default-unitree-g1-mujoco-simulator-policy",
    );
    expect(body.site_package.site_slug).toBe("sw-chi-01");
    expect(body.site_package.site_submission_id).toBe("site-submission-sw-chi-01");
    expect(body.site_package.capture_job_id).toBe("capture-job-sw-chi-01");
    expect(body.site_package.capture_id).toBe("capture-sw-chi-01");
    expect(body.site_package.buyer_request_id).toBe(body.buyer_request_id);
    expect(body.site_package.pipeline_prefix).toBe(
      "/synced-artifacts/sites/sw-chi-01/pipeline",
    );
    expect(body.site_package.publication_ready_to_evaluate).toBe(true);
    expect(body.site_package.cpu_preflight_scorecard_uri).toContain(
      "/cpu_preflight_scorecard.json",
    );
    expect(body.site_package.episode_spec_manifest_uri).toContain(
      "/episode_spec_manifest.json",
    );
    expect(body.pipeline_trigger.cpu_pre_gpu_preflight).toEqual(
      expect.objectContaining({
        local_cpu_preflight_smoke_ran: false,
        simulator_execution_proven: false,
        robot_readiness_proven: false,
      }),
    );
    expect(body.execution_request).toEqual(
      expect.objectContaining({
        webapp_role: "queue_and_forward_only",
        scheduler_owner: "BlueprintCapturePipeline",
        scope: expect.objectContaining({
          mode: "simulator_only",
          label: "Unitree G1 MuJoCo simulator evaluation",
          physical_robot_deployment_claim_allowed: false,
        }),
        queueing: expect.objectContaining({
          web_request_must_not_wait_for_simulator: true,
        }),
        worker_selection: expect.objectContaining({
          mode: "blueprint_selects_fastest_cheapest_available_simulator_worker",
          customer_provider_choice_required: false,
        }),
        preflight: expect.objectContaining({
          cpu_preflight_required_before_gpu: true,
          blocks_gpu_when_missing: true,
        }),
        simulator_routing: expect.objectContaining({
          requested_backend: "pipeline_selected",
          default_first_pass_backend: "mujoco",
          default_first_gpu_backend: "mujoco",
          simulator_preference: "mujoco",
          default_robot_profile_id: "unitree_g1_humanoid",
          allowed_backends: expect.arrayContaining(["isaac_sim", "mujoco"]),
          escalation_backends: expect.arrayContaining(["isaac_sim", "isaac_lab_arena"]),
          selection_policy: expect.objectContaining({
            mode: "mujoco_first_unless_proof_requires_isaac",
            first_pass_backend: "mujoco",
            escalate_to_isaac_when: expect.arrayContaining([
              "rich_usd_or_openusd_scene_load_required",
              "isaac_robot_asset_proof_required",
            ]),
          }),
          proof_boundaries: expect.objectContaining({
            webapp_request_selects_policy_not_execution: true,
            mujoco_proof_does_not_clear_isaac_sim_gate: true,
          }),
        }),
        gpu_allocation: expect.objectContaining({
          allocation_allowed_by_webapp: false,
          gpu_spend_approved: false,
          idle_shutdown_required: true,
        }),
        artifact_contract: expect.objectContaining({
          expected_outputs: expect.arrayContaining([
            "scheduler_decision",
            "worker_launch_plan",
            "worker_manifest",
            "gpu_provider_launch_request",
            "gpu_provider_launcher_result",
            "runpod_provider_adapter_result",
            "gpu_cost_control_ledger",
            "startup_architecture_audit",
            "worker_runtime_manifest",
            "worker_runtime_preflight",
          ]),
          startup_artifacts_are_advisory_until_owner_runtime_proof: true,
          simulator_execution_proven_by_webapp: false,
          public_claim_upgrade_allowed: false,
        }),
      }),
    );
    expect(body.simulator_preference).toBe("mujoco_first");
    expect(body.simulator_scope).toEqual(
      expect.objectContaining({
        mode: "simulator_only",
        robot: "Unitree G1",
        simulator: "MuJoCo",
        customer_label: "WAM/VLA policy evaluation with internal MuJoCo adapter",
        provider_strategy: "Blueprint pipeline selects the replaceable WAM/VLA evaluator backend",
        physical_robot_deployment_claim_allowed: false,
      }),
    );
    expect(body.pipeline_trigger.default_simulator).toBe("mujoco");
    expect(body.requested_tasks[0]).toEqual(
      expect.objectContaining({
        task_id: "walk_to_target",
        label: "Navigate to a spot",
        scenario_ids: ["sw-chi-01_scenario_walk_to_target_unitree_g1_mujoco_v1"],
        skill_id: "walk_to_target",
      }),
    );
    expect(body.robot_profile).toEqual(
      expect.objectContaining({
        robot_profile_id: "unitree_g1_humanoid",
        robot_name: "Unitree G1",
        embodiment: "humanoid",
      }),
    );
    expect(body.owner_system).toEqual(
      expect.objectContaining({
        buyer_request_id: body.buyer_request_id,
        site_submission_id: "site-submission-sw-chi-01",
        capture_job_id: "capture-job-sw-chi-01",
        capture_id: "capture-sw-chi-01",
      }),
    );
    expect(Object.keys(body.policy_package)).toEqual([
      "high_level_skill_trace",
    ]);
    expect(body.policy_package.high_level_skill_trace).toEqual(
      expect.objectContaining({
        ordered_skill_sequence: ["walk_to_target"],
        skill_taxonomy_version: "blueprint_unitree_g1_mujoco_beta.v1",
        source_type: "webapp_default_simulator_beta_request",
      }),
    );
    expect(JSON.stringify(body.policy_package)).not.toMatch(/placeholder/i);
    expect(await screen.findByText(/Request accepted and queued for Pipeline handoff/i)).toBeInTheDocument();
    expect(await screen.findByText(/staged_for_control_plane/i)).toBeInTheDocument();
    expect(screen.getByText(body.buyer_request_id)).toBeInTheDocument();
  });

  it("keeps simulator-only copy from implying physical readiness", () => {
    const { container } = render(<SiteDetail params={{ slug: "sw-chi-01" }} />);

    expect(screen.getByText(/Scope: simulator only/i)).toBeInTheDocument();
    expect(screen.getByText(/WebApp proves request construction, queueing, and forwarding state only/i)).toBeInTheDocument();
    expect(container.textContent || "").not.toMatch(
      /deployment ready|real robot verified|physical safety validated|real robot POV|ready for physical robot/i,
    );
  });

  it("filters by site type, task pack, readiness, access, region, and search", () => {
    render(<Sites />);

    fireEvent.change(screen.getByLabelText("Site type"), { target: { value: "Hospital" } });
    expect(screen.getByText(/Piedmont Hospital Supply Hallway/i)).toBeInTheDocument();
    expect(screen.queryByText(/Harborview Grocery Distribution Annex/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Site type"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Task pack"), { target: { value: "Pick/place" } });
    expect(screen.getByText(/Triangle Robotics Lab/i)).toBeInTheDocument();
    expect(screen.queryByText(/Motor City Battery Staging Cell/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Task pack"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Readiness"), { target: { value: "Capture complete" } });
    expect(screen.getByText(/Motor City Battery Staging Cell/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "Open sample" } });
    expect(screen.getByText(/No matching sites yet\./i)).toBeInTheDocument();
  });

  it("renders a compact site detail page for a legacy slug alias", () => {
    render(<SiteDetail params={{ slug: "siteworld-f5fd54898cfb" }} />);

    expect(
      screen.getByRole("heading", { name: /Triangle Robotics Lab/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Open sample/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Available task packs/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Run simulator evaluation$/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Materialization/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CPU setup manifests present/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Policy Improvement Run export awaits request approval/i).length).toBeGreaterThan(0);
  });
});
