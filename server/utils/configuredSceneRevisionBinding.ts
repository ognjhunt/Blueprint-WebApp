/**
 * How a configured scene offering binds its revision file to the revision's
 * own digest. A leaf module (zod only), so screening readback can use it
 * without importing the whole offering contract.
 */
import { z } from "zod";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const sourceCommit = z.string().regex(/^[0-9a-f]{40}$/);

export const configuredSceneArtifactReference = z.object({
  uri: z.string().regex(/^(?:gs|s3|https):\/\/[^\s]+$/),
  digest,
  size_bytes: z.number().int().positive(),
}).strict();

/**
 * Binds the configured scene revision file (`configured_scene_revision`: its
 * uri, the sha256 of its bytes, its size) to the revision's own self-digest
 * (`configured_scene_revision_digest`). Those are two kinds of digest; only
 * this binding relates them.
 */
export const evaluationPreparationBindingSchema = z.object({
  // The Pipeline has sent these three since 2026-10-09 (Pipeline #2660); a
  // strict binding without them refused every website publication sync.
  // The binding prepares an evaluation and never claims one ran.
  artifact_purpose: z.literal("evaluation_preparation").optional(),
  robot_evaluation_performed: z.literal(false).optional(),
  robot_setup_requirements: z.array(z.record(z.string(), z.unknown())).min(1).max(16).optional(),
  scene_mode: z.literal("reuse_configured_revision"),
  construction_mode: z.literal("reuse_configured_scene"),
  task_binding_mode: z.literal("reuse_configured_template"),
  configuration_source_commit: sourceCommit,
  configured_scene_revision: configuredSceneArtifactReference,
  configured_scene_revision_digest: digest,
  configured_scene_bundle: configuredSceneArtifactReference,
}).strict();

/** The same uri, byte digest and size, and nothing else. */
export function sameArtifactReference(
  left: unknown,
  right: { uri: string; digest: string; size_bytes: number },
) {
  if (!left || typeof left !== "object" || Array.isArray(left)) return false;
  const record = left as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "digest,size_bytes,uri") return false;
  return record.uri === right.uri
    && record.digest === right.digest
    && record.size_bytes === right.size_bytes;
}
