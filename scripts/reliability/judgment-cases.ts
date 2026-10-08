import { createHash } from "node:crypto";
import type { SiteAssessment } from "../../server/agents/site-assessment";

/** Frozen synthetic controls. These are source-admission cases, not human video labels. */
export const JUDGMENT_VERSION = "blueprint.judgment-mutations.v1";
const topics = [
  ["action", "The rack moves outward."], ["completion", "The requested job is completed."],
  ["dimension", "The fixture is 50 cm wide."], ["mass", "The object weighs 2 kg."],
  ["force", "The contact force is 10 N."], ["reach", "The robot can reach the shelf."],
  ["hygiene", "The process satisfies cleaning requirements."], ["capability", "The robot can perform this job."],
] as const;
const conditions = [
  { id: "observed-start", basis: "observed", kind: "video", observation: "observed", start: 8, end: 10, at: 8, admitted: true, relationship: "invariant" },
  { id: "observed-end", basis: "observed", kind: "video", observation: "observed", start: 8, end: 10, at: 10, admitted: true, relationship: "invariant" },
  { id: "observed-zero", basis: "observed", kind: "video", observation: "observed", start: 0, end: 0, at: 0, admitted: true, relationship: "invariant" },
  { id: "occluded-estimate", basis: "observed", kind: "video", observation: "estimate", start: 8, end: 10, at: 8, admitted: false, relationship: "weaken" },
  { id: "absent-action", basis: "observed", kind: "video", observation: "not_visible", start: 8, end: 10, at: 8, admitted: false, relationship: "abstain" },
  { id: "crop-before", basis: "observed", kind: "video", observation: "observed", start: 8, end: 10, at: 7, admitted: false, relationship: "abstain" },
  { id: "crop-after", basis: "observed", kind: "video", observation: "observed", start: 8, end: 10, at: 11, admitted: false, relationship: "abstain" },
  { id: "reordered-interval", basis: "observed", kind: "video", observation: "observed", start: 10, end: 8, at: 9, admitted: false, relationship: "abstain" },
  { id: "owner-is-not-video", basis: "observed", kind: "operator", at: null, admitted: false, relationship: "change" },
  { id: "vendor-is-not-video", basis: "observed", kind: "robot_registry", at: null, admitted: false, relationship: "change" },
  { id: "video-is-not-owner", basis: "operator_stated", kind: "video", observation: "observed", start: 8, end: 10, at: 8, admitted: false, relationship: "change" },
  { id: "owner-is-not-published", basis: "published", kind: "operator", at: null, admitted: false, relationship: "weaken" },
  { id: "video-is-not-published", basis: "published", kind: "video", observation: "observed", start: 8, end: 10, at: 8, admitted: false, relationship: "weaken" },
  { id: "owner-attributed", basis: "operator_stated", kind: "operator", at: null, admitted: true, relationship: "invariant" },
  { id: "unknown-source", basis: "published", kind: "knowledge", at: null, missing: true, admitted: false, relationship: "abstain" },
] as const;
export const judgmentCases = topics.flatMap(([topic, text]) => conditions.map(condition => {
  const parameters = { topic, claim: text, ...condition };
  const semanticHash = createHash("sha256").update(JSON.stringify(parameters)).digest("hex");
  return { id: `JUD-${topic}-${condition.id}`, family: "judgment-source-admission", version: JUDGMENT_VERSION,
    source_id: `synthetic:${topic}`, split: "development_regression", label_status: "PROVISIONAL_agent_checked",
    expected_relation: condition.relationship, semantic_hash: semanticHash, parameters };
}));
export function replayInput(row: typeof judgmentCases[number]) {
  const condition = row.parameters;
  const content = condition.kind === "video" ? { evidence: { summary: "Synthetic transcript, no real video inspected.",
    observations: [{ category: "motion", finding: condition.claim, basis: "observation" in condition ? condition.observation : "observed",
      start_seconds: "start" in condition ? condition.start : 8, end_seconds: "end" in condition ? condition.end : 10,
      uncertainty: null }], not_observable: [] } } : condition.claim;
  const source = { source_id: row.source_id, kind: condition.kind, canonical_ref: `synthetic/${row.id}`,
    sha256: createHash("sha256").update(JSON.stringify(content)).digest("hex"), checked_at: null, content };
  const claim = { text: condition.claim, basis: condition.basis, evidence: [{ source_id: row.source_id, at_seconds: condition.at }] };
  const assessment: SiteAssessment = { status: "assessment", job: [claim], objects_motions_conditions_variations: [],
    operator_success: [], known: [], estimates: [], missing: [], approaches: [],
    next_action: { kind: "research", action: "Check supporting evidence.", why: { text: "Unknown support", basis: "unknown", evidence: [] } }, questions: [] };
  return { assessment, sources: new Map("missing" in condition ? [] : [[row.source_id, source]]), duration: 30 };
}
