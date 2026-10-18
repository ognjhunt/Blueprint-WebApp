import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskDetail from "@/pages/workspace/TaskDetail";

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

describe("owned task page links", () => {
  it("recovers both buttons from a timeout and opens the page on retry", async () => {
    let reject!: (error: Error) => void;
    request.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValueOnce({ url: "/capture-upload/fresh-link" });
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<TaskDetail />);
    fireEvent.click(screen.getByRole("button", { name: "Add or review footage" }));
    expect(screen.getAllByRole("button", { name: "Opening…" })).toHaveLength(2);
    for (const button of screen.getAllByRole("button", { name: "Opening…" })) expect(button).toBeDisabled();
    expect(request).toHaveBeenCalledWith("/tasks/owned-task/task-link", "POST", {}, { timeoutMs: 15000 });
    await act(async () => reject(new Error("The request took too long. Please try again.")));
    expect(screen.getByRole("alert")).toHaveTextContent("The request took too long");
    expect(screen.getByRole("button", { name: "Add or review footage" })).toBeEnabled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open your task page" })));
    expect(navigate).toHaveBeenCalledWith("/capture-upload/fresh-link");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opening…" })).not.toBeInTheDocument();
  });

  it("shows a retryable error when the server returns no link", async () => {
    request.mockResolvedValue({});
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<TaskDetail />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open your task page" })));
    expect(screen.getByRole("alert")).toHaveTextContent("link was missing");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open your task page" })).toBeEnabled();
  });
});

describe("job overview", () => {
  it("does not show a pre-evaluation count of registry teams", () => {
    // The site sees one recommendation after an evaluation passes; a count of
    // registry teams before any evaluation is a supply claim, not a result.
    window.history.replaceState({}, "", "/app/tasks/owned-task?tab=overview");
    render(<TaskDetail />);
    expect(document.body.textContent).not.toMatch(/potential match/i);
    expect(document.body.textContent).not.toMatch(/\b3 potential\b/);
  });
});

describe("booked pilot follow-through", () => {
  it("records start, outcome and deployment separately against the booked run", async () => {
    window.history.replaceState({}, "", "/app/tasks/owned-task?tab=results");
    request.mockResolvedValue({ ok: true });
    fixture.task = { status: "Pilot booked", pilot: { state: "selected", selectedResultId: "qualified-run" },
      pilotBooking: { recommendationId: "rec_book", contact: { email: "team@example.test" } } };
    const view = render(<TaskDetail />);
    expect(screen.getByRole("heading", { name: "Pilot booked" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "team@example.test" })).toHaveAttribute("href", "mailto:team@example.test");
    expect(screen.queryByText("Outcome recorded by your site.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record pilot outcome/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record deployment/ })).not.toBeInTheDocument();

    for (const [state, action, label, notes] of [
      ["selected", "start", "Record pilot start", "The agreed trial started today"],
      ["pilot", "complete", "Record pilot outcome", "The agreed trial completed"],
      ["pilot_complete", "deploy", "Record deployment", "The site agreed to deployment"],
    ]) {
      fixture.task.pilot = { state, selectedResultId: "qualified-run" };
      view.rerender(<TaskDetail />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: notes } });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save decision" })));
      expect(request).toHaveBeenLastCalledWith("/tasks/owned-task/pilot", "POST", { action, resultId: "qualified-run", notes });
    }
    fixture.task.pilot = { state: "deployed", selectedResultId: "qualified-run" };
    view.rerender(<TaskDetail />);
    expect(screen.getByRole("heading", { name: "Deployed" })).toBeInTheDocument();
    expect(screen.getByText("Outcome recorded by your site.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record deployment/ })).not.toBeInTheDocument();
  });
});
