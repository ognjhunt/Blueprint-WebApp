import OpenAI from "openai";

export const FOLLOW_UP_IDS = ["success_target", "item_photos", "item_weight", "item_make_model"] as const;
export type FollowUpId = (typeof FOLLOW_UP_IDS)[number];

export const FOLLOW_UP_QUESTIONS: Record<FollowUpId, { question: string; hint: string }> = {
  success_target: {
    question: "What would a good result look like?",
    hint: "For example: items completed, accuracy, or time per cycle. An estimate is fine.",
  },
  item_photos: {
    question: "Can you add photos of the items the robot handles?",
    hint: "Especially anything that was outside the video. A front and side view help.",
  },
  item_weight: {
    question: "About how much do the handled items weigh?",
    hint: "A range is fine. Include the unit and which item it applies to.",
  },
  item_make_model: {
    question: "Is there a brand or model we should know?",
    hint: "Only if a specific item or piece of equipment matters to this task.",
  },
};

export function allowedFollowUps(value: unknown, eligible: readonly FollowUpId[]): FollowUpId[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(eligible);
  return [...new Set(value.filter((id): id is FollowUpId =>
    typeof id === "string" && allowed.has(id as FollowUpId),
  ))].slice(0, 3);
}

/** The model selects topics only. Copy, authority, and the question limit stay in code. */
export async function selectFollowUps(input: {
  taskStatement: string;
  briefSummary: string;
  itemLabels: string[];
  eligible: FollowUpId[];
}): Promise<FollowUpId[]> {
  if (!input.eligible.length) return [];
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return input.eligible.slice(0, 3);

  try {
    const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 0 });
    const response = await client.responses.create({
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
      max_output_tokens: 600,
      input: [
        { role: "developer", content: "Select at most 3 useful missing topics for a site operator after they submitted a robot task and video. Use only eligible IDs. Prefer questions that change how the task or its success is understood. Do not infer answers or invent objects. Return JSON only: {\"question_ids\":[\"id\"]}." },
        { role: "user", content: JSON.stringify({
          taskStatement: input.taskStatement.slice(0, 3000),
          briefSummary: input.briefSummary.slice(0, 300),
          itemLabels: input.itemLabels.slice(0, 12),
          eligible: input.eligible,
        }) },
      ],
    });
    const parsed = JSON.parse(response.output_text || "{}");
    const selected = allowedFollowUps(parsed.question_ids, input.eligible);
    const essentials = input.eligible.filter((id) => id === "success_target" || id === "item_photos");
    return [...new Set([...essentials, ...(selected.length ? selected : input.eligible)])].slice(0, 3);
  } catch {
    // Missing questions should still be usable when the model is unavailable.
    return input.eligible.slice(0, 3);
  }
}
