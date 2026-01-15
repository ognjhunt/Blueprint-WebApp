import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '@/pages/Dashboard';

const useAuthMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());
const getDocMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/useDashboardOnboarding', () => ({
  useDashboardOnboarding: () => ({
    onboardingCompleted: true,
    onboardingStep: 0,
    showWelcomeModal: false,
    activeTab: 'overview',
    isOnboardingActive: false,
    overviewTabRef: { current: null },
    statsCardRef: { current: null },
    blueprintsTabRef: { current: null },
    blueprintItemRef: { current: null },
    createBlueprintRef: { current: null },
    setActiveTab: vi.fn(),
    startOnboarding: vi.fn(),
    skipOnboarding: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    completeOnboarding: vi.fn(),
  }),
}));

vi.mock('@/contexts/LiveAPIContext', () => ({
  LiveAPIProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/Nav', () => ({
  default: () => <div>Nav</div>,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <div>Footer</div>,
}));

vi.mock('@/components/GeminiChat', () => ({
  default: () => <div>GeminiChat</div>,
}));

vi.mock('@/components/GeminiMultimodal', () => ({
  default: () => <div>GeminiMultimodal</div>,
}));

vi.mock('@/components/DarkModeToggle', () => ({
  default: () => <div>DarkModeToggle</div>,
}));

vi.mock('@/components/BlueprintImage', () => ({
  default: () => <div>BlueprintImage</div>,
}));

vi.mock('@/components/ScreenShareButton', () => ({
  default: () => <div>ScreenShareButton</div>,
}));

vi.mock('@/components/LindyChat', () => ({
  default: () => <div>LindyChat</div>,
}));

vi.mock('@/components/onboarding/WelcomeModal', () => ({
  WelcomeModal: () => <div>WelcomeModal</div>,
}));

vi.mock('@/components/onboarding/Spotlight', () => ({
  Spotlight: () => <div>Spotlight</div>,
}));

vi.mock('@/components/onboarding/OnboardingTooltip', () => ({
  OnboardingTooltip: () => <div>OnboardingTooltip</div>,
}));

vi.mock('@/components/onboarding/ProgressBadge', () => ({
  ProgressBadge: () => <div>ProgressBadge</div>,
}));

vi.mock('@/components/KitArrivalCountdown', () => ({
  default: () => <div>KitArrivalCountdown</div>,
  DEFAULT_KIT_TRACKING_URL: 'https://tracking.example.com',
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() {
      return {};
    }
  },
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: getDocMock,
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ['/', setLocationMock],
}));

describe('Dashboard', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      currentUser: { uid: 'user-123', displayName: 'Test User' },
    });
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        createdBlueprintIDs: [],
        finishedOnboarding: true,
        mappingScheduleDate: null,
        mappingScheduleTime: null,
      }),
    });
  });

  it('renders the main dashboard header after loading', async () => {
    render(<Dashboard />);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Welcome back to Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Main Menu/i)).toBeInTheDocument();
  });
});
