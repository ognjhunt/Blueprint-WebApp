import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PilotExchangeGuide from "@/pages/PilotExchangeGuide";

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

describe("PilotExchangeGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders beginner framing, gates, and charts", () => {
    render(<PilotExchangeGuide />);

    expect(
      screen.getByRole("heading", { name: /How qualified opportunities work/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Why This Matters/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Why pre-deployment qualification matters more in humanoids/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Broad robotics already has scale\. Humanoid programs are attracting capital faster than they are producing reliable, repeatable rollouts\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What this is$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What this is NOT$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site Intake/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Controlled Pilot Ramp/i })).toBeInTheDocument();

    expect(screen.getByText(/Readiness Funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/Task Confidence Bands/i)).toBeInTheDocument();
    expect(screen.getByText(/Why Pilots Fail \(Attribution\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Who Pays for What\?/i)).toBeInTheDocument();

    expect(screen.getByText(/Illustrative metrics/i)).toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeView).toHaveBeenCalledTimes(1);
    expect(analyticsEventsMock.pilotExchangeChartView).toHaveBeenCalledTimes(4);
  });

  it("shows faq interactions", () => {
    render(<PilotExchangeGuide />);

    const faqButton = screen.getByRole("button", {
      name: /Is this simulation-only, or do you still test in the real world\?/i,
    });

    fireEvent.click(faqButton);
    expect(faqButton).toHaveAttribute("data-state", "open");
  });

  it("shows clear ownership and payment sections", () => {
    render(<PilotExchangeGuide />);

    expect(screen.getByText(/Who Pays for What/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted Record \(Default\)/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Readiness Pack/i })).toBeInTheDocument();
    expect(screen.getByText(/Technical Evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Deployment Prep \/ Managed Tuning/i)).toBeInTheDocument();
    expect(screen.getByText(/Ownership Options/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted Record \(Default\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Private Access Terms \(Paid\)/i)).toBeInTheDocument();
  });

  it("explains practical training workflow with concrete step details", () => {
    render(<PilotExchangeGuide />);

    expect(screen.getByText(/How Managed Evaluation Runs in Practice/i)).toBeInTheDocument();
    expect(screen.getByText(/We Deliver the Evaluation Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit Robot Policy Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Training Loops/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply Robustification/i)).toBeInTheDocument();
    expect(screen.getByText(/Score with Standardized Eval/i)).toBeInTheDocument();

    expect(screen.getByText(/preview assets and downstream package/i)).toBeInTheDocument();
    expect(screen.getByText(/Container package that includes policy \+ training code/i)).toBeInTheDocument();
    expect(screen.getByText(/Imitation learning from teleop\/planning demonstrations in simulation/i)).toBeInTheDocument();
    expect(screen.getByText(/Fault injection: network latency, sensor dropouts, blocked paths, and missing items/i)).toBeInTheDocument();
    expect(screen.getByText(/Success rate by task and recovery rate after failures/i)).toBeInTheDocument();
  });
});
