import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PilotExchange from "@/pages/PilotExchange";

const EVAL_ACCESS_STORAGE_KEY = "bp_exchange_eval_access_v1";
const SUBSCRIPTION_ACCESS_STORAGE_KEY = "bp_exchange_subscription_access_v1";

const analyticsEventsMock = vi.hoisted(() => ({
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
}));

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

function openEvalFlow() {
  fireEvent.click(screen.getAllByRole("button", { name: /Check this site/i })[0]);
}

function fillEvalForm() {
  fireEvent.change(screen.getAllByRole("combobox")[0], {
    target: { value: "brief-001" },
  });

  const textboxes = screen.getAllByRole("textbox");

  fireEvent.change(screen.getByPlaceholderText(/aisle-reset-v2/i), {
    target: { value: "humanoid-night-v1" },
  });

  fireEvent.change(screen.getByPlaceholderText(/docker:\/\/ghcr\.io/i), {
    target: { value: "docker://ghcr.io/evalrobotics/humanoid-night:v1" },
  });

  fireEvent.change(screen.getByPlaceholderText(/Describe APIs, topics, or events used/i), {
    target: { value: "ROS 2 action API + WMS webhook" },
  });

  fireEvent.change(screen.getByPlaceholderText(/How your system handles blocks or failures/i), {
    target: { value: "Safe stop, alert operator, retry once" },
  });

  fireEvent.change(screen.getByPlaceholderText(/Hours, traffic assumptions, speed limits/i), {
    target: { value: "Night shift only, no freezer aisles" },
  });

  fireEvent.change(textboxes[5], {
    target: { value: "Taylor Chen" },
  });

  fireEvent.change(textboxes[6], {
    target: { value: "taylor@evalrobotics.ai" },
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

  it("renders site opportunities framing", () => {
    render(<PilotExchange />);

    expect(
      screen.getByRole("heading", { name: /Site opportunities for robot teams\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/These are sites and workflows Blueprint has already captured and packaged\./i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /See Pricing/i })[0]).toHaveAttribute("href", "#pricing");
    expect(screen.getByRole("link", { name: /See how site opportunities work/i })).toHaveAttribute(
      "href",
      "/qualified-opportunities-guide",
    );
    expect(analyticsEventsMock.pilotExchangeView).toHaveBeenCalledTimes(1);
  });

  it("switches tabs and applies filters", () => {
    render(<PilotExchange />);

    expect(screen.getByText(/Southeast Grocery Network B/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filter results/i }));
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Healthcare" },
    });

    expect(screen.getByText(/Regional Healthcare Operator F/i)).toBeInTheDocument();
    expect(screen.queryByText(/Southeast Grocery Network B/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Team results/i }));
    expect(screen.getByRole("tab", { name: /Team results/i })).toBeInTheDocument();
  });

  it("shows pricing inline and opens evaluation directly", () => {
    render(<PilotExchange />);

    expect(screen.getByRole("heading", { name: /Pay for the job you need\./i })).toBeInTheDocument();
    expect(screen.getByText(/Pay for the next layer/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^World Models$/i })).toBeInTheDocument();
    expect(screen.getByText(/Buy site-specific world models of real indoor locations/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Simulation Access/i })).toBeInTheDocument();
    expect(screen.getByText(/Private site terms are custom\./i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Review this site/i })[0]);

    expect(screen.getByRole("heading", { name: /Check a qualified site/i })).toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeOpenPolicyForm).toHaveBeenCalledTimes(1);
  });

  it("shows anonymous leaderboard metrics in location briefs", () => {
    render(<PilotExchange />);

    expect(screen.getAllByText(/Top teams/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Anon Team 014/i)).toBeInTheDocument();
    expect(screen.getByText(/87%/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\(\+5%\)/i).length).toBeGreaterThan(0);
  });

  it("validates form fields before submission when unlocked", async () => {
    seedEvalAccess();
    render(<PilotExchange />);

    openEvalFlow();
    fireEvent.click(screen.getByRole("button", { name: /Submit check/i }));

    expect(await screen.findByText(/Select a qualified site\./i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits eval intake payload with qualification fields", async () => {
    seedEvalAccess();
    render(<PilotExchange />);

    openEvalFlow();
    fillEvalForm();
    fireEvent.click(screen.getByRole("button", { name: /Submit check/i }));

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
    expect(details.briefId).toBe("brief-001");
    expect(details.policy.name).toBe("humanoid-night-v1");
    expect(analyticsEventsMock.pilotExchangeSubmitPolicy).toHaveBeenCalledWith("success");
  });

  it("submits successfully even when subscription access is active", async () => {
    seedEvalAccess();
    window.localStorage.setItem(SUBSCRIPTION_ACCESS_STORAGE_KEY, "true");
    render(<PilotExchange />);

    openEvalFlow();
    fillEvalForm();
    fireEvent.click(screen.getByRole("button", { name: /Submit check/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body as string);
    const details = JSON.parse(payload.details as string);

    expect(payload.helpWith).toEqual(["pilot-exchange-policy-submission"]);
    expect(details.policy.uri).toBe("docker://ghcr.io/evalrobotics/humanoid-night:v1");
  });
});
