import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders realistic deployment sites and request-based hosted evaluation links", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Train, evaluate, and debug on the exact site before deployment\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Shrink the demo-to-deployment gap\./i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Each Blueprint world model is built from real capture of one facility and one workflow lane/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Choose how you want access\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Common reasons robot teams buy this surface\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Buy the site package/i)).toBeInTheDocument();
    expect(screen.getByText(/Request a hosted evaluation/i)).toBeInTheDocument();
    expect(
      screen.getByText(/What real site and workflow the model is anchored to/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/What public status means/i)).toBeInTheDocument();
    expect(screen.getByText(/Harborview Grocery Distribution Annex/i)).toBeInTheDocument();
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Public demo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Export ready/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Commercial status/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Request-scoped commercial review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hosted Evaluation/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Embodiment/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick filters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hosted path documented/i })).toBeInTheDocument();
    expect(screen.queryByText(/Likely buyer:/i)).not.toBeInTheDocument();

    const packageLinks = screen.getAllByRole("link", { name: /Request site package/i });
    const packageUrl = new URL(packageLinks[0].getAttribute("href")!, "https://example.com");
    expect(packageUrl.pathname).toBe("/contact");
    expect(packageUrl.searchParams.get("interest")).toBe("data-licensing");
    expect(packageUrl.searchParams.get("buyerType")).toBe("robot_team");
    expect(packageUrl.searchParams.get("siteName")).toBe("Harborview Grocery Distribution Annex");

    const hostedLinks = screen.getAllByRole("link", { name: /Request hosted evaluation/i });
    const hostedUrl = new URL(hostedLinks[0].getAttribute("href")!, "https://example.com");
    expect(hostedUrl.pathname).toBe("/contact");
    expect(hostedUrl.searchParams.get("interest")).toBe("evaluation-package");
    expect(hostedUrl.searchParams.get("buyerType")).toBe("robot_team");
  });
});
