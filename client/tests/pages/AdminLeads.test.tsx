import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminLeads from "@/pages/AdminLeads";

const useAuthMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/leads", setLocationMock],
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
      <AdminLeads />
    </QueryClientProvider>
  );
}

describe("AdminLeads scene readiness", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      currentUser: { email: "ops@tryblueprint.io" },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              leads: [
                {
                  requestId: "req-1",
                  site_submission_id: "req-1",
                  createdAt: "2026-03-11T12:00:00.000Z",
                  status: "qualified_ready",
                  qualification_state: "qualified_ready",
                  opportunity_state: "handoff_ready",
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
                  pipeline: {
                    scene_id: "scene-1",
                    capture_id: "cap-1",
                    pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                    artifacts: {
                      dashboard_summary_uri: "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
                    },
                  },
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 1,
              newLast24h: 1,
              byStatus: { qualified_ready: 1 },
              byPriority: { normal: 1 },
            })
          )
        );
      }
      if (url === "/api/admin/leads/req-1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              requestId: "req-1",
              site_submission_id: "req-1",
              createdAt: "2026-03-11T12:00:00.000Z",
              status: "qualified_ready",
              qualification_state: "qualified_ready",
              opportunity_state: "handoff_ready",
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
                workflowContext: "Backroom to staging handoff.",
              },
              owner: {},
              context: { sourcePageUrl: "https://example.com", utm: {} },
              enrichment: {},
              events: {},
              notes: [],
              pipeline: {
                scene_id: "scene-1",
                capture_id: "cap-1",
                pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                synced_at: "2026-03-11T12:10:00.000Z",
                artifacts: {
                  dashboard_summary_uri: "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
                },
              },
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/req-1/pipeline/dashboard") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schema_version: "v1",
              scene: "scene-1",
              whole_home: {
                capture_id: "cap-1",
                status: "qualified_ready",
                confidence: 0.9,
                memo_path: "/tmp/memo.md",
                memo_uri: "gs://bucket/memo.md",
              },
              categories: {
                pick: {
                  counts: { ready: 1, risky: 0, not_ready_yet: 0 },
                  tasks: [
                    {
                      task_text: "Pick up part_1",
                      capture_id: "pick-1",
                      status: "ready",
                      next_action: "advance to human signoff",
                      themes: ["human review only"],
                      memo_path: "/tmp/pick.md",
                      memo_uri: "gs://bucket/pick.md",
                    },
                  ],
                },
                open_close: {
                  counts: { ready: 0, risky: 0, not_ready_yet: 1 },
                  tasks: [
                    {
                      task_text: "Open hatch_2",
                      capture_id: "open-1",
                      status: "not_ready_yet",
                      next_action: "redesign",
                      themes: ["route / clearance"],
                      memo_path: "/tmp/open.md",
                      memo_uri: "gs://bucket/open.md",
                    },
                  ],
                },
                navigate: {
                  counts: { ready: 0, risky: 0, not_ready_yet: 1 },
                  tasks: [
                    {
                      task_text: "Navigate to aisle_3",
                      capture_id: "nav-1",
                      status: "not_ready_yet",
                      next_action: "defer",
                      themes: ["reach"],
                      memo_path: "/tmp/nav.md",
                      memo_uri: "gs://bucket/nav.md",
                    },
                  ],
                },
              },
              theme_counts: { reach: 1 },
              action_counts: { redesign: 1, defer: 1, "advance to human signoff": 1 },
              deployment_summary: {
                total_tasks: 3,
                ready_now: 1,
                needs_redesign: 1,
                outside_robot_envelope: 1,
              },
            })
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders scene readiness deployment counts and grouped tasks", async () => {
    renderPage();
    const leadButton = await screen.findByRole("button", { name: /Durham Facility/i });
    fireEvent.click(leadButton);

    expect(await screen.findByText(/Scene readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Whole-home/i)).toBeInTheDocument();
    expect(screen.getByText(/Need redesign/i)).toBeInTheDocument();
    expect(screen.getByText(/Outside envelope/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick up part_1/i)).toBeInTheDocument();
    expect(screen.getByText(/Open hatch_2/i)).toBeInTheDocument();
    expect(screen.getByText(/Navigate to aisle_3/i)).toBeInTheDocument();
  });

  it("shows a fallback when the request has no scene dashboard attachment", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              leads: [
                {
                  requestId: "req-1",
                  site_submission_id: "req-1",
                  createdAt: "2026-03-11T12:00:00.000Z",
                  status: "qualified_ready",
                  qualification_state: "qualified_ready",
                  opportunity_state: "handoff_ready",
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
                  pipeline: {
                    scene_id: "scene-1",
                    capture_id: "cap-1",
                    pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                    artifacts: {},
                  },
                },
              ],
            })
          )
        );
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(new Response(JSON.stringify({ total: 1, newLast24h: 1, byStatus: {}, byPriority: {} })));
      }
      if (url === "/api/admin/leads/req-1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              requestId: "req-1",
              site_submission_id: "req-1",
              createdAt: "2026-03-11T12:00:00.000Z",
              status: "qualified_ready",
              qualification_state: "qualified_ready",
              opportunity_state: "handoff_ready",
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
              notes: [],
              pipeline: {
                scene_id: "scene-1",
                capture_id: "cap-1",
                pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                artifacts: {},
              },
            })
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    renderPage();
    const leadButton = await screen.findByRole("button", { name: /Durham Facility/i });
    fireEvent.click(leadButton);

    await waitFor(() => {
      expect(
        screen.getByText(/no scene dashboard has been emitted for this request yet/i)
      ).toBeInTheDocument();
    });
  });
});
