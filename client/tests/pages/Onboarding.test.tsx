import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Onboarding from '@/pages/Onboarding';

const setLocationMock = vi.hoisted(() => vi.fn());

vi.mock('wouter', () => ({
  useLocation: () => ['/onboarding', setLocationMock],
}));

vi.mock('@/components/Nav', () => ({
  default: () => <div>Nav</div>,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <div>Footer</div>,
}));

vi.mock('@/components/KitArrivalCountdown', () => ({
  default: () => <div>KitArrivalCountdown</div>,
  DEFAULT_KIT_TRACKING_URL: 'https://tracking.example.com',
  KIT_DELIVERY_LEAD_TIME_BUSINESS_DAYS: 3,
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('@/lib/client-env', () => ({
  getGoogleMapsApiKey: () => null,
}));

vi.mock('@/lib/csrf', () => ({
  withCsrfHeader: (headers: HeadersInit = {}) => headers,
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'user-1', email: 'owner@example.com' } }),
  updateProfile: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

describe('Onboarding', () => {
  beforeEach(() => {
    setLocationMock.mockClear();
  });

  it('renders the organization onboarding step', () => {
    render(<Onboarding />);

    expect(
      screen.getByRole('heading', { name: /Who are we onboarding\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 1 · Organization/i)).toBeInTheDocument();
  });
});
