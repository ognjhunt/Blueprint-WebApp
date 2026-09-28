import { createHash } from "node:crypto";
import { z } from "zod";

/** ADP-011/day 7: compatibility is explicit, never inferred from a filename. */
export const MODEL_RUNNER_PROFILE = "onnx_state_mlp_cpu_v1" as const;
export const MODEL_MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const field = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const channel = z.object({
  name: field,
  raw_accepted_bounds: z.tuple([z.number().finite(), z.number().finite()])
    .refine(([lo, hi]) => lo < hi, "Action bounds must increase"),
  unit: z.string().trim().min(1).max(64),
}).strict();

export const modelInterfaceSchema = z.object({
  schema_version: z.literal("blueprint.policy_model_interface.v1"),
  runner_profile: z.literal(MODEL_RUNNER_PROFILE),
  input_name: field,
  output_name: field,
  state_fields: z.array(z.object({
    name: field, width: z.number().int().min(1).max(1024),
    unit: z.string().trim().min(1).max(64),
  }).strict())
    .min(1).max(32).refine((fields) => new Set(fields.map((f) => f.name)).size === fields.length)
    .refine((fields) => fields.reduce((n, f) => n + f.width, 0) <= 1024),
  action_schema: z.object({ chunk_rows: z.number().int().min(1).max(128), channels: z.array(channel).min(1).max(128) }).strict(),
  preprocessing: z.literal("embedded_in_model_graph"),
}).strict();
export type PolicyModelInterface = z.infer<typeof modelInterfaceSchema>;

export interface PolicyModelArtifact {
  schema_version: "blueprint.policy_model_artifact.v1";
  artifact_id: string;
  uri: string;
  sha256: string;
  size_bytes: number;
  storage_generation: string;
  interface: PolicyModelInterface;
  compatibility_status: "uploaded_pending_runner_validation";
}

export function modelBytesDigest(bytes: Buffer): string {
  if (bytes.length < 1 || bytes.length > MODEL_MAX_UPLOAD_BYTES) throw new Error("policy_model_size_invalid");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function validatePrivateModelBucket(bucket: string): string {
  if (!/^[a-z0-9][a-z0-9._-]{2,221}[a-z0-9]$/.test(bucket)) throw new Error("policy_model_private_bucket_required");
  return bucket;
}
