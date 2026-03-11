import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorldDetail from "@/pages/SiteWorldDetail";

describe("SiteWorldDetail", () => {
  it("renders the detail page and auto-starts the session when requested", () => {
    window.history.replaceState({}, "", "/site-worlds/sw-chi-01?start=1");

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Midwest Grocery Backroom/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Starts now/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start billed session/i })).toHaveAttribute(
      "href",
      "/site-worlds/sw-chi-01?start=1",
    );
    expect(screen.getByText(/Session live/i)).toBeInTheDocument();
    expect(screen.getByText(/Billing started at launch\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Stop session/i })).toHaveAttribute(
      "href",
      "/site-worlds/sw-chi-01",
    );
  });
});
