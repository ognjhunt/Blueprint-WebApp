import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";
import { siteWorldCards } from "@/data/siteWorlds";

describe("SiteWorlds", () => {
  it("renders a search-first site-package catalog with truthful state labels", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Browse site packages for readiness evaluation\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        /Search an address, site, city, store type, workflow, or robot task/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Exact catalog match/i)).toBeInTheDocument();
    expect(screen.getByText(/Nearby\/closest match/i)).toBeInTheDocument();
    expect(screen.getByText(/Category\/workflow match/i)).toBeInTheDocument();
    expect(screen.getByText(/Request candidate/i)).toBeInTheDocument();
    expect(screen.getAllByText(/operational truth stays with capture provenance/i).length).toBeGreaterThan(0);

    for (const example of ["Whole Foods", "grocery store", "warehouse tote", "hospital supply", "lab", "Atlanta", "Chicago"]) {
      expect(screen.getByRole("button", { name: example })).toBeInTheDocument();
    }

    expect(
      screen.getByRole("link", { name: /Open sample site package/i }),
    ).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");
    expect(screen.getAllByText(/Sample/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Planned/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Proof visible/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Proof, access, freshness/i).length).toBeGreaterThan(0);

    siteWorldCards.forEach((site) => {
      expect(screen.getAllByText(site.siteName).length).toBeGreaterThan(0);
    });
  });

  it("shows suggestions for names, addresses, cities, aliases, and workflows", () => {
    render(<SiteWorlds />);

    const input = screen.getByLabelText(/Search site packages/i);

    fireEvent.change(input, { target: { value: "Harborview" } });
    expect(
      screen.getAllByRole("option", { name: /Harborview Grocery Distribution Annex/i })[0],
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "1847 W Fulton" } });
    expect(screen.getByRole("option", { name: /1847 W Fulton St/i })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Chicago" } });
    expect(screen.getAllByRole("option", { name: /Chicago, IL/i })[0]).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Whole Foods" } });
    expect(screen.getByRole("option", { name: /whole foods/i })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "replenishment" } });
    expect(screen.getByRole("option", { name: /Case pick and shelf replenishment/i })).toBeInTheDocument();
  });

  it("selecting or typing an unknown location shows a truthful request CTA with prefilled params", () => {
    render(<SiteWorlds />);

    const input = screen.getByLabelText(/Search site packages/i);
    fireEvent.change(input, { target: { value: "123 New Robot Ave, Austin, TX" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      screen.getByText(/No scanned package for this exact place yet/i),
    ).toBeInTheDocument();

    const requestLinks = screen.getAllByRole("link", { name: /Request this location/i });
    expect(requestLinks.length).toBeGreaterThan(0);
    const href = requestLinks[0].getAttribute("href") || "";
    const url = new URL(href, "https://tryblueprint.local");
    expect(href).toContain("buyerType=robot_team");
    expect(href).toContain("interest=capture-access");
    expect(href).toContain("source=site-worlds");
    expect(href).toContain("path=new-capture");
    expect(url.searchParams.get("siteLocation")).toBe("123 New Robot Ave, Austin, TX");
    expect(url.searchParams.get("taskStatement")).toContain("Request an exact-site readiness evaluation");
  });

  it("selecting a city suggestion clearly separates nearby matches from exact scanned packages", () => {
    render(<SiteWorlds />);

    const input = screen.getByLabelText(/Search site packages/i);
    fireEvent.change(input, { target: { value: "Chicago" } });
    const cityOption = screen.getAllByRole("option", { name: /Chicago, IL/i })[0];
    fireEvent.click(cityOption);

    expect(screen.getByText(/No scanned package for this exact place yet/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Closest relevant catalog matches/i })).toBeInTheDocument();

    const firstCard = screen.getByRole("heading", {
      name: /Harborview Grocery Distribution Annex/i,
    }).closest("article");
    expect(firstCard).not.toBeNull();
    expect(within(firstCard as HTMLElement).getByText(/Nearby\/closest catalog match/i)).toBeInTheDocument();
  });
});
