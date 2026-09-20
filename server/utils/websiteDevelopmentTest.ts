import { z } from "zod";

export const websiteDevelopmentTestEnvironment = z.object({
  kind: z.literal("authored_surface_component_test"),
  label: z.literal("Development test on an authored surface; captured scene integration pending."),
  claim_scope: z.literal("development_only"),
  source_task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  source_preparation_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  captured_scene_integration: z.literal("pending"),
  captured_scene_evaluation_allowed: z.literal(false),
  source_scene_blockers: z.array(z.string()).max(20),
}).strict();

