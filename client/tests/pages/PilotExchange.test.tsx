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

  it("renders the hero and eval-first framing", () => {
    render(<PilotExchange />);

    expect(
      screen.getByRole("heading", { name: /Pilot Exchange/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Eval-First Marketplace/i),
    ).toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeView).toHaveBeenCalledTimes(1);
  });

  it("switches between Location Briefs and Policy Submissions tabs", () => {
    render(<PilotExchange />);

    expect(
      screen.getByText(/Midwest Fulfillment Operator A/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Policy Submissions/i }));

    expect(screen.getByText(/Lab Collective 17/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Midwest Fulfillment Operator A/i),
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
      screen.queryByText(/Midwest Fulfillment Operator A/i),
    ).not.toBeInTheDocument();
    expect(analyticsEventsMock.pilotExchangeFilterApply).toHaveBeenCalled();
  });

  it("shows public score summaries and gated detail badge", () => {
    render(<PilotExchange />);

    expect(screen.getByText(/#1 Factory Motion Labs/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Detailed logs\/videos\/configs are gated/i),
    ).toBeInTheDocument();
  });

  it("shows an anonymous leaderboard for each location brief", () => {
    render(<PilotExchange />);

    expect(
      screen.getAllByText(/Leaderboard \(anonymous\)/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Anon Team 014/i)).toBeInTheDocument();
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
  });

  it("validates required fields for location brief form", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Post Deployment Brief/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Submit Deployment Brief/i }));

    expect(await screen.findByText(/First name is required\./i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits policy intake with the expected helpWith value", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Run Eval/i })[0]);

    fireEvent.change(screen.getByLabelText(/Digital twin/i), {
      target: { value: "brief-001" },
    });

    fireEvent.change(screen.getByLabelText(/Policy name/i), {
      target: { value: "stack-v3.1" },
    });
    fireEvent.change(screen.getByLabelText(/URL \\/ endpoint/i), {
      target: { value: "docker://ghcr.io/evalrobotics/stack:v3.1" },
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

    expect(payload.helpWith).toEqual(["pilot-exchange-policy-submission"]);
    expect(payload.details).toContain('"submissionType":"eval-run"');
    expect(analyticsEventsMock.pilotExchangeSubmitPolicy).toHaveBeenCalledWith("success");
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
