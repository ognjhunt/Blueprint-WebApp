import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskDetail from "@/pages/workspace/TaskDetail";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { request, fixture } = vi.hoisted(() => ({ request: vi.fn(), fixture: { task: {} as Record<string, unknown> } }));
vi.mock("wouter", async (original) => ({
  ...await original<typeof import("wouter")>(),
  useParams: () => ({ taskId: "owned-task" }),
}));
vi.mock("@/lib/workspace", async (original) => ({
  ...await original<typeof import("@/lib/workspace")>(),
  useWorkspace: () => ({
    request, refresh: vi.fn(),
    data: { role: "robot_team", tasks: [{
      id: "owned-task", title: "Open drawer", siteName: "Office", location: "Austin",
      status: "In review", archived: false, captureMode: "self_capture",
      results: [], pilot: { state: "none" }, terms: {}, potentialMatches: 3,
      ...fixture.task,
    }] },
  }),
}));
vi.mock("@/components/workspace/WorkspaceUI", async (original) => ({
  ...await original<typeof import("@/components/workspace/WorkspaceUI")>(),
  Frame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));

beforeEach(() => {
  fixture.task = {};
  window.history.replaceState({}, "", "/app/tasks/owned-task?tab=capture");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  request.mockReset();
  window.history.replaceState({}, "", "/");
});

/** The page with the query client the app provides; results fetched on the Results tab need it. */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = () => <QueryClientProvider client={client}><TaskDetail /></QueryClientProvider>;
  const view = render(page());
  return { ...view, rerenderPage: () => view.rerender(page()) };
}

const ESTIMATE = {
  runId: "run-1", state: "completed", outcome: "estimate", current: true, resultDigest: null,
  summary: "One candidate met your pass mark in simulation.", nextAction: "", href: "",
  limitations: ["A simulation is not a physical test."],
  screening: { candidates: [{ candidateId: "cand-1", name: "Arm policy A", state: "completed", planned: 10, scored: 10,
    succeeded: 9, failed: 1, void: 0, blockers: [] }] },
};

describe("Blueprint's own results on the Results tab (F-05)", () => {
  beforeEach(() => window.history.replaceState({}, "", "/app/tasks/owned-task?tab=results"));

  it("shows the site's view of a current screening, as the job page does", async () => {
    request.mockImplementation(async (path: string) => path.endsWith("/results") ? { managedEvidence: [ESTIMATE] } : {});
    renderPage();
    expect(await screen.findByRole("heading", { name: "Your simulation estimate" })).toBeInTheDocument();
    expect(screen.getByText("One candidate met your pass mark in simulation.")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Arm policy A/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No evaluation results yet" })).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/tasks/owned-task/results");
  });

  it("hides a result a corrected object selection replaced", async () => {
    fixture.task = { readiness: { decision: "assessing", headline: "Updating", operatorAction: null, missingViews: [],
      nextUpdateIso: null, resultSuperseded: true } };
    request.mockImplementation(async (path: string) => path.endsWith("/results") ? { managedEvidence: [ESTIMATE] } : {});
    renderPage();
    expect(await screen.findByRole("heading", { name: "No evaluation results yet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your simulation estimate" })).not.toBeInTheDocument();
  });

  it("says results are unavailable when they cannot be read", async () => {
    request.mockImplementation(async (path: string) => {
      if (path.endsWith("/results")) throw new Error("The workspace could not be updated. Please try again.");
      return {};
    });
    renderPage();
    expect(await screen.findByText("Simulation results are temporarily unavailable. Reload this page to retry."))
      .toBeInTheDocument();
  });
});

