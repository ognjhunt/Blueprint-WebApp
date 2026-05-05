import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Proof from "@/pages/Proof";

let mockSearch = "";

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => mockSearch,
  };
});

describe("Proof page", () => {
  beforeEach(() => {
    mockSearch = "";
  });

  it("renders the default proof hub without city-specific copy", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /Sample grocery aisle proof packet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A composite sample showing how shelf navigation, aisle obstruction checks, provenance, and hosted-review outputs stay readable for a robot team\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What the robot team inspects/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Capture provenance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hosted review output \(sample\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Aisle geometry/i)).toBeInTheDocument();
    expect(screen.getByText(/Capture basis/i)).toBeInTheDocument();
    expect(screen.getByText(/Composite public-route sample/i)).toBeInTheDocument();
    expect(screen.getByText(/Navigability assessment/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Example packet/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/San Francisco, CA/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Discuss a similar site/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
    expect(screen.getByRole("link", { name: /View full provenance/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("link", { name: /See inspection checklist/i })).toHaveAttribute(
      "href",
      "/sample-evaluation",
    );
    expect(screen.getByRole("link", { name: /Discuss a similar site/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
    expect(screen.getByRole("link", { name: /Open hosted review/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb/start",
    );
  });

  it("ignores Austin city context and preserves the proof packet CTA", () => {
    mockSearch = "?city=austin";

    render(<Proof />);

    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sample grocery aisle proof packet/i })).toBeInTheDocument();
    expect(
      screen.getByText(/A composite sample showing how shelf navigation, aisle obstruction checks, provenance, and hosted-review outputs stay readable for a robot team\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Discuss a similar site/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
  });

  it("ignores San Francisco city context and preserves the proof packet CTA", () => {
    mockSearch = "?city=san-francisco";

    render(<Proof />);

    expect(screen.queryByText(/San Francisco, CA/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sample grocery aisle proof packet/i })).toBeInTheDocument();
    expect(
      screen.getByText(/A composite sample showing how shelf navigation, aisle obstruction checks, provenance, and hosted-review outputs stay readable for a robot team\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Discuss a similar site/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
  });
});
