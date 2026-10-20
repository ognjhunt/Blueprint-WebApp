import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProtectedRoute from '@/components/ProtectedRoute';

const useAuthMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());
const route = vi.hoisted(() => ({ pathname: "/", search: "" }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('wouter', () => ({
  useLocation: () => [route.pathname, setLocationMock],
  useSearch: () => route.search,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setLocationMock.mockClear();
    route.pathname = "/"; route.search = "";
  });

  it('redirects unauthenticated users to sign-in and stores redirect path', async () => {
    useAuthMock.mockReturnValue({
      currentUser: null,
      userData: null,
      loading: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith('/sign-in');
    });

    expect(sessionStorage.getItem('redirectAfterAuth')).toBe('/');
  });

  it('renders children when the user is authenticated', async () => {
    useAuthMock.mockReturnValue({
      currentUser: { uid: 'user-1' },
      userData: { name: 'Test User' },
      loading: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(
      await screen.findByText('Protected Content'),
    ).toBeInTheDocument();
  });

  it.each(["signout", "role-revoked", "capturer"])("unmounts protected content immediately after %s", async transition => {
    useAuthMock.mockReturnValue({ currentUser: { uid: "user-1" }, userData: { role: "admin" }, loading: false });
    const view = render(<ProtectedRoute requireRoles={["admin"]}><div>Private content</div></ProtectedRoute>);
    await screen.findByText("Private content");
    useAuthMock.mockReturnValue(transition === "signout"
      ? { currentUser: null, userData: null, loading: false }
      : { currentUser: { uid: "user-1" }, userData: { role: transition === "capturer" ? "capturer" : "buyer" }, loading: false });
    view.rerender(<ProtectedRoute requireRoles={["admin"]}><div>Private content</div></ProtectedRoute>);
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it.each([{ role: "capturer" }, null])("allows account privacy without a buyer workspace profile: %s", userData => {
    route.pathname = "/settings"; route.search = "privacy=1";
    useAuthMock.mockReturnValue({ currentUser: { uid: "privacy-owner" }, userData, loading: false });
    render(<ProtectedRoute><div>Account privacy content</div></ProtectedRoute>);
    expect(screen.getByText("Account privacy content")).toBeInTheDocument();
    expect(setLocationMock).not.toHaveBeenCalled();
  });

  it("still blocks a signed-out visitor to account privacy", async () => {
    route.pathname = "/settings"; route.search = "privacy=1";
    useAuthMock.mockReturnValue({ currentUser: null, userData: null, loading: false });
    render(<ProtectedRoute><div>Account privacy content</div></ProtectedRoute>);
    expect(screen.queryByText("Account privacy content")).not.toBeInTheDocument();
    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/sign-in"));
  });

  it.each(["capturer", "missing-profile"])("removes the privacy exception immediately on ordinary Settings navigation: %s", kind => {
    route.pathname = "/settings"; route.search = "privacy=1";
    useAuthMock.mockReturnValue({ currentUser: { uid: "privacy-owner" }, userData: kind === "capturer" ? { role: "capturer" } : null, loading: false });
    const view = render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    route.search = "setup=1";
    view.rerender(<ProtectedRoute><div>Protected content</div></ProtectedRoute>);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    if (kind === "capturer") expect(setLocationMock).toHaveBeenCalledWith("/capture-app");
  });

  it.each(["/admin/jobs", "/settings"])("never waives an admin role requirement with privacy=1 on %s", pathname => {
    route.pathname = pathname; route.search = "privacy=1";
    useAuthMock.mockReturnValue({ currentUser: { uid: "privacy-owner" }, userData: { role: "buyer" }, loading: false });
    render(<ProtectedRoute requireRoles={["admin"]}><div>Admin content</div></ProtectedRoute>);
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    expect(setLocationMock).toHaveBeenCalledWith("/");
  });

});
