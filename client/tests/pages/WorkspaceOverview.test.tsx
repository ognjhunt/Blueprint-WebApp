import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Overview from "@/pages/workspace/Overview";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
const OWNED_TASKS = [
  { id: "owned-task", title: "Open drawer", siteName: "Office", location: "Austin", archived: false,
    recordingPermissionWithdrawn: false, createdAt: null },
  { id: "closed-task", title: "Old job", siteName: "Office", location: "", archived: true,
    recordingPermissionWithdrawn: false, createdAt: null },
];
const account = vi.hoisted(() => ({ role: "site_operator", tasks: [] as unknown[], emailVerified: true }));
vi.mock("@/lib/workspace", async (original) => ({
  ...await original<typeof import("@/lib/workspace")>(),
  useWorkspace: () => ({
    request, refresh: vi.fn(),
    data: { role: account.role, profile: { name: "", organization: "", email: "" }, tasks: account.tasks },
  }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ currentUser: { uid: "u1", emailVerified: account.emailVerified } }),
}));
vi.mock("@/components/workspace/WorkspaceUI", async (original) => ({
  ...await original<typeof import("@/components/workspace/WorkspaceUI")>(),
  Frame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

beforeEach(() => {
  account.role = "site_operator";
  account.tasks = OWNED_TASKS;
  account.emailVerified = true;
});
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

describe("what the account page says when there is no job to list", () => {
  it("asks a site whose email is not verified to verify, since its jobs list only after that", () => {
    account.tasks = [];
    account.emailVerified = false;
    render(<Overview />);
    expect(screen.getByRole("heading", { name: "Verify your email to see your jobs" })).toBeInTheDocument();
    expect(screen.getByText("Open the verification link we email you, then sign in again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send verification email" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "No jobs yet" })).toBeNull();
  });

  it("offers a verified site with no jobs the one way to start", () => {
    account.tasks = [];
    render(<Overview />);
    expect(screen.getByRole("heading", { name: "No jobs yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Start a job" })[0]).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.queryByText(/Show us a job/)).toBeNull();
  });

  it("points a deployment company to Find jobs", () => {
    account.role = "robot_team";
    account.tasks = [];
    render(<Overview />);
    expect(screen.getByRole("heading", { name: "Jobs from sites" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Find jobs" })[0]).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/opportunit/i)).toBeNull();
  });
});
