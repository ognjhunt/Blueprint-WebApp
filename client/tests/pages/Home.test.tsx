import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { HERO_HEADLINES } from '@/pages/Home';

describe('Home', () => {
  it('renders the hero messaging and primary CTAs', () => {
    render(<Home />);

    const heroHeading = screen.getByRole('heading', { level: 1 });

    expect(HERO_HEADLINES).toContain(heroHeading.textContent);
    expect(
      screen.getAllByRole('link', { name: /See how it works/i }).some(
        (link) => link.getAttribute('href') === '/solutions',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: /Request a capture/i }).some(
        (link) => link.getAttribute('href') === '/contact',
      ),
    ).toBe(true);
  });

  it('highlights the service outcomes', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /Why teams use Blueprint/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /A simple service for getting a site deployment-ready\./i }),
    ).toBeInTheDocument();
  });
});
