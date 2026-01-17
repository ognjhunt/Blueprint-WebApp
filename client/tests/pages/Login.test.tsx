import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Login from '@/pages/Login';

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('Login', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
    });
  });

  it('shows validation errors when submitting an empty form', () => {
    render(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
  });

  it('renders the Google sign-in CTA', () => {
    render(<Login />);

    expect(
      screen.getByRole('button', { name: /Continue with Google/i }),
    ).toBeInTheDocument();
  });
});
