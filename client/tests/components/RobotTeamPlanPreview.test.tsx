import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RobotTeamPlanPreview } from "../../src/components/site/RobotTeamPlanPreview";

describe("free beta entry", () => {
  it("links to the workspace without mounting checkout or resuming a saved purchase", () => {
    sessionStorage.setItem("bp-plan-queue", JSON.stringify({ planToken: "old-plan" }));
    const checkout = vi.fn();
    render(<RobotTeamPlanPreview sceneId="old-private-selection" onCheckout={checkout} />);
    expect(screen.getByRole("link", { name: "Open your workspace" })).toHaveAttribute("href", "/app");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/add.*balance|opening checkout|private evaluation/i)).toBeNull();
    expect(checkout).not.toHaveBeenCalled();
    sessionStorage.clear();
  });
});
