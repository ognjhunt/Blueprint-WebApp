import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HostedSessionWorkspace from "@/pages/HostedSessionWorkspace";
import { getSiteWorldById } from "@/data/siteWorlds";

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => "",
    useLocation: () => ["/site-worlds/sw-chi-01/workspace", vi.fn()],
  };
});

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

describe("HostedSessionWorkspace", () => {
  it("renders the hosted session workspace shell", () => {
    render(<HostedSessionWorkspace params={{ slug: "sw-chi-01" }} />);

    expect(screen.getByRole("heading", { name: /Hosted Session Workspace/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Harborview Grocery Distribution Annex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Robot observation/i)).toBeInTheDocument();
    expect(screen.getByText(/Run context/i)).toBeInTheDocument();
    expect(screen.getByText(/Controls/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated outputs/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reset episode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run 10 episodes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export results/i })).toBeInTheDocument();
    expect(screen.getByText(/Raw bundle/i)).toBeInTheDocument();
    expect(screen.getAllByText(/RLDS dataset/i).length).toBeGreaterThan(0);
  });
});
