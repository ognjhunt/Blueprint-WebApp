/** Thin signed owned-upload adapter to the existing native Atlas worker. */
import { z } from "zod";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { matchesCrossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import type { OwnedCaptureAtlasPreparationPlan } from "./reconstructionForwarding";

const sha = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const ownedAtlasExecutionSchema = z.object({
  schema_version: z.literal("owned_capture_atlas_execution.v1"),
  plan_id: z.string().regex(/^reconstruction-atlas-[0-9a-f]{24}$/),
  capture_id: z.string().min(1), intake_id: z.string().min(1),
  plan_digest: sha, task_context_digest: sha, source_video_digest: sha, authorization_digest: sha,
  state: z.enum(["processing", "ready", "needs_input", "failed", "withdrawn"]),
  stage: z.string().min(1).max(128), reason: z.string().regex(/^[a-z][a-z0-9_]{0,119}$/).nullable(),
  revision: z.number().int().positive(), updated_at_epoch: z.number().finite().positive(),
  bundle: z.object({ digest: sha, size_bytes: z.number().int().positive(),
    filename: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,299}\.zip$/), manifest_digest: sha }).strict().nullable(),
  splat_available: z.boolean(), mesh_available: z.boolean(),
  provider_cleanup_state: z.enum(["not_started", "pending", "complete", "failed"]),
  claim_ceiling: z.literal("development_only"), scale_status: z.literal("unscaled_provider_world_units"),
  proof_boundary: z.object({ derived_reconstruction_upgrades_raw_capture: z.literal(false),
    metric_or_collision_qualification_established: z.literal(false), robot_execution_established: z.literal(false),
    physical_task_success_established: z.literal(false) }).strict(),
  execution_digest: sha,
}).strict().superRefine((value, issue) => {
  if (!matchesCrossRuntimeArtifactDigest(value, "execution_digest")
    || value.state !== "ready" && value.bundle !== null)
    issue.addIssue({ code: "custom", message: "owned_atlas_execution_binding_invalid" });
});
export type OwnedAtlasExecution = z.infer<typeof ownedAtlasExecutionSchema>;

export function matchesOwnedAtlasPlan(value: OwnedAtlasExecution, plan: OwnedCaptureAtlasPreparationPlan) {
  return value.plan_id === plan.plan_id && value.capture_id === plan.source_context.capture_id
    && value.intake_id === plan.source_context.intake_id && value.plan_digest === plan.plan_digest
    && value.task_context_digest === plan.source_context.context_digest && value.source_video_digest === plan.source_video_digest;
}

type Operation = "execute" | "retry" | "inspect" | "bundle";
function signedCommand(operation: Operation, command: Record<string, unknown>) {
  const contract = { execute: "execution", retry: "retry", inspect: "inspection", bundle: "bundle" }[operation];
  const body = JSON.stringify({ schema_version: `owned_capture_atlas_${contract}_submission.v1`, ...command });
  const origin = signedWebsitePipelineRequest(`/api/live-pipeline/reconstructions/atlas-${operation}`, body);
  return origin && { ...origin, body, headers: { ...origin.headers, "content-type": "application/json" } };
}

async function request(operation: "execute" | "retry" | "inspect", command: Record<string, unknown>,
  plan: OwnedCaptureAtlasPreparationPlan): Promise<OwnedAtlasExecution> {
  const origin = signedCommand(operation, command);
  if (!origin) throw new Error("owned_capture_atlas_delivery_not_configured");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(origin.url, { method: "POST", body: origin.body,
      headers: origin.headers, redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(`owned_capture_atlas_${operation}_http_${response.status}`);
    const value = ownedAtlasExecutionSchema.parse(await response.json());
    if (!matchesOwnedAtlasPlan(value, plan)) throw new Error("owned_capture_atlas_result_source_mismatch");
    return value;
  } finally { clearTimeout(timeout); }
}

export function executeOwnedAtlas(plan: OwnedCaptureAtlasPreparationPlan, ownerUid: string, idempotencyKey: string) {
  return request("execute", { plan_id: plan.plan_id, owner_user_id: ownerUid,
    task_context_digest: plan.source_context.context_digest, source_video_digest: plan.source_video_digest,
    idempotency_key: idempotencyKey }, plan);
}
export function retryOwnedAtlas(plan: OwnedCaptureAtlasPreparationPlan, ownerUid: string, idempotencyKey: string) {
  return request("retry", { plan_id: plan.plan_id, owner_user_id: ownerUid,
    task_context_digest: plan.source_context.context_digest, source_video_digest: plan.source_video_digest,
    idempotency_key: idempotencyKey }, plan);
}
export function inspectOwnedAtlas(plan: OwnedCaptureAtlasPreparationPlan, ownerUid: string) {
  return request("inspect", { plan_id: plan.plan_id, owner_user_id: ownerUid }, plan);
}
export function ownedAtlasBundleRequest(planId: string, ownerUid: string, digest: string) {
  return signedCommand("bundle", { plan_id: planId, owner_user_id: ownerUid, digest });
}
