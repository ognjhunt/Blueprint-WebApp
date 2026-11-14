/** The retired site assessment's record schema and its source-bound rendering, read by the job page and the job decision. */
import { z } from "zod";
import { isQuotableGrade } from "./robotTeamRegistry";

const selector = z.object({
  kind: z.enum(["video_observation", "qualified_field", "operator_statement"]),
  observation_index: z.number().int().nonnegative().nullable(),
  field_path: z.array(z.string().min(1)).min(1).max(8).nullable(),
});
// Missing selectors remain readable for v1 records and older model responses,
// but cannot produce a source-bound fact in a newly returned v2 packet.
const reference = z.object({ source_id: z.string(), at_seconds: z.number().nonnegative().nullable(),
  selector: selector.nullable().optional() });
function assessmentSchema<Citation extends z.ZodTypeAny>(citation: Citation) {
  const claim = z.object({
    text: z.string(),
    basis: z.enum(["observed", "operator_stated", "published", "measured", "estimate", "unknown"]),
    evidence: z.array(citation),
  });
  return z.object({
    status: z.enum(["assessment", "needs_operator_input"]),
    job: z.array(claim),
    objects_motions_conditions_variations: z.array(claim),
    operator_success: z.array(claim),
    known: z.array(claim),
    estimates: z.array(claim),
    missing: z.array(claim),
    approaches: z.array(z.object({
      approach: z.string(), disposition: z.enum(["plausible", "excluded", "needs_evidence"]),
      reasons: z.array(claim), remaining_checks: z.array(z.string()),
    })),
    next_action: z.object({
      kind: z.enum(["ask_operator", "inspect_video", "measure", "research", "robot_trial", "process_change", "no_robot"]),
      action: z.string(), why: claim,
    }),
    questions: z.array(z.object({ question: z.string(), decision_it_changes: z.string() })),
  });
}
export const siteAssessmentSchema = assessmentSchema(reference);
export type SiteAssessment = z.infer<typeof siteAssessmentSchema>;


const videoObservationSchema = z.object({
  summary: z.string(),
  observations: z.array(z.object({
    category: z.enum(["job_step", "object", "motion", "condition", "variation", "apparent_result"]),
    finding: z.string(), basis: z.enum(["observed", "estimate", "not_visible"]),
    start_seconds: z.number().nonnegative().nullable(), end_seconds: z.number().nonnegative().nullable(),
    uncertainty: z.string().nullable(),
  })),
  not_observable: z.array(z.string()),
});
/** Identical timestamp admission applies to fresh and persisted provider observations. */
export function validateVideoObservations(value: unknown, duration: number) {
  const evidence = videoObservationSchema.parse(value);
  for (const item of evidence.observations) {
    if ((item.start_seconds ?? 0) > duration || (item.end_seconds ?? 0) > duration
      || (item.start_seconds !== null && item.end_seconds !== null && item.end_seconds < item.start_seconds)
      || (item.basis === "observed" && item.start_seconds === null)) throw new Error("assessment_video_timestamp_invalid");
  }
  return evidence;
}


type Source = {
  source_id: string; kind: "operator" | "video" | "knowledge" | "robot_registry";
  canonical_ref: string; sha256: string; checked_at: string | null; content: unknown;
};
// Every team read_robot_registry returns (200 by default) becomes a packet
// source, so a packet's readers must admit at least that many plus the video,
// operator and knowledge sources. A 100-source cap blocked scene preparation
// once the registry passed 100 teams (2026-10-23).
export const SITE_ASSESSMENT_MAX_PACKET_SOURCES = 300;
export const SITE_ASSESSMENT_MAX_PACKET_BYTES = 4_000_000;

