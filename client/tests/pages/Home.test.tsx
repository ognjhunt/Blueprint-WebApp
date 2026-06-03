import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/pages/Home";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    tokenClaims: null,
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePublicLaunchStatus", () => ({
  usePublicLaunchStatus: () => ({
    data: {
      ok: true,
      supportedCities: [
        { city: "Austin", stateCode: "TX", displayName: "Austin, TX", citySlug: "austin-tx" },
        {
          city: "San Francisco",
          stateCode: "CA",
          displayName: "San Francisco, CA",
          citySlug: "san-francisco-ca",
        },
      ],
      currentCity: null,
    },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/lib/experiments", () => ({
  resolveExperimentVariant: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(() => new Promise(() => {})),
}));

describe("Home", () => {
  it("renders the preserved hero and commercial product path", { timeout: 10000 }, () => {
    window.localStorage.clear();
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Site-specific robot deployment readiness\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /required success rate, cycle time, intervention rate, and safety threshold/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Request readiness evaluation/i })[0],
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(
      Array.from(container.querySelectorAll("[data-home-section]"))
        .map((node) => node.getAttribute("data-home-section"))
        .slice(0, 3),
    ).toEqual(["hero", "exact-site-preview", "category-validation"]);
    expect(
      screen.getByRole("heading", { name: /Choose a site task\. Set the pass bar\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Evidence-backed advisory/i)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Request readiness evaluation/i })
        .some((link) => link.getAttribute("href")?.includes("/contact?persona=robot-team")),
    ).toBe(true);
    expect(screen.getByRole("heading", { name: /Blueprint sells pre-pilot readiness evidence, not generic demos\./i })).toBeInTheDocument();
    expect(screen.getByText(/Blueprint turns indoor capture into site\/task readiness reports/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Readiness Report$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site Package Substrate/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Buyer Request Path/i })).toBeInTheDocument();
    expect(screen.getByText(/A walkthrough or site record starts the evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/site\/task confidence packet around success rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Structured intake turns a robot-team question/i)).toBeInTheDocument();
  });

  it("surfaces concise sections for sites, products, proof, and closing action", {
    timeout: 20000,
  }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Choose a site task\. Set the pass bar\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inspect proof/i })).toHaveAttribute(
      "href",
      "/proof",
    );
    expect(
      screen.getByRole("heading", {
        name: /The proof travels with the readiness estimate\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Site packages feed readiness reports\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Indoor capture turns vague robot-pilot risk into a scoped readiness question\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Ground truth means raw capture evidence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Samples and demo worlds are labeled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approved listings keep capture basis/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Request one site\/task readiness evaluation\./i }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /See sample readiness report/i })
        .some((link) => link.getAttribute("href") === "/readiness"),
    ).toBe(true);
  });
});
