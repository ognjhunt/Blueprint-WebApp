import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PilotExchange from "@/pages/PilotExchange";

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

describe("PilotExchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders the hero and readiness framing", () => {
    render(<PilotExchange />);

    expect(
      screen.getByRole("heading", { name: /Pilot Exchange/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pre-Deployment Qualification Exchange/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/What this is/i)).toBeInTheDocument();
    expect(screen.getByText(/What this is not/i)).toBeInTheDocument();
    expect(screen.getByText(/Site Intake/i)).toBeInTheDocument();
    expect(screen.getByText(/Controlled Pilot Ramp/i)).toBeInTheDocument();
    expect(screen.getByText(/Readiness Funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence Bands/i)).toBeInTheDocument();
    expect(screen.getByText(/Failure Attribution/i)).toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeView).toHaveBeenCalledTimes(1);
    expect(analyticsEventsMock.pilotExchangeChartView).toHaveBeenCalledTimes(3);
  });

  it("switches between Location Briefs and Policy Submissions tabs", () => {
    render(<PilotExchange />);

    expect(
      screen.getByText(/Southeast Grocery Network B/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Policy Submissions/i }));

    expect(screen.getByText(/Humanoid Systems Alpha/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Southeast Grocery Network B/i),
    ).not.toBeInTheDocument();
  });

  it("filters seeded location briefs", () => {
    render(<PilotExchange />);

    fireEvent.change(screen.getByLabelText(/Location type filter/i), {
      target: { value: "Healthcare" },
    });

    expect(
      screen.getByText(/Regional Healthcare Operator F/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Southeast Grocery Network B/i),
    ).not.toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeFilterApply).toHaveBeenCalled();
  });

  it("shows public score summaries and illustrative disclaimer", () => {
    render(<PilotExchange />);

    expect(screen.getByText(/#1 Humanoid Systems Alpha/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Illustrative demo data/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Detailed logs\/videos\/configs remain gated/i),
    ).toBeInTheDocument();
  });

  it("shows an anonymous leaderboard for each location brief", () => {
    render(<PilotExchange />);

    expect(
      screen.getAllByText(/Leaderboard \(anonymous\)/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Anon Team 014/i)).toBeInTheDocument();
    expect(screen.getByText(/Interventions: 6\.2 \/ 100 tasks/i)).toBeInTheDocument();
  });

  it("shows the selected twin leaderboard inside the Run Eval modal", () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getByRole("tab", { name: /Policy Submissions/i }));
    expect(screen.queryByText(/Anon Team 014/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Run Eval/i })[0]);
    fireEvent.change(screen.getByLabelText(/Digital twin/i), {
      target: { value: "brief-001" },
    });

    expect(screen.getByText(/Anon Team 014/i)).toBeInTheDocument();
    expect(screen.getByText(/Win threshold/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety\/SAT:/i)).toBeInTheDocument();
  });

  it("validates required fields for location brief form", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Post Deployment Brief/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Submit Deployment Brief/i }));

    expect(await screen.findByText(/First name is required\./i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("requires new qualification fields in location brief form", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Post Deployment Brief/i })[0]);

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Rivera" } });
    fireEvent.change(screen.getByLabelText(/^Company$/i), { target: { value: "Example Ops" } });
    fireEvent.change(screen.getByLabelText(/Role Title/i), { target: { value: "Ops Lead" } });
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/Budget Range/i), { target: { value: "$50K-$300K" } });

    fireEvent.change(screen.getByLabelText(/Location Type/i), { target: { value: "Grocery" } });
    fireEvent.change(screen.getByLabelText(/Robot Embodiment/i), { target: { value: "Humanoid" } });
    fireEvent.change(screen.getByLabelText(/Target Timeline/i), { target: { value: "90 days" } });
    fireEvent.change(screen.getByLabelText(/Privacy Mode/i), { target: { value: "Anonymized" } });

    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: "US Southeast" } });
    fireEvent.change(screen.getByLabelText(/Deployment Objective/i), { target: { value: "Shelf facing" } });
    fireEvent.change(screen.getByLabelText(/Evaluation Goal/i), { target: { value: "Rank top vendors" } });

    fireEvent.click(screen.getByRole("button", { name: /Submit Deployment Brief/i }));

    expect(
      await screen.findByText(/Complete all required location brief fields before submitting\./i),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits policy intake with expected payload and helpWith value", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Run Eval/i })[0]);

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
    expect(analyticsEventsMock.pilotExchangeSubmitPolicy).toHaveBeenCalledWith("success");
  });

  it("tracks readiness gate and FAQ interactions", () => {
    render(<PilotExchange />);

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

  it("includes Pilot Exchange lead labels in admin mappings", () => {
    const adminPath = path.resolve(
      process.cwd(),
      "client/src/pages/AdminLeads.tsx",
    );
    const source = fs.readFileSync(adminPath, "utf-8");

    expect(source).toContain(
      '"pilot-exchange-location-brief": "Pilot Exchange: Location Brief"',
    );
    expect(source).toContain(
      '"pilot-exchange-policy-submission": "Pilot Exchange: Policy Submission"',
    );
    expect(source).toContain(
      '"pilot-exchange-data-licensing": "Pilot Exchange: Data Licensing"',
    );
  });

  it("keeps primary CTAs usable on mobile viewport widths", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
    });
    window.dispatchEvent(new Event("resize"));

    render(<PilotExchange />);

    expect(
      screen.getAllByRole("button", { name: /Post Deployment Brief/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Run Eval/i })[0],
    ).toBeInTheDocument();
  });

  it("supports keyboard focus across primary CTA buttons", () => {
    render(<PilotExchange />);

    const postBriefButton = screen.getAllByRole("button", {
      name: /Post Deployment Brief/i,
    })[0];
    const submitPolicyButton = screen.getAllByRole("button", {
      name: /Run Eval/i,
    })[0];
    const dataLicensingButton = screen.getAllByRole("button", {
      name: /Request Data Licensing/i,
    })[0];

    postBriefButton.focus();
    expect(postBriefButton).toHaveFocus();

    submitPolicyButton.focus();
    expect(submitPolicyButton).toHaveFocus();

    dataLicensingButton.focus();
    expect(dataLicensingButton).toHaveFocus();
  });
});
