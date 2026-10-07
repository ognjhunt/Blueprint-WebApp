import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProtectedRoute from '@/components/ProtectedRoute';

const useAuthMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/', setLocationMock],
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setLocationMock.mockClear();
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

});
