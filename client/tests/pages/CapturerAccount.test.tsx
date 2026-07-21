import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CapturerAccount from "@/pages/CapturerAccount";

const authState = vi.hoisted(() => ({
  currentUser: { uid: "capturer-1" },
  userData: {} as Record<string, unknown>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => headers,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CapturerAccount />
    </QueryClientProvider>,
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("CapturerAccount", () => {
  beforeEach(() => {
    authState.currentUser = { uid: "capturer-1" };
    authState.userData = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not invent application or Stripe readiness state", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/v1/creator/captures?limit=50") return jsonResponse([]);
      if (url === "/v1/creator/earnings") {
        return jsonResponse({ total_earned_cents: 0, pending_payout_cents: 0, scans_completed: 0 });
      }
      if (url === "/v1/creator/payouts/ledger") return jsonResponse([]);
      if (url === "/v1/stripe/account") return jsonResponse({ error: "not available" }, 503);
      throw new Error(`Unexpected request: ${url}`);
    });

    renderPage();

    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByText(/No application state is recorded/i)).toBeInTheDocument();
    expect(await screen.findByText(/state unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open Stripe payout setup/i })).not.toBeInTheDocument();
    expect(screen.getByText(/No payout ledger entry is recorded/i)).toBeInTheDocument();
  });

  it("renders only API-backed capture, payout, and Stripe records", async () => {
    authState.userData = { capturerApplicationStatus: "approved" };
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/v1/creator/captures?limit=50") {
        return jsonResponse([
          {
            id: "capture-1",
            target_address: "Recorded public route",
            captured_at: "2026-07-20T12:00:00.000Z",
            status: "approved",
            estimated_payout_cents: null,
          },
        ]);
      }
      if (url === "/v1/creator/earnings") {
        return jsonResponse({ total_earned_cents: 4200, pending_payout_cents: 0, scans_completed: 1 });
      }
      if (url === "/v1/creator/payouts/ledger") {
        return jsonResponse([
          {
            id: "payout-1",
            scheduled_for: "2026-07-21T12:00:00.000Z",
            amount_cents: 4200,
            status: "paid",
            description: "Capture payout for scene-1",
          },
        ]);
      }
      if (url === "/v1/stripe/account") {
        return jsonResponse({ onboarding_complete: false, payouts_enabled: false, payout_schedule: "manual" });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderPage();

    expect(await screen.findByText("Recorded public route")).toBeInTheDocument();
    expect(screen.getByText("Capture payout for scene-1")).toBeInTheDocument();
    expect(screen.getAllByText("$42.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Open Stripe payout setup/i })).toBeInTheDocument();
  });

  it("keeps missing capture status and timestamps unrecorded", async () => {
    authState.userData = { capturerApplicationStatus: "approved" };
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/v1/creator/captures?limit=50") {
        return jsonResponse([
          {
            id: "capture-with-missing-state",
            target_address: "Recorded route",
            captured_at: null,
            status: null,
            estimated_payout_cents: null,
          },
        ]);
      }
      if (url === "/v1/creator/earnings") {
        return jsonResponse({ total_earned_cents: 0, pending_payout_cents: 0, scans_completed: 0 });
      }
      if (url === "/v1/creator/payouts/ledger") return jsonResponse([]);
      if (url === "/v1/stripe/account") {
        return jsonResponse({ onboarding_complete: true, payouts_enabled: true, payout_schedule: "manual" });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderPage();

    expect(await screen.findByText(/Time not recorded/i)).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.queryByText("submitted")).not.toBeInTheDocument();
  });
});
