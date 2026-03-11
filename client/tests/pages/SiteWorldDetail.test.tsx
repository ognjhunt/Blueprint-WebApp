import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorldDetail from "@/pages/SiteWorldDetail";

describe("SiteWorldDetail", () => {
  it("renders the robot-team hosted eval walkthrough without fake session state", () => {
    window.history.replaceState({}, "", "/site-worlds/sw-chi-01?start=1");

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Midwest Grocery Backroom/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Start with the site asset package\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Use the hosted eval layer built from the site\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /How a robot team would use this/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Qualification is for the site side\./i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick the site/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 8/i)).toBeInTheDocument();
    expect(screen.getByText(/Score the run, export results, and compare policies/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What goes in/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What the session returns/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What teams do with it/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Example run for Midwest Grocery Backroom/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Unitree G1 with head cam and wrist cam/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Checkpoint 148000/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Session live/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Billing started at launch\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Elapsed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Stop session/i })).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Request Scene Package/i })).toHaveAttribute(
      "href",
      "/contact?interest=data-licensing",
    );
    expect(screen.getByRole("link", { name: /Request Hosted Sessions/i })).toHaveAttribute(
      "href",
      "/contact?interest=evaluation-package",
    );
  });
});
