import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { User as FirebaseUser } from "firebase/auth";

import { TeamPolicyDeliveryConfig } from "@/components/blueprint/app/TeamPolicyDeliveryConfig";
import type { PacketPlanningSetup } from "@/lib/policyPacketPlanning";

const { fetchProfiles, registerProfile, submitRun } = vi.hoisted(() => ({
  fetchProfiles: vi.fn(), registerProfile: vi.fn(), submitRun: vi.fn(),
}));
vi.mock("@/lib/teamPolicyDeliveries", () => ({
  fetchTeamPolicyDeliveries: fetchProfiles,
  registerTeamPolicyDelivery: registerProfile,
  submitG1TeamPolicyRun: submitRun,
}));

const setup = {
  setup_digest: `sha256:${"a".repeat(64)}`,
  scene_id: "interiorgs-841757",
  task_id: "scene-841757-book-to-marked-area",
  robot_presets: [{
    robot_preset_id: "unitree_g1_dex3_sonic_v1",
    embodiment_id: "unitree_g1_dex3_v1",
    observation_schema: { schema_id: "humanoidarena_head_rgb_state64_v1" },
    action_schema: { schema_id: "humanoidarena_semantic_v3" },
  }],
} as unknown as PacketPlanningSetup;
const user = { uid: "owner-a" } as FirebaseUser;

beforeEach(() => {
  fetchProfiles.mockReset().mockResolvedValue([{
    profile_digest: `sha256:${"b".repeat(64)}`,
    label: "Team endpoint v1",
    source_setup_digest: setup.setup_digest,
    robot_preset_id: "unitree_g1_dex3_sonic_v1",
    embodiment_id: "unitree_g1_dex3_v1",
    observation_schema_id: "humanoidarena_head_rgb_state64_v1",
    action_schema_id: "humanoidarena_semantic_v3",
    delivery: { mode: "authenticated_endpoint", endpoint_url: "https://policy.example.org/action",
      auth_secret_ref: "secretref:team/policy", timeout_ms: 5000 },
    status: "registered_for_runtime_review",
  }]);
  registerProfile.mockReset();
  submitRun.mockReset().mockResolvedValue("g1-team-policy-" + "c".repeat(64));
});

it("chooses a registered policy and requires site/spend consent before submission", async () => {
  render(<TeamPolicyDeliveryConfig currentUser={user} setup={setup}
    robotPresetId="unitree_g1_dex3_sonic_v1" />);
  const button = await screen.findByRole("button", { name: "Submit team policy run" });
  expect(button).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Registered policy"), {
    target: { value: `sha256:${"b".repeat(64)}` },
  });
  fireEvent.change(screen.getByLabelText("Objective"), {
    target: { value: "g1_navigation_goal" },
  });
  expect(button).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("checkbox", { name: /I authorize one development simulation/ }));
  fireEvent.click(button);
  await waitFor(() => expect(submitRun).toHaveBeenCalledTimes(1));
  expect(submitRun.mock.calls[0][0]).toMatchObject({
    currentUser: user,
    setupDigest: setup.setup_digest,
    profileDigest: `sha256:${"b".repeat(64)}`,
    objectiveId: "g1_navigation_goal",
    maximumCostUsd: 12,
  });
  expect(screen.getByText(/accepted for operator runtime approval/)).toBeTruthy();
  expect(screen.getByText(/No GPU has launched/)).toBeTruthy();
});
