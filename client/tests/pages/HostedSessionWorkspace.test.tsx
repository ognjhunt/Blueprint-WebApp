import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HostedSessionWorkspace from "@/pages/HostedSessionWorkspace";

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () =>
      "?robot=Unitree%20G1%20with%20head%20cam%20and%20wrist%20cam&policy=Checkpoint%20148000&task=Walk%20to%20shelf%20staging%20and%20pick%20the%20blue%20tote&scenario=Normal%20lighting&outputs=Rollout%20video%2C%20Action%20trace",
    useLocation: () => ["/site-worlds/sw-chi-01/workspace", vi.fn()],
  };
});

describe("HostedSessionWorkspace", () => {
  it("renders the hosted session workspace shell", () => {
    render(<HostedSessionWorkspace params={{ slug: "sw-chi-01" }} />);

    expect(screen.getByRole("heading", { name: /Hosted Session Workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/Harborview Grocery Distribution Annex/i)).toBeInTheDocument();
    expect(screen.getByText(/Observation viewport/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Controls/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reset episode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run 10 episodes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export results/i })).toBeInTheDocument();
    expect(screen.getByText(/Checkpoint 148000/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Normal lighting/i).length).toBeGreaterThan(0);
  });
});
