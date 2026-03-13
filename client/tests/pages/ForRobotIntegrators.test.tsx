import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotIntegrators from "@/pages/ForRobotIntegrators";

describe("ForRobotIntegrators", () => {
  it("renders the robot-team use cases and simpler positioning", () => {
    render(<ForRobotIntegrators />);

    expect(screen.getByText(/^For Robot Teams$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /See the site before your robot does\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Blueprint turns a real site into a hosted world model/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What robot teams use it for\./i })).toBeInTheDocument();
    expect(screen.getByText(/Test before travel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Make site-specific data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Share one environment/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you get/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What to expect/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Use the term world model if you want\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse site worlds/i })).toHaveAttribute(
      "href",
      "/site-worlds",
    );
  });
});
