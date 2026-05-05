import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

export const previewDiagnosisOutputSchema = z.object({
  disposition: z.enum([
    "retry_now",
    "retry_later",
    "blocked_release_risk",
    "provider_escalation",
    "not_actionable",
  ]),
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  queue: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
  retry_recommended: z.boolean(),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1400),
  internal_summary: z.string().min(1).max(1600),
});

export type PreviewDiagnosisInput = {
  requestId: string;
  siteWorldId?: string | null;
  preview_status?: string | null;
  provider_name?: string | null;
  provider_model?: string | null;
  provider_run_id?: string | null;
  failure_reason?: string | null;
  preview_manifest_uri?: string | null;
  worldlabs_operation_manifest_uri?: string | null;
  worldlabs_world_manifest_uri?: string | null;
};

export const previewDiagnosisTask: StructuredTaskDefinition<
  PreviewDiagnosisInput,
  z.infer<typeof previewDiagnosisOutputSchema>
> = {
  kind: "preview_diagnosis",
  default_provider: getStructuredAutomationProvider(),
  model_by_provider: getTaskModelByProvider("preview_diagnosis"),
  output_schema: previewDiagnosisOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are Blueprint's preview diagnosis specialist.

Analyze the preview failure state and decide whether the issue is transient, retryable, or needs escalation.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Use retry_now only when the failure looks transient and bounded.
- Use provider_escalation for repeated provider-side or artifact-side failures.
- Set requires_human_review=true when automation_status="blocked" or when the disposition is "provider_escalation" or "blocked_release_risk".
 - Use automation_status="blocked" with disposition="blocked_release_risk" when the release must fail closed until artifacts or provider state are corrected.`,
      returnShape: {
        disposition:
          "retry_now | retry_later | blocked_release_risk | provider_escalation | not_actionable",
        automation_status: "completed | blocked",
        block_reason_code: "string or null",
        retryable: false,
        queue: "",
        confidence: 0.0,
        requires_human_review: true,
        retry_recommended: false,
        next_action: "",
        rationale: "",
        internal_summary: "",
      },
      payload: input,
    });
  },
};
