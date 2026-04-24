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
      screen.getByRole("heading", { name: /See the site before you commit to the path\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public capture can start with everyday places\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Useful sites are not warehouse-only\./i })).toBeInTheDocument();
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted report preview/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", {
      name: /Austin demand is relationship-led, so the proof needs to get specific fast\./i,
    })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contact Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
    expect(screen.getByRole("heading", { name: /Choose what to inspect next\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Capture examples/i })).toHaveAttribute(
      "href",
      "/case-studies",
    );
  });

  it("renders Austin-specific proof guidance and preserves city context in the CTA", () => {
    mockSearch = "?city=austin";

    render(<Proof />);

    expect(screen.getAllByText(/Austin, TX/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /Austin demand is relationship-led, so the proof needs to get specific fast\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/lead with one exact site, the facility type, and a proof path that is easy to inspect/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contact Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&city=austin",
    );
  });

  it("renders San Francisco-specific proof guidance and preserves city context in the CTA", () => {
    mockSearch = "?city=san-francisco";

    render(<Proof />);

    expect(screen.getByText(/San Francisco, CA/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /San Francisco buyers will pressure-test technical clarity immediately\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/lead with exact-site proof, current-stack fit, and what can be reviewed asynchronously/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contact Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&city=san-francisco",
    );
  });
});