describe("owned task page links", () => {
  it("recovers both buttons from a timeout and opens the page on retry", async () => {
    let reject!: (error: Error) => void;
    request.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValueOnce({ url: "/capture-upload/fresh-link" });
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add or review footage" }));
    expect(screen.getAllByRole("button", { name: "Opening…" })).toHaveLength(2);
    for (const button of screen.getAllByRole("button", { name: "Opening…" })) expect(button).toBeDisabled();
    expect(request).toHaveBeenCalledWith("/tasks/owned-task/task-link", "POST", {}, { timeoutMs: 15000 });
    await act(async () => reject(new Error("The request took too long. Please try again.")));
    expect(screen.getByRole("alert")).toHaveTextContent("The request took too long");
    expect(screen.getByRole("button", { name: "Add or review footage" })).toBeEnabled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open your job page" })));
    expect(navigate).toHaveBeenCalledWith("/capture-upload/fresh-link");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opening…" })).not.toBeInTheDocument();
  });

  it("shows a retryable error when the server returns no link", async () => {
    request.mockResolvedValue({});
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open your job page" })));
    expect(screen.getByRole("alert")).toHaveTextContent("link was missing");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open your job page" })).toBeEnabled();
  });
});

describe("job overview", () => {
  it("does not show a pre-evaluation count of registry teams", () => {
    // The site sees one recommendation after an evaluation passes; a count of
    // registry teams before any evaluation is a supply claim, not a result.
    window.history.replaceState({}, "", "/app/tasks/owned-task?tab=overview");
    renderPage();
    expect(document.body.textContent).not.toMatch(/potential match/i);
    expect(document.body.textContent).not.toMatch(/\b3 potential\b/);
  });
});

describe("historical pilot follow-through", () => {
  it("records start, outcome and deployment separately against a previously selected run", async () => {
    window.history.replaceState({}, "", "/app/tasks/owned-task?tab=results");
    request.mockResolvedValue({ ok: true });
    fixture.task = { status: "Pilot booked", pilot: { state: "selected", selectedResultId: "qualified-run" } };
    const view = renderPage();
    expect(screen.queryByRole("heading", { name: /Deployment company selected|Delivery partner selected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Outcome recorded by your site.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record pilot outcome/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record deployment/ })).not.toBeInTheDocument();

    for (const [state, action, label, notes] of [
      ["selected", "start", "Record pilot start", "The agreed trial started today"],
      ["pilot", "complete", "Record pilot outcome", "The agreed trial completed"],
      ["pilot_complete", "deploy", "Record deployment", "The site agreed to deployment"],
    ]) {
      fixture.task.pilot = { state, selectedResultId: "qualified-run" };
      view.rerenderPage();
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: notes } });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save decision" })));
      expect(request).toHaveBeenLastCalledWith("/tasks/owned-task/pilot", "POST", { action, resultId: "qualified-run", notes });
    }
    fixture.task.pilot = { state: "deployed", selectedResultId: "qualified-run" };
    view.rerenderPage();
    expect(screen.getByRole("heading", { name: "Deployed" })).toBeInTheDocument();
    expect(screen.getByText("Outcome recorded by your site.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record deployment/ })).not.toBeInTheDocument();
  });
});

describe("the pilot section", () => {
  beforeEach(() => window.history.replaceState({}, "", "/app/tasks/owned-task?tab=results"));

  it("offers no booking or proposal action, and says Blueprint works with a deployment company", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /Book it|Review the proposal/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No pilot is planned yet\. When the simulation shows what works, Blueprint works alongside a deployment company/)).toBeInTheDocument();
  });
});

describe("job progress timelines", () => {
  it("says how long the stage the job is waiting in usually takes", () => {
    fixture.task = { readiness: { decision: "assessing", headline: "We are preparing your job.", operatorAction: null, missingViews: [], nextUpdateIso: null } };
    renderPage();
    expect(screen.getByText("We confirm the checks needed for your job and explain the next step. Timing depends on the evidence and compatible systems available.")).toBeInTheDocument();
  });
  it("adds nothing for a step that is the site's own", () => {
    fixture.task = { readiness: { decision: "confirm_brief", headline: "Confirm your job brief.", operatorAction: "Confirm it.", missingViews: [], nextUpdateIso: null } };
    renderPage();
    expect(screen.queryByText(/We reply within|Building the simulation usually|Evaluations start once/)).not.toBeInTheDocument();
  });
});

