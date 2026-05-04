import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCompanyMetrics from "@/pages/AdminCompanyMetrics";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => headers,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
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
      <AdminCompanyMetrics />
    </QueryClientProvider>,
  );
}

describe("AdminCompanyMetrics", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      currentUser: { email: "ops@tryblueprint.io" },
    });
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          operatorEmail: "ops@tryblueprint.io",
          scoreboard: {
            generatedAt: "2026-05-03T18:00:00.000Z",
            ceoOperatingScreen: {
              generatedAt: "2026-05-03T18:00:00.000Z",
              activeCity: null,
              lifecycleStop: {
                stage: "capture_uploaded",
                summary: "No city program state is projected into the operating graph.",
                blockers: [],
                waitingActions: [],
              },
              needsFounder: [],
              nextAutonomousActions: [],
              recentChangeSummary: {
                operatingGraphEvents: 2,
                buyerOutcomes: 0,
                founderThreads: 0,
                latestEvents: [],
              },
              metricHealth: {
                daily: {
                  truthful: 0,
                  partial: 0,
                  blocked: 0,
                  blockedMetrics: [],
                  partialMetrics: [],
                },
                weekly: {
                  truthful: 0,
                  partial: 0,
                  blocked: 0,
                  blockedMetrics: [],
                  partialMetrics: [],
                },
              },
              captureToHostedReviewLifecycle: {
                summary: {
                  uploadedCaptures: 2,
                  packageReadyCaptures: 1,
                  hostedReviewReadyCaptures: 1,
                  hostedReviewStartedCaptures: 1,
                  currentStageCounts: {
                    capture_uploaded: 1,
                    pipeline_packaging: 0,
                    package_ready: 0,
                    hosted_review_ready: 0,
                    hosted_review_started: 1,
                  },
                },
                rows: [
                  {
                    captureId: "cap-austin-1",
                    city: "Austin, TX",
                    citySlug: "austin-tx",
                    currentStage: "hosted_review_started",
                    completedStages: [
                      "capture_uploaded",
                      "package_ready",
                      "hosted_review_ready",
                      "hosted_review_started",
                    ],
                    nextMissingStage: null,
                    latestEvidenceAtIso: "2026-05-03T17:00:00.000Z",
                    sourceRepos: ["BlueprintCapture", "Blueprint-WebApp"],
                    evidenceRefs: [
                      "capture_submissions/cap-austin-1",
                      "operatingGraphEvents/review-austin-start",
                    ],
                    packageRunIds: ["package_run:cap-austin-1"],
                    hostedReviewRunIds: ["hosted_review_run:req-austin"],
                    nextAction: null,
                  },
                  {
                    captureId: "cap-sf-1",
                    city: "San Francisco, CA",
                    citySlug: "san-francisco-ca",
                    currentStage: "capture_uploaded",
                    completedStages: ["capture_uploaded"],
                    nextMissingStage: "pipeline_packaging",
                    latestEvidenceAtIso: "2026-05-03T16:00:00.000Z",
                    sourceRepos: ["BlueprintCapture"],
                    evidenceRefs: ["capture_submissions/cap-sf-1"],
                    packageRunIds: [],
                    hostedReviewRunIds: [],
                    nextAction: {
                      id: "capture_to_hosted_review:cap-sf-1:pipeline_packaging",
                      owner: "pipeline-codex",
                      status: "ready_to_execute",
                      summary: "Run or verify pipeline packaging from the durable uploaded capture.",
                      sourceRef: "capture_submissions/cap-sf-1",
                    },
                  },
                ],
              },
            },
            views: {
              daily: { metrics: [] },
              weekly: { metrics: [] },
            },
          },
        }),
      ),
    );
  });

  it("shows row-level capture-to-hosted-review operating-graph evidence", async () => {
    renderPage();

    expect(await screen.findByText("Capture To Hosted Review")).toBeInTheDocument();
    expect(screen.getByText("cap-austin-1")).toBeInTheDocument();
    expect(screen.getByText("hosted_review_started")).toBeInTheDocument();
    expect(screen.getByText("operatingGraphEvents/review-austin-start")).toBeInTheDocument();
    expect(screen.getByText("cap-sf-1")).toBeInTheDocument();
    expect(screen.getByText(/pipeline_packaging/)).toBeInTheDocument();
  });
});
