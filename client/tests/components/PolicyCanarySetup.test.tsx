import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PolicyCanarySetupView } from "@/lib/policyCanaryRuns";

const navigate = vi.fn();
const fetchPolicyCanarySetup = vi.fn();

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useLocation: () => ["/app/packs/scene-839873-launch/policy-canary", navigate],
  useParams: () => ({ sourceLaunchId: "scene-839873-launch" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "team-user-1", email: "team@tryblueprint.io" } }),
}));
vi.mock("@/lib/policyCanaryRuns", async () => {
  const actual = await vi.importActual<typeof import("@/lib/policyCanaryRuns")>("@/lib/policyCanaryRuns");
  return {
    ...actual,
    fetchPolicyCanarySetup,
    createPolicyCanaryRun: vi.fn(),
  };
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
    setup_digest: sha("9"),
    offering: { scene_id: "scene-839873", scene_version: "v1", task_id: "simple-relocation", task_version: "v1", task_kind: "rigid_relocation", task_strategy: "planar_push", controls_status: "configured_controls_pending" },
    notification_recipient_email: "team@tryblueprint.io",
    warning: "Controls pending — results are unqualified.",
    proof_boundary: { controls_qualification_bypassed: false, result_is_unqualified: true, official_ranking_permitted: false, scene_promotion_permitted: false },
  };
}

describe("PolicyCanarySetup", () => {
  beforeEach(() => {
    navigate.mockReset();
    fetchPolicyCanarySetup.mockReset().mockResolvedValue(setup());
  });

  it("shows the exact Scene 839873 two-policy Quick-10 confirmation path", async () => {
    const { default: PolicyCanarySetup } = await import("../../src/pages/app/PolicyCanarySetup");
    render(<PolicyCanarySetup />);

    await waitFor(() => expect(screen.getByText("scene-839873 · simple-relocation")).toBeTruthy());
    expect(screen.getByText("PI 0.5 DROID")).toBeTruthy();
    expect(screen.getByText("GR00T N1.7 DROID")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("20", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("20 nonblocking")).toBeTruthy();
    expect(screen.getByText("Deterministic cell 10")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByDisplayValue("team@tryblueprint.io")).toBeTruthy();
    expect(screen.getByText(/20 learned rollouts · 20 nonblocking diagnostic controls/)).toBeTruthy();
  });
});