// The research notes' capability fact, as recorded in a robot registry source.
const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9_.:-]+$/);
const forbidden = (value: string) => /[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[A-Za-z]{2,}/i.test(value)
  || /(?:bearer\s+\S+|(?:api[ _-]?key|access[ _-]?(?:token|key(?:[ _-]?id)?)|refresh[ _-]?token|client[ _-]?secret|private[ _-]?key|password|passwd|pwd|authorization|token|credentials?|secret(?:[ _-]?access)?[ _-]?key|secret|signature|sig)\s*["']?\s*[:=]|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i.test(value);
const safeText = (max = 2000) => z.string().min(1).max(max).refine(value => !forbidden(value)
  && (value.match(/https?:\/\/[^\s<>"]+/gi) ?? []).every(url => publicUrl.safeParse(url.replace(/[.,;!?)\]]+$/, "")).success), "learning_private_text");
const publicUrl = z.string().max(2000).url().refine(value => {
  try {
    const url = new URL(value); let decoded = value;
    for (let attempt = 0; attempt < 4; attempt++) {
      const next = decodeURIComponent(decoded);
      if (forbidden(next)) return false;
      if (next === decoded) break;
      decoded = next;
    }
    const decodedUrl = new URL(decoded);
    return [url, decodedUrl].every(parsed => parsed.protocol === "https:" && !parsed.username && !parsed.password)
      && decodeURIComponent(decoded) === decoded
      && ![...decodedUrl.searchParams.keys()].some(key => /^(?:email|emailaddress|token|accesstoken|refreshtoken|apikey|key|secret|clientsecret|privatekey|authorization|password|passwd|pwd|credentials?|signature|sig)$/i.test(key.replace(/[^a-z0-9]/gi, "")));
  } catch { return false; }
}, "learning_private_url");
function dateMillis(value: string): number {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const day = us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day) return NaN;
  if (us || value === day) return timestamp;
  return z.string().datetime({ offset: true }).safeParse(value).success ? Date.parse(value) : NaN;
}
const originalDate = z.string().max(80).refine(value => Number.isFinite(dateMillis(value)), "learning_source_date_invalid");
const unique = z.array(id).max(100).refine(items => new Set(items).size === items.length);
const capabilityFactSchema = z.object({ factId: id, field: safeText(120), statement: safeText(), status: z.enum(["reviewed", "conflicted", "unsupported", "unknown"]),
  evidenceLevel: z.enum(["vendor_claim", "demonstrated_capability", "named_deployment", "current_availability", "unknown"]),
  confidence: z.enum(["low", "medium", "high", "unknown"]), freshnessDays: z.number().int().min(1).max(90),
  taskTags: z.array(safeText(120)).max(20), geographyTags: z.array(safeText(120)).max(20), sourcePageIds: unique,
  sources: z.array(z.object({ url: publicUrl, sourceCheckedAt: originalDate, revalidatedAt: originalDate.nullable(), publicationDate: originalDate.nullable(),
    classification: safeText(120), publisher: safeText(300).nullable() }).strict()).max(20),
  limits: z.array(safeText(120)).max(20), conflicts: z.array(safeText(120)).max(20),
}).strict();

const REGISTRY_CONTEXT_FIELDS: Record<string, (value: unknown) => string | null> = {
  capabilityDescription: value => typeof value === "string" && value.trim() ? `Unqualified registry description: ${value}` : null,
  status: value => typeof value === "string" && value.trim() ? `Registry record status: ${value}` : null,
  willing_supply: value => typeof value === "boolean" ? `Registry record willing_supply: ${value}` : null,
  supply_agreements_missing: value => Array.isArray(value) && value.length
    && value.every(item => typeof item === "string" && item.trim())
    ? `Registry record supply agreements missing: ${value.join(", ")}` : null,
};

/** Source binding establishes wording provenance, never video truth or deployment fit. */
export function renderSourceBoundAssessment(raw: SiteAssessment, sources: ReadonlyMap<string, Source>, duration: number | null) {
  // Registry descriptions and supply-record fields are research context, not
  // qualified capability fields. Keep their exact source and the raw model
  // claim; never let an optional description or a record status masquerade as
  // a measured/published specification or discard the other independently
  // bound observations in an assessment.
  const descriptions = (value: any): string[] | null => {
    if (value?.basis !== "published" || !Array.isArray(value.evidence) || !value.evidence.length) return null;
    const texts: string[] = [];
    for (const ref of value.evidence) {
      const source = sources.get(ref.source_id), selector = ref.selector;
      const field = Array.isArray(selector?.field_path) && selector.field_path.length === 1 ? selector.field_path[0] : null;
      const render = typeof field === "string" && Object.prototype.hasOwnProperty.call(REGISTRY_CONTEXT_FIELDS, field)
        ? REGISTRY_CONTEXT_FIELDS[field] : null;
      const text = render && source?.kind === "robot_registry" && selector?.kind === "qualified_field"
        && selector.observation_index === null && source.content && typeof source.content === "object"
        ? render((source.content as Record<string, unknown>)[field!]) : null;
      if (!text) return null;
      texts.push(text);
    }
    return texts;
  };
  const validationProjection = (value: any): any => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(validationProjection);
    const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, validationProjection(item)]));
    return descriptions(value) ? { ...next, basis: "unknown" } : next;
  };
  validateAssessmentEvidence(validationProjection(raw), sources, duration);
  const verification = { format: "assessment_evidence_binding.v1", source_bound_claims: 0,
    unverified_claims: 0, interpretation_claims: 0, unqualified_registry_context_claims: 0,
    decision_status: "advisory_review_required",
    interpretation_fields: ["approaches[].approach", "approaches[].remaining_checks[]", "questions[].question", "questions[].decision_it_changes"],
    limitation: "Source-derived reports are not independently verified perception, measurements or robot suitability." };
  const scalar = (value: unknown): value is string | number | boolean =>
    typeof value === "string" && Boolean(value.trim()) || typeof value === "number" && Number.isFinite(value) || typeof value === "boolean";
  const ownPath = (value: unknown, path: string[]): unknown => {
    for (const key of path) {
      if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) return undefined;
      // Knowledge facts are arrays. Admit only canonical own indices, never
      // array metadata, sparse slots, inherited values or alternate spellings.
      if (Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key)
        || !Number.isSafeInteger(Number(key)) || Number(key) >= value.length)) return undefined;
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  };
  const renderReference = (basis: string, ref: z.infer<typeof reference>): string | null => {
    const source = sources.get(ref.source_id), binding = ref.selector;
    if (!source || !binding) return null;
    if (basis === "observed" && source.kind === "video" && binding.kind === "video_observation"
      && binding.field_path === null && binding.observation_index !== null && duration !== null) {
      const evidence = validateVideoObservations((source.content as { evidence?: unknown })?.evidence, duration);
      const item = evidence.observations[binding.observation_index];
      if (!item || item.basis !== "observed" || ref.at_seconds === null || item.start_seconds === null
        || ref.at_seconds < item.start_seconds || ref.at_seconds > (item.end_seconds ?? item.start_seconds)) return null;
      return `Video analysis reports at ${item.start_seconds}${item.end_seconds === null ? "" : `–${item.end_seconds}`} s: ${item.finding}`
        + (item.uncertainty ? ` Observation uncertainty: ${item.uncertainty}` : "")
        + (evidence.not_observable.length ? ` Not established by this reading: ${evidence.not_observable.join("; ")}.` : "")
        + " Video analysis does not establish calibrated measurements or robot capability.";
    }
    if (basis === "operator_stated" && source.kind === "operator" && binding.kind === "operator_statement"
      && binding.observation_index === null && binding.field_path === null && typeof source.content === "string") {
      return `Supplied operator statement (speaker and facts unverified): ${source.content}`;
    }
    if (!["published", "measured"].includes(basis) || binding.kind !== "qualified_field"
      || binding.observation_index !== null || !binding.field_path) return null;
    if (source.kind === "robot_registry" && binding.field_path.length === 1) {
      const field = binding.field_path[0];
      const record = source.content as { capability?: Record<string, unknown>; fieldProvenance?: Record<string, any> };
      const value = ownPath(record.capability, [field]), provenance = ownPath(record.fieldProvenance, [field]) as Record<string, unknown> | undefined;
      if (!scalar(value) || !provenance || typeof provenance.source !== "string" || !provenance.source.trim()
        || (basis === "measured" ? provenance.grade !== "measured" : !isQuotableGrade(provenance.grade as any))) return null;
      return `Registry ${String(provenance.grade)} field ${field}: ${JSON.stringify(value)}. This specification does not establish site suitability.`;
    }
    if (source.kind === "knowledge" && basis === "published") {
      const record = source.content as { content?: unknown; current?: unknown };
      if (record.current === false) return null;
      const value = ownPath(record.content, binding.field_path);
      if (!scalar(value)) return null;
      let qualification = "";
      if (binding.field_path[0] === "facts") {
        // A scalar leaf cannot shed the containing capability fact's reviewed
        // status, evidence grade, limits, conflicts, scope or source dates.
        const fact = capabilityFactSchema.safeParse(ownPath(record.content, binding.field_path.slice(0, 2)));
        if (!fact.success || fact.data.status !== "reviewed" || fact.data.evidenceLevel === "unknown") return null;
        const { statement: _statement, ...qualified } = fact.data;
        qualification = ` Recorded fact qualification: ${JSON.stringify(qualified)}.`;
      }
      return `Fetched record states ${binding.field_path.join(".")}: ${JSON.stringify(value)}.${qualification} This source statement does not establish site suitability.`;
    }
    return null;
  };
  const inspect = (value: any): any => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(inspect);
    if (typeof value.basis === "string" && Array.isArray(value.evidence)) {
      const context = descriptions(value);
      if (context) {
        verification.interpretation_claims++;
        verification.unqualified_registry_context_claims++;
        return { ...structuredClone(value), basis: "unknown", verification_status: "interpretation",
          text: context.join("\n")
            + " This is research context; it does not establish a capability specification or site suitability." };
      }
      if (["estimate", "unknown"].includes(value.basis)) {
        verification.interpretation_claims++;
        return { ...structuredClone(value), verification_status: "interpretation" };
      }
      const statements = value.evidence.map((ref: z.infer<typeof reference>) => renderReference(value.basis, ref));
      if (statements.length && statements.every((statement: string | null) => statement !== null)) {
        verification.source_bound_claims++;
        return { ...structuredClone(value), text: statements.join("\n"), verification_status: "source_bound" };
      }
      verification.unverified_claims++;
      return { ...structuredClone(value), text: "Unverified interpretation; consult the retained sources before relying on this claim.",
        basis: "unknown", verification_status: "unverified" };
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inspect(item)]));
  };
  const assessment = inspect(raw) as SiteAssessment;
  for (const approach of assessment.approaches) {
    // A selected specification/observation establishes its source wording,
    // not the model's feasibility conclusion. This lane has no physical-trial
    // decision DTO; retain the original disposition in raw_model_assessment.
    approach.disposition = "needs_evidence";
    Object.assign(approach, { verification_status: "advisory_review_required", interpretation_status: "unverified_interpretation" });
  }
  const action = assessment.next_action;
  const safeActions: Record<SiteAssessment["next_action"]["kind"], string> = {
    ask_operator: "Clarify unresolved site facts and success criteria.",
    inspect_video: "Inspect the video for unresolved job evidence.",
    measure: "Obtain the measurements needed to evaluate the job.",
    research: "Check current specifications and unresolved evidence.",
    robot_trial: "Consider a bounded physical trial after reviewing the evidence and permissions.",
    process_change: "Evaluate a workflow or fixture change after reviewing the requirements.",
    no_robot: "Keep manual work as an option while clarifying unresolved requirements.",
  };
  action.action = safeActions[action.kind];
  Object.assign(action, { verification_status: "advisory_review_required" });
  if (action.kind === "no_robot") action.kind = "research";
  if (verification.unverified_claims) {
    assessment.status = "needs_operator_input";
    action.kind = "research";
    action.action = safeActions.research;
    action.why = { text: "Some factual claims lack a valid evidence binding; resolve them before choosing an approach.", basis: "unknown", evidence: [] };
    if (!assessment.questions.length) assessment.questions.push({ question: "What evidence can confirm the unresolved job facts?", decision_it_changes: "Which approach can be evaluated usefully" });
  }
  for (const question of assessment.questions) Object.assign(question, { verification_status: "unverified_interpretation" });
  return { assessment, verification };
}

