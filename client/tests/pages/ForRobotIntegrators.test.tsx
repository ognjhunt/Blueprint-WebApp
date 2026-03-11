import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotIntegrators from "@/pages/ForRobotIntegrators";

describe("ForRobotIntegrators", () => {
  it("renders the broader robot-team framing and research section", () => {
    render(<ForRobotIntegrators />);

    expect(screen.getByText(/^For Robot Teams$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Evaluate on qualified sites, not cold leads\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What changed recently/i })).toBeInTheDocument();
    expect(screen.getByText(/^WoVR$/i)).toBeInTheDocument();
    expect(screen.getByText(/^DreamZero$/i)).toBeInTheDocument();
    expect(screen.getByText(/^VLA-RFT$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Passive site video can help with context, but it usually does not give a robot enough to train from scratch\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read WoVR/i })).toHaveAttribute(
      "href",
      "https://arxiv.org/abs/2602.13977",
    );
    expect(screen.getByRole("link", { name: /View qualified opportunities/i })).toHaveAttribute(
      "href",
      "/qualified-opportunities",
    );
  });
});
