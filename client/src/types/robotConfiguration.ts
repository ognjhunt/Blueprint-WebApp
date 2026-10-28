import { z } from "zod";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const robotConfigurationPreflightSchema = z.object({
  schema_version: z.literal("deployment_embodiment_configuration_preflight.v1"),
  status: z.enum(["requires_setup", "configured_not_executed"]),
  claim_ceiling: z.literal("configuration_only"),
  embodiment_id: z.string(), catalog_digest: digest, embodiment_digest: digest, request_digest: digest,
  model: z.object({ sha256: digest, size_bytes: z.number().int().nonnegative() }).strict(),
  model_file_digest_verified: z.boolean(),
  structure: z.object({ joint_count: z.number().int().nonnegative(), rigid_body_count: z.number().int().nonnegative() }).strict(),
  blockers: z.array(z.string().max(2000)).max(100), limitations: z.array(z.string().max(2000)).max(100),
  execution_authorized: z.literal(false), provider_mutation_performed: z.literal(false), preflight_digest: digest,
}).strict();
export type RobotConfigurationPreflight = z.infer<typeof robotConfigurationPreflightSchema>;
