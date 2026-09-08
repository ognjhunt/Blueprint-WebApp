import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Proof from "@/pages/Proof";

describe("Proof", () => {
  it("shows the two-sided process, the sourced cost, and the physical-proof boundary", () => {
    render(<Proof />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /first two months are real work/i,
      }),
    ).toBeInTheDocument();
    // The two-sided "what happens today" figure.
    expect(screen.getByText(/What the robot company does today/i)).toBeInTheDocument();
    expect(screen.getByText(/What the site does today/i)).toBeInTheDocument();
    // The cost figure keeps its published anchors and a labelled modelled panel.
    expect(screen.getByText(/Blueprint planning model/i)).toBeInTheDocument();
    // The boundary is preserved.
    expect(
      screen.getByRole("heading", {
        name: /A good filter is not a deployment certificate/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Physical proof$/i }),
    ).toBeInTheDocument();
  });
});
