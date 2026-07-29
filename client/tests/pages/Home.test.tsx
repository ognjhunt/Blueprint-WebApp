import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders one Task Evaluation Run lifecycle with abstention and one primary CTA", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: /Turn a real site-task into a decision you can defend/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Maintained testbed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cheapest qualified evidence$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Decision or abstention/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Explicit abstention$/i)).toBeInTheDocument();
    expect(screen.getByText(/does not infer a winner from raw scores/i)).toBeInTheDocument();
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });
});
