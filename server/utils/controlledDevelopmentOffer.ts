/** ADP-050/day 28: private development offers never enter qualified supply. */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { taskListingSchema } from "./taskListingDetails";

export const DEVELOPMENT_OFFERS = "controlledDevelopmentOffers";
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/);
export const developmentOfferSchema = z.object({
  schema_version: z.literal("blueprint.controlled_development_offer.v1"),
  evidence_scope: z.literal("development_only"),
  qualification_eligible: z.literal(false),
  enabled: z.boolean(),
  requestId: identity,
  allowed_checkpoint_runtimes: z.array(z.enum(["customer_hosted", "controller_adapter", "model_artifact"])).min(1).max(3),
  allowed_team_ids: z.array(identity).min(1).max(100),
  expires_at_iso: z.string().datetime(),
  authorization_reference: z.string().trim().min(8).max(500),
  rights_verified: z.literal(true),
  native_canary_receipt_digest: digest,
  details: taskListingSchema,
  policy_interface: z.object({contract_digest: digest,
    robot: z.record(z.unknown()), observation_schema: z.record(z.unknown()),
    action_schema: z.record(z.unknown())}).strict(),
  execution_facts: z.object({captureEvidenceClass: z.literal("geometry"), taskId: identity, taskFamily: identity,
    captureDigest: digest, testbedDigest: digest, testbedId: identity,
    testbedVersion: z.string().min(1).max(80), siteId: identity, captureId: identity}).strict(),
  agent_execution_offer: z.object({schema_version: z.literal("blueprint.agent_execution_offer.v1"),
    scene_id: identity, capture_id: identity, capture_root: z.string().min(2).max(1000),
    scenario_id: identity, episode_count: z.literal(1), episode_specs_sha256: digest,
    policy_execution_profiles: z.array(z.enum(["controlled_observation_v1", "onnx_state_mlp_cpu_v1"])).min(1).max(2),
  }).strict(),
}).strict().superRefine((row, context) => {
  const offer = row.agent_execution_offer;
  if (offer.capture_id !== row.execution_facts.captureId || offer.scene_id !== row.execution_facts.siteId
      || !offer.capture_root.startsWith("/") || offer.capture_root.split("/").includes("..")
      || !offer.capture_root.endsWith(`/scenes/${offer.scene_id}/captures/${offer.capture_id}`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Development offer capture binding mismatch" });
  }
});

export function developmentOfferForTeam(value: unknown, teamId: string) {
  const parsed = developmentOfferSchema.safeParse(value);
  return parsed.success && parsed.data.enabled && parsed.data.allowed_team_ids.includes(teamId)
    && Date.parse(parsed.data.expires_at_iso) > Date.now() ? parsed.data : null;
}

export async function loadTaskForTeam(sceneId: string, teamId: string): Promise<Record<string, any> | null> {
  if (!db) return null;
  const production = await db.collection("inboundRequests").doc(sceneId).get();
  if (production.exists) return production.data() ?? null;
  const development = await db.collection(DEVELOPMENT_OFFERS).doc(sceneId).get();
  return developmentOfferForTeam(development.data(), teamId);
}
