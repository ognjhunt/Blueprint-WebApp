import { adpDiagnosisSchema } from "../adp-contract";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

export const adpRunOperatorTask: StructuredTaskDefinition<{ pipeline_task_id: string }> = {
  kind: "adp_run_operator", default_provider: "openai_agents_api",
  output_schema: adpDiagnosisSchema,
  tool_policy: { mode: "api", allowed_actions: ["inspect_admitted_task", "enqueue_admitted_task", "cancel_admitted_task", "cleanup_admitted_task"] },
  approval_policy: { require_human_approval: false, sensitive_actions: [], allow_preapproval: true },
  session_policy: { dispatch_mode: "collect", lane: "adp", max_concurrent: 1 },
  // The Pipeline controller owns the actual prompt, evidence and model. This
  // string is a product reference and is never sent directly to a provider.
  build_prompt: (input) => buildCacheFriendlyPrompt({
    instructions: "This is a Task Evaluation task reference. The admitted-task controller owns its prompt, tools and execution authority.",
    returnShape: { disposition: "no_action", summary: "", evidence_references: [], next_actions: [], uncertainty: [] },
    payload: input,
  }),
};
