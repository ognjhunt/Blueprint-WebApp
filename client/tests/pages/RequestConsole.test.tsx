import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequestConsole from "@/pages/RequestConsole";

vi.mock("wouter", () => ({
  useLocation: () => ["/requests/req-1", vi.fn()],
  useSearch: () => "",
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("@/lib/analytics", () => ({
  analyticsEvents: {
    buyerReviewViewed: vi.fn(),
  },
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

describe("RequestConsole", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: "req-1",
          site_submission_id: "site-sub-1",
          createdAt: "2026-05-03T17:00:00.000Z",
          status: "in_review",
          qualification_state: "in_review",
          opportunity_state: "handoff_ready",
          priority: "normal",
          contact: {
            firstName: "Nijel",
            lastName: "Hunt",
            email: "nijel@example.com",
            company: "Blueprint",
            roleTitle: "Founder",
          },
          request: {
            budgetBucket: "$50K-$250K",
            requestedLanes: ["preview_simulation"],
            helpWith: ["scene-library"],
            buyerType: "robot_team",
            siteName: "Harborview Grocery Annex",
            siteLocation: "Chicago, IL",
            taskStatement: "Walk to shelf staging and pick the blue tote.",
            workflowContext: "Warehouse tote picking.",
            operatingConstraints: "Public aisles only.",
            privacySecurityConstraints: "No staff-only areas.",
          },
          owner: "ops",
          context: {
            sourcePageUrl: "https://tryblueprint.io/contact",
            utm: {},
          },
          enrichment: {},
          events: {},
          structured_intake: {
            mode: "structured_intake_first",
            primary_cta: "Request proof",
            secondary_cta: "Book review",
            calendar_disposition: "not_needed_yet",
            calendar_reasons: [],
            missing_structured_fields: [],
            missing_structured_field_labels: [],
            owner_lane: "buyer-solutions-agent",
            recommended_path: "proof_path_review",
            next_action: "Route to buyer-solutions-agent for proof-path review.",
            routing_summary: "Robot-team request with exact-site proof path.",
            calendar_summary: "Calendar stays secondary.",
            proof_path_summary: "Exact-site proof review is in progress.",
            proof_ready_outcome: "needs_clarification",
            proof_path_outcome: "exact_site",
            proof_readiness_score: 65,
            proof_ready_criteria: [],
            missing_proof_ready_fields: [],
            site_operator_claim_outcome: "not_site_operator",
            access_boundary_outcome: "not_applicable",
            site_claim_readiness_score: 0,
            site_claim_criteria: [],
            missing_site_claim_fields: [],
          },
          ops: {
            assigned_region_id: "chicago-il",
            rights_status: "permission_required",
            capture_policy_tier: "review_required",
            capture_status: "under_review",
            quote_status: "not_started",
            next_step: "Keep package files blocked until rights and hosted-session state are attached.",
          },
          evaluation_readiness: {
            buyer_trust_score: {
              score: 64,
              band: "medium",
              reasons: ["Needs rights evidence."],
            },
            preview_status: "queued",
            provider_run: {
              provider_name: "World Labs",
              provider_model: "world-model-preview",
              status: "queued",
            },
            missing_evidence: ["rights"],
          },
        }),
      ),
    );
  });

  it("distinguishes request, proof, runtime, and payment authority inside the private review room", async () => {
    renderPage();

    expect(await screen.findByText("Harborview Grocery Annex")).toBeInTheDocument();
    expect(screen.getByText(/Private review truth map/i)).toBeInTheDocument();
    expect(screen.getByText(/Firestore request record/i)).toBeInTheDocument();
    expect(screen.getByText("Next action")).toBeInTheDocument();
    expect(screen.getByText(/Provider preview state/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe, Render, fulfillment/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked until entitlement, hosted-session, payment, and backing runtime records support them/i)).toBeInTheDocument();
  });

  it("does not project missing owner-system fields as pending operational states", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          requestId: "req-1",
          site_submission_id: "site-sub-1",
          createdAt: "2026-05-03T17:00:00.000Z",
          status: "submitted",
          qualification_state: "submitted",
          opportunity_state: null,
          priority: "normal",
          contact: {
            firstName: "Nijel",
            lastName: "Hunt",
            email: "nijel@example.com",
            company: "Blueprint",
            roleTitle: "Founder",
          },
          request: {
            budgetBucket: "$50K-$250K",
            requestedLanes: [],
            helpWith: [],
            buyerType: "site_operator",
            siteName: "Unassigned site",
            siteLocation: "Chicago, IL",
            taskStatement: "Review submitted intake.",
          },
          owner: "unassigned",
          context: { sourcePageUrl: "https://tryblueprint.io/contact", utm: {} },
          enrichment: {},
          events: {},
          structured_intake: null,
          ops: null,
          evaluation_readiness: null,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Unassigned site")).toBeInTheDocument();
    expect(screen.getByText("Capture state not recorded")).toBeInTheDocument();
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("No next action is recorded.")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.queryByText("Review required")).not.toBeInTheDocument();
    expect(screen.queryByText("Not requested")).not.toBeInTheDocument();
  });
});
