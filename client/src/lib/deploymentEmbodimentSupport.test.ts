// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deploymentEmbodimentCatalog as catalog, deploymentEmbodimentCatalogSchema,
  deploymentCanonicalJson, canonicalDeploymentSelections, deploymentCatalogWithDigest,
  makeDeploymentEmbodimentShortlist, validateDeploymentEmbodimentShortlist,
} from "./deploymentEmbodimentSupport";

const robot = catalog.embodiments[0];
const choice = { embodiment_id: robot.embodiment_id, policy_route_ids: [robot.policy_routes[0].route_id] };
describe("deployment embodiment planning handoff", () => {
  it("binds the exact catalog and portable selections to independent SHA-256 digests", async () => {
    const handoff = await makeDeploymentEmbodimentShortlist([choice], "job-123");
    expect(handoff.catalog_digest).toBe(`sha256:${createHash("sha256").update(deploymentCanonicalJson(catalog)).digest("hex")}`);
    const { shortlist_digest, ...content } = handoff;
    expect(shortlist_digest).toBe(`sha256:${createHash("sha256").update(deploymentCanonicalJson(content)).digest("hex")}`);
    expect(await validateDeploymentEmbodimentShortlist(handoff)).toEqual(handoff);
    expect(handoff.claim_ceiling).toBe("planning_only");
    expect(Object.keys(handoff).sort()).toEqual(["schema_version", "claim_ceiling", "catalog_digest", "source_launch_id", "selections", "shortlist_digest"].sort());
  });
  it("orders selections and compatible routes by the source catalog", () => {
    const rows = catalog.embodiments.slice(0, 2).reverse().map(row => ({ embodiment_id: row.embodiment_id,
      policy_route_ids: row.policy_routes.map(route => route.route_id).reverse() }));
    expect(canonicalDeploymentSelections(rows)).toEqual(catalog.embodiments.slice(0, 2).map(row => ({
      embodiment_id: row.embodiment_id,
      policy_route_ids: catalog.policy_routes.filter(route => row.policy_routes.some(item => item.route_id === route.route_id)).map(route => route.route_id),
    })));
  });
  it("refuses duplicates, empty routes, unknown robots and incompatible policies", () => {
    for (const rows of [[choice, choice], [{ ...choice, policy_route_ids: [] }],
      [{ ...choice, embodiment_id: "unknown" }], [{ ...choice, policy_route_ids: ["unknown"] }],
      [{ ...choice, policy_route_ids: [...choice.policy_route_ids, ...choice.policy_route_ids] }]])
      expect(() => canonicalDeploymentSelections(rows)).toThrow();
  });
  it("refuses forged execution claims, extra fields, stale catalogs and altered handoffs", async () => {
    const handoff = await makeDeploymentEmbodimentShortlist([choice]);
    for (const edit of [{ claim_ceiling: "verified_runnable" }, { robot_preset_id: "fabricated" },
      { catalog_digest: `sha256:${"0".repeat(64)}` }, { source_launch_id: "different-job" }])
      await expect(validateDeploymentEmbodimentShortlist({ ...handoff, ...edit })).rejects.toThrow();
    expect(() => deploymentEmbodimentCatalogSchema.parse({ ...catalog, ready: true })).toThrow();
    expect((await deploymentCatalogWithDigest()).catalog_digest).toBe(handoff.catalog_digest);
  });
  it("matches Pipeline bounds for launch identities, arm metadata and public sources", async () => {
    for (const source of ["", "job/with/path", "a".repeat(193), "job?token=secret"])
      await expect(makeDeploymentEmbodimentShortlist([choice], source)).rejects.toThrow();
    for (const edit of [{arm_count:3}, {arm_dof:[13]}, {required_artifacts:[]}, {asset_sources:[]},
      {asset_sources:[{...robot.asset_sources[0],format:"unsupported"}]},
      {asset_sources:[robot.asset_sources[0],robot.asset_sources[0]]},
      {asset_sources:[{...robot.asset_sources[0],url:"https://source.test/robot?token=secret"}]},
      {asset_sources:[{...robot.asset_sources[0],url:"https://source.test/robot#part"}]}])
      expect(()=>deploymentEmbodimentCatalogSchema.parse({...catalog,embodiments:[{...robot,...edit}]})).toThrow();
  });
});
