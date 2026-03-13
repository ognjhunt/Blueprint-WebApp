import { z } from "zod";

const derivedAssetEntrySchema = z.object({
  status: z.string().min(1),
  manifest_uri: z.string().optional(),
  artifact_uri: z.string().optional(),
  updated_at: z.union([z.string(), z.null()]).optional(),
}).passthrough();

export const pipelineAttachmentSyncPayloadSchema = z.object({
  schema_version: z.literal("v1"),
  site_submission_id: z.string().optional().default(""),
  request_id: z.string().optional().default(""),
  scene_id: z.string().optional().default(""),
  capture_id: z.string().optional().default(""),
  pipeline_prefix: z.string().optional().default(""),
  qualification_state: z.string().optional().default(""),
  opportunity_state: z.string().optional().default(""),
  authoritative_state_update: z.boolean().optional().default(false),
  artifacts: z.record(z.unknown()).optional().default({}),
  derived_assets: z.record(derivedAssetEntrySchema).optional().default({}),
});

export type PipelineAttachmentSyncPayload = z.infer<
  typeof pipelineAttachmentSyncPayloadSchema
>;

export function parsePipelineAttachmentSyncPayload(
  payload: unknown,
): PipelineAttachmentSyncPayload {
  return pipelineAttachmentSyncPayloadSchema.parse(payload);
}
