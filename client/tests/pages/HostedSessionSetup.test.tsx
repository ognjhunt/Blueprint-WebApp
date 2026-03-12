import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HostedSessionSetup from "@/pages/HostedSessionSetup";

const setLocationMock = vi.fn();

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/site-worlds/sw-chi-01/start", setLocationMock],
  };
});

describe("HostedSessionSetup", () => {
  it("renders a dedicated setup page and launches into the workspace route", () => {
    render(<HostedSessionSetup params={{ slug: "sw-chi-01" }} />);

    expect(screen.getByRole("heading", { name: /Start Hosted Session/i })).toBeInTheDocument();
    expect(screen.getByText(/Harborview Grocery Distribution Annex/i)).toBeInTheDocument();
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(screen.getByText(/You are setting up a hosted evaluation run\./i)).toBeInTheDocument();
    expect(screen.getByText(/Listed rates on Site Worlds are for self-serve session time\./i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Unitree G1 with head cam and wrist cam/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Checkpoint 148000/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Launch session/i }));

    expect(setLocationMock).toHaveBeenCalledWith(
      expect.stringContaining("/site-worlds/sw-chi-01/workspace?"),
    );
  });
});
