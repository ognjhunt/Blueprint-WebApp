import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("renders the simplified public trust page", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", {
        name: /Rights, privacy, and provenance — kept visible\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Rights stay explicit$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted access stays bounded$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^No claims beyond the listing$/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", {
        name: /Every world model passes the same four gates\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Rights$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Privacy$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Provenance$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Scope limits$/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", { name: /Six commitments we hold on every world model\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What stays attached to a listing/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights packet · example/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We label generated and simulated media as review support/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We honor takedown, refresh, redaction, and revocation requests/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /The line we will not cross\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No capture of restricted or private areas/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /it does not claim deployment readiness, safety certification, or guaranteed outcomes/i,
      ),
    ).toBeInTheDocument();
  });
});
