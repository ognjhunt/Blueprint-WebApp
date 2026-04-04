import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminGrowthStudio from "@/pages/AdminGrowthStudio";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("@/components/Analytics", () => ({
  analyticsEvents: {
    campaignKitGenerated: vi.fn(),
    creativeImageGenerated: vi.fn(),
    creativeVideoRequested: vi.fn(),
  },
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <AdminGrowthStudio />
    </QueryClientProvider>,
  );
}

describe("AdminGrowthStudio", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/api/admin/growth/campaigns/ship-broadcast/pending-approval")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "campaign-1",
              name: "Ship Broadcast: Blueprint-WebApp abc1234 - Improve hosted review CTA",
              subject: "Improve hosted review CTA",
              recipientCount: 2,
              sendStatus: "pending_approval",
              createdAt: "2026-04-04T14:00:00.000Z",
              lastLedgerDocId: "ledger-1",
              approvalReason: null,
              assetKey: "ship-broadcast:webapp:abc1234",
              assetType: "ship_broadcast",
              sourceIssueIds: ["BLU-200"],
              proofLinks: ["https://notion.so/draft-1"],
            },
          ],
        }));
      }

      if (url.includes("/api/admin/growth/campaigns")) {
        return new Response(JSON.stringify({ localCampaigns: [] }));
      }

      if (url.includes("/api/admin/growth/creative-runs")) {
        return new Response(JSON.stringify({ items: [] }));
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the ship-broadcast approval queue panel", async () => {
    renderPage();

    expect(await screen.findByText(/Ship-broadcast approval queue/i)).toBeInTheDocument();
    expect(await screen.findByText(/Asset key: ship-broadcast:webapp:abc1234/i)).toBeInTheDocument();
    expect(screen.getByText(/Source issues: BLU-200/i)).toBeInTheDocument();
    expect(screen.getByText(/Proof links/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve and Send/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDisabled();

    const rejectReasonInput = screen.getByLabelText(/Reject reason for campaign-1/i);
    fireEvent.change(rejectReasonInput, { target: { value: "Needs founder review on claims" } });

    expect(screen.getByRole("button", { name: /^Reject$/i })).not.toBeDisabled();
  });
});
