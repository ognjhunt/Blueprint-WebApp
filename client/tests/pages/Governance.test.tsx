import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Governance from "@/pages/Governance";

/**
 * The governance page is the one public surface where an aspirational claim is
 * indistinguishable from a lie, so these assertions guard two different things:
 * that the pipeline-verified controls are actually rendered, and that the three
 * sections predating the runway rewrite — progressive access, permission
 * granularity, and egress — were not quietly dropped by it. Losing any of them
 * is a regression in what a site operator is told, not a copy change.
 */
describe("Governance", () => {
  it("explains controlled testing without unrestricted site-data transfer", () => {
    render(<Governance />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Robot teams test your site without ever getting your site/i,
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

  it("names each pipeline-enforced control and what enforces it", () => {
    render(<Governance />);
    expect(
      screen.getByRole("heading", {
        name: /Six mechanisms, and what enforces each one/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A capture without its consent record does not process/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You can revoke after delivery, and it reaches what already shipped/i),
    ).toBeInTheDocument();
    // Each control cites the module that implements it, so a sceptical reader
    // can re-check rather than trust the page.
    expect(screen.getAllByText(/consent_normalization/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/consent_takedown/i).length).toBeGreaterThan(0);
  });

  it("states its limits at the same weight as its promises", () => {
    render(<Governance />);
    expect(
      screen.getByRole("heading", { name: /What we do not claim/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/We do not hold SOC 2/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Hosted infrastructure means cloud providers process your data/i,
      ),
    ).toBeInTheDocument();
  });
});
