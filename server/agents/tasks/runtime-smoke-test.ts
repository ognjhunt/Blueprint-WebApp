import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { operatorThreadOutputSchema } from "./operator-thread";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

/**
 * The runtime smoke test: one call whose whole prompt is written here. It
 * reads nothing from its input, has no tools and carries no site data and no
 * one's personal information (data class `fixed_text`), so it runs on the
 * default order through the data-class gate and connectivity checks keep
 * working where the staff lane fails closed.
 */
export const RUNTIME_SMOKE_TEST_MESSAGE =
  'Answer with reply="Agent runtime smoke test passed.", summary="Smoke test completed successfully.", suggested_actions=["Continue integration"], requires_human_review=false.';

export const runtimeSmokeTestTask: StructuredTaskDefinition<Record<string, never>, {
  reply: string; summary: string; suggested_actions: string[]; requires_human_review: boolean;
}> = {
  kind: "runtime_smoke_test",
  default_provider: getStructuredAutomationProvider("runtime_smoke_test"),
  model_by_provider: getTaskModelByProvider("runtime_smoke_test"),
  output_schema: operatorThreadOutputSchema,
  tool_policy: { mode: "api", prefer_direct_api: true },
  build_prompt() {
    return buildCacheFriendlyPrompt({
      instructions: "You are a connectivity check. Output JSON only. No markdown. No explanation outside JSON.",
      returnShape: { reply: "", summary: "", suggested_actions: [], requires_human_review: false },
      // Fixed text only: the input is never read.
      payload: { message: RUNTIME_SMOKE_TEST_MESSAGE },
    });
  },
};
