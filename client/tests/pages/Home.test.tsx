import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/pages/Home';

describe('Home', () => {
  it('renders the hero messaging and primary CTAs', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        name: /The complete data platform for robotic AI\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Browse Marketplace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Submit a request/i }),
    ).toBeInTheDocument();
  });

  it('highlights the SimReady value proposition', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /Why SimReady\?/i }),
    ).toBeInTheDocument();
  });
});
