import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskDetail from "@/pages/workspace/TaskDetail";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
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
      results: [], pilot: { state: "none" }, terms: {},
    }] },
  }),
}));
vi.mock("@/components/workspace/WorkspaceUI", async (original) => ({
  ...await original<typeof import("@/components/workspace/WorkspaceUI")>(),
  Frame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));

beforeEach(() => {
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
