import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockSearch = "";
const analyticsEventsMock = vi.hoisted(() => ({
  contactRequestStarted: vi.fn(),
  contactRequestSubmitted: vi.fn(),
  contactRequestCompleted: vi.fn(),
  contactRequestFailed: vi.fn(),
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

beforeEach(() => {
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
    expect(screen.getByText(/Prefer a lighter first step\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /How it works/i })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: /Sample deliverables/i })).toHaveAttribute("href", "/sample-deliverables");
    expect(screen.queryByText(/Buyer type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested lanes/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Immediate workflow question/i }),
    ).toBeInTheDocument();
    expect(analyticsEventsMock.contactRequestStarted).toHaveBeenCalledWith({
      persona: "robot_team",
      hostedMode: false,
      requestedLane: "deeper_evaluation",
      authenticated: false,
      prefilledSiteContext: false,
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

    expect(screen.queryByText(/Buyer type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested lanes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Access rules/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Privacy and security notes/i)).not.toBeInTheDocument();
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
      screen.getByText(/Texas Robotics, a founder intro, a university contact, or an industrial partner/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore world models/i })).toHaveAttribute(
      "href",
      "/world-models?city=austin",
    );
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
      screen.getByText(/exact-site requirement versus an adjacent-site proof path/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/async artifact review matters to the buyer/i),
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
    fireEvent.change(screen.getByRole("textbox", { name: /Immediate workflow question/i }), {
      target: { value: "Qualify a tote picking workflow." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Target site type/i }), {
      target: { value: "Warehouse" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Proof path/i }), {
      target: { value: "exact_site_required" },
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
      hasSiteName: false,
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
    fireEvent.change(screen.getByRole("textbox", { name: /Target site type/i }), {
      target: { value: "Warehouse" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Proof path/i }), {
      target: { value: "exact_site_required" },
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
