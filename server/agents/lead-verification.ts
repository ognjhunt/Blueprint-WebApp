import { verificationDigest } from "./research-digest";
export { verificationDigest } from "./research-digest";

export const LEAD_VERIFICATION_VERSION = "blueprint.lead-verification.v1";
export const LEAD_VERIFICATION_RESULT_VERSION = "blueprint.lead-verification-result.v1";
export const LEAD_DIAGNOSTIC_RESULT_VERSION = "blueprint.lead-verification-result.v2";
export const LEAD_SEPARATE_GATES = ["buying_intent", "consent_rights", "commercial_qualification", "robot_compatibility", "deployment_readiness"];
const facts = ["operator", "physical_site", "site_task", "human_workflow"];
const claims = [...facts, "plausible_fit"];
const states = ["verified_fact", "inference", "unresolved", "contradicted", "stale", "unreachable"];
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const object = (value: any) => value && typeof value === "object" && !Array.isArray(value);
export const leadIdentityText = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function leadIdentityKey(candidate: any): string | null {
  const parts = [candidate?.organization, candidate?.site || candidate?.location, candidate?.location || candidate?.site, candidate?.task];
  return parts.every(value => text(value) && leadIdentityText(value)) ? verificationDigest(parts.map(leadIdentityText)) : null;
}
function moment(value: unknown) {
  // Date-only publication dates are useful context; assessment/check authority
  // requires an explicit timezone. Preserve its original precision and bytes.
  if (typeof value !== "string") throw new Error("timestamp needs offset");
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || +match[1] < 1 || +match[4] >= 24 || +match[5] >= 60 || +(match[6] ?? "0") >= 60
    || new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) throw new Error("timestamp invalid");
  const seconds = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${match[8]}`);
  if (!Number.isFinite(seconds)) throw new Error("timestamp invalid");
  // Python datetime retains microseconds; Date.parse drops them. Compare at
  // the same precision so a future check/assessment cannot hide in one ms.
  return BigInt(seconds) * BigInt(1000) + BigInt((match[7] ?? "").slice(0, 6).padEnd(6, "0"));
}
function sourceUsable(source: any, assessedAt: bigint, primary = false) {
  try {
    const url = new URL(source.url);
    return ["https:", "http:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password
      && text(source.id) && text(source.publisher) && text(source.quote) && text(source.freshness_reason)
      && source.freshness === "current" && ["rendered", "static", "operator_document"].includes(source.retrieval)
      && (primary ? ["operator", "primary"] : ["operator", "primary", "independent", "vendor"]).includes(source.classification)
      && moment(source.checked_at) <= assessedAt;
  } catch { return false; }
}

/** The agent judges source meaning and exact site/task linkage. This pure
 * harness binds the retained judgment and exposes repairable gaps. No I/O,
 * provider calls, robot compatibility or commercial authority is conferred.
 * Extra metadata is retained unchanged; there are no source/result quotas.
 */
function evaluateLegacyLeadVerification(candidate: any, assessment: any, now: number, allowUnknownExpiry = false) {
  const reasons: string[] = [];
  let rejected = false, candidateDigest: string | null = null, assessmentDigest: string | null = null;
  try { candidateDigest = verificationDigest(candidate); assessmentDigest = verificationDigest(assessment ?? null); }
  catch { candidateDigest = null; assessmentDigest = null; reasons.push("digest: repair nonportable numbers/types; retain large IDs as strings"); }
  const result = { version: LEAD_VERIFICATION_RESULT_VERSION, candidate_key: candidate?.candidate_key ?? null,
    candidate_digest: candidateDigest, identity_key: leadIdentityKey(candidate), evaluated_at: new Date(now).toISOString(),
    assessment: assessment ?? null, assessment_digest: assessmentDigest, assessment_present: assessment != null,
    assessment_valid: false, separate_gates: [...LEAD_SEPARATE_GATES] };
  if (!result.identity_key) reasons.push("identity: resolve named operator, physical site/location and task");
  if (!object(assessment)) reasons.push("assessment: perform source assessment; discovery alone is unverified");
  else {
    try {
      const assessedAt = moment(assessment.assessed_at);
      if (!candidateDigest || !assessmentDigest || assessment.version !== LEAD_VERIFICATION_VERSION || assessment.candidate_digest !== candidateDigest
        || !(assessedAt <= BigInt(now) * BigInt(1000) && (allowUnknownExpiry && assessment.valid_until === null || BigInt(now) * BigInt(1000) < moment(assessment.valid_until))) || !object(assessment.claims)
        || !Array.isArray(assessment.sources) || !object(assessment.counterevidence)) throw new Error("binding, freshness or structure");
      const sources: any[] = assessment.sources;
      const indexed = new Map(sources.filter(source => object(source) && text(source.id)).map(source => [source.id, source]));
      if (indexed.size !== sources.length) throw new Error("source identity");
      result.assessment_valid = true;
      for (const name of claims) {
        const claim = assessment.claims[name];
        if (!object(claim) || !states.includes(claim.status) || !text(claim.reason)) {
          reasons.push(`${name}: assess claim and retain its source-linked reason`); result.assessment_valid = false; continue;
        }
        const refs = claim.source_refs;
        const linked = Array.isArray(refs) ? refs.filter(ref => typeof ref === "string" && indexed.has(ref)).map(ref => indexed.get(ref)) : [];
        const usable = !!linked.length && linked.length === refs.length && linked.every(source => sourceUsable(source, assessedAt, facts.includes(name)));
        if (claim.status === "contradicted" && usable) { rejected = true; reasons.push(`${name}: contradicted — ${claim.reason}`); }
        else if (!(facts.includes(name) ? ["verified_fact"] : ["verified_fact", "inference"]).includes(claim.status) || !usable) {
          reasons.push(`${name}: ${claim.status}; resolve source, primary support, scope or freshness — ${claim.reason}`);
        }
      }
      const counter = assessment.counterevidence, refs = counter.source_refs;
      const linked = Array.isArray(refs) ? refs.filter(ref => typeof ref === "string" && indexed.has(ref)).map(ref => indexed.get(ref)) : [];
      const usable = !!linked.length && linked.length === refs.length && linked.every(source => sourceUsable(source, assessedAt) && source.classification !== "vendor");
      const searched = Array.isArray(counter.searches) && !!counter.searches.length && counter.searches.every(text);
      if (counter.status === "contradicted" && usable && text(counter.reason)) { rejected = true; reasons.push(`counterevidence: contradicted — ${counter.reason}`); }
      else if (counter.status !== "checked" || !text(counter.reason) || !(searched || usable) || (refs?.length && !usable)) {
        reasons.push("counterevidence: resolve automation/contradictions; retain actual searches, sources and limits");
      }
      if (!["checked", "unresolved", "contradicted"].includes(counter.status)) result.assessment_valid = false;
    } catch { reasons.push("assessment: repair candidate binding, dates, source IDs or assessment structure"); }
  }
  const status = rejected ? "rejected" : reasons.length ? "unresolved" : "verified";
  return { ...result, status, reasons: reasons.length ? reasons : ["Primary sources support the named site/task and human workflow; fit remains a bounded hypothesis"],
    eligible_for_qualified_promotion: status === "verified" };
}

/** Locate structural errors only. Missing evidence stays unresolved rather
 * than causing correction turns that pressure the agent to invent a fact. */
export function leadAssessmentIssues(candidate: any, assessment: any) {
  const issues: { path: string; code: string; expected: string }[] = [];
  const issue = (path: string, code: string, expected: string) => issues.push({ path, code, expected });
  if (assessment == null) return issues;
  if (!object(assessment)) { issue("/", "assessment_object_required", "an assessment object or null for unassessed evidence"); return issues; }
  const versions = ["version", "schema_version"].filter(key => Object.hasOwn(assessment, key)).map(key => assessment[key]);
  if (!versions.length || versions.some(value => value !== LEAD_VERIFICATION_VERSION)) issue("/version", "assessment_version_invalid",
    `"version": "${LEAD_VERIFICATION_VERSION}"; a matching schema_version alias is accepted without rewriting evidence`);
  let bound = false;
  try { bound = assessment.candidate_digest === verificationDigest(candidate); verificationDigest(assessment); } catch { bound = false; }
  if (!bound) issue("/candidate_digest", "assessment_candidate_binding_invalid", "copy the supplied exact candidate_digest; retain portable metadata and retain large IDs as strings");
  for (const key of ["assessed_at", "valid_until"]) {
    if (key === "valid_until" && Object.hasOwn(assessment, key) && assessment[key] === null) continue;
    try { moment(assessment[key]); } catch { issue(`/${key}`, "assessment_timestamp_invalid", "actual ISO timestamp with timezone; valid_until may be null when freshness is unknown, never invent an expiry"); }
  }
  const ids = new Set<string>();
  if (!Array.isArray(assessment.sources)) issue("/sources", "assessment_sources_invalid", "a list of retained source objects, including inaccessible/unknown evidence");
  else assessment.sources.forEach((source: any, index: number) => {
    const path = `/sources/${index}`;
    if (!object(source)) { issue(path, "assessment_source_invalid", "a retained source object"); return; }
    if (!text(source.id) || ids.has(source.id)) issue(`${path}/id`, "assessment_source_id_invalid", "a unique nonempty local source ID; do not invent or merge sources");
    else ids.add(source.id);
    if (source.checked_at != null) {
      try { moment(source.checked_at); } catch { issue(`${path}/checked_at`, "assessment_timestamp_invalid", "retain the actual source check timestamp with timezone; unknown/unreachable sources cannot supply positive support"); }
    }
  });
  if (!object(assessment.claims)) issue("/claims", "assessment_claims_invalid", "separate operator, physical_site, site_task, human_workflow and plausible_fit claims");
  else for (const name of claims) {
    const claim = assessment.claims[name], path = `/claims/${name}`;
    if (!object(claim)) { issue(path, "assessment_claim_invalid", "a claim object with status, source-linked reason and source_refs; missing facts stay unresolved"); continue; }
    if (!states.includes(claim.status) || !text(claim.reason)) issue(path, "assessment_claim_invalid", "an allowed evidence status and a nonempty reason at the exact operator/site/task scope");
    if (!Array.isArray(claim.source_refs) || claim.source_refs.some((ref: any) => typeof ref !== "string" || !ids.has(ref))) issue(`${path}/source_refs`,
      "assessment_source_reference_invalid", "a list of exact retained source IDs; unresolved claims may use an empty list");
  }
  const counter = assessment.counterevidence;
  if (!object(counter)) issue("/counterevidence", "assessment_counterevidence_invalid", "status, reason, source_refs and actual bounded searches; unknown results remain unresolved");
  else {
    if (!["checked", "unresolved", "contradicted"].includes(counter.status) || !text(counter.reason)) issue("/counterevidence", "assessment_counterevidence_invalid", "checked, unresolved or contradicted with the actual scope and limits");
    if (!Array.isArray(counter.source_refs) || counter.source_refs.some((ref: any) => typeof ref !== "string" || !ids.has(ref))) issue("/counterevidence/source_refs",
      "assessment_source_reference_invalid", "exact retained source IDs or an empty list for unresolved evidence");
    if (!Array.isArray(counter.searches) || counter.searches.some((query: any) => !(text(query) || object(query) && text(query.query)))) issue("/counterevidence/searches", "assessment_searches_invalid",
      "a list of actual query strings or retained query records with a query field; an empty list is valid when no countersearch was performed");
  }
  return issues;
}

export function evaluateLeadVerification(candidate: any, assessment: any, now: number, resultVersion = LEAD_DIAGNOSTIC_RESULT_VERSION) {
  if (resultVersion === LEAD_VERIFICATION_RESULT_VERSION) return evaluateLegacyLeadVerification(candidate, assessment, now) as ReturnType<typeof evaluateLegacyLeadVerification> & { validation_errors?: ReturnType<typeof leadAssessmentIssues> };
  if (resultVersion !== LEAD_DIAGNOSTIC_RESULT_VERSION) throw new Error("lead verification result version unsupported");
  const issues = leadAssessmentIssues(candidate, assessment);
  const expiryUnknown = object(assessment) && Object.hasOwn(assessment, "valid_until") && assessment.valid_until === null;
  const evaluation = object(assessment) && !issues.length ? { ...assessment, version: LEAD_VERIFICATION_VERSION } : assessment;
  if (object(assessment) && !issues.length) {
    evaluation.counterevidence = { ...assessment.counterevidence, searches: assessment.counterevidence.searches.map((query: any) => {
      if (!object(query)) return query;
      try { if (query.checked_at != null && moment(query.checked_at) > moment(assessment.assessed_at)) return null; } catch { return null; }
      return query.query;
    }) };
  }
  const result = { ...evaluateLegacyLeadVerification(candidate, evaluation, now, expiryUnknown && !issues.length), version: LEAD_DIAGNOSTIC_RESULT_VERSION,
    assessment: assessment ?? null, assessment_digest: null as string | null, validation_errors: issues };
  try { result.assessment_digest = verificationDigest(assessment ?? null); } catch { /* Preserve nonportable raw evidence. */ }
  if (issues.length) { result.assessment_valid = false; result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
    result.reasons = issues.map(item => `${item.path}: ${item.expected}`); }
  else if (object(assessment) && moment(assessment.assessed_at) > BigInt(now) * BigInt(1000)) {
    result.assessment_valid = false; result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
    result.reasons = ["/assessed_at: assessment is in the future; retain the actual checked time"];
  } else if (expiryUnknown) {
    const retained = result.status === "verified" ? [] : result.reasons;
    result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
    result.reasons = ["/valid_until: freshness is unknown; retain unresolved evidence and establish a supported currentness boundary before promotion", ...retained];
  } else if (object(assessment) && moment(assessment.valid_until) <= BigInt(now) * BigInt(1000)) {
    result.assessment_valid = false; result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
    result.reasons = ["/valid_until: assessment has expired; recheck the sources or retain unknown freshness"];
  }
  return result;
}

/** Recompute every raw assessment, then fence duplicate conflicts/promotion.
 * A second alias cannot inflate verified yield or bypass a rejected sibling.
 */
export function leadPacketCandidates(packet: any) {
  return packet.verification_cohort_version === LEAD_VERIFICATION_VERSION
    ? [...packet.candidates, ...(packet.duplicates ?? [])].sort((a, b) => a.discovery_index - b.discovery_index) : packet.candidates;
}
export function evaluateLeadCohort(candidates: any[], assessments: Record<string, any>, now: number, duplicateChecks: Record<string, any> = {}) {
  const results: (ReturnType<typeof evaluateLeadVerification> & { duplicate_of?: string; duplicate_check?: any })[] = candidates.map(candidate =>
    evaluateLeadVerification(candidate, assessments[candidate.candidate_key] ?? null, now));
  const indexed = new Map(results.map(result => [result.candidate_key, result]));
  for (const result of results) {
    const check = duplicateChecks[result.candidate_key];
    if (!object(check) || check.duplicate !== true) continue;
    result.duplicate_check = check;
    let target = check.duplicate_of, canonical: typeof result | undefined;
    const visited = new Set([result.candidate_key]);
    while (text(check.reason) && indexed.has(target) && !visited.has(target)) {
      visited.add(target);
      const next = duplicateChecks[target];
      if (!object(next) || next.duplicate !== true) { canonical = indexed.get(target); break; }
      if (!text(next.reason)) break;
      target = next.duplicate_of;
    }
    if (canonical) { result.identity_key = canonical.identity_key; result.duplicate_of = canonical.candidate_key;
      result.eligible_for_qualified_promotion = false; }
    else { result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
      result.reasons.push("duplicate: retain referenced original candidate and equivalence reason; unresolved duplicate cannot inflate verified yield"); }
  }
  const groups = new Map<string, typeof results>();
  results.forEach((result, index) => {
    const key = result.identity_key ?? `unresolved:${index}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  });
  for (const group of groups.values()) {
    const conflict = new Set(group.map(result => result.status)).size > 1;
    const canonical = group.find(result => !result.duplicate_of) ?? group[0];
    group.forEach(result => {
      if (conflict) { result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
        result.reasons.push("duplicate assessments conflict: resolve the same operator/site/task before promotion"); }
      if (result !== canonical) { result.duplicate_of = canonical.candidate_key; result.eligible_for_qualified_promotion = false; }
    });
  }
  return results;
}

