import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotIntegrators from "@/pages/ForRobotIntegrators";

describe("ForRobotIntegrators", () => {
  it("renders the robot-team use cases and simpler positioning", () => {
    render(<ForRobotIntegrators />);

    expect(screen.getByText(/^For Robot Teams$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Use a site-specific world model before you commit field time\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What teams can do with it/i })).toBeInTheDocument();
    expect(screen.getByText(/Test before travel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Make site-specific data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Share one hosted environment/i)).toBeInTheDocument();
    expect(screen.getByText(/How to talk about it/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Simple positioning/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Clear boundaries/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse site worlds/i })).toHaveAttribute(
      "href",
      "/site-worlds",
    );
  });
});
