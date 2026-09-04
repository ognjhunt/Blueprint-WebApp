import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { rigidDestinationSchema } from "./taskEvaluationLaunchPreparationContract";

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
const publicText = (maximum: number) => z.string().trim().min(1).max(maximum).refine(
  (value) => !/(?:\b(?:s3|gs|file|https?):\/\/|\/(?:var|etc|opt|private|tmp)\/|api[_ -]?key|credential|secret)/i.test(value),
  "public display text contains a private locator or credential term",
);
const publicDisplayAllowedFields = [
  "status",
  "scene_identity",
  "task_identity",
  "task_kind",
  "task_strategy",
  "public_title",
  "public_summary",
  "public_category",
  "thumbnail",
  "proof_boundary",
] as const;
const evaluationAdmission = z.object({
  zero_action_required: z.literal(true),
  scripted_positive_required: z.literal(true),
  learned_policy_evaluation_admitted: z.boolean(),
}).strict();
const publicDisplay = z.object({
  schema_version: z.literal("task_evaluation_configured_scene_public_display.v1"),
  status: z.literal("authorized"),
  source_authorization_digest: digest,
  source_offering_digest: digest,
  public_slug: z.string().min(1).max(96).regex(/^[a-z0-9][a-z0-9-]*$/),
  title: publicText(120),
  summary: publicText(500),
  category: publicText(80),
  allowed_fields: z.tuple(publicDisplayAllowedFields.map((field) => z.literal(field)) as [
    z.ZodLiteral<"status">,
    z.ZodLiteral<"scene_identity">,
    z.ZodLiteral<"task_identity">,
    z.ZodLiteral<"task_kind">,
    z.ZodLiteral<"task_strategy">,
    z.ZodLiteral<"public_title">,
    z.ZodLiteral<"public_summary">,
    z.ZodLiteral<"public_category">,
    z.ZodLiteral<"thumbnail">,
    z.ZodLiteral<"proof_boundary">,
  ]),
  scene_identity_digest: digest,
  configured_scene_revision_digest: digest,
  task_thumbnail_digest: digest,
  projection_digest: digest,
}).strict().superRefine((projection, context) => {
  if (
    canonicalArtifactDigest(
      projection as unknown as Record<string, unknown>,
      "projection_digest",
    ) !== projection.projection_digest
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "configured scene public projection digest mismatch",
  });
});

