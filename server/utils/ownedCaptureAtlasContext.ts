/** Owned-upload source/task context. A valid digest grants no disclosure or spend. */
import { z } from "zod";
import { matchesCrossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { captureUploadIntakeReceiptSchema } from "./captureUploadForwarding";
import { parseVerifiedCaptureQaPublication } from "./captureQaContract";

const sha = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const object = z.record(z.string(), z.unknown());
export const ownedCaptureAtlasContextSchema = z.object({
  schema_version: z.literal("owned_capture_atlas_context.v1"),
  request_id: identifier, capture_id: identifier, intake_id: identifier, scene_id: identifier,
  source_scene_id: identifier.nullable(),
  scene_identity_basis: z.enum(["source_scene_id", "capture_session_identity"]),
  purpose: z.literal("scene_preparation"), description: z.string().refine(value => value.trim().length > 0),
  task_specification: object, task_family: z.string().min(1),
  task_confirmation_status: z.unknown(),
  source_capture: z.object({ capture_digest: sha, envelope_digest: sha,
    qa_report_digest: sha, object_manifest_digest: sha,
    capture_authority_profile: z.string().min(1) }).strict(),
  governance: object, permitted_reconstruction_providers: z.array(z.string()),
  permitted_evidence_uses: z.array(z.string()), coordinate_frame_declaration: object,
  authority_issued: z.literal(false), context_digest: sha,
}).strict();
export type OwnedCaptureAtlasContext = z.infer<typeof ownedCaptureAtlasContextSchema>;

export function validateOwnedCaptureAtlasContext(value: unknown): OwnedCaptureAtlasContext {
  const parsed = ownedCaptureAtlasContextSchema.safeParse(value);
  if (!parsed.success) throw new Error("owned_capture_atlas_context_schema_invalid");
  const context = parsed.data;
  if (!matchesCrossRuntimeArtifactDigest(context, "context_digest"))
    throw new Error("owned_capture_atlas_context_digest_mismatch");
  const task = context.task_specification;
  if (!Object.hasOwn(context, "task_confirmation_status") || context.description !== task.description
    || context.task_family !== (task.task_family || "general_task")
    || crossRuntimeDigest(context.task_confirmation_status) !== crossRuntimeDigest(
      Object.hasOwn(task, "success_parameters_status") ? task.success_parameters_status : "unknown"))
    throw new Error("owned_capture_atlas_task_binding_mismatch");
  if (context.scene_id !== (context.source_scene_id || context.capture_id)
    || context.scene_identity_basis !== (context.source_scene_id ? "source_scene_id" : "capture_session_identity"))
    throw new Error("owned_capture_atlas_scene_binding_mismatch");
  return context;
}

/** Reopen the real owned session, not a fabricated site/recording attestation.
 * `value` must be the authenticated Pipeline plan response or that retained plan.
 * Pipeline must additionally re-open the actual manifest and bytes before every
 * disclosure. This WebApp projection alone is never provider authority.
 */
export function requireOwnedCaptureAtlasSource(input: {
  session: Record<string, any>; ownerUid: string; context: unknown;
}): OwnedCaptureAtlasContext {
  const record = input.session;
  if (!input.ownerUid || record.owner_user_id !== input.ownerUid)
    throw new Error("owned_capture_atlas_owner_mismatch");
  if (record.capture_access?.future_processing_allowed === false || record.completed_capture_lifecycle)
    throw new Error("capture_revoked_or_expired");
  const context = validateOwnedCaptureAtlasContext(input.context);
  const receipt = captureUploadIntakeReceiptSchema.safeParse(record.pipeline_capture_intake_receipt);
  const qa = parseVerifiedCaptureQaPublication(record.pipeline_capture_qa);
  if (!receipt.success || !qa.ok || receipt.data.admission_status !== "accepted"
    || receipt.data.state !== "capture_accepted" || qa.publication.status !== "accepted"
    || qa.publication.state !== "capture_accepted")
    throw new Error("owned_capture_atlas_accepted_source_required");
  const source = context.source_capture, request = record.request;
  if (!request || context.capture_id !== record.session_id
    || context.intake_id !== request.intake_id
    || receipt.data.capture_session_id !== record.session_id || receipt.data.intake_id !== request.intake_id
    || qa.publication.capture_session_id !== record.session_id || qa.publication.intake_id !== request.intake_id
    || source.capture_digest !== receipt.data.capture_digest
    || source.envelope_digest !== receipt.data.envelope_digest
    || source.envelope_digest !== qa.publication.envelope_digest
    || source.qa_report_digest !== qa.publication.qa_report_digest
    || receipt.data.capture_qa_report.qa_report_digest !== source.qa_report_digest
    || source.capture_authority_profile !== request.capture_authority_profile
    || source.capture_authority_profile !== qa.publication.capture_authority_profile
    || context.source_scene_id !== (request.scene_id || null))
    throw new Error("owned_capture_atlas_source_binding_mismatch");
  for (const [key, expected] of Object.entries({
    task_specification: request.known_task_specification,
    governance: request.governance,
    coordinate_frame_declaration: request.coordinate_frame_declaration,
    permitted_reconstruction_providers: request.permitted_reconstruction_providers,
    permitted_evidence_uses: request.permitted_evidence_uses,
  })) {
    if (crossRuntimeDigest(context[key as keyof OwnedCaptureAtlasContext]) !== crossRuntimeDigest(expected))
      throw new Error("owned_capture_atlas_source_or_task_changed");
  }
  return context;
}
