import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PricingPage from './Pricing'; // Adjust path as needed
import { AuthProvider } from '@/contexts/AuthContext'; // Assuming AuthProvider is needed
import { MemoryRouter } from 'wouter'; // For useLocation and setLocation hooks

// Mock child components
vi.mock('@/components/Nav', () => ({
  default: () => <div data-testid="nav-mock" />,
}));
vi.mock('@/components/Footer', () => ({
  default: () => <div data-testid="footer-mock" />,
}));
vi.mock('@/components/TeamSeatSelectorModal', () => ({
  default: ({ isOpen, onClose, onContinue }) => isOpen ? (
    <div data-testid="team-seat-selector-modal">
      <button onClick={() => onContinue(2)}>Continue with 2 seats</button>
      <button onClick={onClose}>Close Seats</button>
    </div>
  ) : null,
}));
vi.mock('@/components/WorkspaceNameModal', () => ({
  default: ({ isOpen, onClose, onContinue }) => isOpen ? (
    <div data-testid="workspace-name-modal">
      <input type="text" data-testid="workspace-name-input" />
      <button onClick={() => onContinue('Test Workspace')}>Continue Workspace</button>
      <button onClick={onClose}>Close Workspace</button>
    </div>
  ) : null,
}));
vi.mock('@/components/InviteMembersModal', () => ({
  default: ({ isOpen, onClose }) => isOpen ? (
    <div data-testid="invite-members-modal">
      <button onClick={onClose}>Close Invite</button>
    </div>
  ) : null,
}));

// Mock a UI component to test if it's the source of the error
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

// Mock other UI components from @/components/ui that are used in PricingPage
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }) => <div {...props}>{children}</div>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));
vi.mock('@/components/ui/slider', () => ({
  Slider: (props) => <div data-testid="slider-mock" {...props} />, // Slider often involves more complex interaction
}));
vi.mock('@/components/ui/progress', () => ({
  Progress: (props) => <div data-testid="progress-mock" {...props} />,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }) => <span {...props}>{children}</span>,
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="mock-auth-provider">{children}</div>,
  useAuth: () => ({
    currentUser: null,
    loading: false,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    signup: vi.fn().mockResolvedValue(undefined),
    // Ensure all functions/values returned by the real useAuth are mocked here
    // For example, if there's a function to update profile, etc.
    // This simplified version might need expansion based on actual useAuth structure.
  }),
}));

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '',
    query: {},
    asPath: '',
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
    isLocaleDomain: false,
    isReady: true,
    basePath: '',
    isPreview: false,
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: new Proxy({}, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          // Return a simple functional component that renders a div with its children
          return ({ children, ...props }) => <div {...props}>{children}</div>;
        }
        return Reflect.get(target, prop);
      },
    }),
    AnimatePresence: ({ children }) => <div>{children}</div>, // Mock AnimatePresence if used
    useInView: () => false, // Mock useInView hook if used
  };
});

// Mock Firebase
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
    // Add any other firestore functions used by PricingPage
  };
});
vi.mock('@/lib/firebase', () => ({
  db: {}, // Mock db object
  auth: {}, // Mock auth object if used directly from here
}));


// Mock @stripe/stripe-js
const mockRedirectToCheckout = vi.fn();
vi.mock('@stripe/stripe-js', async () => {
  const actual = await vi.importActual('@stripe/stripe-js');
  return {
    ...actual,
    loadStripe: vi.fn().mockResolvedValue({
      redirectToCheckout: mockRedirectToCheckout,
    }),
  };
});

// Mock global fetch
global.fetch = vi.fn();

// Spy on window.alert and window.history.replaceState
const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

// Mock process.env
vi.stubGlobal('process', {
  ...process, // Keep other process properties
  env: {
    ...process.env,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_key',
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    // STRIPE_SECRET_KEY is used in the POST function, not directly in client-side rendering
  },
});

describe('PricingPage', () => {
  let originalLocation;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original window.location and mock it
    originalLocation = window.location;
    // @ts-ignore
    delete window.location;
  });

  afterEach(() => {
    // Restore original window.location
    window.location = originalLocation;
    localStorage.clear();
  });

  const renderPricingPage = (search = '') => {
    // @ts-ignore
    window.location = new URL(`http://localhost/pricing${search}`);

    // Mock document.getElementById for scrollIntoView
    HTMLDivElement.prototype.scrollIntoView = vi.fn();

    return render(
      <MemoryRouter initialPath={`/pricing${search}`}>
        <AuthProvider> {/* Assuming AuthProvider is used, adjust if not */}
          <PricingPage />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('useEffect - URL param handling for Stripe redirects', () => {
    it('should show success alert for Plus plan (hours only) and clean URL', async () => {
      renderPricingPage('?success=true&session_id=cs_test_123&seats=0');

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Payment successful! Your Plus plan (hours only) is now active.");
      });
      await waitFor(() => {
        expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/pricing');
      });
    });

    it('should show success alert and open invite modal for Plus plan with Team seats, and clean URL', async () => {
      localStorage.setItem('pendingWorkspaceName', 'Test Workspace From Redirect');
      renderPricingPage('?success=true&session_id=cs_test_456&seats=2');

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Payment successful! Your Plus plan with 2 team seats is now active for workspace: Test Workspace From Redirect.");
      });
      // Check if invite members modal is opened (indirectly, or directly if a state spy is possible)
      // For now, we'll rely on the alert and URL cleanup. A more robust test would check modal visibility.
      expect(screen.getByTestId('invite-members-modal')).toBeInTheDocument();

      await waitFor(() => {
        expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/pricing');
      });
      expect(localStorage.getItem('pendingWorkspaceName')).toBeNull(); // Check cleanup
    });

    it('should show canceled alert and clean URL if payment was canceled', async () => {
      renderPricingPage('?canceled=true');

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Payment canceled. Your cart has been preserved if you'd like to try again.");
      });
      await waitFor(() => {
        expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/pricing');
      });
    });
  });

  // More test suites will follow for other functions
});
