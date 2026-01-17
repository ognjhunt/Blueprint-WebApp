import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ForgotPassword from '@/pages/ForgotPassword';

describe('ForgotPassword', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits the reset request and shows the success state', async () => {
    vi.useFakeTimers();
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'user@example.com' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Send reset link/i }),
    );

    await act(async () => {
      vi.runAllTimers();
    });

    expect(
      screen.getByRole('heading', { name: /Check your email/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });
});