/** Referential checks cannot establish that a model's interpretation is true. */
export function validateAssessmentEvidence(assessment: SiteAssessment, sources: ReadonlyMap<string, Source>, duration: number | null) {
  const knownClaims = new Set(assessment.known);
  const inspect = (value: any): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (typeof value.basis === "string" && Array.isArray(value.evidence)) {
      if (!["estimate", "unknown"].includes(value.basis) && !value.evidence.length) throw new Error("assessment_fact_source_required");
      for (const ref of value.evidence) {
        const source = sources.get(ref.source_id);
        if (!source) throw new Error("assessment_unknown_source_id");
        if (ref.at_seconds !== null && (!Number.isFinite(ref.at_seconds) || ref.at_seconds < 0
          || source.kind !== "video" || duration === null || ref.at_seconds > duration)) throw new Error("assessment_reference_timestamp_invalid");
        if (value.basis === "observed" && (source.kind !== "video" || ref.at_seconds === null)) throw new Error("assessment_observation_timestamp_required");
        if (value.basis === "observed") {
          const content = source.content as { evidence?: unknown };
          const evidence = validateVideoObservations(content?.evidence, duration!);
          // A citation must point to an admitted visible interval. This still cannot
          // establish sentence entailment or whether the provider saw the event correctly.
          if (!evidence.observations.some(item => item.basis === "observed" && item.start_seconds !== null
            && ref.at_seconds >= item.start_seconds && ref.at_seconds <= (item.end_seconds ?? item.start_seconds))) {
            throw new Error("assessment_observation_not_supported");
          }
        }
        if (value.basis === "published" && !["knowledge", "robot_registry"].includes(source.kind)) throw new Error("assessment_published_source_required");
        // Video findings and operator statements have no calibrated measurement
        // receipt. Their timing/appearance or reported measurements retain their own basis.
        if (value.basis === "measured" && !["knowledge", "robot_registry"].includes(source.kind)) throw new Error("assessment_measured_source_required");
        if (["published", "measured"].includes(value.basis) && source.kind === "knowledge") {
          const record = source.content as { content?: unknown; current?: unknown } | null;
          // Published facts require present applicability in every claim location.
          // Retain superseded sources as historical unknown/estimate context;
          // age alone is no veto, and claim prose is not a semantic oracle.
          if (value.basis === "published" && record?.current === false) {
            throw new Error(knownClaims.has(value) ? "assessment_known_published_source_not_current"
              : "assessment_published_source_not_current");
          }
          const content = record && typeof record === "object" && "content" in record ? record.content : record;
          if (content === null || content === undefined || (typeof content === "string" && !content.trim())
            || (typeof content === "object" && !Object.keys(content).length)) throw new Error("assessment_knowledge_content_required");
        }
        if (["published", "measured"].includes(value.basis) && source.kind === "robot_registry") {
          const record = source.content as { capability?: Record<string, unknown>; fieldProvenance?: Record<string, any> };
          // This only admits a source with a qualified field. It cannot establish
          // that the prose cites that field, gives its value, or entails robot fit.
          if (!Object.entries(record?.capability ?? {}).some(([field, fieldValue]) => {
            const provenance = record.fieldProvenance?.[field];
            return ((typeof fieldValue === "string" && Boolean(fieldValue.trim()))
              || (typeof fieldValue === "number" && Number.isFinite(fieldValue)))
              && typeof provenance?.source === "string" && provenance.source.trim()
              && (value.basis === "measured" ? provenance.grade === "measured" : isQuotableGrade(provenance.grade));
          })) throw new Error("assessment_registry_source_basis_required");
        }
        if (value.basis === "operator_stated" && source.kind !== "operator") throw new Error("assessment_operator_source_required");
      }
    }
    Object.values(value).forEach(inspect);
  };
  inspect(assessment);
  for (const approach of assessment.approaches) {
    // Unknown capability or an empty search cannot establish impossibility.
    // Sourced estimates remain allowed; this does not prove prose entailment.
    if (approach.disposition === "excluded" && !approach.reasons.some(reason =>
      reason.basis !== "unknown" && reason.evidence.length > 0)) throw new Error("assessment_exclusion_evidence_required");
  }
}
