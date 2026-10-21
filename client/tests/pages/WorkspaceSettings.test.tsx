import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Settings from "@/pages/workspace/Settings";
import { deploymentEmbodimentCatalog } from "@/lib/deploymentEmbodimentSupport";
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
  it("shows an actionable form error when a planning robot has no selected policy route", async () => {
    window.history.replaceState({}, "", "/settings?tab=robots");
    const fetch = vi.fn(async (path: RequestInfo | URL) => new Response(JSON.stringify(
      String(path).includes("/checkpoints") ? {teams:[],checkpoints:[],runtimes:[]}
        : {role:"robot_team",profile:{name:"Robot Owner",organization:"Robot Team",email:"team@example.test"},
          tasks:[],setups:[],evaluations:[],results:[]}), {status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    const view = render(<QueryClientProvider client={client}><Settings /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button",{name:"+ Add setup"}));
    const source = screen.getByRole("combobox",{name:"Robot model"});
    fireEvent.change(source,{target:{value:`support:${deploymentEmbodimentCatalog.embodiments[0].embodiment_id}`}});
    fireEvent.submit(source.closest("form")!);
    expect(await screen.findByText("Choose at least one policy route for this robot.")).toHaveAttribute("role","alert");
    expect(fetch.mock.calls.some(([path])=>String(path).endsWith("/setups"))).toBe(false);
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
    expect(
      screen.getByRole("link", { name: /Open capture account/ }),
    ).toHaveAttribute("href", "/capture-app/account");
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
