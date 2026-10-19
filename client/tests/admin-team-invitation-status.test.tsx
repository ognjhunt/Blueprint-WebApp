import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminRobotTeamAccess from "../src/pages/AdminRobotTeamAccess";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: unknown) => headers ?? {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("operator invitation delivery status", () => {
  it.each([
    ["queued", "Approval saved. Sign-up email queued."],
    ["sent", "Approval saved. Sign-up email sent."],
    ["needs_attention", "Approval saved. Invitation delivery needs attention; check the outbox before retrying."],
  ])("shows %s for an already approved team instead of claiming inbox delivery", async (notificationStatus, message) => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true,
      json: async () => init?.method === "POST" ? { alreadyApproved: true, notificationStatus }
        : { applications: [], count: 0 },
    })));
    render(<QueryClientProvider client={new QueryClient()}><AdminRobotTeamAccess /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fixture team owner" } });
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "fixture@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Fixture robot team" } });
    fireEvent.submit(screen.getByRole("form", { name: "Invite a team" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/They have the sign-up email|Already approved; nothing sent/)).toBeNull();
  });
});
