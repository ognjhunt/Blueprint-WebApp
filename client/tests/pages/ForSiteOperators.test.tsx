import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("uses the same service, result model, and CTA for the site-operator persona", () => {
    render(<ForSiteOperators />);
    expect(screen.getByRole("heading", { name: /Turn one real task into a decision you can inspect/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Same service · same result model/i)).toBeInTheDocument();
    expect(screen.getByText(/Candidates are optional at intake/i)).toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
  });
});
