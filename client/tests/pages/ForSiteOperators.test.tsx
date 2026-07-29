import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("uses the same service, result model, and CTA for the site-operator persona", () => {
    render(<ForSiteOperators />);
    expect(
      screen.getByRole("heading", { name: /Your site is the test\. Keep control of it\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Same service, different first question/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Candidates are optional/i).length).toBeGreaterThan(0);
    // Operator control over rights, access, and safety stays explicit.
    expect(screen.getByText(/^You decide$/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety stays where it belongs/i)).toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
  });
});
