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

  it('redirects unauthenticated users to login and stores redirect path', async () => {
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
      expect(setLocationMock).toHaveBeenCalledWith('/login');
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
});
