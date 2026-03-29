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
  }, 15_000);

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

  it("renders the approvals queue and triggers operator actions", async () => {
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
      if (url.startsWith("/api/admin/leads/action-queue")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "ledger-1",
                  status: "pending_approval",
                  lane: "waitlist",
                  action_type: "send_email",
                  source_collection: "waitlistSubmissions",
                  source_doc_id: "submission-1",
                  action_tier: 3,
                  idempotency_key: "waitlist:submission-1",
                  auto_approve_reason: null,
                  approval_reason: "requires_human_review",
                  approved_by: null,
                  approved_at: null,
                  rejected_by: null,
                  rejected_reason: null,
                  execution_attempts: 0,
                  last_execution_error: null,
                  created_at: "2026-03-29T12:00:00.000Z",
                  updated_at: "2026-03-29T12:05:00.000Z",
                  sent_at: null,
                  last_execution_at: null,
                  action_payload: {
                    to: "ada@example.com",
                    subject: "Invite now",
                    body: "Please join the capturer beta.",
                  },
                  draft_output: {
                    recommendation: "invite_now",
                    confidence: 0.91,
                  },
                },
                {
                  id: "ledger-2",
                  status: "failed",
                  lane: "support",
                  action_type: "send_email",
                  source_collection: "contactRequests",
                  source_doc_id: "contact-1",
                  action_tier: 1,
                  idempotency_key: "support:contact-1",
                  auto_approve_reason: "policy_auto_approved",
                  approval_reason: null,
                  approved_by: "ops@tryblueprint.io",
                  approved_at: "2026-03-29T12:03:00.000Z",
                  rejected_by: null,
                  rejected_reason: null,
                  execution_attempts: 2,
                  last_execution_error: "SMTP timeout",
                  created_at: "2026-03-29T11:50:00.000Z",
                  updated_at: "2026-03-29T12:06:00.000Z",
                  sent_at: null,
                  last_execution_at: "2026-03-29T12:06:00.000Z",
                  action_payload: {
                    to: "support@example.com",
                    subject: "Support reply",
                    body: "We can help with that.",
                  },
                  draft_output: {
                    category: "general_support",
                    confidence: 0.87,
                  },
                },
              ],
              summary: {
                total: 2,
                pending_approval: 1,
                failed: 1,
              },
            })
          ),
        );
      }
      if (url.includes("/action-queue/") && url.endsWith("/reject")) {
        return Promise.resolve(new Response(JSON.stringify({ state: "rejected" })));
      }
      if (url.includes("/action-queue/") && url.endsWith("/retry")) {
        return Promise.resolve(new Response(JSON.stringify({ state: "sent" })));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Needs manual review");

    renderPage();

    const approvalsTab = await screen.findByRole("tab", { name: /approvals/i });
    fireEvent.mouseDown(approvalsTab);
    fireEvent.click(approvalsTab);

    expect(await screen.findByRole("button", { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(promptSpy).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/leads/action-queue/ledger-1/reject"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/leads/action-queue/ledger-2/retry"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    promptSpy.mockRestore();
  });

  it("renders the field ops workspace and triggers assignment/outreach actions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(new Response(JSON.stringify({ leads: [] })));
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(new Response(JSON.stringify({ total: 0, newLast24h: 0, byStatus: {}, byPriority: {} })));
      }
      if (url.startsWith("/api/admin/field-ops/capture-jobs?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              jobs: [
                {
                  id: "job-1",
                  title: "Durham Facility",
                  address: "123 Main St",
                  status: "scheduled",
                  buyer_request_id: "req-1",
                  marketplace_state: "claimable",
                  rights_status: "review_required",
                  capture_policy_tier: "review_required",
                  field_ops: {},
                  site_access: {},
                  updated_at: "2026-03-29T12:00:00.000Z",
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith("/candidates")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  uid: "creator-1",
                  name: "Casey Capturer",
                  email: "capturer@example.com",
                  phone_number: "555-000-1111",
                  market: "Durham",
                  availability: "flexible",
                  equipment: ["iPhone 15 Pro"],
                  totalCaptures: 9,
                  approvedCaptures: 8,
                  avgQuality: 21,
                  score: 94,
                  score_breakdown: {
                    market: 30,
                    availability: 20,
                    equipment: 25,
                    quality: 9,
                    reliability: 10,
                  },
                  travel_estimate_minutes: 15,
                  travel_estimate_source: "heuristic_market",
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith("/site-access/contacts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              contacts: [
                {
                  email: "operator@example.com",
                  name: "Pat Operator",
                  source: "inbound_request_contact",
                  company: "Durham Facility",
                  roleTitle: "Site lead",
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/field-ops/reschedule-queue") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "booking-1",
                  businessName: "Durham Facility",
                  email: "buyer@example.com",
                  current_date: "2026-04-01",
                  current_time: "10:00 AM",
                  requested_date: "2026-04-01",
                  requested_time: "3:00 PM",
                  requested_by: "buyer",
                  status: "pending_approval",
                  reason: "schedule_conflict",
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/field-ops/finance-queue") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "payout-1",
                  status: "review_required",
                  creator_id: "creator-1",
                  capture_id: "cap-1",
                  stripe_payout_id: "po_1",
                  failure_reason: "Bank account needs review",
                  queue: "payout_exception_queue",
                  ops_automation: {},
                  finance_review: {},
                  updated_at: "2026-03-29T12:00:00.000Z",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    renderPage();

    const fieldOpsTab = await screen.findByRole("tab", { name: /field ops/i });
    fireEvent.mouseDown(fieldOpsTab);
    fireEvent.click(fieldOpsTab);

    expect((await screen.findAllByText(/Durham Facility/i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: /Assign \+ confirm/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Send outreach/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Mark investigating/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Assign \+ confirm/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/field-ops/capture-jobs/job-1/assign-capturer"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Send outreach/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/field-ops/capture-jobs/job-1/site-access/outreach"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
