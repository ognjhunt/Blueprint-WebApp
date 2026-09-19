import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SiteDetail from "@/pages/SiteDetail";
import Sites from "@/pages/Sites";

const liveSite = {
  id: "site-live-1",
  siteCode: "LIVE-1",
  siteName: "Owner-backed warehouse",
  siteAddress: "Private location",
  sceneId: "scene-live-1",
  captureId: "capture-live-1",
  siteSubmissionId: "submission-live-1",
  pipelinePrefix: "gs://pipeline/live-1",
  category: "Logistics",
  industry: "Warehouse",
  taskLane: "Tote handling",
  tone: "slate",
  accent: "blue",
  thumbnailKind: "parcel",
  summary: "A current capture record for a warehouse tote workflow.",
  bestFor: "Tote handling",
  startStates: [],
  runtime: "request-scoped",
  defaultRuntimeBackend: "mujoco",
  availableRuntimeBackends: ["mujoco"],
  sampleRobot: "Unitree G1",
  sampleRobotProfile: { id: "g1", name: "Unitree G1" },
  sampleTask: "Move a tote",
  samplePolicy: "Buyer supplied",
  scenarioVariants: [],
  exportArtifacts: [],
  runtimeManifest: {},
  taskCatalog: [{ id: "task-1", taskId: "move-tote", taskText: "Move a tote" }],
  scenarioCatalog: [],
  startStateCatalog: [],
  robotProfiles: [],
  exportModes: [],
  packages: [{ name: "Site Package" }, { name: "Policy Evaluation Set" }],
  dataSource: "pipeline",
  evaluationReadiness: { qualification_state: "qualified_ready" },
} as any;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/site-worlds/tasks")) return new Response(JSON.stringify({ items: [{
        id: "task-1", title: "Move totes between two stations", taskFamily: "Transport", objects: "Totes", region: "Midwest", siteType: "Warehouse", cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "past", stage: "ready", evaluationAvailable: true, costUsd: 25, publishedAtIso: "2026-09-19T00:00:00Z",
      }] }), { status: 200 });
      if (url.includes("/api/site-worlds/site-live-1")) {
        return new Response(JSON.stringify(liveSite), { status: 200 });
      }
      if (url.includes("/api/site-worlds/static-fixture")) {
        return new Response(JSON.stringify({ ...liveSite, id: "static-fixture", dataSource: "static" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          items: [liveSite, { ...liveSite, id: "static-fixture", siteName: "Invented fallback", dataSource: "static" }],
          count: 2,
        }),
        { status: 200 },
      );
    }),
  );
  vi.stubGlobal("scrollTo", vi.fn());
});

describe("Sites", () => {
  it("browses owner-approved tasks before requiring a robot setup", async () => {
    render(<Sites />);
    expect(screen.getByRole("heading", { name: "Task library" })).toBeInTheDocument();
    expect(await screen.findByText("Move totes between two stations")).toBeInTheDocument();
    expect(screen.getByText("Past opportunity")).toBeInTheDocument();
    expect(screen.queryByText("Owner-backed warehouse")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/site-worlds/tasks", expect.anything());
  });

  it("filters the public tasks and offers a way to clear an empty search", async () => {
    render(<Sites />);
    await screen.findByText("Move totes between two stations");
    fireEvent.change(screen.getByLabelText("Filter by region"), { target: { value: "Europe" } });
    expect(screen.queryByText("Move totes between two stations")).not.toBeInTheDocument();
    expect(screen.getByText("No tasks match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Move totes between two stations")).toBeInTheDocument();
  });

  it("offers demand capture instead of fixture supply when inventory is empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    render(<Sites />);
    expect(await screen.findByText("No public tasks to browse yet.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Task preferences" })).toBeInTheDocument();
    expect(screen.queryByText("Move totes between two stations")).not.toBeInTheDocument();
  });

  it("renders a Pipeline-backed site detail with an explicit proof boundary", async () => {
    render(<SiteDetail params={{ slug: "site-live-1" }} />);
    expect(await screen.findByRole("heading", { name: "Owner-backed warehouse" })).toBeInTheDocument();
    expect(screen.getByText("Move a tote")).toBeInTheDocument();
    expect(screen.getByText(/proves only that a current public capture record exists/i)).toBeInTheDocument();
    expect(screen.getByText(/Illustrative workflow image/i)).toBeInTheDocument();
  });

  it("rejects a static fixture returned by a misconfigured detail endpoint", async () => {
    render(<SiteDetail params={{ slug: "static-fixture" }} />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /not available/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/not backed by Pipeline/i)).toBeInTheDocument();
  });
});
