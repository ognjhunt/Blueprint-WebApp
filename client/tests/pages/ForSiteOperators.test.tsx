import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("renders the simplified site-operator persona page", () => {
    render(<ForSiteOperators />);

    expect(screen.getByText(/^For Site Operators$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Control how your facility becomes a world-model asset\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What operators get\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /How it works and what you control\./i })).toBeInTheDocument();
    expect(screen.getByText(/Register the facility/i)).toBeInTheDocument();
    expect(screen.getByText(/Approve capture windows/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep scheduling, privacy, permission, and downstream-usage boundaries explicit\./i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What kinds of spaces fit\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /List your site/i })).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.queryByText(/^Revenue share$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Any indoor facility qualifies/i)).not.toBeInTheDocument();
  });
});
