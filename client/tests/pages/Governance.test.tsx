import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("explains controlled testing without unrestricted site-data transfer", () => {
    render(<Governance />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Let robot teams test the site without giving them the site/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /More detail only when the opportunity earns it/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Four permissions\. Four different values/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/raw files do not leave Blueprint/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/General model training/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /What stays inside\. What may come out/i,
      }),
    ).toBeInTheDocument();
  });
});
