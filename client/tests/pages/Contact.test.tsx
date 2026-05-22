import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockSearch = "";
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

describe("Contact page", () => {
  it("renders the default robot-team intake", () => {
    render(<Contact />);

    expect(
      screen.getByRole("heading", {
        name: /Request a site, location, or robot workflow\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: /What site, location, or robot workflow do you need\?/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Human and agent friendly/i)).toBeInTheDocument();
    expect(screen.getByText(/Add contact details and send the request/i)).toBeInTheDocument();
    expect(screen.getByText(/This is an intake record, not access, payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/Buyer type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested lanes/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request this location/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /World model package/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Hosted review/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /New capture request/i })).toBeInTheDocument();
    expect(screen.getByText(/Required first pass/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Hosted review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/New capture request/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: /What should this world model help your team evaluate\?/i })).toBeInTheDocument();
    expect(screen.queryByText(/Proof boundaries visible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fastest paths/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Learn More/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prefer a lighter first step\?/i)).not.toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestStarted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "world_model",
      authenticated: false,
      prefilledSiteContext: false,
    });
  });

  it("tracks the path selector without adding personal data", () => {
    render(<Contact />);

    fireEvent.click(screen.getAllByRole("button", { name: /Hosted review/i })[0]);

    expect(analyticsEventsMock.contactPageCtaClicked).toHaveBeenCalledWith({
      persona: "robot_team",
      ctaId: "contact_path_select_hosted-review",
      ctaLabel: "Hosted review",
      destination: "hosted-review",
      source: "contact-primary-path-selector",
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "hosted_evaluation",
    });
  });

  it("renders a compact hosted-session mode with prefilled robot-team data", () => {
    mockSearch =
      "?interest=hosted-evaluation&buyerType=robot_team&path=hosted-evaluation&source=site-worlds&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Request a site, location, or robot workflow\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Harborview Grocery Distribution Annex").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Walk to shelf staging and pick the blue tote")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unitree G1 with head cam and wrist cam")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Request hosted review/i }).length).toBeGreaterThan(0);

    expect(screen.queryByRole("combobox", { name: /Proof path/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Existing stack or review workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Human-gated topics to raise early/i })).not.toBeInTheDocument();
  });

  it("carries source route context into the robot-team payload", async () => {
    mockSearch =
      "?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-world-detail&siteName=Harborview+Grocery+Distribution+Annex&targetSiteType=Grocery+distribution&scenario=Walk+to+shelf+staging&requestedOutputs=Runtime+manifest+and+proof+packet";

    render(<Contact />);

    expect(screen.getAllByDisplayValue("Harborview Grocery Distribution Annex").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Grocery distribution")).toBeInTheDocument();
    expect(screen.getAllByText(/Scenario/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Runtime manifest and proof packet/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company name*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Your role/i }), {
      target: { value: "Autonomy lead" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /What should this world model help your team evaluate\?/i }), {
      target: { value: "Compare shelf-staging behavior before field travel." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request world model/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const submitCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    const body = JSON.parse(String(submitCall?.[1]?.body));
    expect(body).toMatchObject({
      buyerType: "robot_team",
      commercialRequestPath: "world_model",
      siteName: "Harborview Grocery Distribution Annex",
      targetSiteType: "Grocery distribution",
      details: "Scenario: Walk to shelf staging\nRequested outputs: Runtime manifest and proof packet",
    });
  });

  it("prefills the primary request from a city param without adding city-specific wall copy", () => {
    mockSearch = "?persona=robot-team&city=austin";

    render(<Contact />);

    expect(
      screen.getByRole("heading", {
        name: /Request a site, location, or robot workflow\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: /What site, location, or robot workflow do you need\?/i,
      }),
    ).toHaveValue("austin");
    expect(screen.queryByText(/Austin request lens/i)).not.toBeInTheDocument();
  });

  it("shows a truthful unknown-location request state from a direct agent URL", () => {
    mockSearch =
      "?source=site-worlds&buyerType=robot_team&path=hosted-review&location=123%20Unknown%20St&workflow=warehouse%20tote";

    render(<Contact />);

    expect(
      screen.getByText(/No scanned package for this exact place yet\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: /What site, location, or robot workflow do you need\?/i,
      }),
    ).toHaveValue("123 Unknown St");
    expect(
      screen.getByRole("link", { name: /Request hosted review/i }),
    ).toHaveAttribute("href", expect.stringContaining("buyerType=robot_team"));
    expect(
      screen.getByRole("link", { name: /Request hosted review/i }),
    ).toHaveAttribute("href", expect.stringContaining("source=site-worlds"));
    expect(
      screen.getByDisplayValue("warehouse tote"),
    ).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("123 Unknown St").length).toBeGreaterThan(0);
  });

  it("submits the default robot-team request when required fields are filled", async () => {
    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company name*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Your role/i }), {
      target: { value: "Autonomy lead" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /What should this world model help your team evaluate\?/i }), {
      target: { value: "Qualify a tote picking workflow." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Site or facility/i }), {
      target: { value: "Warehouse in Chicago" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request world model/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText(/World model request received/i)).toBeInTheDocument();
    expect(screen.getByText(/No checkout, provider generation, live hosted launch/i)).toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestSubmitted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "world_model",
      authenticated: false,
      hasJobTitle: true,
      hasSiteName: true,
      hasSiteLocation: false,
      hasTaskStatement: true,
      hasOperatingConstraints: false,
      hasPrivacySecurityConstraints: false,
      hasNotes: false,
    });
    expect(analyticsEventsMock.contactRequestCompleted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "world_model",
      authenticated: false,
    });
  });

  it("submits hosted-session mode with robot-team defaults", async () => {
    mockSearch =
      "?interest=hosted-evaluation&buyerType=robot_team&path=hosted-evaluation&source=site-worlds&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam";

    render(<Contact />);

    await screen.findByDisplayValue("Walk to shelf staging and pick the blue tote");

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company name*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Your role/i }), {
      target: { value: "Autonomy lead" },
    });
    const hostedSubmitButtons = screen.getAllByRole("button", { name: /Request hosted review/i });
    fireEvent.click(hostedSubmitButtons[hostedSubmitButtons.length - 1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const submitCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    const body = JSON.parse(String(submitCall?.[1]?.body));
    expect(body.buyerType).toBe("robot_team");
    expect(body.commercialRequestPath).toBe("hosted_evaluation");
    expect(body.requestedLanes).toEqual(["deeper_evaluation"]);
    expect(body.budgetBucket).toBe("Undecided/Unsure");
    expect(body.siteName).toBe("Harborview Grocery Distribution Annex");
    expect(body.siteLocation).toBe("1847 W Fulton St, Chicago, IL 60612");
    expect(body.siteLocationMetadata).toEqual({
      source: "manual",
      formattedAddress: "1847 W Fulton St, Chicago, IL 60612",
    });
    expect(body.context).toMatchObject({
      demandCity: null,
      buyerChannelSource: "site_worlds",
      buyerChannelSourceCaptureMode: "explicit_query",
      buyerChannelSourceRaw: "site-worlds",
      utm: {
        source: null,
        medium: null,
        campaign: null,
        term: null,
        content: null,
      },
    });
    expect(screen.getByText(/Hosted review request received/i)).toBeInTheDocument();
  });

  it("submits site-operator rights, privacy, access, and commercial boundaries", async () => {
    mockSearch = "?persona=site-operator";

    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Nina" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Operator" },
    });
    fireEvent.change(screen.getByPlaceholderText("Operator or company*"), {
      target: { value: "Brightleaf Ops" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "nina@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Facility name/i }), {
      target: { value: "Brightleaf Books" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Site location/i }), {
      target: { value: "Durham, NC" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Access rules/i }), {
      target: { value: "Escorted weekdays, no capture near the cash office." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add privacy, rights, or commercialization details/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /Rights and ownership notes/i }), {
      target: { value: "Owner approval required before release." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Privacy and security notes/i }), {
      target: { value: "Redact faces and skip employee-only rooms." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Commercialization preference/i }), {
      target: { value: "Keep private until owner review." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit site claim/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const submitCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    const body = JSON.parse(String(submitCall?.[1]?.body));
    expect(body).toMatchObject({
      buyerType: "site_operator",
      siteName: "Brightleaf Books",
      siteLocation: "Durham, NC",
      operatingConstraints: "Escorted weekdays, no capture near the cash office.",
      captureRights: "Owner approval required before release.",
      privacySecurityConstraints: "Redact faces and skip employee-only rooms.",
      derivedScenePermission: "Keep private until owner review.",
    });
    expect(screen.getByText(/Site claim received/i)).toBeInTheDocument();
  });

  it("tracks a validation failure when required contact fields are missing", async () => {
    render(<Contact />);

    fireEvent.click(screen.getByRole("button", { name: /Request world model/i }));

    expect(screen.getByText(/keeps the request routeable before any call or human review/i)).toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestFailed).toHaveBeenCalledWith({
      stage: "validation",
      errorType: "missing_required_fields",
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
      commercialRequestPath: "world_model",
    });
  });
});
