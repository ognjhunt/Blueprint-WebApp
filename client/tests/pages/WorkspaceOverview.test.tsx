import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Overview from "@/pages/workspace/Overview";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/workspace", async (original) => ({
  ...await original<typeof import("@/lib/workspace")>(),
  useWorkspace: () => ({
    request, refresh: vi.fn(),
    data: { role: "site_operator", profile: { name: "", organization: "", email: "" }, tasks: [
      { id: "owned-task", title: "Open drawer", siteName: "Office", location: "Austin", archived: false,
        recordingPermissionWithdrawn: false, createdAt: null },
      { id: "closed-task", title: "Old job", siteName: "Office", location: "", archived: true,
        recordingPermissionWithdrawn: false, createdAt: null },
    ] },
  }),
}));
vi.mock("@/components/workspace/WorkspaceUI", async (original) => ({
  ...await original<typeof import("@/components/workspace/WorkspaceUI")>(),
  Frame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  request.mockReset();
});

describe("the account's one list of jobs", () => {
  it("lists each open job with the one way to its job page", () => {
    render(<Overview />);
    expect(screen.getByRole("heading", { name: "Open drawer" })).toBeInTheDocument();
    expect(screen.queryByText("Old job")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open your job page" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /review results|view task/i })).not.toBeInTheDocument();
  });

  it("recovers the button from a timeout and opens the page on retry", async () => {
    let reject!: (error: Error) => void;
    request.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValueOnce({ url: "/capture-upload/fresh-link" });
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<Overview />);
    fireEvent.click(screen.getByRole("button", { name: "Open your job page" }));
    expect(screen.getByRole("button", { name: "Opening…" })).toBeDisabled();
    expect(request).toHaveBeenCalledWith("/tasks/owned-task/task-link", "POST", {}, { timeoutMs: 15000 });
    await act(async () => reject(new Error("The request took too long. Please try again.")));
    expect(screen.getByRole("alert")).toHaveTextContent("The request took too long");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open your job page" })));
    expect(navigate).toHaveBeenCalledWith("/capture-upload/fresh-link");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opening…" })).not.toBeInTheDocument();
  });

  it("shows a retryable error when the server returns no link", async () => {
    request.mockResolvedValue({});
    const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<Overview />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open your job page" })));
    expect(screen.getByRole("alert")).toHaveTextContent("link was missing");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open your job page" })).toBeEnabled();
  });
});
