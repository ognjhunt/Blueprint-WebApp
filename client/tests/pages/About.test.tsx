import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import About from "@/pages/About";

describe("About", () => {
  it("centers the company on evaluating robots for sites that can buy", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /We evaluate robots for sites that are ready to buy/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Robot supply is scaling\. The work of matching one to a job is not/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Every robot company should not rebuild the same site from scratch/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Fast is useful only when the result stays honest/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use real hardware to settle physical performance and safety claims/i,
      ),
    ).toBeInTheDocument();
  });
});
