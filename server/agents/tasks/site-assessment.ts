import { z } from "zod";
import { SITE_ASSESSMENT_INSTRUCTIONS, SITE_ASSESSMENT_MODEL, siteAssessmentSchema } from "../site-assessment";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

/** The existing admin session records the supplied conversation, never a URL. */
export const siteAssessmentTaskInput = z.object({
  message: z.string().min(1).max(8000),
  context: z.object({ request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/) }).strict(),
}).strict();
export const assessmentReadActions = ["analyze_site_video", "search_robot_knowledge", "fetch_robot_knowledge", "read_robot_registry"];
export const siteAssessmentTask: StructuredTaskDefinition<z.infer<typeof siteAssessmentTaskInput>, z.infer<typeof siteAssessmentSchema>> = {
  kind: "site_assessment", default_provider: "openai_responses",
  model_by_provider: { openai_responses: SITE_ASSESSMENT_MODEL }, output_schema: siteAssessmentSchema,
  tool_policy: { mode: "api", prefer_direct_api: true, allowed_actions: assessmentReadActions },
  session_policy: { dispatch_mode: "collect", lane: "session", max_concurrent: 1 },
  build_prompt: input => buildCacheFriendlyPrompt({
    instructions: SITE_ASSESSMENT_INSTRUCTIONS,
    returnShape: { status: "assessment | needs_operator_input", job: [],
      objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [],
      next_action: { kind: "ask_operator | inspect_video | measure | research | robot_trial | process_change | no_robot", action: "",
        why: { text: "", basis: "unknown", evidence: [] } }, questions: [] },
    payload: input,
  }),
  build_outcome_contract: () => ({
    objective: "Assess one admitted site's job using video, operator statements and sourced robot evidence.",
    success_criteria: ["Return the six assessment sections, including uncertainties and a useful next action."],
    self_checks: ["Select admitted observations or qualified fields; factual text is rendered from sources, while unbound interpretations remain unverified.",
      "Preserve missing facts and the no-robot option; a source-bound report is not proof of robot suitability."],
    proof_requirements: ["Retain site_assessment.v2 source-bound output, raw unverified model prose, source provenance, tool receipts and provider accounting."],
    pass_threshold: 0.75, bounded_scope: "One internal advisory assessment; no fulfillment or qualification changes.",
  }),
};
