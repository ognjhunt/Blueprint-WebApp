import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PilotExchangeGuide from "@/pages/PilotExchangeGuide";

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

describe("PilotExchangeGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders beginner framing, gates, and charts", () => {
    render(<PilotExchangeGuide />);

    expect(
      screen.getByRole("heading", { name: /What Pilot Exchange Is and How It Works/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What this is/i)).toBeInTheDocument();
    expect(screen.getByText(/What this is not/i)).toBeInTheDocument();
    expect(screen.getByText(/Site Intake/i)).toBeInTheDocument();
    expect(screen.getByText(/Controlled Pilot Ramp/i)).toBeInTheDocument();

    expect(screen.getByText(/Readiness Funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence Bands/i)).toBeInTheDocument();
    expect(screen.getByText(/Failure Attribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Monetization Mix/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Illustrative demo data/i).length).toBeGreaterThan(0);
    expect(analyticsEventsMock.pilotExchangeView).toHaveBeenCalledTimes(1);
    expect(analyticsEventsMock.pilotExchangeChartView).toHaveBeenCalledTimes(4);
  });

  it("tracks gate and faq interactions", () => {
    render(<PilotExchangeGuide />);

    fireEvent.click(screen.getByRole("button", { name: /Real-to-Sim Activation/i }));
    expect(analyticsEventsMock.pilotExchangeSelectReadinessGate).toHaveBeenCalledWith(
      "Real-to-Sim Activation",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Is this simulation-only, or do you still test in the real world\?/i,
      }),
    );
    expect(analyticsEventsMock.pilotExchangeOpenFaq).toHaveBeenCalledWith("faq-01");
  });

  it("shows clear ownership and payment sections", () => {
    render(<PilotExchangeGuide />);

    expect(screen.getByText(/Who Pays for What/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Site Scan \(Shared Model\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Robotics Team Subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/Training Access/i)).toBeInTheDocument();
    expect(screen.getByText(/Ownership Options/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared Twin \(Default\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Private Twin Buyout/i)).toBeInTheDocument();
  });

  it("explains practical training workflow with concrete step details", () => {
    render(<PilotExchangeGuide />);

    expect(screen.getByText(/How Training Runs in Practice/i)).toBeInTheDocument();
    expect(screen.getByText(/Deliver SimReady Site Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit Robot Policy Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Training Loops/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply Robustification/i)).toBeInTheDocument();
    expect(screen.getByText(/Score with Standardized Eval/i)).toBeInTheDocument();

    expect(screen.getByText(/USD stage \(facility\) \+ SimReady assets/i)).toBeInTheDocument();
    expect(screen.getByText(/container package that includes policy \+ training code/i)).toBeInTheDocument();
    expect(screen.getByText(/Imitation learning from teleop\/planning demonstrations/i)).toBeInTheDocument();
    expect(screen.getByText(/Fault injection: network latency, sensor dropouts/i)).toBeInTheDocument();
    expect(screen.getByText(/Success rate by task and recovery rate after failures/i)).toBeInTheDocument();
  });
});
