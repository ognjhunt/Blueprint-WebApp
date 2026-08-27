import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const sourceCommit = z.string().regex(/^[0-9a-f]{40}$/);
const identifier = z.string().min(1).max(192).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const identity = z.object({
  id: identifier,
  version: identifier,
}).strict();
const artifactReference = z.object({
  uri: z.string().regex(/^(?:gs|s3|https):\/\/[^\s]+$/),
  digest,
  size_bytes: z.number().int().positive(),
}).strict();
const taskThumbnailReference = artifactReference.extend({
  size_bytes: z.number().int().positive().max(16 * 1024 * 1024),
});

export const configuredSceneOfferingSchema = z.object({
  schema_version: z.literal("task_evaluation_configured_scene_offering.v1"),
  status: z.literal("launch_ready"),
  configuration_run_id: identifier,
  team_namespace: identifier,
  catalog_visibility: z.literal("team_only"),
  scene_identity: identity,
  task: z.object({
    identity,
    kind: z.string().trim().min(1).max(192),
    strategy: z.string().trim().min(1).max(192),
    subject_identity: identity,
  }).strict(),
  presentation: z.object({
    task_thumbnail: taskThumbnailReference,
    selection_receipt: artifactReference,
    selection: z.object({
      camera_id: z.string().trim().min(1).max(192),
      frame_digest: digest,
      rationale: z.string().trim().min(1).max(1_000),
      reviewer: z.object({
        kind: z.literal("ai"),
        identity: z.string().trim().min(1).max(200),
        runtime: z.string().trim().min(1).max(200),
        model: z.string().trim().min(1).max(200),
      }).strict(),
    }).strict(),
    selected_from_exact_reviewed_frame_count: z.literal(8),
    derived_appearance_evidence: z.literal(true),
    capture_or_physical_evidence: z.literal(false),
    image_bytes_modified_after_selection: z.literal(false),
  }).strict(),
  evaluation_preparation_binding: z.object({
    scene_mode: z.literal("reuse_configured_revision"),
    construction_mode: z.literal("reuse_configured_scene"),
    task_binding_mode: z.literal("reuse_configured_template"),
    configuration_source_commit: sourceCommit,
    configured_scene_revision: artifactReference,
    configured_scene_revision_digest: digest,
    configured_scene_bundle: artifactReference,
  }).strict(),
  proof_boundary: z.object({
    thumbnail_is_derived_appearance_evidence: z.literal(true),
    thumbnail_is_capture_or_physical_evidence: z.literal(false),
    configuration_is_policy_evaluation: z.literal(false),
    configuration_is_deployment_or_safety_approval: z.literal(false),
  }).strict(),
  offering_digest: digest,
}).strict().superRefine((offering, context) => {
  if (offering.presentation.selection.frame_digest !== offering.presentation.task_thumbnail.digest) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selected frame digest must match task thumbnail digest",
    });
  }
  const actualDigest = canonicalArtifactDigest(
    offering as unknown as Record<string, unknown>,
    "offering_digest",
  );
  if (actualDigest !== offering.offering_digest) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "configured scene offering digest mismatch",
  });
});

export type ConfiguredSceneOffering = z.infer<typeof configuredSceneOfferingSchema>;

function sameIdentity(
  left: unknown,
  right: { id: string; version: string },
) {
  if (!left || typeof left !== "object" || Array.isArray(left)) return false;
  const record = left as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "id,version") return false;
  return record.id === right.id && record.version === right.version;
}

function sameArtifactReference(
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

export function configuredSceneOfferingBinding(
  offering: ConfiguredSceneOffering,
  sourceLaunchId: string,
) {
  return {
    source_launch_id: sourceLaunchId,
    offering_digest: offering.offering_digest,
    configured_scene_revision_digest:
      offering.evaluation_preparation_binding.configured_scene_revision_digest,
    configured_scene_bundle_digest:
      offering.evaluation_preparation_binding.configured_scene_bundle.digest,
    task_thumbnail_digest: offering.presentation.task_thumbnail.digest,
  };
}

export function preparationMatchesConfiguredSceneOffering(
  request: Record<string, any>,
  offering: ConfiguredSceneOffering,
) {
  const binding = offering.evaluation_preparation_binding;
  return request.run_mode === "episode_evaluation"
    && request.team_namespace === offering.team_namespace
    && request.scene?.mode === binding.scene_mode
    && sameIdentity(request.scene?.identity, offering.scene_identity)
    && sameArtifactReference(
      request.scene?.configured_revision,
      binding.configured_scene_revision,
    )
    && request.construction?.mode === binding.construction_mode
    && request.task?.binding_mode === binding.task_binding_mode
    && sameIdentity(request.task?.identity, offering.task.identity)
    && request.task?.kind === offering.task.kind
    && request.task?.strategy === offering.task.strategy
    && sameIdentity(request.task?.subject?.identity, offering.task.subject_identity)
    && request.task?.configured_scene_revision_digest === binding.configured_scene_revision_digest;
}

export function parseConfiguredSceneOfferingFromLaunchReceipt(receipt: Record<string, unknown>) {
  const terminalEvidence = receipt.terminal_evidence;
  if (!terminalEvidence || typeof terminalEvidence !== "object" || Array.isArray(terminalEvidence)) {
    return { ok: true as const, offering: null };
  }
  const sceneConfiguration = (terminalEvidence as Record<string, unknown>).scene_configuration;
  if (sceneConfiguration === undefined) return { ok: true as const, offering: null };
  if (!sceneConfiguration || typeof sceneConfiguration !== "object" || Array.isArray(sceneConfiguration)) {
    return { ok: false as const, blockers: ["configured_scene_offering_terminal_evidence_invalid"] };
  }
  const scene = sceneConfiguration as Record<string, unknown>;
  if (
    receipt.status !== "completed"
    || receipt.execute_requested !== true
    || !Array.isArray(receipt.blockers)
    || receipt.blockers.length !== 0
    || (terminalEvidence as Record<string, unknown>).status !== "passed"
  ) {
    if (scene.configured_scene_offering !== undefined) return {
      ok: false as const,
      blockers: ["configured_scene_offering_terminal_status_invalid"],
    };
    return { ok: true as const, offering: null };
  }
  const parsed = configuredSceneOfferingSchema.safeParse(scene.configured_scene_offering);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["configured_scene_offering_invalid"],
  };
  const offering = parsed.data;
  const binding = offering.evaluation_preparation_binding;
  const presentation = offering.presentation;
  if (
    scene.configured_scene_revision_digest !== binding.configured_scene_revision_digest
    || !sameArtifactReference(
      scene.configured_scene_revision_reference,
      binding.configured_scene_revision,
    )
    || !sameArtifactReference(
      scene.configured_scene_bundle_reference,
      binding.configured_scene_bundle,
    )
    || !sameArtifactReference(
      scene.task_thumbnail_reference,
      presentation.task_thumbnail,
    )
    || !sameArtifactReference(
      scene.task_thumbnail_selection_receipt_reference,
      presentation.selection_receipt,
    )
  ) return {
    ok: false as const,
    blockers: ["configured_scene_offering_terminal_binding_mismatch"],
  };
  return { ok: true as const, offering };
}
