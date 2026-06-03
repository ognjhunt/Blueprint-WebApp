import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Proof from "@/pages/Proof";

describe("Proof page", () => {
  it("renders the concise proof explainer", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /See what supports the readiness estimate\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/what came from capture, what is inferred, what is still missing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /The public packet teaches the workflow\. The request packet proves one site\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Public sample$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Request-specific proof$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Capture provenance/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Rights and privacy posture/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Readiness advisory/i).length).toBeGreaterThan(0);
  });

  it("keeps the claim boundary and request CTA visible", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /Advisory until stronger proof exists\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/must not claim safety validation/i)).toBeInTheDocument();
    expect(screen.getByText(/Hold until the proof gap is resolved/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request readiness review/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact?persona=robot-team"));
    expect(screen.getByRole("link", { name: /Request a proof packet/i })).toHaveAttribute(
      "href",
      expect.stringContaining("path=proof-packet"),
    );
  });
});
