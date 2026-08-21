import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import About from "@/pages/About";

describe("About", () => {
  it("centers the company on reusable pre-deployment work", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /We automate the work before the robot arrives/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Robot supply scales\. Deployment homework does not/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /same deployment homework should not be rebuilt inside every OEM/i,
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
