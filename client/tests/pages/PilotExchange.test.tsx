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

  it("validates required fields for location brief form", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Post Deployment Brief/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Submit Deployment Brief/i }));

    expect(await screen.findByText(/First name is required\./i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits policy intake with the expected helpWith value", async () => {
    render(<PilotExchange />);

    fireEvent.click(screen.getAllByRole("button", { name: /Submit Policy for Eval/i })[0]);

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "Taylor" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Chen" },
    });
    fireEvent.change(screen.getByLabelText(/Company/i), {
      target: { value: "Eval Robotics" },
    });
    fireEvent.change(screen.getByLabelText(/Role Title/i), {
      target: { value: "Deployment Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/Work Email/i), {
      target: { value: "taylor@evalrobotics.ai" },
    });
    fireEvent.change(screen.getByLabelText(/Budget Range/i), {
      target: { value: "$50K-$300K" },
    });
    fireEvent.change(screen.getByLabelText(/Target Location Type/i), {
      target: { value: "Warehouse" },
    });
    fireEvent.change(screen.getByLabelText(/Robot Embodiment/i), {
      target: { value: "AMR + Arm" },
    });
    fireEvent.change(screen.getByLabelText(/Deployment Timeline/i), {
      target: { value: "60 days" },
    });
    fireEvent.change(screen.getByLabelText(/Privacy Preference/i), {
      target: { value: "Anonymized" },
    });
    fireEvent.change(screen.getByLabelText(/Policy \/ Stack Name/i), {
      target: { value: "stack-v3.1" },
    });
    fireEvent.change(screen.getByLabelText(/Benchmark Evidence/i), {
      target: { value: "Ran 1,000 eval episodes with low collision rates." },
    });
    fireEvent.change(screen.getByLabelText(/Deployment Summary/i), {
      target: { value: "Ready for warehouse tote induction pilots." },
    });

    const submitButtons = screen.getAllByRole("button", {
      name: /Submit Policy for Eval/i,
    });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body as string);

    expect(payload.helpWith).toEqual(["pilot-exchange-policy-submission"]);
    expect(payload.details).toContain('"submissionType":"policy-submission"');
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
      screen.getAllByRole("button", { name: /Submit Policy for Eval/i })[0],
    ).toBeInTheDocument();
  });

  it("supports keyboard focus across primary CTA buttons", () => {
    render(<PilotExchange />);

    const postBriefButton = screen.getAllByRole("button", {
      name: /Post Deployment Brief/i,
    })[0];
    const submitPolicyButton = screen.getAllByRole("button", {
      name: /Submit Policy for Eval/i,
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
