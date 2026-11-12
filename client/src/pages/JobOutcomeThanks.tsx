/**
 * The thank-you page after an outcome answer is recorded (PACKAGE_E E8). It shows the answer and
 * nothing else: no job, no name, no company.
 */
import { isOutcomeState, outcomeThanks } from "@/lib/jobOutcomeStates";

export function outcomeThanksSentence(search: string): string {
  let answer: string | null = null;
  try { answer = new URLSearchParams(search).get("answer"); } catch { answer = null; }
  return isOutcomeState(answer) ? outcomeThanks(answer) : "Thanks.";
}

export default function JobOutcomeThanks() {
  const sentence = outcomeThanksSentence(typeof window === "undefined" ? "" : window.location.search);
  return <main style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 16px" }}>
    <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{sentence}</h1>
  </main>;
}
