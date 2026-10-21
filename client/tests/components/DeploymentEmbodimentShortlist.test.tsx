import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeploymentEmbodimentShortlist } from "@/components/workspace/DeploymentEmbodimentShortlist";
import { RobotDescriptionFields, readRobotDescription } from "@/components/workspace/RobotDescriptionFields";
import { deploymentEmbodimentCatalog as catalog, downloadDeploymentEmbodimentShortlist } from "@/lib/deploymentEmbodimentSupport";

vi.mock("@/lib/deploymentEmbodimentSupport", async () => ({
  ...await vi.importActual<typeof import("@/lib/deploymentEmbodimentSupport")>("@/lib/deploymentEmbodimentSupport"),
  downloadDeploymentEmbodimentShortlist: vi.fn(),
}));

describe("deployment embodiment selection", () => {
  it("offers every planning robot while requiring explicit compatible policy routes before export", async () => {
    render(<DeploymentEmbodimentShortlist sourceLaunchId="job-123" />);
    const download = screen.getByRole("button", { name: "Download robot and policy shortlist" });
    expect(download).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Choose robots and policies/ }));
    for (const row of catalog.embodiments) expect(screen.getByRole("checkbox", { name: `Shortlist ${row.display_name}` })).toBeEnabled();
    const robot = catalog.embodiments[0];
    fireEvent.click(screen.getByRole("checkbox", { name: `Shortlist ${robot.display_name}` }));
    const routes = screen.getByRole("group", { name: `Policy routes for ${robot.display_name}` });
    expect(within(routes).getAllByRole("checkbox")).toHaveLength(robot.policy_routes.length);
    expect(download).toBeDisabled();
    fireEvent.click(within(routes).getAllByRole("checkbox")[0]);
    expect(download).toBeEnabled();
    fireEvent.click(download);
    await waitFor(() => expect(downloadDeploymentEmbodimentShortlist).toHaveBeenCalledWith(expect.objectContaining({
      claim_ceiling: "planning_only", source_launch_id: "job-123",
      selections: [{ embodiment_id: robot.embodiment_id, policy_route_ids: [catalog.policy_routes.find(route => robot.policy_routes.some(row => row.route_id === route.route_id))!.route_id] }],
    })));
    expect(screen.queryByRole("button", { name: /start|launch|submit.*run/i })).toBeNull();
  });
  it("serializes common saved setup choices as planning descriptions without a runtime binding", async () => {
    const { container } = render(<form><RobotDescriptionFields /></form>);
    const robot = catalog.embodiments[0];
    fireEvent.change(screen.getByRole("combobox", { name: "Robot model" }), { target: { value: `support:${robot.embodiment_id}` } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(container.querySelector<HTMLInputElement>("input[name=robotSupportCatalogDigest]")?.value).toMatch(/^sha256:/));
    const result = readRobotDescription(new FormData(container.querySelector("form")!), []);
    expect(result).toMatchObject({ source: "support_option", embodimentId: robot.embodiment_id,
      policyRouteIds: [catalog.policy_routes.find(route => robot.policy_routes.some(row => row.route_id === route.route_id))!.route_id] });
    expect(result).not.toHaveProperty("configurationId");
  });
});
