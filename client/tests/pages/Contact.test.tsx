import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockSearch = "";
let mockLocation = "/contact";
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
    useLocation: () => [mockLocation, vi.fn()],
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
  mockLocation = "/contact";
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

function submittedBody() {
  const submitCall = vi.mocked(global.fetch).mock.calls.find(
    ([input]) => input === "/api/inbound-request",
  );
  return JSON.parse(String(submitCall?.[1]?.body));
}

describe("Contact page", () => {
  it("renders the simple robot-team Policy Evaluation Run flow", () => {
    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Tell us what to test\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/We will recommend the right subscription or quick-look path/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Robot team/i })).toHaveAttribute(
      "href",
      "/contact/robot-team#contact-intake",
    );
    expect(screen.getByRole("link", { name: /Site owner/i })).toHaveAttribute(
      "href",
      "/contact/site-operator#contact-intake",
    );
    expect(screen.getByRole("textbox", { name: /Robot \/ policy name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Target site or site type/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request evaluation/i })).toBeInTheDocument();
    expect(screen.queryByText(/Site data package/i)).not.toBeInTheDocument();
  });

  it("maps old world-model query params to the Policy Improvement Run form", () => {
    mockSearch =
      "?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-world-detail&siteName=Harborview+Grocery+Distribution+Annex&targetSiteType=Grocery+distribution&requestedOutputs=Runtime+manifest+and+proof+packet&targetRobotTeam=Unitree+G1";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Improve a policy\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Start with the failures worth fixing/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Harborview Grocery Distribution Annex")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unitree G1")).toBeInTheDocument();
  });

  it("submits a robot-team Policy Evaluation Run payload", async () => {
    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Robot \/ policy name/i }), {
      target: { value: "Unitree G1 policy API" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Target site or site type/i }), {
      target: { value: "Warehouse in Chicago" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Task \+ threshold/i }), {
      target: { value: "Tote transfer. Need a clear winner before field time." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add optional details/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /Policy \/ checkpoint labels/i }), {
      target: { value: "policy_v1, policy_v2" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Preferred policy access method/i }), {
      target: { value: "Policy API endpoint" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Episode count/i }), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Validation mode/i }), {
      target: { value: "Comparative policy eval" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Observation schema/i }), {
      target: { value: "RGB-D and robot state" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Action schema/i }), {
      target: { value: "base, arm, gripper" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Control frequency/i }), {
      target: { value: "20 Hz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request evaluation/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(
      await screen.findByText(/Policy Evaluation Run request received/i),
    ).toBeInTheDocument();
    const body = submittedBody();
    expect(body).toMatchObject({
      buyerType: "robot_team",
      commercialRequestPath: "hosted_evaluation",
      requestedLanes: ["deeper_evaluation"],
      proofPathPreference: "exact_site_required",
      siteName: "Warehouse in Chicago",
      targetSiteType: "Warehouse in Chicago",
      taskStatement: "Tote transfer. Need a clear winner before field time.",
      targetRobotTeam: "Unitree G1 policy API",
    });
    expect(body.details).toContain("Policy/checkpoint labels: policy_v1, policy_v2");
    expect(body.details).toContain("Policy access method: Policy API endpoint");
    expect(body.details).toContain("Episode count: 500");
    expect(body.details).toContain("Validation mode: Comparative policy eval");
    expect(body.realSiteRobotEvalFit).toMatchObject({
      scenarioCardInput: {
        normalScenario: "500 requested policy-evaluation episodes",
      },
      evalCardInput: {
        robotOrPolicyTested: "Unitree G1 policy API",
        preferredReviewPath: "Policy API endpoint",
      },
    });
  });

  it("site-operator contact path keeps the low-cost access-boundary lane visible", () => {
    mockLocation = "/contact/site-operator";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Share a place to test robots\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Start a \$5,000\/site supply review or scope separate yearly monitoring\. You control access/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Facility name or site type/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /City \/ location/i })).toBeInTheDocument();
    expect(screen.getByText(/Ask before each robot-team use/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start site review/i })).toBeInTheDocument();
  });
});
