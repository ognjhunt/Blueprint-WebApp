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
    hint: "Only if a specific item or piece of equipment matters to this job.",
  },
};

export function allowedFollowUps(value: unknown, eligible: readonly FollowUpId[]): FollowUpId[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(eligible);
  return [...new Set(value.filter((id): id is FollowUpId =>
    typeof id === "string" && allowed.has(id as FollowUpId),
  ))].slice(0, 3);
}

/** How long a site's page waits for the picker before it uses the fixed list. */
const FOLLOW_UP_DEADLINE_MS = 12_000;

/**
 * The model selects topics only. Copy, authority, and the question limit stay
 * in code. The call goes through the agent runtime as the
 * `site_task_follow_up` lane: the same provider settings, data-class gate,
 * per-run cost cap, spend accounting and "no funds" handling as every lane.
 * With no provider configured that may receive the site's text, the fixed
 * list is returned at once and no run is started or stored. The run carries
 * the request id so its row can be found for the job. Whenever the lane does
 * not answer in time, or answers with an error, the fixed list is used.
 */
export async function selectFollowUps(input: {
  requestId?: string;
  taskStatement: string;
  briefSummary: string;
  itemLabels: string[];
  eligible: FollowUpId[];
  /** The loaded request's withdrawal: a withdrawn job's text is never sent (the fixed list instead). */
  consentRevoked?: boolean;
}): Promise<FollowUpId[]> {
  if (!input.eligible.length) return [];
  const fixedList = input.eligible.slice(0, 3);
  if (input.consentRevoked === true) return fixedList;

  try {
    const { getStructuredProviderOrder } = await import("../agents/provider-config");
    if (!getStructuredProviderOrder("site_task_follow_up").length) return fixedList;
    const { runAgentTask } = await import("../agents/runtime");
    const run = runAgentTask<{ taskStatement: string; briefSummary: string; itemLabels: string[]; eligible: string[] },
      { question_ids?: unknown }>({
      kind: "site_task_follow_up",
      input: {
        taskStatement: input.taskStatement.slice(0, 3000),
        briefSummary: input.briefSummary.slice(0, 300),
        itemLabels: input.itemLabels.slice(0, 12),
        eligible: input.eligible,
      },
      ...(input.requestId ? { metadata: { request_id: input.requestId } } : {}),
    }, { dispatchQueuedOnFinish: false,
      ...(input.requestId ? { privacyRequestBinding: { request_id: input.requestId } } : {}) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), FOLLOW_UP_DEADLINE_MS); });
    const result = await Promise.race([run, deadline]).finally(() => clearTimeout(timer));
    if (!result || result.status !== "completed" || !result.output) return fixedList;
    const selected = allowedFollowUps(result.output.question_ids, input.eligible);
    const essentials = input.eligible.filter((id) => id === "success_target" || id === "item_photos");
    return [...new Set([...essentials, ...(selected.length ? selected : input.eligible)])].slice(0, 3);
  } catch {
    // Missing questions should still be usable when the model is unavailable.
    return fixedList;
  }
}
