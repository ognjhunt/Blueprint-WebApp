import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/pages/Home';

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    tokenClaims: null,
    logout: vi.fn(),
  }),
}));

describe('Home', () => {
  it('renders the hero messaging and primary CTAs', { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /indoor spatial data marketplace for robotics/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/capture evidence/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Browse world models/i }).some(
        (link) => link.getAttribute('href') === '/world-models',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: /Start earning/i }).some(
        (link) => link.getAttribute('href') === '/capture',
      ),
    ).toBe(true);
  });

  it('highlights the service outcomes', { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /Why Blueprint/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Capture\. Qualify\. Deploy\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Built for every side of the market/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Market trajectory/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Humanoid programs are scaling faster than sites are getting ready\./i)).not.toBeInTheDocument();
    expect(screen.getByText(/qualification is the quality moat/i)).toBeInTheDocument();
  });
});
