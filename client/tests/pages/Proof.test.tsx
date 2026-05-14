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
      screen.getByRole("heading", { name: /See what is attached to the world model before you buy\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Blueprint proof is the buyer-facing trust layer for site-specific world models/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Proof is a product capability\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /The public packet teaches the workflow\. The live packet proves one request\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Every output should point back to the source packet\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Buyer confidence comes from visible limits\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hosted review is the buyer room, not the proof source\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /A proof packet should make the next decision obvious\./i })).toBeInTheDocument();
    expect(screen.getAllByText(/Public sample, clearly labeled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Live proof packet is request-gated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No invented rights or outcomes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Capture-grounded/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Model-inferred/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Review before export/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Fail closed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sample rows only/i)).toBeInTheDocument();
    expect(screen.getByText(/Proceed to hosted evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Hold the purchase/i)).toBeInTheDocument();
    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/San Francisco, CA/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a proof packet/i })[0]).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-hero",
    );
    expect(screen.getByRole("link", { name: /Browse sample world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /Request hosted evaluation/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=proof-bottom",
    );
  });

  it("ignores Austin city context and preserves the proof packet CTA", () => {
    mockSearch = "?city=austin";

    render(<Proof />);

    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /See what is attached to the world model before you buy\./i })).toBeInTheDocument();
    expect(
      screen.getByText(/Blueprint proof is the buyer-facing trust layer for site-specific world models/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a proof packet/i })[0]).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-hero",
    );
  });

  it("ignores San Francisco city context and preserves the proof packet CTA", () => {
    mockSearch = "?city=san-francisco";

    render(<Proof />);

    expect(screen.queryByText(/San Francisco, CA/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /See what is attached to the world model before you buy\./i })).toBeInTheDocument();
    expect(
      screen.getByText(/Blueprint proof is the buyer-facing trust layer for site-specific world models/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a proof packet/i })[0]).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-hero",
    );
  });
});
