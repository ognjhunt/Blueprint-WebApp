import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HostedSessionSetup from "@/pages/HostedSessionSetup";
import { getSiteWorldById } from "@/data/siteWorlds";

const setLocationMock = vi.fn();

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/site-worlds/sw-chi-01/start", setLocationMock],
  };
});

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

describe("HostedSessionSetup", () => {
  it("renders the three launch sections", async () => {
    render(<HostedSessionSetup params={{ slug: "sw-chi-01" }} />);

    expect(await screen.findByRole("heading", { name: /Start Hosted Session/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Harborview Grocery Distribution Annex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Site Model/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Robot profile/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Session Runtime/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Checkpoint 148000/i)).toBeInTheDocument();
    expect(screen.getByText(/Raw session bundle \+ RLDS dataset/i)).toBeInTheDocument();
  });
});
