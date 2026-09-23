/**
 * The gate answers a site task has on file, from one place.
 *
 * Two fields hold gate answers, written at different moments:
 *
 * - `request.siteTaskGates` — whatever the intake form collected. In the
 *   capture-first flow that is nothing, because the form asks no gate questions.
 * - top-level `siteTaskGates` — written by `confirmBrief` when the operator
 *   confirms the brief. It is the complete confirmed set: intake answers reach
 *   it as proposals, and a gate the operator marked "not sure" is deliberately
 *   absent from it.
 *
 * Every reader used to read only the intake field, so a confirmed capture-first
 * site looked like it had answered nothing and never became runnable supply.
 * Readers call this instead. Once a brief is confirmed, the confirmed set wins
 * outright rather than being merged over the intake answers, so a gate the
 * operator withdrew ("not sure") does not reappear from intake.
 */
export function gateAnswersOnFile(record: unknown): Record<string, string> {
  const value = (record ?? {}) as {
    siteTaskGates?: unknown;
    request?: { siteTaskGates?: unknown } | null;
  };
  const confirmed = answerMap(value.siteTaskGates);
  if (confirmed) return confirmed;
  return answerMap(value.request?.siteTaskGates) ?? {};
}

function answerMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answers: Record<string, string> = {};
  for (const [fieldId, answer] of Object.entries(value as Record<string, unknown>)) {
    if (typeof answer === "string" && answer) answers[fieldId] = answer;
  }
  return answers;
}
