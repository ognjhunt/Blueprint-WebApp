import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OffWaitlistSignUpFlow from '@/pages/OffWaitlistSignUpFlow';

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

describe('OffWaitlistSignUpFlow', () => {
  beforeEach(() => {
    window.history.pushState(
      {},
      '',
      '/off-waitlist-signup?token=blueprint-internal-test-token-2025',
    );
  });

  it('renders the first step and validates email input', async () => {
    render(<OffWaitlistSignUpFlow />);

    expect(
      await screen.findByRole('heading', { name: /Welcome off the waitlist/i }),
    ).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('you@business.com');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    expect(
      screen.getByText(/Please enter a valid email address\./i),
    ).toBeInTheDocument();
  });

  it('advances to contact details once step one is valid', async () => {
    render(<OffWaitlistSignUpFlow />);

    const continueButton = await screen.findByRole('button', {
      name: /Continue/i,
    });
    expect(continueButton).toBeDisabled();

    const passwordInput = screen.getByPlaceholderText('At least 8 characters');
    fireEvent.change(passwordInput, { target: { value: 'strong-pass' } });

    await waitFor(() => {
      expect(continueButton).toBeEnabled();
    });
    fireEvent.click(continueButton);

    expect(
      await screen.findByRole('heading', { name: /Contact & Location/i }),
    ).toBeInTheDocument();
  });
});
