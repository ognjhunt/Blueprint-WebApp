import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Sites from "@/pages/Sites";
import SiteDetail from "@/pages/SiteDetail";

describe("Sites", () => {
  it("renders the captured-site library with the expected filters and CTAs", () => {
    render(<Sites />);

    expect(
      screen.getByRole("heading", {
        name: /Browse captured sites for robot evaluation\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search sites, tasks, locations, or use cases/i),
    ).toBeInTheDocument();

    for (const label of ["Site type", "Task pack", "Readiness", "Access", "Region"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    const harborviewCard = screen
      .getByRole("heading", { name: /Harborview Grocery Distribution Annex/i })
      .closest("article");
    expect(harborviewCard).not.toBeNull();
    expect(within(harborviewCard as HTMLElement).getByText(/500 ready/i)).toBeInTheDocument();
    expect(within(harborviewCard as HTMLElement).getByRole("link", { name: /View site/i })).toHaveAttribute(
      "href",
      "/sites/sw-chi-01",
    );
    const requestHref =
      within(harborviewCard as HTMLElement)
        .getByRole("link", { name: /Request evaluation/i })
        .getAttribute("href") || "";
    expect(requestHref).toContain("path=task-evaluation-run");
  });

  it("filters by site type, task pack, readiness, access, region, and search", () => {
    render(<Sites />);

    fireEvent.change(screen.getByLabelText("Site type"), { target: { value: "Hospital" } });
    expect(screen.getByText(/Piedmont Hospital Supply Hallway/i)).toBeInTheDocument();
    expect(screen.queryByText(/Harborview Grocery Distribution Annex/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Site type"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Task pack"), { target: { value: "Pick/place" } });
    expect(screen.getByText(/Triangle Robotics Lab/i)).toBeInTheDocument();
    expect(screen.queryByText(/Motor City Battery Staging Cell/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Task pack"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Readiness"), { target: { value: "Capture complete" } });
    expect(screen.getByText(/Motor City Battery Staging Cell/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "Open sample" } });
    expect(screen.getByText(/No matching sites yet\./i)).toBeInTheDocument();
  });

  it("renders a compact site detail page for a legacy slug alias", () => {
    render(<SiteDetail params={{ slug: "siteworld-f5fd54898cfb" }} />);

    expect(
      screen.getByRole("heading", { name: /Triangle Robotics Lab/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Open sample/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Available task packs/i })).toBeInTheDocument();
    const requestRunHref =
      screen
        .getAllByRole("link", { name: /Request Task Evaluation Run/i })[0]
        .getAttribute("href") || "";
    expect(requestRunHref).toContain("siteSlug=triangle-robotics-lab");
  });
});
