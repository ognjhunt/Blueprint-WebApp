import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Agents from "@/pages/Agents";

describe("Agents page", () => {
  it("explains the robot-team agent workflow without overstating operational proof", () => {
    render(<Agents />);

    expect(
      screen.getByRole("heading", { name: /Robot-team agent access/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Quickstart/i)).toBeInTheDocument();
    expect(screen.getAllByText(/BLUEPRINT_API_BASE_URL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Firebase robot-team or admin bearer token/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/commerce quote/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dry-run order/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/blueprint\.commerce\.checkoutDryRun/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dry_run_order/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/blueprint\.session\.runBatch/i)).toBeInTheDocument();
    expect(screen.getByText(/capture_grounded/i)).toBeInTheDocument();
    expect(screen.getByText(/provider_derived/i)).toBeInTheDocument();
    expect(screen.getByText(/403 forbidden/i)).toBeInTheDocument();
    expect(screen.getByText(/agent-access\.openapi\.json/i)).toBeInTheDocument();

    expect(screen.queryByText(/customer result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/deployment guarantee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live Stripe payment completed/i)).not.toBeInTheDocument();
  });
});
