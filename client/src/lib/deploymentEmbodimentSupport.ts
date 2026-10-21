import { z } from "zod";
import catalogJson from "../data/deploymentEmbodimentSupport.v1.json";

const id = z.string().regex(/^[a-z0-9][a-z0-9_.-]*$/);
const sourceLaunchId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const text = z.string().min(1);
const source = z.string().url().refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash; }, "Use an HTTPS public source without credentials, query parameters or a fragment.");
export const deploymentEmbodimentCatalogSchema = z.object({
  schema_version: z.literal("deployment_embodiment_support.v1"),
  claim_ceiling: z.literal("planning_only"),
  policy_routes: z.array(z.object({
    route_id: id, display_name: text, kind: z.enum(["hosted_api", "checkpoint", "customer_controller", "planning_endpoint", "skill_trace", "early_access"]), model_id: text.nullable(),
    observation_schema_id: text.nullable(), action_schema_id: text.nullable(),
    source_url: source, required_artifacts: z.array(text).min(1),
  }).strict()).min(1),
  embodiments: z.array(z.object({
    embodiment_id: id, display_name: text, manufacturer: text, arm_count: z.union([z.literal(1), z.literal(2)]),
    arm_dof: z.array(z.number().int().min(1).max(12)).min(1).nullable(), base_mode: z.literal("fixed"),
    tool_requirement: text, related_teams: z.array(text),
    asset_sources: z.array(z.object({
      source_id: id, format: z.enum(["usd", "urdf", "xacro", "mjcf", "documentation"]), url: source, relative_path: text.nullable(), revision: text.nullable(),
      license_note: text, preparation: text,
    }).strict()).min(1),
    policy_routes: z.array(z.object({
      route_id: id, evidence: z.enum(["publisher_demonstrated", "interface_candidate", "customer_supplied"]), source_url: source,
    }).strict()).min(1), required_artifacts: z.array(text).min(1),
  }).strict()).min(1),
}).strict().superRefine((value, context) => {
  for (const [field, values] of [["policy_routes", value.policy_routes.map(row => row.route_id)],
    ["embodiments", value.embodiments.map(row => row.embodiment_id)]] as const) {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path: [field], message: `Duplicate ${field} identity.` });
  }
  for (const row of value.embodiments) {
    const routes = row.policy_routes.map(route => route.route_id);
    if (new Set(routes).size !== routes.length || routes.some(route => !value.policy_routes.some(policy => policy.route_id === route)))
      context.addIssue({ code: "custom", path: ["embodiments"], message: "Unknown or duplicate policy route." });
    if (row.arm_dof && row.arm_dof.length !== row.arm_count)
      context.addIssue({ code: "custom", path: ["embodiments"], message: "Arm degrees of freedom must match arm count." });
    if (new Set(row.asset_sources.map(asset => asset.source_id)).size !== row.asset_sources.length)
      context.addIssue({ code: "custom", path: ["embodiments"], message: "Duplicate asset source identity." });
  }
});

export type DeploymentEmbodimentCatalog = z.infer<typeof deploymentEmbodimentCatalogSchema>;
export const deploymentEmbodimentCatalog = deploymentEmbodimentCatalogSchema.parse(catalogJson);
export const deploymentEmbodimentSelectionSchema = z.object({
  embodiment_id: id, policy_route_ids: z.array(id).min(1),
}).strict();
export type DeploymentEmbodimentSelection = z.infer<typeof deploymentEmbodimentSelectionSchema>;
export const deploymentEmbodimentShortlistSchema = z.object({
  schema_version: z.literal("deployment_embodiment_shortlist.v1"), claim_ceiling: z.literal("planning_only"),
  catalog_digest: digest, source_launch_id: sourceLaunchId.nullable(),
  selections: z.array(deploymentEmbodimentSelectionSchema).min(1), shortlist_digest: digest,
}).strict();
export type DeploymentEmbodimentShortlist = z.infer<typeof deploymentEmbodimentShortlistSchema>;

/** ASCII key sorting matches Pipeline's sorted JSON; no locale-dependent ordering. */
export function deploymentCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(deploymentCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${deploymentCanonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function deploymentDigest(value: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deploymentCanonicalJson(value)));
  return `sha256:${Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
export function canonicalDeploymentSelections(raw: unknown): DeploymentEmbodimentSelection[] {
  const rows = z.array(deploymentEmbodimentSelectionSchema).min(1).parse(raw);
  if (new Set(rows.map(row => row.embodiment_id)).size !== rows.length) throw new Error("Choose each robot only once.");
  for (const row of rows) {
    const robot = deploymentEmbodimentCatalog.embodiments.find(item => item.embodiment_id === row.embodiment_id);
    if (!robot) throw new Error("The selected robot is not in this catalog.");
    if (new Set(row.policy_route_ids).size !== row.policy_route_ids.length
      || row.policy_route_ids.some(route => !robot.policy_routes.some(item => item.route_id === route)))
      throw new Error(`Choose distinct compatible policy routes for ${robot.display_name}.`);
  }
  return deploymentEmbodimentCatalog.embodiments.flatMap(robot => {
    const selected = rows.find(row => row.embodiment_id === robot.embodiment_id);
    return selected ? [{ embodiment_id: robot.embodiment_id, policy_route_ids: deploymentEmbodimentCatalog.policy_routes
      .filter(route => selected.policy_route_ids.includes(route.route_id)).map(route => route.route_id) }] : [];
  });
}
export async function deploymentCatalogWithDigest() {
  return { ...deploymentEmbodimentCatalog, catalog_digest: await deploymentDigest(deploymentEmbodimentCatalog) };
}
export async function makeDeploymentEmbodimentShortlist(selections: unknown, sourceLaunchId: string | null = null): Promise<DeploymentEmbodimentShortlist> {
  const content = {
    schema_version: "deployment_embodiment_shortlist.v1" as const, claim_ceiling: "planning_only" as const,
    catalog_digest: await deploymentDigest(deploymentEmbodimentCatalog), source_launch_id: sourceLaunchId,
    selections: canonicalDeploymentSelections(selections),
  };
  return deploymentEmbodimentShortlistSchema.parse({ ...content, shortlist_digest: await deploymentDigest(content) });
}
export async function validateDeploymentEmbodimentShortlist(raw: unknown) {
  const parsed = deploymentEmbodimentShortlistSchema.parse(raw);
  const expected = await makeDeploymentEmbodimentShortlist(parsed.selections, parsed.source_launch_id);
  if (deploymentCanonicalJson(parsed) !== deploymentCanonicalJson(expected)) throw new Error("The shortlist or catalog changed. Export the shortlist again.");
  return parsed;
}
export function downloadDeploymentEmbodimentShortlist(value: DeploymentEmbodimentShortlist) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url;
  anchor.download = `${(value.source_launch_id || "robot-policy").replace(/[^A-Za-z0-9._-]/g, "-")}-embodiment-shortlist.json`;
  anchor.click(); URL.revokeObjectURL(url);
}
