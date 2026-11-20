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
    expect(screen.getAllByRole("link", { name: "Your account" })[0]).toHaveAttribute("href", "/app");

    // Launch copy (2026-11-20, d-069): one link for every account, whatever its role or set-up; /app sends it on.
    auth.userData = { role: "capturer" };
    rerender(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.getAllByRole("link", { name: "Your account" })[0]).toHaveAttribute("href", "/app");
    auth.userData = { finishedOnboarding: false };
    rerender(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.getAllByRole("link", { name: "Your account" })[0]).toHaveAttribute("href", "/app");
    expect(screen.queryByRole("link", { name: /onboarding|workspace/i })).toBeNull();
  });

  it("tells staff why they see the library and where the public application form is", async () => {
    auth.currentUser = { uid: "u1", email: "ops@example.test" };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({
      items: [], access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: true },
    }) });
    render(<TaskBrowse />);
    expect(await screen.findByRole("note")).toHaveTextContent(/Signed in as ops@example\.test · staff view/);
    expect(screen.getByRole("link", { name: "See the application form" })).toHaveAttribute("href", "/partners#partner-application");
  });
});
