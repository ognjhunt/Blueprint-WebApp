import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ currentUser: null as null | { uid: string; email: string }, userData: null as null | Record<string, unknown> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async () => ({}) }));

const { MinimalSiteLayout } = await import("@/components/site/MinimalSiteLayout");
const { TaskBrowse } = await import("@/components/site/TaskBrowse");

const fetchMock = vi.fn();
beforeEach(() => { auth.currentUser = null; auth.userData = { finishedOnboarding: true }; fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("signed-in state on public pages", () => {
  it("shows the account in place of Sign in", () => {
    const { rerender } = render(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/sign-in");

    auth.currentUser = { uid: "u1", email: "ops@example.test" };
    rerender(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Your workspace" })[0]).toHaveAttribute("href", "/app");

    auth.userData = { role: "capturer" };
    rerender(<MinimalSiteLayout>page</MinimalSiteLayout>);
    // The capturer role is retired (2026-11-11): routed like everyone else.
    expect(screen.getAllByRole("link", { name: "Finish onboarding" })[0]).toHaveAttribute("href", "/onboarding");
    auth.userData = { finishedOnboarding: false };
    rerender(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.getAllByRole("link", { name: "Finish onboarding" })[0]).toHaveAttribute("href", "/onboarding");
  });

  // Decision 3 (launch copy, 2026-11-20): staff see exactly what an approved company sees, with no hint of their own.
  it("shows staff the library exactly as an approved company sees it", async () => {
    auth.currentUser = { uid: "u1", email: "ops@example.test" };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({
      items: [], access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: true },
    }) });
    render(<TaskBrowse />);
    expect(await screen.findByRole("heading", { name: "No jobs yet." })).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
    expect(document.body.textContent).not.toMatch(/ops@example\.test|staff view|Signed in as/);
  });
});
