import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { HERO_HEADLINES, HOME_HERO_VARIANTS } from '@/pages/Home';

describe('Home', () => {
  it('renders the hero messaging and primary CTAs', { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    const heroHeading = screen.getByRole('heading', { level: 1 });

    expect(HERO_HEADLINES).toContain(heroHeading.textContent);
    expect(
      HOME_HERO_VARIANTS.some((variant) => screen.queryAllByText(variant.eyebrow).length > 0),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: /See how it works/i }).some(
        (link) => link.getAttribute('href') === '/how-it-works',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: /Request qualification/i }).some(
        (link) => link.getAttribute('href') === '/contact?interest=site-qualification',
      ),
    ).toBe(true);
  });

  it('highlights the service outcomes', { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /Why teams use Blueprint/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /A simple path from site intake to a clear next step\./i,
      }),
    ).toBeInTheDocument();
  });
});
