import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SitePacks from "@/pages/app/SitePacks";

const currentUser = vi.hoisted(() => ({ uid: "friend-1" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser }),
}));

vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

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

describe("Tasks page (/app/packs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      offerings: [
        offering("evaluation_ready", "scene-839873-launch"),
        offering("configured_controls_pending", "scene-pending-launch"),
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("is titled Tasks and gives each task one status and one next step", async () => {
    render(<SitePacks />);

    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    const paidLinks = await screen.findAllByRole("link", { name: /evaluate a task · \$99 per policy/i });
    expect(paidLinks).toHaveLength(2);
    paidLinks.forEach((link) => expect(link).toHaveAttribute("href", "/sites"));
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Scene checks pending")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2, name: "Rigid relocation" })).toHaveLength(2);

    // The image caveat is stated once for the page, not repeated on every card.
    expect(screen.getAllByText(/rendered images of the prepared scene, not photos/)).toHaveLength(1);
    expect(screen.queryByText(/digest-bound renders|derived appearance evidence|Maintained site-task substrate|compatibility-backed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /request a task evaluation run/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("does not offer an evaluation for a task that is still being prepared", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      offerings: [offering("launch_ready" as any, "launch-only")],
    }), { status: 200 }));
    render(<SitePacks />);
    expect(await screen.findByText("Being prepared")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /set up an evaluation|run a policy test|view task/i })).not.toBeInTheDocument();
  });

  it("shows a plain empty state when the team has no tasks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ offerings: [] }), { status: 200 }));
    render(<SitePacks />);
    expect(await screen.findByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See openings" })).toHaveAttribute("href", "/app/opportunities");
  });
});


it("keeps the authored-surface development label on its task", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ offerings: [{
    ...offering("configured_controls_pending", "development-launch"),
    proof_boundary: { test_environment: {
      label: "Development test on an authored surface; captured scene integration pending.",
      captured_scene_evaluation_allowed: false,
    } },
  }] }), { status: 200, headers: { "content-type": "application/json" } }));
  render(<SitePacks />);
  expect(await screen.findByText("Development test on an authored surface; captured scene integration pending.")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /set up an evaluation/i })).not.toBeInTheDocument();
});


it("sends a generated-object preview to the team task page without implying reviewed appearance", async () => {
  const value = offering("configured_controls_pending", "website-launch");
  value.presentation.appearance_review_status = "prepared_scene_ungraded";
  value.presentation.selected_from_exact_reviewed_frame_count = 0;
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ offerings: [value] }), { status: 200 }));
  render(<SitePacks />);
  expect(await screen.findByText("Scene appearance not reviewed yet.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /evaluate a task · \$99 per policy/i })).toHaveAttribute("href", "/sites");
  expect(screen.queryByRole("link", { name: /run a policy test/i })).not.toBeInTheDocument();
});
