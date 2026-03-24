import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockSearch = "";

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
  };
});

beforeEach(() => {
  mockSearch = "";
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

describe("Contact page", () => {
  it("renders the default robot-team intake", () => {
    render(<Contact />);

    expect(
      screen.getByRole("heading", {
        name: /Tell us what your team needs and we will point you to the right next step\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/For Robot Teams/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What happens after you send this/i)).toBeInTheDocument();
    expect(screen.getByText(/Prefer email\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /Proof/i })).toHaveAttribute("href", "/proof");
    expect(screen.queryByText(/Buyer type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested lanes/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/What do you need\?/i)).toBeInTheDocument();
  });

  it("renders a compact hosted-session mode with prefilled robot-team data", () => {
    mockSearch =
      "?interest=evaluation-package&buyerType=robot_team&source=site-worlds&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam";

    render(<Contact />);

    expect(
      screen.getByRole("heading", { name: /Request a hosted evaluation for this site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Walk to shelf staging and pick the blue tote")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unitree G1 with head cam and wrist cam")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request hosted evaluation/i })).toBeInTheDocument();

    expect(screen.queryByText(/Buyer type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested lanes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Access rules/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Privacy and security notes/i)).not.toBeInTheDocument();
  });

  it("submits the default robot-team request when required fields are filled", async () => {
    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company name*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Describe the evaluation, package, workflow, or deployment question you need help with.*"),
      {
        target: { value: "Qualify a tote picking workflow." },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: /Send request/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText(/Robot-team inquiry received/i)).toBeInTheDocument();
  });

  it("submits hosted-session mode with robot-team defaults", async () => {
    mockSearch =
      "?interest=evaluation-package&buyerType=robot_team&source=site-worlds&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam";

    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company name*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request hosted evaluation/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const submitCall = vi.mocked(global.fetch).mock.calls.find(
      ([input]) => input === "/api/inbound-request",
    );
    const body = JSON.parse(String(submitCall?.[1]?.body));
    expect(body.buyerType).toBe("robot_team");
    expect(body.requestedLanes).toEqual(["deeper_evaluation"]);
    expect(body.budgetBucket).toBe("Undecided/Unsure");
    expect(body.siteName).toBe("Harborview Grocery Distribution Annex");
    expect(screen.getByText(/Hosted evaluation request received/i)).toBeInTheDocument();
  });
});
