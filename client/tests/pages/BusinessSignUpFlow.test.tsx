import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BusinessSignUpFlow from "@/pages/BusinessSignUpFlow";

const setLocationMock = vi.hoisted(() => vi.fn());
const createUserWithEmailAndPasswordMock = vi.hoisted(() => vi.fn());
const setDocMock = vi.hoisted(() => vi.fn());
const analyticsEventsMock = vi.hoisted(() => ({
  businessSignupStarted: vi.fn(),
  businessSignupSubmitted: vi.fn(),
  businessSignupCompleted: vi.fn(),
  businessSignupFailed: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/signup/business", setLocationMock],
}));

vi.mock("@/lib/analytics", () => ({
  analyticsEvents: analyticsEventsMock,
  getSafeErrorType: vi.fn(() => "unknown"),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => "users/doc"),
  setDoc: setDocMock,
  serverTimestamp: vi.fn(() => "timestamp"),
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
  signInWithGoogle: vi.fn(),
}));

vi.mock("@/lib/client-env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/client-env")>(
    "@/lib/client-env",
  );
  return {
    ...actual,
    getGoogleMapsApiKey: () => null,
  };
});

describe("BusinessSignUpFlow analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/signup/business");
    createUserWithEmailAndPasswordMock.mockResolvedValue({
      user: { uid: "business-uid" },
    });
    setDocMock.mockResolvedValue(undefined);
    global.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      if (input === "/api/csrf") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ csrfToken: "test-token" }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          requestId: "structured-intake-1",
          siteSubmissionId: "structured-intake-1",
          status: "submitted",
        }),
      });
    }) as typeof fetch;
  });

  it("tracks the funnel start with the default robot-team lane", () => {
    render(<BusinessSignUpFlow />);

    expect(analyticsEventsMock.businessSignupStarted).toHaveBeenCalledWith({
      defaultRequestedLane: "deeper_evaluation",
      requestedLaneCount: 1,
    });
    expect(screen.getAllByText(/Buyer access request/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Existing portal users should use sign in instead of creating a second path/i)).toBeInTheDocument();
  });

  it("tracks Austin demand-city context on funnel start when present in the URL", () => {
    window.history.pushState({}, "", "/signup/business?city=austin");

    render(<BusinessSignUpFlow />);

    expect(analyticsEventsMock.businessSignupStarted).toHaveBeenCalledWith({
      defaultRequestedLane: "deeper_evaluation",
      requestedLaneCount: 1,
      demandAttribution: {
        demandCity: "austin",
        buyerChannelSource: null,
        buyerChannelSourceCaptureMode: "unknown",
        buyerChannelSourceRaw: null,
        utm: {
          source: null,
          medium: null,
          campaign: null,
          term: null,
          content: null,
        },
      },
    });
  });

  it("tracks a validation failure when step 1 is incomplete", () => {
    render(<BusinessSignUpFlow />);

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(analyticsEventsMock.businessSignupFailed).toHaveBeenCalledWith({
      stage: "step_validation",
      stepNumber: 1,
      errorType: "missing_organization_name",
      buyerType: "robot_team",
      requestedLaneCount: 1,
    });
  });

  it("tracks submit and completion for a successful business signup", async () => {
    render(<BusinessSignUpFlow />);

    fireEvent.change(screen.getByLabelText(/Organization name/i), {
      target: { value: "Acme Robotics" },
    });
    fireEvent.change(screen.getByLabelText(/Work email/i), {
      target: { value: "ops@acme.ai" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "strongpass123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), {
      target: { value: "strongpass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByText(/Team and requested lane/i);

    fireEvent.change(await screen.findByLabelText(/Your name/i), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Autonomy lead" },
    });
    fireEvent.change(screen.getByLabelText(/Company size/i), {
      target: { value: "11-50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByLabelText(/Site name/i);

    fireEvent.change(screen.getByLabelText(/Site name/i), {
      target: { value: "Durham fulfillment center" },
    });
    fireEvent.change(screen.getByLabelText(/Site location/i), {
      target: { value: "Durham, NC" },
    });
    fireEvent.change(screen.getByLabelText(/Task statement/i), {
      target: { value: "Qualify a tote-picking workflow." },
    });
    fireEvent.change(screen.getByLabelText(/Target robot team or embodiment/i), {
      target: { value: "AMR fleet" },
    });
    fireEvent.change(screen.getByLabelText(/Proof path/i), {
      target: { value: "exact_site_required" },
    });
    fireEvent.change(screen.getByLabelText(/Budget range/i), {
      target: { value: "$50K-$300K" },
    });
    fireEvent.change(screen.getByLabelText(/How did you hear about Blueprint\?/i), {
      target: { value: "google" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/onboarding");
    });

    const inboundCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    expect(inboundCall).toBeDefined();
    const inboundBody = JSON.parse(String(inboundCall?.[1]?.body));
    expect(inboundBody).toMatchObject({
      buyerType: "robot_team",
      requestedLanes: ["deeper_evaluation"],
      siteName: "Durham fulfillment center",
      siteLocation: "Durham, NC",
      siteLocationMetadata: {
        source: "manual",
        formattedAddress: "Durham, NC",
      },
      taskStatement: "Qualify a tote-picking workflow.",
      budgetBucket: "$50K-$300K",
      proofPathPreference: "exact_site_required",
      targetRobotTeam: "AMR fleet",
    });

    const savedUser = setDocMock.mock.calls[0]?.[1];
    expect(savedUser).toMatchObject({
      structuredIntakeRecommendedPath: "intake_then_recommended_scoping_call",
      calendarDisposition: "recommended",
      proofReadyOutcome: "proof_ready_intake",
      proofPathOutcome: "exact_site",
      proofReadinessScore: 100,
      missingProofReadyFields: [],
      onboardingProgress: {
        proofReadyIntake: true,
      },
    });

    expect(analyticsEventsMock.businessSignupSubmitted).toHaveBeenCalledWith({
      buyerType: "robot_team",
      requestedLaneCount: 1,
      includesQualificationLane: false,
      companySize: "11-50",
      budgetRange: "$50K-$300K",
      referralSource: "google",
      hasPhoneNumber: false,
      hasWorkflowContext: false,
      hasOperatingConstraints: false,
      hasPrivacySecurityConstraints: false,
      hasKnownBlockers: false,
      hasTargetRobotTeam: true,
      demandAttribution: {
        demandCity: null,
        buyerChannelSource: "organic_search",
        buyerChannelSourceCaptureMode: "self_reported",
        buyerChannelSourceRaw: "google",
        utm: {
          source: null,
          medium: null,
          campaign: null,
          term: null,
          content: null,
        },
      },
    });
    expect(analyticsEventsMock.businessSignupCompleted).toHaveBeenCalledWith({
      buyerType: "robot_team",
      requestedLaneCount: 1,
      includesQualificationLane: false,
      companySize: "11-50",
      budgetRange: "$50K-$300K",
      referralSource: "google",
      demandAttribution: {
        demandCity: null,
        buyerChannelSource: "organic_search",
        buyerChannelSourceCaptureMode: "self_reported",
        buyerChannelSourceRaw: "google",
        utm: {
          source: null,
          medium: null,
          campaign: null,
          term: null,
          content: null,
        },
      },
    });
  });

  it("routes a site-operator signup into a measured site claim and access boundary", async () => {
    render(<BusinessSignUpFlow />);

    fireEvent.change(screen.getByLabelText(/Organization name/i), {
      target: { value: "Brightleaf Ops" },
    });
    fireEvent.change(screen.getByLabelText(/Work email/i), {
      target: { value: "operator@brightleaf.example" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "strongpass123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), {
      target: { value: "strongpass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByText(/Team and requested lane/i);

    fireEvent.change(await screen.findByLabelText(/Your name/i), {
      target: { value: "Nina Operator" },
    });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Facilities lead" },
    });
    fireEvent.change(screen.getByLabelText(/Company size/i), {
      target: { value: "51-200" },
    });
    fireEvent.click(screen.getByText(/^Site operator$/i));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByLabelText(/Facility name/i);

    fireEvent.change(screen.getByLabelText(/Facility name/i), {
      target: { value: "Brightleaf Books" },
    });
    fireEvent.change(screen.getByLabelText(/Site location/i), {
      target: { value: "Durham, NC" },
    });
    fireEvent.change(screen.getByLabelText(/Operator intent/i), {
      target: { value: "Claim this facility for escorted robot-team review." },
    });
    fireEvent.change(screen.getByLabelText(/Access rules/i), {
      target: { value: "Escorted weekday access, no capture before 9am." },
    });
    fireEvent.change(screen.getByLabelText(/Privacy and security constraints/i), {
      target: { value: "No employee-only rooms and redact faces." },
    });
    fireEvent.change(screen.getByLabelText(/Budget range/i), {
      target: { value: "$50K-$300K" },
    });
    fireEvent.change(screen.getByLabelText(/How did you hear about Blueprint\?/i), {
      target: { value: "partner_referral" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/onboarding");
    });

    const inboundCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    expect(inboundCall).toBeDefined();
    const inboundBody = JSON.parse(String(inboundCall?.[1]?.body));
    expect(inboundBody).toMatchObject({
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      siteName: "Brightleaf Books",
      siteLocation: "Durham, NC",
      taskStatement: "Claim this facility for escorted robot-team review.",
      operatingConstraints: "Escorted weekday access, no capture before 9am.",
      privacySecurityConstraints: "No employee-only rooms and redact faces.",
    });

    const savedUser = setDocMock.mock.calls[0]?.[1];
    expect(savedUser).toMatchObject({
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      structuredIntakeRecommendedPath: "intake_then_required_scoping_call",
      calendarDisposition: "required_before_next_step",
      siteOperatorClaimOutcome: "site_claim_access_boundary_ready",
      accessBoundaryOutcome: "access_boundary_defined",
      siteClaimReadinessScore: 100,
      missingSiteClaimFields: [],
      onboardingProgress: {
        siteClaimConfirmed: true,
        accessBoundariesDefined: true,
        privacyRulesConfirmed: true,
      },
    });
  });
});
