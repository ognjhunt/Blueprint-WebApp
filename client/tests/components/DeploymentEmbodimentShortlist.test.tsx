import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeploymentEmbodimentShortlist } from "@/components/workspace/DeploymentEmbodimentShortlist";
import { RobotDescriptionFields, readRobotDescription } from "@/components/workspace/RobotDescriptionFields";
import { deploymentEmbodimentCatalog as catalog, downloadDeploymentEmbodimentShortlist } from "@/lib/deploymentEmbodimentSupport";

vi.mock("@/lib/deploymentEmbodimentSupport", async () => ({
  ...await vi.importActual<typeof import("@/lib/deploymentEmbodimentSupport")>("@/lib/deploymentEmbodimentSupport"),
  downloadDeploymentEmbodimentShortlist: vi.fn(),
}));

describe("deployment embodiment selection", () => {
  beforeEach(() => vi.clearAllMocks());
  it("offers every planning robot while requiring explicit compatible policy routes before export", async () => {
    render(<DeploymentEmbodimentShortlist sourceLaunchId="job-123" />);
    const download = screen.getByRole("button", { name: "Download robot and policy shortlist" });
    expect(download).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Show all 16 robots" }));
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
  it("keeps the gallery sparse, reveals setup details, and retains selections across arm filters", () => {
    render(<DeploymentEmbodimentShortlist />);
    expect(screen.getAllByRole("checkbox", { name: /^Shortlist / })).toHaveLength(4);
    const yam = catalog.embodiments.find(row => row.embodiment_id === "i2rt_yam_bimanual")!;
    const tile = screen.getByRole("article", { name: yam.display_name });
    expect(within(tile).getByText("Two arms")).toBeVisible();
    expect(within(tile).getByRole("img")).toHaveAttribute("src", "/images/deployment-embodiments/yam.png");
    const details = tile.querySelector("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(within(tile).getByText("Setup details", { selector: "summary" }));
    expect(details.open).toBe(true);
    expect(within(details).getByText("Assets and preparation")).toBeVisible();
    fireEvent.click(within(tile).getByRole("checkbox", { name: `Shortlist ${yam.display_name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Single arm", exact: true }));
    expect(screen.queryByRole("article", { name: yam.display_name })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    fireEvent.click(screen.getByRole("button", { name: "Two arms", exact: true }));
    expect(screen.getByRole("checkbox", { name: `Shortlist ${yam.display_name}` })).toBeChecked();
    expect(screen.getByRole("group", { name: `Policy routes for ${yam.display_name}` })).toBeInTheDocument();
  });
  it("labels missing product imagery as a configuration illustration", () => {
    render(<DeploymentEmbodimentShortlist />);
    fireEvent.click(screen.getByRole("button", { name: "Show all 16 robots" }));
    const robot = catalog.embodiments.find(row => row.embodiment_id === "fanuc_m710ic_45m")!;
    const tile = screen.getByRole("article", { name: robot.display_name });
    expect(within(tile).getByRole("img")).toHaveAccessibleName(/schematic single-arm configuration, not exact model geometry/);
    expect(within(tile).getByText("Configuration illustration")).toBeVisible();
  });
  it("keeps planning choices out of customer forms and preserves a saved robot identity", () => {
    const robot = catalog.embodiments[0];
    const saved = { source: "support_option" as const, embodimentId: robot.embodiment_id, catalogDigest: "sha256:" + "a".repeat(64), policyRouteIds: [robot.policy_routes[0].route_id] };
    const view = render(<form><RobotDescriptionFields value={saved} /></form>);
    expect(screen.queryByRole("group", { name: /Deployment embodiments/ })).toBeNull();
    expect(screen.queryByRole("option", { name: catalog.embodiments[1].display_name })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText("Setup details")).toBeNull();
    expect(screen.getByText(/needs simulation validation/)).toBeVisible();
    expect(readRobotDescription(new FormData(view.container.querySelector("form")!), [])).toEqual(saved);
  });
  it("still rejects a planning descriptor without an explicit policy route", () => {
    const form = new FormData();
    form.set("robotDescriptionSource", `support:${catalog.embodiments[0].embodiment_id}`);
    expect(() => readRobotDescription(form, [])).toThrow("Choose at least one policy route");
  });
});
