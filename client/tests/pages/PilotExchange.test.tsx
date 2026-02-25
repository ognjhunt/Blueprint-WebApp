import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PilotExchange from "@/pages/PilotExchange";

const EVAL_ACCESS_STORAGE_KEY = "bp_exchange_eval_access_v1";
const SUBSCRIPTION_ACCESS_STORAGE_KEY = "bp_exchange_subscription_access_v1";

const analyticsEventsMock = {
  pilotExchangeView: vi.fn(),
  pilotExchangeFilterApply: vi.fn(),
  pilotExchangeOpenBriefForm: vi.fn(),
  pilotExchangeSubmitBrief: vi.fn(),
  pilotExchangeOpenPolicyForm: vi.fn(),
  pilotExchangeSubmitPolicy: vi.fn(),
  pilotExchangeSubmitDataLicenseRequest: vi.fn(),
  pilotExchangeSelectReadinessGate: vi.fn(),
  pilotExchangeOpenFaq: vi.fn(),
  pilotExchangeChartView: vi.fn(),
};

vi.mock("@/components/Analytics", () => ({
  analyticsEvents: analyticsEventsMock,
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: vi.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "test-csrf-token",
  })),
}));

function seedEvalAccess() {
  window.localStorage.setItem(EVAL_ACCESS_STORAGE_KEY, "true");
}

function fillEvalForm() {
  fireEvent.change(screen.getByLabelText(/Digital twin/i), {
    target: { value: "brief-001" },
  });

  fireEvent.change(screen.getByLabelText(/Robot policy package name/i), {
    target: { value: "humanoid-night-v1" },
  });

  fireEvent.change(screen.getByLabelText(/URL \/ endpoint/i), {
    target: { value: "docker://ghcr.io/evalrobotics/humanoid-night:v1" },
  });

  fireEvent.change(screen.getByLabelText(/Interface Contract/i), {
    target: { value: "ROS 2 action API + WMS webhook" },
  });

  fireEvent.change(screen.getByLabelText(/Fallback Strategy/i), {
    target: { value: "Safe stop, alert operator, retry once" },
  });

  fireEvent.change(screen.getByLabelText(/Assumed Operating Envelope/i), {
    target: { value: "Night shift only, no freezer aisles" },
  });

  fireEvent.change(screen.getByLabelText(/Work email/i), {
    target: { value: "taylor@evalrobotics.ai" },
  });

  fireEvent.change(screen.getByLabelText(/Full name/i), {
    target: { value: "Taylor Chen" },
  });
}

describe("PilotExchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          requestId: "req-001",
          status: "new",
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders marketplace framing with paywall notice", () => {
    render(<PilotExchange />);

    expect(
      screen.getByRole("heading", { name: /Pilot Exchange Marketplace/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Robotics Teams Only/i)).toBeInTheDocument();
    expect(screen.getByText(/Eval submission is barred until purchase/i)).toBeInTheDocument();
    expect(screen.getByText(/What the Paid Access Actually Includes/i)).toBeInTheDocument();
    expect(screen.getByText(/Training Subscription Features/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pilot Exchange Guide/i })).toHaveAttribute(
      "href",
      "/pilot-exchange-guide",
    );
    expect(analyticsEventsMock.pilotExchangeView).toHaveBeenCalledTimes(1);
  });

  it("switches tabs and applies filters", () => {
    render(<PilotExchange />);

    expect(screen.getByText(/Southeast Grocery Network B/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Location type filter/i), {
      target: { value: "Healthcare" },
    });

    expect(screen.getByText(/Regional Healthcare Operator F/i)).toBeInTheDocument();
    expect(screen.queryByText(/Southeast Grocery Network B/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Policy Submissions/i }));
    expect(screen.getByText(/CareFlow Automation/i)).toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeFilterApply).toHaveBeenCalled();
  });

  it("opens pricing dialog when evaluation access is locked", () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Unlock Evaluation Access/i })[0]);

    expect(screen.getByRole("heading", { name: /Unlock Exchange Access/i })).toBeInTheDocument();
    expect(screen.getByText(/Robotics Team Subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/Pro Site Evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Training Subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/Ownership policy \(simple\)/i)).toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeOpenPolicyForm).not.toHaveBeenCalled();
  });

  it("shows anonymous leaderboard metrics in location briefs", () => {
    render(<PilotExchange />);

    expect(screen.getAllByText(/Leaderboard \(anonymous\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Anon Team 014/i)).toBeInTheDocument();
    expect(screen.getByText(/Interventions: 6\.2 \/ 100 tasks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Integration: Passed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Safety\/SAT: Ready/i).length).toBeGreaterThan(0);
  });

  it("validates form fields before submission when unlocked", async () => {
    seedEvalAccess();
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /^Run Eval$/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Run eval$/i }));

    expect(await screen.findByText(/Select a digital twin to run against\./i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits eval intake payload with qualification fields", async () => {
    seedEvalAccess();
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /^Run Eval$/i })[0]);
    fillEvalForm();
    fireEvent.click(screen.getByRole("button", { name: /^Run eval$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body as string);
    const details = JSON.parse(payload.details as string);

    expect(payload.helpWith).toEqual(["pilot-exchange-policy-submission"]);
    expect(details.interfaceContract).toBe("ROS 2 action API + WMS webhook");
    expect(details.fallbackStrategy).toBe("Safe stop, alert operator, retry once");
    expect(details.assumedOperatingEnvelope).toBe("Night shift only, no freezer aisles");
    expect(details.accessTier).toBe("pro-evaluation");
    expect(analyticsEventsMock.pilotExchangeSubmitPolicy).toHaveBeenCalledWith("success");
  });

  it("uses team-subscription access tier when subscription is active", async () => {
    seedEvalAccess();
    window.localStorage.setItem(SUBSCRIPTION_ACCESS_STORAGE_KEY, "true");
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /^Run Eval$/i })[0]);
    fillEvalForm();
    fireEvent.click(screen.getByRole("button", { name: /^Run eval$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body as string);
    const details = JSON.parse(payload.details as string);

    expect(details.accessTier).toBe("team-subscription");
  });
});
