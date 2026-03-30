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
      screen.getByRole("heading", { name: /See what you can train on before you commit\./i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contact Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
  });

  it("renders Austin-specific proof guidance and preserves city context in the CTA", () => {
    mockSearch = "?city=austin";

    render(<Proof />);

    expect(screen.getByText(/Austin, TX/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Austin demand is relationship-led, so the proof needs to get specific fast\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/facility type, recency, and provenance visible before broader world-model framing/i),
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
      screen.getByText(/exact-site proof, stack compatibility, and async artifact review ahead of generic AI language/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contact Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&city=san-francisco",
    );
  });
});
