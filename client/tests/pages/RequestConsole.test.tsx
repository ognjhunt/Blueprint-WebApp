import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RequestConsole from "@/pages/RequestConsole";

let mockPath = "/requests/req-1";

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => [mockPath, vi.fn()],
    useSearch: () => "",
  };
});

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <RequestConsole params={{ requestId: "req-1" }} />
    </QueryClientProvider>,
  );
}

describe("RequestConsole pipeline and exchange state", () => {
  beforeEach(() => {
    mockPath = "/requests/req-1";
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/requests/req-1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              requestId: "req-1",
              site_submission_id: "req-1",
              createdAt: "2026-03-11T12:00:00.000Z",
              latest_pipeline_completed_at: "2026-03-11T12:45:00.000Z",
              status: "qualified_ready",
              qualification_state: "qualified_ready",
              opportunity_state: "handoff_ready",
              exchange_status: "eligible",
              exchange_visibility: "gated_robot_teams",
              priority: "normal",
              contact: {
                firstName: "Ada",
                lastName: "Lovelace",
                email: "ada@example.com",
                company: "Analytical Engines",
                roleTitle: "Ops",
              },
              request: {
                budgetBucket: "$50K-$300K",
                requestedLanes: ["qualification"],
                helpWith: ["benchmark-packs"],
                buyerType: "site_operator",
                siteName: "Durham Facility",
                siteLocation: "Durham, NC",
                taskStatement: "Review a picking workflow.",
              },
              owner: {},
              context: { sourcePageUrl: "https://example.com", utm: {} },
              enrichment: {},
              events: {},
              ops: {
                capture_policy_tier: "approved_capture",
                rights_status: "verified",
                capture_status: "approved",
                quote_status: "buyer_ready",
                next_step: "Review the latest package with your robot team.",
              },
              deployment_readiness: {
                preview_status: "queued",
              },
            }),
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces pipeline freshness and exchange lifecycle on the buyer console", async () => {
    renderPage();

    expect(await screen.findByText(/Pipeline and Exchange/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline Freshness/i)).toBeInTheDocument();
    expect(screen.getByText("Eligible")).toBeInTheDocument();
    expect(screen.getByText("Gated Robot Teams")).toBeInTheDocument();
    expect(
      screen.getByText(/Exchange visibility shows how Blueprint can surface this request to robot teams/i),
    ).toBeInTheDocument();
  });
});