export const configuredSceneOfferingSchema = z.object({
  schema_version: z.literal("task_evaluation_configured_scene_offering.v1"),
  status: z.enum(["launch_ready", "configured_controls_pending", "evaluation_ready"]),
  configuration_run_id: identifier,
  team_namespace: identifier,
  catalog_visibility: z.literal("team_only"),
  scene_identity: identity,
  task: z.object({
    identity,
    kind: z.string().trim().min(1).max(192),
    strategy: z.string().trim().min(1).max(192),
    subject_identity: identity,
    destination: rigidDestinationSchema
      .omit({ placement_qualification: true })
      .required({ native_import_qualification: true, geometry: true })
      .optional(),
  }).strict(),
  presentation: z.object({
    task_thumbnail: taskThumbnailReference,
    selection_receipt: artifactReference,
    selection: z.object({
      camera_id: z.string().trim().min(1).max(192),
      frame_digest: digest,
      rationale: z.string().trim().min(1).max(1_000),
      appearance_review_status: z.enum(["accepted", "paused_ungraded"]).optional(),
      reviewer: z.object({
        kind: z.enum(["ai", "system"]),
        identity: z.string().trim().min(1).max(200),
        runtime: z.string().trim().min(1).max(200),
        model: z.string().trim().min(1).max(200),
      }).strict(),
    }).strict(),
    appearance_review_status: z.enum(["accepted", "paused_ungraded"]).optional(),
    selected_from_exact_reviewed_frame_count: z.union([z.literal(0), z.literal(8)]),
    warning_label: z.literal("Visual review paused - appearance ungraded").optional(),
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
    appearance_visual_review_completed: z.boolean().optional(),
    appearance_quality_graded: z.boolean().optional(),
    appearance_review_status: z.enum(["accepted", "paused_ungraded"]).optional(),
    appearance_warning_label: z.literal("Visual review paused - appearance ungraded").optional(),
    configuration_is_policy_evaluation: z.literal(false),
    configuration_is_deployment_or_safety_approval: z.literal(false),
  }).strict(),
  evaluation_admission: evaluationAdmission.optional(),
  public_display: publicDisplay.optional(),
  offering_digest: digest,
}).strict().superRefine((offering, context) => {
  if (
    offering.task.strategy === "pick_and_place"
    && (
      !offering.task.destination
      || offering.task.destination.identity.id === offering.task.subject_identity.id
    )
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "pick-and-place offering requires a distinct destination probe contract",
  });
  if (offering.presentation.selection.frame_digest !== offering.presentation.task_thumbnail.digest) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selected frame digest must match task thumbnail digest",
    });
  }
  const reviewStatus = offering.presentation.appearance_review_status ?? "accepted";
  if (
    (offering.presentation.selection.appearance_review_status ?? reviewStatus) !== reviewStatus
    || (offering.proof_boundary.appearance_review_status ?? reviewStatus) !== reviewStatus
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "appearance review status bindings must match",
  });
  if (reviewStatus === "paused_ungraded") {
    if (
      offering.presentation.selected_from_exact_reviewed_frame_count !== 0
      || offering.presentation.selection.reviewer.kind !== "system"
      || offering.presentation.warning_label !== "Visual review paused - appearance ungraded"
      || offering.proof_boundary.appearance_visual_review_completed !== false
      || offering.proof_boundary.appearance_quality_graded !== false
      || offering.proof_boundary.appearance_warning_label
        !== "Visual review paused - appearance ungraded"
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ungraded appearance offering must preserve its warning boundary",
    });
  } else if (
    offering.presentation.selected_from_exact_reviewed_frame_count !== 8
    || offering.presentation.selection.reviewer.kind !== "ai"
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "accepted appearance offering must bind an AI-reviewed frame",
  });
  const actualDigest = canonicalArtifactDigest(
    offering as unknown as Record<string, unknown>,
    "offering_digest",
  );
  if (actualDigest !== offering.offering_digest) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "configured scene offering digest mismatch",
  });
  if (
    offering.status === "configured_controls_pending"
    && offering.evaluation_admission?.learned_policy_evaluation_admitted !== false
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "controls-pending offering must keep learned policy evaluation locked",
  });
  if (
    offering.status === "evaluation_ready"
    && offering.evaluation_admission?.learned_policy_evaluation_admitted !== true
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "evaluation-ready offering must admit learned policy evaluation",
  });
  if (offering.public_display) {
    const projection = offering.public_display;
    const sourceOffering = structuredClone(
      offering as unknown as Record<string, unknown>,
    );
    delete sourceOffering.public_display;
    const expectedSceneIdentityDigest = canonicalArtifactDigest(
      offering.scene_identity as unknown as Record<string, unknown>,
      "scene_identity_digest",
    );
    if (
      projection.source_offering_digest
        !== canonicalArtifactDigest(sourceOffering, "offering_digest")
      || projection.scene_identity_digest !== expectedSceneIdentityDigest
      || projection.configured_scene_revision_digest
        !== offering.evaluation_preparation_binding.configured_scene_revision_digest
      || projection.task_thumbnail_digest !== offering.presentation.task_thumbnail.digest
      || !["configured_controls_pending", "evaluation_ready"].includes(offering.status)
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "configured scene public projection binding mismatch",
    });
  }
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
  const requestDestination = request.task?.destination;
  const offeringDestination = offering.task.destination;
  const comparableRequestDestination = requestDestination
    ? Object.fromEntries(
      Object.entries(requestDestination).filter(([key]) => key !== "placement_qualification")
    )
    : undefined;
  const destinationMatches = offeringDestination
    ? Boolean(comparableRequestDestination)
      && canonicalArtifactDigest(
        comparableRequestDestination as Record<string, unknown>,
        "placement_qualification",
      ) === canonicalArtifactDigest(
        offeringDestination as unknown as Record<string, unknown>,
        "placement_qualification",
      )
    : requestDestination === undefined;
  return ["episode_evaluation", "destination_qualification"].includes(request.run_mode)
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
    && request.task?.configured_scene_revision_digest === binding.configured_scene_revision_digest
    && destinationMatches;
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
