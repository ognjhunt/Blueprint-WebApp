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

const applications = [
  {
    uid: "capturer-1",
    displayName: "Casey Capturer",
    email: "casey@example.com",
    market: "Durham, NC",
    equipment: ["iPhone 15 Pro"],
    availability: "weekends",
    referralSource: "friend",
    status: "pending_review",
    appliedAt: "2026-07-01T12:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  },
  {
    uid: "capturer-2",
    displayName: "Avery Approved",
    email: "avery@example.com",
    market: "Austin, TX",
    equipment: ["Pixel 9 Pro"],
    availability: "flexible",
    referralSource: null,
    status: "approved",
    appliedAt: "2026-06-20T12:00:00.000Z",
    reviewedAt: "2026-06-25T12:00:00.000Z",
    reviewedBy: "ops-admin-uid",
    reviewNote: "Strong market fit",
  },
];

describe("AdminLeads capturer applications", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      currentUser: { email: "ops@tryblueprint.io" },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(new Response(JSON.stringify({ leads: [] })));
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ total: 0, newLast24h: 0, byStatus: {}, byPriority: {} })
          )
        );
      }
      if (url === "/api/admin/capturer-applications" && !init?.method) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, applications }))
        );
      }
      if (
        url.startsWith("/api/admin/capturer-applications/") &&
        url.endsWith("/decision")
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              application: { ...applications[0], status: "approved" },
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

  it("lists capturer applications with statuses and honest assignment copy", async () => {
    renderPage();

    const capturersTab = await screen.findByRole("tab", { name: /capturers/i });
    fireEvent.mouseDown(capturersTab);
    fireEvent.click(capturersTab);

    expect(await screen.findByText(/Casey Capturer/i)).toBeInTheDocument();
    expect(screen.getByText(/Avery Approved/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Approved/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Durham, NC/i)).toBeInTheDocument();
    expect(screen.getByText(/iPhone 15 Pro/i)).toBeInTheDocument();
    expect(
      screen.getByText(/approving here does not create or promise an assignment/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Note: Strong market fit/i)).toBeInTheDocument();
    // Only the pending application gets decision buttons.
    expect(screen.getAllByRole("button", { name: /^Approve$/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Reject$/ })).toHaveLength(1);
  });

  it("approves a pending application after confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    const capturersTab = await screen.findByRole("tab", { name: /capturers/i });
    fireEvent.mouseDown(capturersTab);
    fireEvent.click(capturersTab);

    fireEvent.click(await screen.findByRole("button", { name: /^Approve$/ }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/capturer-applications/capturer-1/decision",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ decision: "approved" }),
        })
      );
    });

    confirmSpy.mockRestore();
  });

  it("rejects a pending application with an optional note", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Out of market");

    renderPage();

    const capturersTab = await screen.findByRole("tab", { name: /capturers/i });
    fireEvent.mouseDown(capturersTab);
    fireEvent.click(capturersTab);

    fireEvent.click(await screen.findByRole("button", { name: /^Reject$/ }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/capturer-applications/capturer-1/decision",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ decision: "rejected", note: "Out of market" }),
        })
      );
    });

    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });
});
