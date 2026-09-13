import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingChecklist from "@/pages/OnboardingChecklist";

vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

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
  beforeEach(() => {
    setLocationMock.mockReset();
  });
  it("opens the workspace only after account setup is durably saved", async () => {
    const { updateDoc } = await import("firebase/firestore");
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined);
    render(<OnboardingChecklist />);
    fireEvent.click(screen.getByRole("button", { name: "Open workspace →" }));
    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/app"));
    expect(updateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        finishedOnboarding: true,
        onboardingStep: "completed",
      }),
    );
  });
  it("shows a failed save without claiming setup is complete", async () => {
    const { updateDoc } = await import("firebase/firestore");
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error("write failed"));
    render(<OnboardingChecklist />);
    fireEvent.click(screen.getByRole("button", { name: "Open workspace →" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not finish setup",
      ),
    );
    expect(setLocationMock).not.toHaveBeenCalled();
  });

  it("shows site-operator rights, privacy, access, and commercial control status", () => {
    render(<OnboardingChecklist />);

    expect(screen.getByText(/Site access & review/i)).toBeInTheDocument();
    expect(screen.getByText(/^Rights$/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights note captured/i)).toBeInTheDocument();
    expect(screen.getByText(/^Privacy$/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy boundary captured/i)).toBeInTheDocument();
    expect(screen.getByText(/^Access$/i)).toBeInTheDocument();
    expect(screen.getByText(/Access rules defined/i)).toBeInTheDocument();
    expect(screen.getByText(/^Commercial control$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Commercial posture captured/i),
    ).toBeInTheDocument();
  });
});
