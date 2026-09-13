import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
