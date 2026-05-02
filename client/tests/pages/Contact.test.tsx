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
        name: /Tell us the site, task, and robot in a few lines\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/For Robot Teams/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What happens after you send this/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights, privacy, and proof boundaries stay explicit/i)).toBeInTheDocument();
    expect(screen.queryByText(/Buyer type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested lanes/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start robot-team brief/i })).toBeInTheDocument();
    expect(screen.getByText(/Brief first\. Calendar second\./i)).toBeInTheDocument();
    expect(screen.getByText(/Required to route/i)).toBeInTheDocument();
    expect(screen.getByText(/Fastest paths/i)).toBeInTheDocument();
    expect(screen.getByText(/Book a scoping call/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Best when your team wants the runtime path explained before it writes a brief\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Inspect the sample listing/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /What should Blueprint help your team answer first\?/i })).toBeInTheDocument();
    expect(screen.queryByText(/Learn More/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prefer a lighter first step\?/i)).not.toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestStarted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
      authenticated: false,
      prefilledSiteContext: false,
    });
  });

  it("tracks the hero start CTA without adding personal data", () => {
    render(<Contact />);

    fireEvent.click(screen.getByRole("link", { name: /Start robot-team brief/i }));

    expect(analyticsEventsMock.contactPageCtaClicked).toHaveBeenCalledWith({
      persona: "robot_team",
      ctaId: "contact_hero_start",
      ctaLabel: "Start robot-team brief",
      destination: "#contact-intake",
      source: "contact-hero",
      requestedLane: "deeper_evaluation",
    });
  });

  it("renders a compact hosted-session mode with prefilled robot-team data", () => {
    mockSearch =
      "?interest=evaluation-package&buyerType=robot_team&source=site-worlds&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Request a hosted evaluation for this site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Walk to shelf staging and pick the blue tote")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unitree G1 with head cam and wrist cam")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request hosted evaluation/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Confirm the site, the task, and the robot setup\. Blueprint will use that to line up the right hosted evaluation path for your team\./i,
      ),
    ).toBeInTheDocument();

    expect(screen.queryByRole("combobox", { name: /Proof path/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Existing stack or review workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Human-gated topics to raise early/i })).not.toBeInTheDocument();
  });

  it("renders Austin-specific buyer guidance when the city param is present", () => {
    mockSearch = "?persona=robot-team&city=austin";

    render(<Contact />);

    expect(
      screen.getByRole("heading", {
        name: /Give the Austin buyer enough exact-site proof to move quickly\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Austin request lens/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This city leans on high-trust introductions/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Fastest paths/i)).toBeInTheDocument();
    expect(screen.getByText(/Inspect the sample listing/i)).toBeInTheDocument();
  });

  it("renders San Francisco-specific buyer guidance when the city param is present", () => {
    mockSearch = "?persona=robot-team&city=san-francisco";

    render(<Contact />);

    expect(
      screen.getByRole("heading", {
        name: /Frame the San Francisco request for a technical buyer fast\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/San Francisco request lens/i)).toBeInTheDocument();
    expect(
      screen.getByText(/denser buyer and partner channels/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/technical scrutiny/i),
    ).toBeInTheDocument();
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
    fireEvent.change(screen.getByRole("textbox", { name: /What should Blueprint help your team answer first\?/i }), {
      target: { value: "Qualify a tote picking workflow." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Site or facility/i }), {
      target: { value: "Warehouse in Chicago" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Robot or stack/i }), {
      target: { value: "Unitree G1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Send a short brief/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText(/Brief received/i)).toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestSubmitted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
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
      authenticated: false,
    });
  });

  it("submits hosted-session mode with robot-team defaults", async () => {
    mockSearch =
      "?interest=evaluation-package&buyerType=robot_team&source=site-worlds&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam";

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
    fireEvent.click(screen.getByRole("button", { name: /Request hosted evaluation/i }));

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
    expect(screen.getByText(/Hosted evaluation request received/i)).toBeInTheDocument();
  });

  it("tracks a validation failure when required contact fields are missing", async () => {
    render(<Contact />);

    fireEvent.click(screen.getByRole("button", { name: /Send a short brief/i }));

    expect(analyticsEventsMock.contactRequestFailed).toHaveBeenCalledWith({
      stage: "validation",
      errorType: "missing_required_fields",
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
    });
  });
});
