import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockSearch = "";
let mockLocation = "/contact";
const setLocationMock = vi.hoisted(() => vi.fn());
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
    useLocation: () => [mockLocation, setLocationMock],
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
  it("renders the robot-team Task Evaluation Run flow", () => {
    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Start before the first onsite visit\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tell us what your robot can do/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Test a captured site task\./i })).toHaveAttribute(
      "href",
      "/contact/robot-team#contact-intake",
    );
    expect(
      screen.getByRole("link", { name: /Operate a site\? Submit one workflow for screening/i }),
    ).toHaveAttribute("href", "/contact/site-operator#contact-intake");
    expect(screen.getByRole("textbox", { name: /^Name$/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Robot team \/ company/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prepare deployment/i })).toBeInTheDocument();
    expect(screen.queryByText(/Site data package/i)).not.toBeInTheDocument();
  });

  it("maps old world-model query params to the same Task Evaluation Run form", () => {
    mockSearch =
      "?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-world-detail&siteName=Harborview+Grocery+Distribution+Annex&targetSiteType=Grocery+distribution&requestedOutputs=Runtime+manifest+and+proof+packet&targetRobotTeam=Unitree+G1";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Start before the first onsite visit\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/missing months 0–2 inputs/i)).toBeInTheDocument();
    expect(screen.queryByText(/Policy Improvement Run/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Harborview Grocery Distribution Annex")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Unitree G1")).not.toBeInTheDocument();
  });

  it("submits a robot-team Task Evaluation Run contact request", async () => {
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
    fireEvent.change(screen.getByRole("textbox", { name: /About the workflow/i }), {
      target: { value: "Tote transfer. Decide whether field time is justified." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Prepare deployment/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({ method: "POST" }),
    ));

    expect(
      await screen.findByText(/Message received\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We will check the task, decision, thresholds, evidence, and constraints/i),
    ).toBeInTheDocument();
  });

  it("site-operator contact path uses the same Task Evaluation Run", () => {
    mockLocation = "/contact/site-operator";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Show us the job before you choose the robot\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/short workflow description, phone video/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Name$/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Organization/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Submit one workflow for screening/i)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prepare deployment/i })).toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });

  it("routes the site-operator pilot option into the secure structured dossier", () => {
    mockLocation = "/contact/site-operator";
    mockSearch = "?intent=pilot-opportunity";

    render(<Contact />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Name$/i }), {
      target: { value: "Jordan Lee" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Work email/i }), {
      target: { value: "jordan@siteco.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Organization/i }), {
      target: { value: "SiteCo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to secure dossier/i }));

    expect(setLocationMock).toHaveBeenCalledWith(
      "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=site-operator-contact",
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
