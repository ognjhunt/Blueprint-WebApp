import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { HERO_HEADLINES, HOME_HERO_VARIANTS } from '@/pages/Home';

describe('Home', () => {
  it('renders the hero messaging and primary CTAs', () => {
    window.localStorage.clear();
    render(<Home />);

    const heroHeading = screen.getByRole('heading', { level: 1 });

    expect(HERO_HEADLINES).toContain(heroHeading.textContent);
    expect(
      HOME_HERO_VARIANTS.some((variant) => screen.queryByText(variant.eyebrow) !== null),
    ).toBe(true);
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
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /Why teams use Blueprint/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /A humanoid deployment workflow that starts before the humanoid ships\./i,
      }),
    ).toBeInTheDocument();
  });
});
