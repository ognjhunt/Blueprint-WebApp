import { makeBusinessHistory, type BusinessHistoryEvent } from "./business-history";

/** Conversation-derived hypotheses, never verified market facts or selection
 * filters. Original message metadata must be supplied by the trusted capture. */
export const INITIAL_BLUEPRINT_HYPOTHESES = [
  { recordId: "BP-HYP-site-readiness-learning", statement: "Some sites may seek readiness or learning before purchase.",
    confounders: ["contactability", "response_bias", "decision_owner_unknown", "timing"],
    whatWouldChangeBelief: ["Comparable contacted sites explicitly describe other motives; willingness to reply alone is insufficient."],
    nextQuestion: "What information would change your assessment of this recurring task?", nextTest: "Record explicit motives and compare relevant cohorts; keep unrelated opportunities eligible." },
  { recordId: "BP-HYP-task-specific-brief", statement: "Task-specific briefs may improve robot-team opportunity assessment.",
    confounders: ["task_fit", "brief_quality", "team_capacity", "contact_route", "message_version"],
    whatWouldChangeBelief: ["Comparable recipients report no assessment benefit, or progress remains blocked despite sufficient task evidence."],
    nextQuestion: "Which missing task or site evidence would help you assess this opportunity?", nextTest: "Compare attributed brief usefulness and later assessment outcomes while checking message and task differences." },
  { recordId: "BP-HYP-early-small-team-collaboration", statement: "Early or small robot teams may be more willing to collaborate.",
    confounders: ["team_size_unknown", "capacity", "contactability", "response_bias", "task_fit", "timing"],
    whatWouldChangeBelief: ["Comparable teams show different collaboration outcomes after controlling available evidence; replies alone do not prove participation."],
    nextQuestion: "What would make participation in this bounded task evaluation useful and feasible?", nextTest: "Compare owner-confirmed evaluation participation, not inferred interest; do not filter by team size." },
  { recordId: "BP-HYP-missing-task-site-information", statement: "Missing task or site information may block progress.",
    confounders: ["authority", "budget", "timing", "technical_fit", "delivery_unknown"],
    whatWouldChangeBelief: ["Owners identify another blocker or additional verified task information does not change assessment."],
    nextQuestion: "What specific evidence would resolve the current uncertainty?", nextTest: "Track explicit objections, evidence supplied and later owner-confirmed outcomes; seek counterexamples." },
] as const;
export function initialHypothesisEvents(input: { subjectKey: string; capturedBy: string; occurredAt: string; recordedAt: string; sources: BusinessHistoryEvent["sources"] }) {
  return INITIAL_BLUEPRINT_HYPOTHESES.map(hypothesis => makeBusinessHistory({ ...input, ...hypothesis,
    kind: "hypothesis", contentClass: "blueprint_business_only", supersedesEventId: null, status: "provisional",
    uncertainty: "Conversation-derived, unconfirmed business hypothesis; no verified market or causal conclusion.", evidence: [],
    confounders: [...hypothesis.confounders], whatWouldChangeBelief: [...hypothesis.whatWouldChangeBelief],
    causalProof: false, hardFilterProspects: false, unexpectedExplorationRequired: true }));
}
