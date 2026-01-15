import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Contact from '@/pages/Contact';

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
    if (input === "/api/csrf") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ csrfToken: "test-token" }),
      });
    }

    return Promise.resolve({ ok: true });
  });
});

describe('Contact page', () => {
  it('renders the contact page heading and helper cards', () => {
    render(<Contact />);

    expect(
      screen.getByRole('heading', {
        name: /Build better robots with Blueprint/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Quick Response/i)).toBeInTheDocument();
    expect(screen.getByText(/Prefer email\?/i)).toBeInTheDocument();
  });

  it('submits the contact form when required fields are filled', async () => {
    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText('First name*'), {
      target: { value: 'Ada' },
    });
    fireEvent.change(screen.getByPlaceholderText('Last name*'), {
      target: { value: 'Lovelace' },
    });
    fireEvent.change(screen.getByPlaceholderText('Company name*'), {
      target: { value: 'Analytical Engines' },
    });
    fireEvent.change(screen.getByPlaceholderText('Work email*'), {
      target: { value: 'ada@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: '$50K-$300K' }));
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Benchmark Packs - Evaluation suites/i,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/contact",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