describe("development-only 3D preview", () => {
  const ready = { captureId: "walkthrough-owned-task", label: "3D preview (beta, unscaled)", state: "ready",
    statusText: "Your 3D preview is ready to download.", developmentOnly: true, splatAvailable: true,
    meshAvailable: true, sizeBytes: 4096, updatedAtIso: "2026-10-22T12:00:00.000Z", downloadAvailable: true, viewAvailable: false };

  it("shows one Blueprint-owned next step and keeps raw coverage notes in closed processing details", () => {
    const note = "A closer walkthrough along the shelving units";
    fixture.task = { status: "3D preview ready", atlasPreview: { ...ready, downloadAvailable: false, viewAvailable: true,
      statusText: "Your 3D preview is ready. Blueprint keeps the model for your job." },
      readiness: { decision: "preview_ready", headline: "Your 3D preview is ready. Blueprint is checking the next processing step.",
        operatorAction: null, missingViews: [note], nextUpdateIso: null } };
    renderPage();
    expect(screen.queryByRole("button", { name: "Download 3D preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View 3D preview" })).toBeEnabled();
    expect(screen.getByText(/Blueprint is checking the next processing step/)).toBeVisible();
    expect(screen.queryAllByText(/Still needed:|We usually reply within an hour|In review/)).toHaveLength(0);
    expect(screen.getByText(note)).not.toBeVisible();
    fireEvent.click(screen.getByText("Processing details"));
    expect(screen.getByText(note)).toBeVisible();
    expect(screen.getByText(/is not to scale/)).toBeVisible();
  });

  // Owner decision 2026-10-29: Blueprint owns the reconstruction; the site sees it is ready but never downloads it.
  it("shows a ready preview with no download and never asks for a ticket", () => {
    fixture.task = { atlasPreview: { ...ready, statusText: "Your 3D preview is ready. Blueprint keeps the model for your job.",
      downloadAvailable: false } };
    renderPage();
    expect(screen.getByRole("heading", { name: "3D preview (beta, unscaled)" })).toBeInTheDocument();
    expect(screen.getByText("Your 3D preview is ready. Blueprint keeps the model for your job.")).toBeInTheDocument();
    expect(screen.getByText(/Blueprint keeps this model; it is not available to download/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download 3D preview/ })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalledWith("/tasks/owned-task/atlas-preview/download-ticket", expect.anything(),
      expect.anything(), expect.anything());
  });

  it("opens a ready preview in the viewer through a fresh view ticket", async () => {
    const url = `/splat-viewer/index.html?content=${encodeURIComponent("/api/website-atlas-preview-views/owned-task/walkthrough-owned-task/scene.ply?expires=1&signature=a")}`;
    request.mockResolvedValue({ viewer_url: url });
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    fixture.task = { atlasPreview: { ...ready, downloadAvailable: false, viewAvailable: true } };
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "View 3D preview" })));
    expect(request).toHaveBeenCalledWith("/tasks/owned-task/atlas-preview/view-ticket", "POST",
      { captureId: "walkthrough-owned-task" }, { timeoutMs: 15000 });
    expect(navigate).toHaveBeenCalledWith(url);
    request.mockResolvedValueOnce({ viewer_url: "https://elsewhere.example/viewer" });
    navigate.mockClear();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "View 3D preview" })));
    expect(screen.getByRole("alert")).toHaveTextContent("3D preview link was missing");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows only a status while it is being made, and nothing once consent is withdrawn", () => {
    fixture.task = { atlasPreview: { ...ready, state: "processing", statusText: "Your 3D preview is being made from your recording.",
      sizeBytes: null, downloadAvailable: false } };
    const view = renderPage();
    expect(screen.getByText("Your 3D preview is being made from your recording.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download 3D preview" })).not.toBeInTheDocument();
    fixture.task = { atlasPreview: ready, recordingPermissionWithdrawn: true };
    view.rerenderPage();
    expect(screen.queryByRole("heading", { name: "3D preview (beta, unscaled)" })).not.toBeInTheDocument();
    fixture.task = { atlasPreview: null };
    view.rerenderPage();
    expect(screen.queryByText(/3D preview/)).not.toBeInTheDocument();
  });
});