export class LeadVerificationRequired extends Error {
  constructor(public verification: ReturnType<typeof evaluateLeadVerification>) {
    super(`lead_verification_required:${verification.reasons.join("; ")}`);
  }
}
/** An agent can establish official delegation to an employer portal or another
 * primary document. Domain matching alone cannot establish/deny affiliation.
 * Called alongside requireVerifiedLead at promotion; the exact candidate task
 * evidence URL must be among that assessment's primary site/task sources.
 */
export function leadTaskSourceSupports(source: any, entry: any) {
  const assessment = source?.leadVerification, claim = assessment?.claims?.site_task;
  return ["operator", "independent"].includes(entry?.classification) && entry?.claim_kind === "fact"
    && claim?.status === "verified_fact" && Array.isArray(claim.source_refs) && Array.isArray(assessment.sources)
    && assessment.sources.some((item: any) => claim.source_refs.includes(item.id) && item.url === entry.url
      && ["operator", "primary"].includes(item.classification));
}
/** Never accept a client/cached result's eligible/status flags as authority. */
export function requireVerifiedLead(source: any, now: number) {
  const context = source?.leadVerificationCohort;
  const result = context ? evaluateLeadCohort(context.candidates, context.assessments, now, context.duplicateChecks)
    .find(result => result.candidate_digest === verificationDigest(source.candidate))
    ?? evaluateLeadVerification(source?.candidate, null, now)
    : evaluateLeadVerification(source?.candidate, source?.leadVerification ?? null, now);
  if (!result.eligible_for_qualified_promotion) throw new LeadVerificationRequired(result);
  return result;
}
