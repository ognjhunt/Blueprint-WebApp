import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockSearch = "";
let mockLocation = "/contact";
const analyticsEventsMock = vi.hoisted(() => ({
  contactRequestStarted: vi.fn(),
  contactRequestSubmitted: vi.fn(),
  contactRequestCompleted: vi.fn(),
  contactRequestFailed: vi.fn(),
  contactPageCtaClicked: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
  }),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => mockSearch,
    useLocation: () => [mockLocation, vi.fn()],
  };
});

vi.mock("@/lib/analytics", () => ({
  analyticsEvents: analyticsEventsMock,
  getSafeErrorType: vi.fn(() => "unknown"),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch = "";
  mockLocation = "/contact";
  global.fetch = vi.fn().mockImplementation((input: RequestInfo, init?: RequestInit) => {
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
        requestId: "req-123",
        siteSubmissionId: "req-123",
        status: "submitted",
        echoedBody: init?.body,
      }),
    });
  }) as typeof fetch;
});

function submittedBody() {
  const submitCall = vi.mocked(global.fetch).mock.calls.find(
    ([input]) => input === "/api/inbound-request",
  );
  return JSON.parse(String(submitCall?.[1]?.body));
}

describe("Contact page", () => {
  it("renders the simplified robot-team Task Evaluation Run flow", () => {
    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Request a Task Evaluation Run\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Robot teams/i })).toHaveAttribute(
      "href",
      "/contact/robot-team#contact-intake",
    );
    expect(screen.getByRole("link", { name: /Site operators/i })).toHaveAttribute(
      "href",
      "/contact/site-operator#contact-intake",
    );
    expect(screen.getByText(/1 site x 1 robot policy\/profile x 1 task pack x scenario count/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /First name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Work email/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Company$/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Robot \/ policy name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Target site or site type/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Task \+ threshold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request evaluation/i })).toBeInTheDocument();
    expect(screen.queryByText(/Human and agent friendly/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Site data package/i)).not.toBeInTheDocument();

    expect(analyticsEventsMock.contactRequestStarted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: true,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "hosted_evaluation",
      authenticated: false,
      prefilledSiteContext: false,
    });
  });

  it("maps old robot-team world-model query params to the Post-Training Data Package form", () => {
    mockSearch =
      "?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-world-detail&siteName=Harborview+Grocery+Distribution+Annex&targetSiteType=Grocery+distribution&scenario=Walk+to+shelf+staging&requestedOutputs=Runtime+manifest+and+proof+packet&targetRobotTeam=Unitree+G1";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Request a Post-Training Data Package\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A Post-Training Data Package means/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Harborview Grocery Distribution Annex")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unitree G1")).toBeInTheDocument();
    expect(screen.getByText(/Prefilled context attached/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime manifest and proof packet/i)).toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        hostedMode: false,
        requestedLane: "data_licensing",
        commercialRequestPath: "world_model",
      }),
    );
  });

  it("submits a robot-team Task Evaluation Run payload", async () => {
    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Robot \/ policy name/i }), {
      target: { value: "Unitree G1 policy API" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Target site or site type/i }), {
      target: { value: "Warehouse in Chicago" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Task \+ threshold/i }), {
      target: { value: "Tote transfer. Need >=97% simulated success before pilot." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add optional details/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /Preferred policy access method/i }), {
      target: { value: "Policy API endpoint" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Scenario count/i }), {
      target: { value: "50 normal, 25 edge cases" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Deadline/i }), {
      target: { value: "Scope by June 20" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Notes/i }), {
      target: { value: "Compare against action logs." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request evaluation/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText(/Task Evaluation Run request received/i)).toBeInTheDocument();
    const body = submittedBody();
    expect(body).toMatchObject({
      firstName: "Ada",
      lastName: "Not provided",
      company: "Analytical Engines",
      roleTitle: "Robot team",
      email: "ada@example.com",
      buyerType: "robot_team",
      commercialRequestPath: "hosted_evaluation",
      requestedLanes: ["deeper_evaluation"],
      proofPathPreference: "exact_site_required",
      siteName: "Warehouse in Chicago",
      targetSiteType: "Warehouse in Chicago",
      taskStatement: "Tote transfer. Need >=97% simulated success before pilot.",
      targetRobotTeam: "Unitree G1 policy API",
    });
    expect(body.details).toContain("Policy access method: Policy API endpoint");
    expect(body.details).toContain("Scenario count: 50 normal, 25 edge cases");
    expect(body.realSiteRobotEvalFit).toMatchObject({
      siteCardInput: {
        siteType: "Warehouse in Chicago",
      },
      taskCardInput: {
        task: "Tote transfer. Need >=97% simulated success before pilot.",
        requiredMetrics: "Tote transfer. Need >=97% simulated success before pilot.",
      },
      evalCardInput: {
        robotOrPolicyTested: "Unitree G1 policy API",
        preferredReviewPath: "Policy API endpoint",
      },
    });
    expect(analyticsEventsMock.contactRequestSubmitted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: true,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "hosted_evaluation",
      authenticated: false,
      hasJobTitle: false,
      hasSiteName: true,
      hasSiteLocation: false,
      hasTaskStatement: true,
      hasOperatingConstraints: false,
      hasPrivacySecurityConstraints: false,
      hasNotes: true,
    });
  });

  it("submits a Post-Training Data Package payload from data-package params", async () => {
    mockSearch =
      "?persona=robot-team&buyerType=robot_team&interest=post-training-data-package&path=data-package&requestedOutputs=Post-Training%20Data%20Package";

    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ruth" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company*"), {
      target: { value: "ModelOps Robotics" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ruth@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Target site or site type/i }), {
      target: { value: "Retail backroom" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Task \+ threshold/i }), {
      target: { value: "Shelf restock failures, robot POV clips, and variation labels." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request data package/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText(/Post-Training Data Package request received/i)).toBeInTheDocument();
    expect(submittedBody()).toMatchObject({
      buyerType: "robot_team",
      commercialRequestPath: "world_model",
      requestedLanes: ["data_licensing"],
      proofPathPreference: "exact_site_required",
      siteName: "Retail backroom",
      targetSiteType: "Retail backroom",
      taskStatement: "Shelf restock failures, robot POV clips, and variation labels.",
    });
    expect(analyticsEventsMock.contactRequestSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        hostedMode: false,
        requestedLane: "data_licensing",
        commercialRequestPath: "world_model",
      }),
    );
  });

  it("renders the simplified free site-operator submission flow", () => {
    mockLocation = "/contact/site-operator";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Submit a Site for Robot Evaluation\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Submitting a site is free/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Facility name or site type/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /City \/ location/i })).toBeInTheDocument();
    expect(screen.getByText(/Private review only/i)).toBeInTheDocument();
    expect(screen.getByText(/Anonymized marketplace use/i)).toBeInTheDocument();
    expect(screen.getByText(/Ask before each robot-team use/i)).toBeInTheDocument();
    expect(screen.getByText(/Not sure yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit site free/i })).toBeInTheDocument();
  });

  it("submits site-operator access and privacy boundaries", async () => {
    mockLocation = "/contact/site-operator";

    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Nina" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company or operator*"), {
      target: { value: "Brightleaf Ops" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "nina@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Facility name or site type/i }), {
      target: { value: "Brightleaf Books" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /City \/ location/i }), {
      target: { value: "Durham, NC" },
    });
    fireEvent.click(screen.getByText(/Ask before each robot-team use/i));
    fireEvent.change(
      screen.getByRole("textbox", { name: /Privacy, safety, or commercialization notes/i }),
      {
        target: { value: "Redact faces and skip employee-only rooms." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /Submit site free/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText(/Site submission received/i)).toBeInTheDocument();
    const body = submittedBody();
    expect(body).toMatchObject({
      firstName: "Nina",
      lastName: "Not provided",
      company: "Brightleaf Ops",
      roleTitle: "Site operator",
      buyerType: "site_operator",
      commercialRequestPath: "site_claim",
      requestedLanes: ["qualification"],
      siteName: "Brightleaf Books",
      siteLocation: "Durham, NC",
      operatingConstraints: "Ask before each robot-team use",
      privacySecurityConstraints: "Redact faces and skip employee-only rooms.",
    });
    expect(body.captureRights).toContain("Ask before each robot-team use");
    expect(body.derivedScenePermission).toContain("Per-use operator approval");
  });

  it("tracks a validation failure when required robot-team fields are missing", async () => {
    render(<Contact />);

    fireEvent.click(screen.getByRole("button", { name: /Request evaluation/i }));

    expect(screen.getByText(/Please add: First name, Company, Work email, Target site or site type, Task \+ threshold/i)).toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestFailed).toHaveBeenCalledWith({
      stage: "validation",
      errorType: "missing_required_fields",
      persona: "robot_team",
      hostedMode: true,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "hosted_evaluation",
    });
  });
});
