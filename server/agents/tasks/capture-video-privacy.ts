/** The upload gate asks only whether the clip centres identifiable people. */
import { z } from "zod";

import { getGeminiVideoModel } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

export const captureVideoPrivacyOutputSchema = z.object({
  decision: z.enum(["clear", "hold", "uncertain"]),
  // No free text in the receipt: a model must not describe a person here.
  evidence_seconds: z.array(z.number().finite().nonnegative().max(86_400)).max(5),
}).strict();

export type CaptureVideoPrivacyOutput = z.infer<typeof captureVideoPrivacyOutputSchema>;
export type CaptureVideoPrivacyInput = { taskVideoUrl: string };

export const captureVideoPrivacyTask: StructuredTaskDefinition<
  CaptureVideoPrivacyInput, CaptureVideoPrivacyOutput
> = {
  kind: "capture_video_privacy",
  default_provider: "gemini_video",
  model_by_provider: { gemini_video: getGeminiVideoModel() },
  video_processing_mode: "STATIC",
  video_max_output_tokens: 8_192,
  output_schema: captureVideoPrivacyOutputSchema,
  tool_policy: { mode: "api", prefer_direct_api: true },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `Review this video only for the upload privacy gate. The question is whether the footage centres on identifiable people rather than the work area. Check the sampled frames across the clip; do not infer from any task description.

Do not include prose or any other field. Never describe or identify a person, including appearance, clothing, role, age, or gender.

Use hold when identifiable people are the main subject. Incidental people who pass through a view of the work area do not by themselves require hold. Use clear only when the video is sufficiently visible to decide it does not centre on identifiable people. Use uncertain if visibility or the sampled views cannot settle that question. Do not treat uncertainty as clear.`,
      returnShape: { decision: "clear | hold | uncertain", evidence_seconds: [] },
      payload: input,
    });
  },
};
