import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders the simplified capture-backed policy evaluation story", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Evaluate robot policies before field time\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/runs WAM\/VLA policy evaluations on captured real-site task packs/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create evaluation run/i })).toHaveAttribute(
      "href",
      "/for-robot-teams",
    );
    expect(screen.getByText(/100 \/ 500/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1-3/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("heading", { name: /^Policy Evaluation Run$/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Policy ranking, failures, OOD flags/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Precise boundaries\./i })).toBeInTheDocument();
    expect(screen.getByText(/do not prove safety, deployment readiness, universal SRCC/i)).toBeInTheDocument();
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
  });
});
