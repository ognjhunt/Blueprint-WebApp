import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BusinessSignUpFlow from "@/pages/BusinessSignUpFlow";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legalAcceptance";

const ANIMATED_STEP_TIMEOUT_MS = 10_000;

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
    expect(screen.getAllByText(/Robot team access request/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Existing portal users should use sign in instead of creating a second path/i)).toBeInTheDocument();
  });

  it("preselects the site-operator lane from signup query params", () => {
    window.history.pushState({}, "", "/signup/business?buyerType=site_operator");

    render(<BusinessSignUpFlow />);

    expect(analyticsEventsMock.businessSignupStarted).toHaveBeenCalledWith({
      defaultRequestedLane: "qualification",
      requestedLaneCount: 1,
    });
    expect(screen.getAllByText(/Site operator access request/i).length).toBeGreaterThan(0);
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

    await screen.findByText(
      /Team and requested lane/i,
      undefined,
      { timeout: ANIMATED_STEP_TIMEOUT_MS },
    );

    fireEvent.change(await screen.findByLabelText(/Your name/i), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(/Phone number/i), {
      target: { value: "919-555-0101" },
    });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Autonomy lead" },
    });
    fireEvent.change(screen.getByLabelText(/Company size/i), {
      target: { value: "11-50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByLabelText(
      /Site name/i,
      undefined,
      { timeout: ANIMATED_STEP_TIMEOUT_MS },
    );

    fireEvent.change(screen.getByLabelText(/Site name/i), {
      target: { value: "Durham fulfillment center" },
    });
    fireEvent.change(screen.getByLabelText(/Site location/i), {
      target: { value: "Durham, NC" },
    });
    fireEvent.change(screen.getByLabelText(/Task statement/i), {
      target: { value: "Qualify a tote-picking workflow." },
    });
    fireEvent.change(screen.getByLabelText(/Workflow context/i), {
      target: { value: "Need success threshold and cycle-time metric for tote picking." },
    });
    fireEvent.change(screen.getByLabelText(/Operating constraints/i), {
      target: { value: "Safety exclusion zones around humans and forklifts." },
    });
    fireEvent.change(screen.getByLabelText(/Known blockers/i), {
      target: { value: "Need simulator validation evidence and action logs before pilot." },
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
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Terms of Service and Privacy Policy/i }),
    );
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
      accountSignup: true,
      acceptedTerms: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
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
      workflowContext: "Need success threshold and cycle-time metric for tote picking.",
      operatingConstraints: "Safety exclusion zones around humans and forklifts.",
      knownBlockers: "Need simulator validation evidence and action logs before pilot.",
      details:
        "Workflow context: Need success threshold and cycle-time metric for tote picking.\nOperating constraints: Safety exclusion zones around humans and forklifts.\nKnown blockers: Need simulator validation evidence and action logs before pilot.",
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
      // R047: the persisted profile records Terms/Privacy acceptance.
      acceptedTerms: true,
      termsVersion: TERMS_VERSION,
      termsAcceptance: {
        accepted_terms: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        terms_url: "/terms",
        privacy_url: "/privacy",
        accepted_at: "timestamp",
      },
    });

    expect(analyticsEventsMock.businessSignupSubmitted).toHaveBeenCalledWith({
      buyerType: "robot_team",
      requestedLaneCount: 1,
      includesQualificationLane: false,
      companySize: "11-50",
      budgetRange: "$50K-$300K",
      referralSource: "google",
      hasPhoneNumber: true,
      hasWorkflowContext: true,
      hasOperatingConstraints: true,
      hasPrivacySecurityConstraints: false,
      hasCommercializationPreference: false,
      hasKnownBlockers: true,
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

  it("routes a site-operator pilot signup into a permissioned structured dossier", async () => {
    window.history.pushState(
      {},
      "",
      "/signup/business?buyerType=site_operator&intent=pilot-opportunity",
    );
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

    await screen.findByText(
      /Role and site lane/i,
      undefined,
      { timeout: ANIMATED_STEP_TIMEOUT_MS },
    );

    fireEvent.change(await screen.findByLabelText(/Your name/i), {
      target: { value: "Nina Operator" },
    });
    fireEvent.change(screen.getByLabelText(/Phone number/i), {
      target: { value: "919-555-0102" },
    });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Facilities lead" },
    });
    fireEvent.change(screen.getByLabelText(/Company size/i), {
      target: { value: "51-200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByLabelText(
      /Facility name/i,
      undefined,
      { timeout: ANIMATED_STEP_TIMEOUT_MS },
    );

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
    fireEvent.change(screen.getByLabelText(/Commercialization boundary/i), {
      target: { value: "Ask before each robot-team use" },
    });
    expect(
      screen.getByRole("checkbox", { name: /Prepare this workflow as a pilot opportunity/i }),
    ).toBeChecked();
    fireEvent.change(screen.getByLabelText(/Objects and variability/i), {
      target: { value: "Rigid book totes, 6-14 kg, three standard footprints." },
    });
    fireEvent.change(screen.getByLabelText(/Standardized benchmark/i), {
      target: { value: "6-14 kg rigid totes, 97% success, 45 second target, separated aisle class." },
    });
    fireEvent.change(screen.getByLabelText(/Operational profile/i), {
      target: { value: "45 second cycle, two shifts, 3% exception rate." },
    });
    fireEvent.change(screen.getByLabelText(/Integration environment/i), {
      target: { value: "WMS task API, facility Wi-Fi, no PLC write access." },
    });
    fireEvent.change(screen.getByLabelText(/Owner and rollout readiness/i), {
      target: { value: "Facilities lead owns a separated pilot area; four similar sites." },
    });
    expect(screen.getByText(/Site submission is free/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Budget range/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/How did you hear about Blueprint\?/i), {
      target: { value: "partner_referral" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Terms of Service and Privacy Policy/i }),
    );
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
      derivedScenePermission: "Ask before each robot-team use",
      pilotOpportunity: {
        requested: true,
        visibility: "private",
        benchmarkProfile: "6-14 kg rigid totes, 97% success, 45 second target, separated aisle class.",
        objectProfile: "Rigid book totes, 6-14 kg, three standard footprints.",
        operationalProfile: "45 second cycle, two shifts, 3% exception rate.",
        integrationEnvironment: "WMS task API, facility Wi-Fi, no PLC write access.",
        rolloutReadiness: "Facilities lead owns a separated pilot area; four similar sites.",
        dataUsePermissions: {
          evaluateExistingPolicy: "granted",
          siteSpecificAdaptation: "not_granted",
          retainImprovements: "not_granted",
          generalModelTraining: "not_granted",
        },
      },
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
      pilotOpportunityOutcome: "review_pending",
      missingPilotOpportunityFields: [],
      onboardingProgress: {
        siteClaimConfirmed: true,
        accessBoundariesDefined: true,
        privacyRulesConfirmed: true,
        commercializationPreferenceSet: true,
        pilotOpportunityDossierSubmitted: true,
      },
      // R047: the persisted operator profile records Terms/Privacy acceptance.
      acceptedTerms: true,
      termsAcceptance: {
        accepted_terms: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        accepted_at: "timestamp",
      },
    });
  });

  it("blocks buyer signup submission until Terms and Privacy are accepted", async () => {
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

    await screen.findByText(
      /Team and requested lane/i,
      undefined,
      { timeout: ANIMATED_STEP_TIMEOUT_MS },
    );

    fireEvent.change(await screen.findByLabelText(/Your name/i), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(/Phone number/i), {
      target: { value: "919-555-0103" },
    });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Autonomy lead" },
    });
    fireEvent.change(screen.getByLabelText(/Company size/i), {
      target: { value: "11-50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await screen.findByLabelText(
      /Site name/i,
      undefined,
      { timeout: ANIMATED_STEP_TIMEOUT_MS },
    );

    fireEvent.change(screen.getByLabelText(/Site name/i), {
      target: { value: "Durham fulfillment center" },
    });
    fireEvent.change(screen.getByLabelText(/Site location/i), {
      target: { value: "Durham, NC" },
    });
    fireEvent.change(screen.getByLabelText(/Task statement/i), {
      target: { value: "Qualify a tote-picking workflow." },
    });
    fireEvent.change(screen.getByLabelText(/Budget range/i), {
      target: { value: "$50K-$300K" },
    });
    fireEvent.change(screen.getByLabelText(/How did you hear about Blueprint\?/i), {
      target: { value: "google" },
    });

    // Submit WITHOUT checking the acceptance box.
    fireEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    await waitFor(() => {
      expect(analyticsEventsMock.businessSignupFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: "step_validation",
          stepNumber: 3,
          errorType: "missing_terms_acceptance",
        }),
      );
    });

    expect(setLocationMock).not.toHaveBeenCalledWith("/onboarding");
    expect(setDocMock).not.toHaveBeenCalled();
    const inboundCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    expect(inboundCall).toBeUndefined();
    expect(
      screen.getByText(/accept the Terms of Service and Privacy Policy/i),
    ).toBeInTheDocument();
  });
});
