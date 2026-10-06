import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ currentUser: null as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async () => ({}) }));

const { MinimalSiteLayout } = await import("@/components/site/MinimalSiteLayout");
const { TaskBrowse } = await import("@/components/site/TaskBrowse");

const fetchMock = vi.fn();
beforeEach(() => { auth.currentUser = null; fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("signed-in state on public pages", () => {
  it("shows the account instead of the signed-out calls to action", () => {
    const { rerender } = render(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.getByRole("link", { name: "Start a job assessment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();

    auth.currentUser = { uid: "u1", email: "ops@example.test" };
    rerender(<MinimalSiteLayout>page</MinimalSiteLayout>);
    expect(screen.queryByRole("link", { name: "Start a job assessment" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Your workspace" })[0]).toHaveAttribute("href", "/app");
  });

  it("tells staff why they see the library and lets them preview the application", async () => {
    auth.currentUser = { uid: "u1", email: "ops@example.test" };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({
      items: [], access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: true },
    }) });
    render(<TaskBrowse />);
    expect(await screen.findByRole("note")).toHaveTextContent(/Signed in as ops@example\.test · staff view/);
    fireEvent.click(screen.getByRole("button", { name: "Preview the application form" }));
    expect(screen.getByRole("button", { name: "Back to the job library" })).toBeInTheDocument();
  });
});
