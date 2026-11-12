import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Settings from "@/pages/workspace/Settings";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      uid: "capturer",
      email: "capture@example.com",
      getIdToken: async () => "test-token",
    },
    userData: { role: "capturer", name: "Capture Owner" },
    loading: false,
    logout: vi.fn(),
  }),
}));
afterEach(() => vi.unstubAllGlobals());
describe("unconfigured account settings", () => {
  it("offers a robot team no robots-and-policies tab: running its own software is not offered (2026-11-12)", async () => {
    window.history.replaceState({}, "", "/settings?tab=robots");
    const fetch = vi.fn(async () => new Response(JSON.stringify({role:"robot_team",
      profile:{name:"Robot Owner",organization:"Robot Team",email:"team@example.test"},tasks:[]}),
      {status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    const view = render(<QueryClientProvider client={client}><Settings /></QueryClientProvider>);
    expect(await screen.findByRole("heading",{name:"Account"})).toBeInTheDocument();
    expect(screen.queryByRole("tab",{name:"Robots & policies"})).toBeNull();
    expect(screen.queryByRole("button",{name:"+ Add setup"})).toBeNull();
    expect(screen.queryByText(/Policy token|Saved setups/)).toBeNull();
    expect(fetch.mock.calls.some(([path])=>/\/(setups|checkpoints)\b/.test(String(path)))).toBe(false);
    view.unmount(); client.clear(); window.history.replaceState({},"","/");
  });
  it("shows editable setup and keeps capture access instead of a dead-end retry", async () => {
    const fetch = vi.fn(
      async (path: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(path).endsWith("/setup")
              ? {
                  workspaceType: null,
                  profile: {
                    name: "Capture Owner",
                    organization: "Company",
                    email: "capture@example.com",
                  },
                  termsRequired: true,
                  access: { capture: true, operations: false },
                }
              : {
                  code: "workspace_setup_required",
                  error: "Choose a workspace type to get started.",
                },
          ),
          {
            status: String(path).endsWith("/setup") ? 200 : 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <Settings />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Set up your workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveValue("Capture Owner");
    expect(screen.getByLabelText("Organization")).toHaveValue("Company");
    expect(screen.getByLabelText("Workspace type")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Workspace type"), { target: { value: "site_operator" } });
    expect(screen.getByRole("heading", { name: "Start with your site and job" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Show us a task/ })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.queryByLabelText("Organization")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose another workspace" }));
    // The capture account is retired (2026-11-11), so nothing links to it.
    expect(screen.queryByRole("link", { name: /Open capture account/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Robot-team workspace")).not.toBeInTheDocument();
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/workspace/"),
    ).toHaveLength(1);
    client.clear();
  });
});
