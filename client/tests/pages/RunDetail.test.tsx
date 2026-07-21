import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import RunDetail from "@/pages/app/RunDetail";

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

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: () => ({ runId: "job-1" }),
  };
});

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

function stubRunDetailApi(handler: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.includes("/api/robot-eval/job-requests/job-1/status")) {
      return handler();
    }
    if (url.includes("/api/marketplace/entitlements/current")) {
      return jsonResponse({ entitlement: null, access: null, entitlements: [] });
    }
    return jsonResponse({});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("app/RunDetail", () => {
  it("renders only the stored run record fields for a buyer-owned run", async () => {
    stubRunDetailApi(() =>
      jsonResponse({
        ok: true,
        job_id: "job-1",
        status: "queued_for_pipeline",
        pipeline_status: "staged_for_control_plane",
        site_slug: "atlanta-cafe",
        site_submission_id: "scene-1:capture-1",
        entitlement_id: "ent-1",
        entitlement_sku: "atlanta-cafe-robot-eval-run",
        created_at_iso: "2026-07-02T00:00:00.000Z",
        updated_at_iso: "2026-07-02T00:00:00.000Z",
        error: null,
        result_artifacts: {},
        proof_boundary: { simulator_execution_proven: false },
      }),
    );

    renderWithQueryClient(<RunDetail />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "atlanta-cafe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("job-1")).toBeInTheDocument();
    expect(screen.getAllByText("Queued").length).toBeGreaterThan(0);
    expect(screen.getByText("staged_for_control_plane")).toBeInTheDocument();
    expect(screen.getByText("scene-1:capture-1")).toBeInTheDocument();
    expect(screen.getByText("ent-1")).toBeInTheDocument();
    expect(screen.getAllByText("2026-07-02T00:00:00.000Z").length).toBe(2);
    expect(screen.getByText("simulator execution proven")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
    // No fabricated result sections when the store has none.
    expect(screen.queryByText("Result artifacts")).not.toBeInTheDocument();
  });

  it("renders an honest not-found state when the server has no buyer-owned record", async () => {
    stubRunDetailApi(() =>
      jsonResponse(
        { error: "Robot eval job request was not found.", code: "robot_eval_job_not_found" },
        404,
      ),
    );

    renderWithQueryClient(<RunDetail />);

    expect(
      await screen.findByText("No owned run record returned"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Run record not available" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to runs/i })).toHaveAttribute(
      "href",
      "/app/runs",
    );
  });
});
