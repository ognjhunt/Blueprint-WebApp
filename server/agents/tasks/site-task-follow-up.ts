import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";

/**
 * Picks which follow-up questions a site sees after it sent its task and
 * video. The model chooses topic ids only; the question text, the authority
 * and the limit of three stay in code (utils/siteTaskFollowUp.ts), and a
 * fixed list is used whenever this lane does not answer.
 *
 * One picker call is one provider request with a 600-token output ceiling:
 * the schema accepts whatever ids the model returns (or none) and the code
 * filters them, so an off-list id, more than three ids or a missing list never
 * starts a correction round, and an answer that is not JSON gets none either.
 * The stored run keeps a digest of the site's text, never the text.
 */
export const siteTaskFollowUpOutputSchema = z.object({
  question_ids: z.unknown().optional(),
});

export type SiteTaskFollowUpInput = {
  taskStatement: string;
  briefSummary: string;
  itemLabels: string[];
  eligible: string[];
};

export const SITE_TASK_FOLLOW_UP_INSTRUCTION = "Select at most 3 useful missing topics for a site operator after they submitted a robot task and video. "
  + "Use only eligible IDs. Prefer questions that change how the task or its success is understood. "
  + "Do not infer answers or invent objects. Return JSON only: {\"question_ids\":[\"id\"]}.";

export const siteTaskFollowUpTask: StructuredTaskDefinition<
  SiteTaskFollowUpInput,
  z.infer<typeof siteTaskFollowUpOutputSchema>
> = {
  kind: "site_task_follow_up",
  default_provider: getStructuredAutomationProvider("site_task_follow_up"),
  model_by_provider: getTaskModelByProvider("site_task_follow_up"),
  max_output_tokens_ceiling: 600,
  max_output_corrections: 0,
  persist_content: "redacted",
  output_schema: siteTaskFollowUpOutputSchema,
  tool_policy: { mode: "api", prefer_direct_api: true },
  build_prompt(input) {
    return `${SITE_TASK_FOLLOW_UP_INSTRUCTION}\n\n${JSON.stringify({
      taskStatement: input.taskStatement,
      briefSummary: input.briefSummary,
      itemLabels: input.itemLabels,
      eligible: input.eligible,
    })}`;
  },
};
