import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import Runs from "@/pages/app/Runs";
import type { BuyerRunRecord } from "@/lib/buyerAppData";

const getIdToken = vi.fn(async () => "token-1");

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      uid: "buyer-1",
      email: "buyer@example.com",
      displayName: "Buyer One",
      getIdToken,
    },
    userData: null,
    loading: false,
  }),
}));

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function stubBuyerApi({ runs }: { runs: BuyerRunRecord[] }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.includes("/api/marketplace/entitlements/current")) {
      return jsonResponse({ entitlement: null, access: null, entitlements: [] });
    }
    if (url.includes("/api/robot-eval/job-requests")) {
      return jsonResponse({ ok: true, count: runs.length, job_requests: runs });
    }
    return jsonResponse({});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("app/Runs", () => {
  it("renders the buyer's stored run records with status, site, and detail link", async () => {
    const fetchMock = stubBuyerApi({
      runs: [
        {
          job_id: "job-newer",
          status: "queued_for_pipeline",
          pipeline_status: null,
          site_slug: "atlanta-cafe",
          created_at_iso: "2026-07-02T00:00:00.000Z",
        },
        {
          job_id: "job-older",
          status: "completed",
          pipeline_status: "completed",
          site_slug: "denver-warehouse",
          created_at_iso: "2026-07-01T00:00:00.000Z",
        },
      ],
    });

    renderWithQueryClient(<Runs />);

    expect(await screen.findByText("atlanta-cafe")).toBeInTheDocument();
    expect(screen.getByText("denver-warehouse")).toBeInTheDocument();
    expect(screen.getByText("job-newer")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    const detailLinks = screen.getAllByRole("link", { name: /view run/i });
    expect(detailLinks[0]).toHaveAttribute("href", "/app/runs/job-newer");
    expect(detailLinks[1]).toHaveAttribute("href", "/app/runs/job-older");

    // The run list request is authenticated with the Firebase id token.
    const runListCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input as RequestInfo | URL).includes("/api/robot-eval/job-requests"),
    );
    expect(runListCall).toBeDefined();
    expect(
      (runListCall?.[1] as RequestInit | undefined)?.headers,
    ).toMatchObject({ Authorization: "Bearer token-1" });
  });

  it("renders an honest empty state with a link to sites when no runs exist", async () => {
    stubBuyerApi({ runs: [] });

    renderWithQueryClient(<Runs />);

    expect(await screen.findByText("No evaluation runs yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse sites/i })).toHaveAttribute(
      "href",
      "/sites",
    );
    expect(screen.queryByRole("link", { name: /view run/i })).not.toBeInTheDocument();
  });
});
