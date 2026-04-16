import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import About from "@/pages/About";

describe("About", () => {
  it("frames Blueprint as an operationally serious company", () => {
    render(<About />);

    expect(screen.getByRole("heading", { name: /Blueprint turns real facilities into buyer-ready world-model products\./i })).toBeInTheDocument();
    expect(screen.getByText(/Why teams trust Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/How Blueprint works with real sites/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /An anonymized deployment-decision story/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read governance and trust/i })).toHaveAttribute(
      "href",
      "/governance",
    );
  });
});
