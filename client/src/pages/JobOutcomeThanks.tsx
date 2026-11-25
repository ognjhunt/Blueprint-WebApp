/**
 * The thank-you page after an outcome answer is recorded (PACKAGE_E E8). It shows the answer (and the reason given with
 * "Not going ahead") and nothing else: no job, no name, no company.
 */
import { OUTCOME_STATE_LABELS, isOutcomeState, outcomeThanks } from "@/lib/jobOutcomeStates";

/** After a side's own final answer, a later link of that side records nothing and says so (review S3). It names only that
 * side's own answer, never the other side's. */
export const outcomeAlreadyRecorded = (label: string) => `You already told us: ${label}. Nothing more is needed.`;

export function outcomeThanksSentence(search: string): string {
  let answer: string | null = null, already: string | null = null, reason: string | null = null;
  try {
    const params = new URLSearchParams(search);
    answer = params.get("answer"); already = params.get("already"); reason = params.get("reason");
  } catch { answer = null; }
  if (isOutcomeState(already)) return outcomeAlreadyRecorded(OUTCOME_STATE_LABELS[already]);
  return isOutcomeState(answer) ? outcomeThanks(answer, reason) : "Thanks.";
}

export default function JobOutcomeThanks() {
  const sentence = outcomeThanksSentence(typeof window === "undefined" ? "" : window.location.search);
  return <main style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 16px" }}>
    <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{sentence}</h1>
  </main>;
}
