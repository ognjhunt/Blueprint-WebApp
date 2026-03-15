import { z } from "zod";

const derivedAssetEntrySchema = z.object({
  status: z.string().min(1),
  manifest_uri: z.string().optional(),
  artifact_uri: z.string().optional(),
  updated_at: z.union([z.string(), z.null()]).optional(),
}).passthrough();

const buyerTrustScoreSchema = z.object({
  score: z.number(),
  band: z.enum(["high", "medium", "low"]),
  reasons: z.array(z.string()).default([]),
});

const providerRunSummarySchema = z.object({
  provider_name: z.string().optional(),
  provider_model: z.string().optional(),
  provider_run_id: z.string().optional(),
  status: z.string().optional(),
  preview_manifest_uri: z.string().optional(),
  cost_usd: z.number().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  provenance: z.record(z.unknown()).nullable().optional(),
}).passthrough();

const deploymentReadinessSchema = z.object({
  qualification_state: z.string().optional(),
  opportunity_state: z.string().optional(),
  buyer_trust_score: buyerTrustScoreSchema.optional(),
  qualification_summary: z.record(z.unknown()).nullable().optional(),
  capture_quality_summary: z.record(z.unknown()).nullable().optional(),
  rights_and_compliance: z.record(z.unknown()).optional(),
  privacy_processing: z.record(z.unknown()).optional(),
  missing_evidence: z.array(z.string()).optional(),
  preview_status: z.string().nullable().optional(),
  provider_run: providerRunSummarySchema.nullable().optional(),
}).passthrough();

export const pipelineAttachmentSyncPayloadSchema = z.object({
  schema_version: z.literal("v1"),
  site_submission_id: z.string().optional().default(""),
  request_id: z.string().optional().default(""),
  buyer_request_id: z.string().optional().default(""),
  capture_job_id: z.string().optional().default(""),
  scene_id: z.string().optional().default(""),
  capture_id: z.string().optional().default(""),
  pipeline_prefix: z.string().optional().default(""),
  qualification_state: z.string().optional().default(""),
  opportunity_state: z.string().optional().default(""),
  authoritative_state_update: z.boolean().optional().default(false),
  artifacts: z.record(z.unknown()).optional().default({}),
  derived_assets: z.record(derivedAssetEntrySchema).optional().default({}),
  deployment_readiness: deploymentReadinessSchema.optional(),
});

export type PipelineAttachmentSyncPayload = z.infer<
  typeof pipelineAttachmentSyncPayloadSchema
>;

export function parsePipelineAttachmentSyncPayload(
  payload: unknown,
): PipelineAttachmentSyncPayload {
  return pipelineAttachmentSyncPayloadSchema.parse(payload);
}
