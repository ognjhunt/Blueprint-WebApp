import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OnboardingChecklist from "@/pages/OnboardingChecklist";

const setLocationMock = vi.hoisted(() => vi.fn());
const mockUserData = vi.hoisted(() => ({
  buyerType: "site_operator",
  siteName: "Brightleaf Books",
  siteLocation: "Durham, NC",
  taskStatement: "Claim this facility for controlled robot-team review.",
  captureRights: "Owner approval required before release.",
  privacySecurityConstraints: "Redact faces and skip employee-only rooms.",
  derivedScenePermission: "Keep private until owner review.",
  structuredIntakeRecommendedPath: "site_operator_partnership_review",
  calendarDisposition: "required_before_next_step",
  siteOperatorClaimOutcome: "site_claim_access_boundary_ready",
  accessBoundaryOutcome: "access_boundary_defined",
  siteClaimReadinessScore: 100,
  siteClaimCriteria: [
    "facility_name",
    "site_location",
    "operator_intent",
    "access_rules",
    "privacy_security_boundary",
  ],
  missingSiteClaimFields: [],
  onboardingProgress: {
    profileComplete: true,
    defineSiteSubmission: true,
    completeIntakeReview: false,
    reviewQualifiedOpportunities: false,
    inviteTeam: false,
    siteClaimConfirmed: true,
    accessBoundariesDefined: true,
    privacyRulesConfirmed: true,
    commercializationPreferenceSet: true,
    teamContactConfirmed: false,
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/onboarding", setLocationMock],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "operator-user" },
    userData: mockUserData,
  }),
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));

describe("OnboardingChecklist", () => {
  it("shows site-operator rights, privacy, access, and commercial control status", () => {
    render(<OnboardingChecklist />);
    // Scoped to the page body: the account chrome's footer also links "Privacy".
    const page = within(screen.getByRole("main"));

    expect(page.getByText(/Operator control map/i)).toBeInTheDocument();
    expect(page.getByText(/^Rights$/i)).toBeInTheDocument();
    expect(page.getByText(/Rights note captured/i)).toBeInTheDocument();
    expect(page.getByText(/^Privacy$/i)).toBeInTheDocument();
    expect(page.getByText(/Privacy boundary captured/i)).toBeInTheDocument();
    expect(page.getByText(/^Access$/i)).toBeInTheDocument();
    expect(page.getByText(/Access rules defined/i)).toBeInTheDocument();
    expect(page.getByText(/^Commercial control$/i)).toBeInTheDocument();
    expect(page.getByText(/Commercial posture captured/i)).toBeInTheDocument();
  });
});
