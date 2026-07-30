import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("renders the public trust page", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", {
        name: /Rights, privacy, and provenance — kept visible\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Rights stay explicit$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted access stays bounded$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^No claims beyond the record$/i).length).toBeGreaterThan(0);
  });

  it("keeps the operator/Blueprint control boundary explicit", () => {
    render(<Governance />);

    expect(screen.getByText(/^You decide$/i)).toBeInTheDocument();
    expect(screen.getByText(/^We are accountable for$/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Capture windows$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Restricted areas$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Safety approval$/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Generated and simulated media is labelled review support/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Takedown, refresh, redaction, and revocation requests are honoured/i),
    ).toBeInTheDocument();
  });

  it("shows the four gates and the illustrative rights record", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", { name: /Every capture passes the same four gates\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Rights$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Privacy$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Provenance$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Scope limits$/i })).toBeInTheDocument();

    // The rights record is a labelled example, never presented as a live record.
    expect(
      screen.getByRole("heading", { name: /What stays attached to a capture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/field names and example values, not a live record/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Illustrative/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/RIGHTS-2049-08/)).toBeInTheDocument();
  });

  it("keeps the hard limit visible", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", { name: /The line we will not cross\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No capture of restricted or private areas/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /it does not claim deployment readiness, safety certification, or guaranteed outcomes/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Safety approval stays external/i)).toBeInTheDocument();
  });
});
