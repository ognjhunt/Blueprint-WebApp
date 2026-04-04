import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import AdminGrowthOpsScorecard from "@/pages/AdminGrowthOpsScorecard";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <AdminGrowthOpsScorecard />
    </QueryClientProvider>,
  );
}

describe("AdminGrowthOpsScorecard", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          window: {
            days: 30,
            from: "2026-03-04T00:00:00.000Z",
            to: "2026-04-02T00:00:00.000Z",
          },
          funnel: {
            exactSiteViews: 12,
            exactSiteContactStarts: 4,
            exactSiteContactSubmissions: 3,
            exactSiteContactCompleted: 2,
            voiceStarts: 5,
            voiceCompleted: 4,
          },
          queue: {
            currentHostedReviewItems: 6,
            newHostedReviewLast7d: 2,
            highPriorityHostedReview: 1,
            exactSiteRequiredSubmitted: 3,
          },
          experiments: [],
          campaigns: [],
          eventsByDay: [
            {
              date: "2026-04-01",
              views: 2,
              contactStarts: 1,
              contactSubmissions: 1,
              contactCompleted: 1,
              voiceStarts: 1,
              voiceCompleted: 1,
            },
          ],
          operatorStatus: {
            providers: {
              analytics: {
                firstPartyIngest: { enabled: true, persisted: true, error: null },
                ga4: { configured: true },
                posthog: { configured: true },
              },
              sendgrid: { configured: true, provider: "sendgrid" },
              sendgridWebhook: { configured: true },
              runway: { configured: true },
              googleImage: { configured: true, executionState: "ready" },
              elevenlabs: { configured: true, agentConfigured: false },
              telephony: { configured: false, forwardNumberConfigured: false },
            },
            agentRuntime: { configured: true, provider: "openai" },
            lastIntegrationVerification: {
              id: "verify-1",
              verifiedAt: "2026-04-02T13:00:00.000Z",
            },
            recentCreativeRuns: [
              {
                id: "creative-1",
                status: "assets_generated",
                skuName: "Exact-Site Hosted Review",
                createdAt: "2026-04-02T14:00:00.000Z",
                storageUri: "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
              },
            ],
            launchReadiness: {
              status: "ready",
              blockers: [],
              warnings: [],
              checks: {
                server: true,
                firebaseAdmin: true,
                redis: true,
                stripe: true,
                email: true,
                pipelineSync: true,
                agentRuntime: true,
                autonomousAutomation: true,
              },
              launchChecks: {},
            },
            workers: [
              {
                workerKey: "creative_asset_factory",
                enabled: true,
                status: "idle",
                intervalMs: 86400000,
                batchSize: 1,
                startupDelayMs: 75000,
                lastRunNumber: 1,
                lastRunStartedAt: "2026-04-02T12:00:00.000Z",
                lastRunCompletedAt: "2026-04-02T12:00:10.000Z",
                lastRunDurationMs: 10000,
                lastProcessedCount: 1,
                lastFailedCount: 0,
                lastError: null,
              },
            ],
          },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders provider health and worker status panels", async () => {
    renderPage();

    expect(await screen.findByText(/Provider health/i)).toBeInTheDocument();
    expect(screen.getByText(/Automation workers/i)).toBeInTheDocument();
    expect(screen.getByText(/Immediate blockers/i)).toBeInTheDocument();
    expect(screen.getByText(/creative asset factory/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent runtime: openai/i)).toBeInTheDocument();
    expect(screen.getByText(/Last verify:/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent creative runs/i)).toBeInTheDocument();
    expect(screen.getByText(/gs:\/\/blueprint-8c1ca\.appspot\.com\/creative-factory\/run-1\/product-reel\.mp4/i)).toBeInTheDocument();
    expect(screen.getByText(/Google image state: ready/i)).toBeInTheDocument();
    expect(screen.getByText(/No launch blockers detected/i)).toBeInTheDocument();
  });
});
