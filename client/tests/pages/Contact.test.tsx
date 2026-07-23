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
      screen.getByRole("heading", { name: /Tell us what policies to compare\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/We scope one Policy Shortlist campaign/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compare policies on a real site\./i })).toHaveAttribute(
      "href",
      "/contact/robot-team#contact-intake",
    );
    // The operator lane is demoted to a low-emphasis reachable link, but stays
    // reachable at the same site-operator intake href.
    expect(
      screen.getByRole("link", { name: /Partner on lighthouse capture access/i }),
    ).toHaveAttribute("href", "/contact/site-operator#contact-intake");
    expect(screen.getByRole("textbox", { name: /^Name$/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Robot team \/ company/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send message/i })).toBeInTheDocument();
    expect(screen.queryByText(/Site data package/i)).not.toBeInTheDocument();
  });

  it("maps old world-model query params to the Policy Improvement Run form", () => {
    mockSearch =
      "?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-world-detail&siteName=Harborview+Grocery+Distribution+Annex&targetSiteType=Grocery+distribution&requestedOutputs=Runtime+manifest+and+proof+packet&targetRobotTeam=Unitree+G1";

    render(<Contact />);

    // buyerType=robot_team keeps the persona on the robot-team branch, so the
    // heading/subhead are identical to the default robot-team flow above —
    // there is no separate "Policy Improvement Run" heading in the current
    // component, and the prefilled siteName/targetRobotTeam values are parsed
    // but never wired into any form field's value.
    expect(
      screen.getByRole("heading", { name: /Tell us what policies to compare\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/We scope one Policy Shortlist campaign/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Harborview Grocery Distribution Annex")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Unitree G1")).not.toBeInTheDocument();
  });

  it("submits a robot-team Policy Evaluation Run payload", async () => {
    render(<Contact />);

    fireEvent.change(screen.getByRole("textbox", { name: /^Name$/i }), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Robot team \/ company/i }), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Work email/i }), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /About the task/i }), {
      target: { value: "Tote transfer. Need a clear winner before field time." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));

    // The current Contact form is a mock submit with no backend — it does not
    // call fetch, and instead flips local state to show a confirmation panel.
    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/inbound-request",
      expect.anything(),
    );

    expect(
      await screen.findByText(/Message received\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We will check the task, scope the comparison, and return a priced run plan/i),
    ).toBeInTheDocument();
  });

  it("site-operator contact path keeps the low-cost access-boundary lane visible", () => {
    mockLocation = "/contact/site-operator";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Find robot teams for your site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Start a \$5,000 Robot Match — we compare compatible robot teams on your captured site/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Name$/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Organization/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Partner on lighthouse capture access/i)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send message/i })).toBeInTheDocument();
  });
});
