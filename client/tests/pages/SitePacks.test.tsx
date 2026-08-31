import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SitePacks from "@/pages/app/SitePacks";

const currentUser = vi.hoisted(() => ({ uid: "friend-1" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser }),
}));

vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/lib/buyerAppData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/buyerAppData")>();
  return { ...actual, useBuyerAppEntitlements: () => ({ entitlements: [], isLoading: false, error: null }) };
});

vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer token" }),
}));

vi.mock("@/lib/configuredSceneOffering", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/configuredSceneOffering")>();
  return {
    ...actual,
    fetchAuthenticatedConfiguredSceneThumbnail: vi.fn().mockRejectedValue(new Error("thumbnail omitted in test")),
  };
});

const offering = (status: "evaluation_ready" | "configured_controls_pending", sourceLaunchId: string) => ({
  source_launch_id: sourceLaunchId,
  status,
  offering_digest: `sha256:${(status === "evaluation_ready" ? "a" : "b").repeat(64)}`,
  configuration_run_id: "config-1",
  team_namespace: "team-1",
  scene_identity: { id: "scene-839873", version: "v1" },
  task: {
    identity: { id: "rigid-relocation", version: "v1" },
    kind: "pick_and_place",
    strategy: "simple_relocation",
    subject_identity: { id: "mug", version: "v1" },
  },
  presentation: {
    thumbnail_url: `/api/configured-scene-offerings/${sourceLaunchId}/thumbnail`,
    selection: { camera_id: "overview", rationale: "task view" },
    appearance_review_status: "accepted",
    selected_from_exact_reviewed_frame_count: 8,
  },
});

describe("SitePacks configured offering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      offerings: [
        offering("evaluation_ready", "scene-839873-launch"),
        offering("configured_controls_pending", "scene-pending-launch"),
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("keeps qualified evaluation strict while exposing the separate controls-pending canary", async () => {
    render(<SitePacks />);

    const configureLink = await screen.findByRole("link", { name: /configure evaluation/i });
    expect(configureLink).toHaveAttribute("href", "/app/packs/scene-839873-launch/evaluate");
    const canaryLink = screen.getByRole("link", { name: /run policy canary/i });
    expect(canaryLink).toHaveAttribute("href", "/app/packs/scene-pending-launch/policy-canary");
    expect(screen.getByText("Controls pending")).toBeInTheDocument();
    expect(screen.getByText(/Results will be marked unqualified until controls pass/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/prepare task evaluation run/i)).not.toBeInTheDocument());
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });
});
