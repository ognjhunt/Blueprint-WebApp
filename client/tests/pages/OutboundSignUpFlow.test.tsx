import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OutboundSignUpFlow from '@/pages/OutboundSignUpFlow';

const getGoogleMapsApiKeyMock = vi.hoisted(() => vi.fn(() => null));

vi.mock('@/components/Nav', () => ({
  default: () => <div>Nav Mock</div>,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <div>Footer Mock</div>,
}));

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }) => <div>{children}</div>,
  GoogleLogin: () => <button>Google Login Mock</button>,
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('@/lib/client-env', () => ({
  getGoogleMapsApiKey: () => getGoogleMapsApiKeyMock(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'test-user' } })),
  createUserWithEmailAndPassword: vi.fn().mockResolvedValue({
    user: { uid: 'test-uid' },
  }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(null),
  updateDoc: vi.fn().mockResolvedValue(null),
  serverTimestamp: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  arrayUnion: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock('@/utils/lindyWebhook', () => ({
  triggerLindyWebhook: vi.fn(),
}));

vi.mock('@/utils/postSignupWorkflows', () => ({
  triggerPostSignupWorkflowsDetached: vi.fn(),
}));

describe('OutboundSignUpFlow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/signup/business');
  });

  it('renders the checkout messaging on the first step', () => {
    render(<OutboundSignUpFlow />);

    expect(
      screen.getByText(/Optional Stripe checkout in the final step\./i),
    ).toBeInTheDocument();
  });
});
