import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { researchDigest, verificationDigest } from "./research-digest";
import { isOutreachRuleVersion, LEGACY_OUTREACH_RULE_VERSION, OUTREACH_RULE_VERSION, outreachReadyQuestion, questionTask,
  type OutreachRuleVersion } from "./outreach-ready-question";
export { verificationDigest } from "./research-digest";

export const LEAD_VERIFICATION_VERSION = "blueprint.lead-verification.v1";
export const LEAD_VERIFICATION_RESULT_VERSION = "blueprint.lead-verification-result.v1";
export const LEAD_DIAGNOSTIC_RESULT_VERSION = "blueprint.lead-verification-result.v2";
/** v3 is v2 plus the outreach-ready tier. Its status and eligible_for_qualified_promotion
 * are v2's, so a v3-pinned row's verified decision uses the v2 rules here. This module
 * does not derive the tier; a v3 pin never admits a hypothesis. */
export const LEAD_OUTREACH_RESULT_VERSION = "blueprint.lead-verification-result.v3";
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
  // Accept ±HH:MM and ±HHMM offsets, matching Python's parser (shell `date %z` emits ±HHMM).
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  if (!match || +match[1] < 1 || +match[4] >= 24 || +match[5] >= 60 || +(match[6] ?? "0") >= 60
    || new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) throw new Error("timestamp invalid");
  const offset = match[8].length === 5 ? `${match[8].slice(0, 3)}:${match[8].slice(3)}` : match[8];
  const seconds = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${offset}`);
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
  if (resultVersion === LEAD_OUTREACH_RESULT_VERSION) resultVersion = LEAD_DIAGNOSTIC_RESULT_VERSION;
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
export function evaluateLeadCohort(candidates: any[], assessments: Record<string, any>, now: number, duplicateChecks: Record<string, any> = {},
  resultVersion = LEAD_DIAGNOSTIC_RESULT_VERSION) {
  const results: (ReturnType<typeof evaluateLeadVerification> & { duplicate_of?: string; duplicate_check?: any })[] = candidates.map(candidate =>
    evaluateLeadVerification(candidate, assessments[candidate.candidate_key] ?? null, now, resultVersion));
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
  // A published row is re-verified under the result version it was decided with; rows
  // without a pin predate v2 and keep the original v1 evaluator.
  const result = context ? evaluateLeadCohort(context.candidates, context.assessments, now, context.duplicateChecks,
    context.resultVersion ?? LEAD_VERIFICATION_RESULT_VERSION)
    .find(result => result.candidate_digest === verificationDigest(source.candidate))
    ?? evaluateLeadVerification(source?.candidate, null, now)
    : evaluateLeadVerification(source?.candidate, source?.leadVerification ?? null, now);
  if (!result.eligible_for_qualified_promotion) throw new LeadVerificationRequired(result);
  return result;
}

// ---------------------------------------------------------------------------------------------
// blueprint.outreach-ready-rule.v1.2, and v1.1 for rows published under it: a TypeScript mirror of
// Pipeline tools/daily_research/verification.py (retained_evidence, evidence_index, quote_level,
// outreach_gates, outreach_tier and the result-v3 cohort pass). It is tested against the vendored shared
// golden file. Admission uses it only to re-derive a published tier under the row's own rule version:
// any disagreement with Pipeline refuses, so a mirror defect can withhold a hypothesis but never admit
// one. It grants no verification, send or approval authority.
export { LEGACY_OUTREACH_RULE_VERSION, OUTREACH_RULE_VERSION, OUTREACH_RULE_VERSIONS, isOutreachRuleVersion,
  type OutreachRuleVersion } from "./outreach-ready-question";
export const OUTREACH_EVIDENCE_VERSION = "blueprint.outreach-ready-evidence.v1";
export const OUTREACH_MIN_QUOTE_WORDS = 3;
const PROVEN_FACTS = ["operator", "physical_site", "site_task"] as const;
const SITE_TASK_STATES = new Set(["verified_fact", "inference"]);
const TOOLS = new Set(["blueprint_read_source", "blueprint_search"]);
const EVIDENCE_PHASES = new Set(["research", "repair", "qa"]);
const FINDALL_OPERATIONS = new Set(["status", "result"]);
const RETRIEVALS = new Set(["rendered", "static", "operator_document"]);
const PRIMARY_CLASSES = new Set(["operator", "primary"]), ALL_CLASSES = new Set(["operator", "primary", "independent", "vendor"]);
const FACILITY_FIELDS: Record<string, [Set<string>, Set<string>, string]> = {
  facility_type: [new Set(["operations", "office", "mailing_only", "unknown"]), new Set(["office", "mailing_only"]), "facility_office_or_mailing_only"],
  facility_operator: [new Set(["company", "contractor", "tenant", "unknown"]), new Set(["contractor", "tenant"]), "facility_operated_by_another_party"],
};
const JOB_PATH_SEGMENTS = new Set(["careers", "career", "jobs", "job", "job-posting", "job-postings", "openings", "vacancies"]);
const JOB_HOSTS = ["greenhouse.io", "lever.co", "myworkdayjobs.com", "icims.com", "smartrecruiters.com", "jobvite.com",
  "ashbyhq.com", "workable.com", "bamboohr.com", "taleo.net"];
// A normalized address segment: a house number, then a name (Python \d is any decimal digit).
const STREET = /^\p{Nd}[\p{L}\p{N}]* [\p{L}\p{Nl}\p{No}]/u;
// Python str.split() and str.strip() whitespace (str.isspace), which differs from JavaScript's.
const PY_SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_SPACES = new RegExp(`[${PY_SPACE}]+`), PY_NON_SPACE = new RegExp(`[^${PY_SPACE}]`);
const pyText = (value: unknown): value is string => typeof value === "string" && PY_NON_SPACE.test(value);
const own = (value: any, key: unknown) => typeof key === "string" && object(value) && Object.hasOwn(value, key);
/** Python `value in {...}` for a set of strings: an unhashable list or dict raises, as Python does. */
function pyIn(value: unknown, set: Set<string>) {
  if (value !== null && typeof value === "object") throw new TypeError("unhashable");
  return typeof value === "string" && set.has(value);
}
/** Python truthiness of a parsed JSON value. */
const pyTruthy = (value: unknown) => Array.isArray(value) ? value.length > 0
  : object(value) ? Object.keys(value as object).length > 0 : Boolean(value);
const codepointCompare = (a: string, b: string) => {
  const left = Array.from(a), right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = left[index].codePointAt(0)! - right[index].codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
};
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

/** Python verification.normalized: NFKC, lower case, letter and digit runs joined by one space. */
export function outreachNormalized(value: string) {
  return (value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");
}
/** Python verification.quote_words: whitespace-separated tokens that keep a letter or digit. */
export function outreachQuoteWords(quote: string) {
  return quote.normalize("NFKC").split(PY_SPACES).filter(token => /[\p{L}\p{N}]/u.test(token));
}

/** Python urllib.parse.urlsplit (3.11+): the parts url_key, source_usable and job_post read. */
function pyUrlSplit(value: unknown) {
  if (typeof value !== "string") throw new TypeError("url must be a string");
  let url = value.replace(/^[\x00-\x20]+/, "").replace(/[\t\r\n]/g, ""), scheme = "", netloc = "", query = "";
  const colon = url.indexOf(":");
  if (colon > 0 && /^[A-Za-z]/.test(url) && /^[A-Za-z0-9+\-.]+$/.test(url.slice(0, colon))) {
    scheme = url.slice(0, colon).toLowerCase(); url = url.slice(colon + 1);
  }
  if (url.startsWith("//")) {
    let end = url.length;
    for (const delimiter of "/?#") { const at = url.indexOf(delimiter, 2); if (at >= 0) end = Math.min(end, at); }
    netloc = url.slice(2, end); url = url.slice(end);
    if (netloc.includes("[") !== netloc.includes("]")) throw new Error("Invalid IPv6 URL");
    if (netloc.includes("[")) {
      const hostinfo = netloc.slice(netloc.lastIndexOf("@") + 1), open = hostinfo.indexOf("[");
      const bracketed = hostinfo.slice(open + 1), close = bracketed.indexOf("]"), port = close >= 0 ? bracketed.slice(close + 1) : "";
      const host = close >= 0 ? bracketed.slice(0, close) : bracketed;
      if (open > 0 || (port && !port.startsWith(":")) || (host.startsWith("v") ? !/^v[a-fA-F0-9]+\..+$/.test(host) : isIP(host) !== 6)) {
        throw new Error("Invalid IPv6 URL");
      }
    }
  }
  const hash = url.indexOf("#");
  if (hash >= 0) url = url.slice(0, hash);
  const question = url.indexOf("?");
  if (question >= 0) { query = url.slice(question + 1); url = url.slice(0, question); }
  if (netloc && !/^[\x00-\x7f]*$/.test(netloc)) {
    const stripped = netloc.replace(/[@:#?]/g, ""), normalized = stripped.normalize("NFKC");
    if (stripped !== normalized && /[/?#@:]/.test(normalized)) throw new Error("netloc contains invalid characters under NFKC normalization");
  }
  const at = netloc.lastIndexOf("@"), hostinfo = netloc.slice(at + 1), userinfo = at >= 0 ? netloc.slice(0, at) : null;
  const open = hostinfo.indexOf("[");
  let hostname = open >= 0 ? hostinfo.slice(open + 1).split("]")[0] : hostinfo.split(":")[0];
  const zone = hostname.indexOf("%");
  hostname = zone >= 0 ? hostname.slice(0, zone).toLowerCase() + hostname.slice(zone) : hostname.toLowerCase();
  const separator = userinfo?.indexOf(":") ?? -1;
  return { scheme, path: url, query, hostname: hostname || null,
    username: userinfo === null ? null : separator >= 0 ? userinfo.slice(0, separator) : userinfo,
    password: userinfo !== null && separator >= 0 ? userinfo.slice(separator + 1) : null };
}
/** Python verification.url_key: scheme, host case, www., a trailing slash and the fragment do not differ. */
export function outreachUrlKey(value: unknown): string | null {
  try {
    const parts = pyUrlSplit(value), host = (parts.hostname ?? "").toLowerCase().replace(/^www\./, "");
    if (!["http", "https"].includes(parts.scheme) || !host || parts.username || parts.password) return null;
    return host + parts.path.replace(/\/+$/, "") + (parts.query ? `?${parts.query}` : "");
  } catch { return null; }
}
const hostKey = (value: unknown) => outreachUrlKey(value)?.split("/", 1)[0].split("?", 1)[0] ?? null;

/** Python verification.source_usable, with its urlsplit URL rule (the tier's own copy). */
function outreachSourceUsable(source: any, assessedAt: bigint, primary = false) {
  try {
    const parts = pyUrlSplit(source.url);
    return ["https", "http"].includes(parts.scheme) && !!parts.hostname && !parts.username && !parts.password
      && pyText(source.id) && pyText(source.publisher) && pyText(source.quote) && pyText(source.freshness_reason)
      && source.freshness === "current" && pyIn(source.retrieval, RETRIEVALS)
      && pyIn(source.classification, primary ? PRIMARY_CLASSES : ALL_CLASSES) && moment(source.checked_at) <= assessedAt;
  } catch { return false; }
}

export type OutreachEvidenceRecord = { url: unknown; text: unknown; tool_result_sha256: string; kind?: string };
export type OutreachEvidence = { schema_version: string; state: "retained"; pages: OutreachEvidenceRecord[];
  excerpts: OutreachEvidenceRecord[]; refused: number } | { schema_version: string; state: "unavailable" };
export const OUTREACH_EVIDENCE_UNAVAILABLE = Object.freeze({ schema_version: OUTREACH_EVIDENCE_VERSION, state: "unavailable" as const });
const utf8 = (bytes: Buffer) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

/** Python verification.retained_evidence over one row's retained tool results. `read` returns a
 * file's bytes or null when it is missing; the only I/O. A result whose bytes, digest or shape
 * differ is refused and counted; the others are kept. Page text is credited to the requested URL
 * and its redirect hops only while every hop stays on the requested host. */
export function retainedOutreachEvidence(row: any, read: (name: string) => Buffer | null): Extract<OutreachEvidence, { state: "retained" }> {
  const pages: OutreachEvidenceRecord[] = [], excerpts: OutreachEvidenceRecord[] = [];
  let refused = 0;
  const calls = object(row) && object(row.application_tool_calls) ? row.application_tool_calls : {};
  for (const [id, call] of Object.entries<any>(calls).sort(([a], [b]) => codepointCompare(a, b))) {
    const request = object(call) ? call.request : null, name = object(request) ? request.name : null;
    if (!pyIn(name, TOOLS) || !pyIn(call.phase, EVIDENCE_PHASES) || call.success !== true || typeof call.result_file !== "string") continue;
    const raw = read(call.result_file);
    let found: OutreachEvidenceRecord[];
    try {
      if (raw === null) throw new Error("tool result missing");
      const event = JSON.parse(utf8(raw));
      if (sha256(raw) !== call.result_sha256 || researchDigest(event) !== call.result_digest
        || !object(event) || event.success !== true || event.call_id !== id || typeof event.output !== "string") throw new Error("tool result binding");
      const output = JSON.parse(event.output), sha: string = call.result_sha256;
      if (name === "blueprint_read_source") {
        if (typeof output.text !== "string" || !own(output, "requested_url") || !own(output, "url")) throw new TypeError("page text");
        const hops = pyTruthy(output.redirects) ? output.redirects : [];
        if (!Array.isArray(hops) || hops.some((hop: any) => !own(hop, "url"))) throw new TypeError("redirects");
        const chain: unknown[] = [output.requested_url, ...hops.map((hop: any) => hop.url), output.url];
        const host = hostKey(chain[0]), sameHost = host !== null && chain.every(url => hostKey(url) === host);
        found = sameHost ? [...new Set(chain as string[])].sort(codepointCompare).map(url => ({ url, text: output.text, tool_result_sha256: sha })) : [];
      } else {
        const results = output.response.results;
        if (!Array.isArray(results) || results.some((item: any) => !own(item, "url") || !own(item, "snippet"))) throw new TypeError("results");
        found = results.map((item: any) => ({ url: item.url, text: item.snippet, tool_result_sha256: sha, kind: "search_snippet" }));
      }
    } catch { refused += 1; continue; }
    (name === "blueprint_read_source" ? pages : excerpts).push(...found);
  }
  const reads = object(row) && object(row.parallel_findall_reads) ? row.parallel_findall_reads : {};
  for (const [id, receipt] of Object.entries<any>(reads).sort(([a], [b]) => codepointCompare(a, b))) {
    const call = Object.hasOwn(calls, id) ? calls[id] : undefined;
    if (!object(call) || !pyIn(call.phase, EVIDENCE_PHASES) || !object(receipt) || !pyIn(receipt.operation, FINDALL_OPERATIONS)
      || typeof receipt.file !== "string") continue;
    const raw = read(receipt.file);
    let found: OutreachEvidenceRecord[];
    try {
      if (raw === null || sha256(raw) !== receipt.sha256 || raw.length !== receipt.bytes) throw new Error("snapshot binding");
      found = findAllCitations(JSON.parse(utf8(raw))).map(([url, text]) => ({ url, text, tool_result_sha256: receipt.sha256, kind: "citation_excerpt" }));
    } catch { refused += 1; continue; }
    excerpts.push(...found);
  }
  return { schema_version: OUTREACH_EVIDENCE_VERSION, state: "retained", pages, excerpts, refused };
}
/** Python verification._citations: (url, excerpt) for every citation, in its stack order. */
function findAllCitations(snapshot: unknown) {
  const found: [string, string][] = [], stack: unknown[] = [snapshot];
  while (stack.length) {
    const item = stack.pop();
    if (object(item)) {
      const record = item as Record<string, unknown>;
      if (typeof record.url === "string" && Array.isArray(record.excerpts)) {
        for (const excerpt of record.excerpts) if (typeof excerpt === "string") found.push([record.url, excerpt]);
      }
      for (const value of Object.values(record)) stack.push(value);
    } else if (Array.isArray(item)) for (const value of item) stack.push(value);
  }
  return found;
}

/** Python verification.evidence_summary: the bounded binding review recomputes against. */
export function outreachEvidenceSummary(evidence: any) {
  if (!object(evidence) || evidence.state !== "retained") return { ...OUTREACH_EVIDENCE_UNAVAILABLE };
  const count = (kind: string) => Array.isArray(evidence[kind]) ? evidence[kind].length : 0;
  const shas = [...new Set((["pages", "excerpts"] as const).flatMap(kind => Array.isArray(evidence[kind]) ? evidence[kind] : [])
    .filter((record: any) => object(record) && typeof record.tool_result_sha256 === "string").map((record: any) => record.tool_result_sha256 as string))]
    .sort(codepointCompare);
  const refused = evidence.refused;
  return { schema_version: OUTREACH_EVIDENCE_VERSION, state: "retained", pages: count("pages"), excerpts: count("excerpts"),
    refused: Number.isSafeInteger(refused) && refused >= 0 ? refused : 0, sources_sha256: researchDigest(shas) };
}

type EvidenceIndex = { pages: Map<string, [string, string][]>; excerpts: Map<string, [string, string][]> };
/** Python verification.evidence_index: normalized text by URL key; malformed records are skipped. */
function outreachEvidenceIndex(evidence: any): EvidenceIndex {
  const index: EvidenceIndex = { pages: new Map(), excerpts: new Map() }, memo = new Map<string, string>();
  if (!object(evidence) || evidence.state !== "retained") return index;
  for (const kind of ["pages", "excerpts"] as const) {
    for (const record of Array.isArray(evidence[kind]) ? evidence[kind] : []) {
      if (!object(record) || !Object.hasOwn(record, "url") || !Object.hasOwn(record, "text") || !Object.hasOwn(record, "tool_result_sha256")) continue;
      const key = outreachUrlKey(record.url), raw = record.text, sha = record.tool_result_sha256;
      if (key === null || typeof sha !== "string" || typeof raw !== "string") continue;
      if (!memo.has(raw)) memo.set(raw, ` ${outreachNormalized(raw)} `);
      index[kind].set(key, [...(index[kind].get(key) ?? []), [memo.get(raw)!, sha]]);
    }
  }
  return index;
}
/** Python verification.quote_level: verified_on_page or in_citation_excerpt with its tool result. */
function outreachQuoteLevel(quote: unknown, url: unknown, index: EvidenceIndex): [string | null, string | null] {
  if (typeof quote !== "string") return [null, null];
  const key = outreachUrlKey(url);
  if (key === null || outreachQuoteWords(quote).length < OUTREACH_MIN_QUOTE_WORDS) return [null, null];
  const needle = ` ${outreachNormalized(quote)} `;
  for (const [level, kind] of [["verified_on_page", "pages"], ["in_citation_excerpt", "excerpts"]] as const) {
    for (const [value, sha] of index[kind].get(key) ?? []) if (value.includes(needle)) return [level, sha];
  }
  return [null, null];
}
/** quote_level bound to one retained evidence state: the level at which a quote is proven at a URL. */
export function outreachQuoteProver(evidence: unknown) {
  const index = outreachEvidenceIndex(evidence);
  return (quote: unknown, url: unknown) => {
    const [level, sha] = outreachQuoteLevel(quote, url, index);
    return level ? { level: level as "verified_on_page" | "in_citation_excerpt", toolResultSha256: sha! } : null;
  };
}
/** Python verification.site_terms: (places, names) that tie evidence to this facility. */
function siteTerms(candidate: any) {
  const parts = (value: unknown) => typeof value === "string" ? value.split(",").map(outreachNormalized) : [];
  const site = parts(candidate?.site), location = parts(candidate?.location);
  const places = new Set([...site, ...location].filter(part => STREET.test(part)));
  if (location.filter(Boolean).length >= 2 && location[0]) places.add(location[0]);
  const names = new Set([...places, ...(site.length && site[0] ? [site[0]] : [])]);
  return { places, names };
}
/** Python verification.job_post: a careers or jobs page, or a hiring-system host. */
function jobPost(url: unknown) {
  let parts;
  try { parts = pyUrlSplit(url); } catch { return false; }
  const host = (parts.hostname ?? "").toLowerCase();
  return parts.path.split("/").some(segment => segment && JOB_PATH_SEGMENTS.has(segment.toLowerCase()))
    || ["careers", "jobs"].includes(host.split(".", 1)[0]) || JOB_HOSTS.some(name => host === name || host.endsWith(`.${name}`));
}
/** Python verification.names_site: the quote or its retained page names the city or street, or a job post names the site. */
function namesSite(source: any, index: EvidenceIndex, places: Set<string>, names: Set<string>) {
  if (typeof source.quote !== "string") return false;
  const key = outreachUrlKey(source.url);
  const texts = [` ${outreachNormalized(source.quote)} `, ...(["pages", "excerpts"] as const)
    .flatMap(kind => (key === null ? [] : index[kind].get(key) ?? []).map(([value]) => value))];
  const found = (terms: Set<string>) => [...terms].some(term => texts.some(value => value.includes(` ${term} `)));
  return found(places) || (jobPost(source.url) && found(names));
}
/** Python verification.facility_gates; a malformed optional field is "invalid". */
function facilityGates(assessment: any, indexed: Map<string, any>, index: EvidenceIndex) {
  const value: Record<string, any> = { valid: true };
  let assessedAt: bigint | null = null;
  try { assessedAt = moment(assessment.assessed_at); } catch { assessedAt = null; }
  for (const [field, [allowed]] of Object.entries(FACILITY_FIELDS)) {
    const entry = Object.hasOwn(assessment, field) ? assessment[field] : undefined;
    if (entry === undefined || entry === null) { value[field] = { value: null, proven: false }; continue; }
    const refs = object(entry) ? entry.source_refs : null;
    if (!object(entry) || !pyIn(entry.value, allowed) || !Array.isArray(refs)
      || refs.some((ref: unknown) => typeof ref !== "string" || !indexed.has(ref))) {
      value.valid = false; value[field] = { value: null, proven: false }; continue;
    }
    const proven = assessedAt !== null && refs.some((ref: string) => {
      const source = indexed.get(ref);
      return outreachSourceUsable(source, assessedAt!) && source.classification !== "vendor"
        && outreachQuoteLevel(source.quote, source.url, index)[0] !== null;
    });
    value[field] = { value: entry.value, proven };
  }
  return value;
}
/** Python verification.outreach_gates: the inputs outreach_tier reads. */
function outreachGates(result: any, candidate: any, index: EvidenceIndex, conflict: boolean) {
  const assessment = object(result.assessment) ? result.assessment : {};
  const claimed = object(assessment.claims) ? assessment.claims : {};
  const sources: any[] = Array.isArray(assessment.sources) ? assessment.sources : [];
  const indexed = new Map(sources.filter(source => object(source) && pyText(source.id)).map(source => [source.id as string, source]));
  const counter = object(assessment.counterevidence) ? assessment.counterevidence : {};
  const states: Record<string, unknown> = Object.fromEntries(claims.map(name => [name, object(claimed[name]) ? claimed[name].status : null]));
  states.counterevidence = counter.status;
  const { places, names } = siteTerms(candidate);
  const facts: Record<string, { primary_sources_usable: boolean; proofs: any[]; site_specific: boolean }> = {};
  for (const name of PROVEN_FACTS) {
    const refs = object(claimed[name]) ? claimed[name].source_refs : null;
    const linked = Array.isArray(refs) ? refs.filter((ref: unknown) => typeof ref === "string" && indexed.has(ref)).map((ref: string) => indexed.get(ref)) : [];
    let usable = false;
    try {
      const assessedAt = moment(assessment.assessed_at);
      usable = !!linked.length && linked.length === refs.length && linked.every(source => outreachSourceUsable(source, assessedAt, true));
    } catch { usable = false; }
    const proofs: any[] = [];
    let siteSpecific = false;
    for (const source of linked) {
      const [level, sha] = outreachQuoteLevel(source.quote, source.url, index);
      if (!level) continue;
      // Python encodes the quote as strict UTF-8; a lone surrogate raises and gives tier none.
      if (!(source.quote as string).isWellFormed()) throw new Error("quote is not valid UTF-8");
      proofs.push({ claim: name, source_id: source.id, url: source.url, quote_sha256: sha256(Buffer.from(source.quote, "utf8")), level, tool_result_sha256: sha });
      siteSpecific = siteSpecific || (name === "site_task" && namesSite(source, index, places, names));
    }
    facts[name] = { primary_sources_usable: usable, proofs, site_specific: siteSpecific };
  }
  const check = result.duplicate_check;
  return { eligible_for_qualified_promotion: result.eligible_for_qualified_promotion === true,
    assessment_valid: result.assessment_valid === true && !(Array.isArray(result.validation_errors) && result.validation_errors.length),
    identity_present: !!result.identity_key, duplicate: !!result.duplicate_of || (!!object(check) && check.duplicate === true),
    conflict, valid_until: Object.hasOwn(assessment, "valid_until") ? assessment.valid_until : null, states, facts,
    facility: facilityGates(assessment, indexed, index), task: candidate?.task, site: candidate?.site,
    // v1.2: the question's city, and its automation evidence (a contradicted counterevidence).
    location: candidate?.location, partial_automation: states.counterevidence === "contradicted" };
}
/** Python verification.open_checks, in rule order. */
export function outreachOpenChecks(states: Record<string, unknown>, validUntil: unknown) {
  return [...(states.site_task !== "verified_fact" ? ["site_link"] : []), ...(states.human_workflow !== "verified_fact" ? ["manual_workflow"] : []),
    ...(validUntil === null ? ["freshness"] : []), "existing_automation", "fit", "interest"];
}
/** Python verification.outreach_tier under ``ruleVersion``. Any defect here gives tier none, as in Python. */
function outreachTier(gates: ReturnType<typeof outreachGates> | null, nowUs: bigint, ruleVersion: OutreachRuleVersion) {
  const block: { rule_version: string; proving_sources: any[]; open_checks: string[]; open_questions: string[]; blockers: string[] } = {
    rule_version: ruleVersion, proving_sources: [], open_checks: [], open_questions: [], blockers: [] };
  try {
    if (!gates) throw new Error("gates unavailable");
    const { facts, states } = gates;
    block.proving_sources = PROVEN_FACTS.filter(name => facts[name].proofs.length).map(name => facts[name].proofs[0]);
    if (gates.eligible_for_qualified_promotion) return { tier: "verified", eligible_for_outreach_ready: false, outreach_ready: block };
    const blockers = claims.filter(name => states[name] === "contradicted").map(name => `${name}_contradicted`);
    const validUntil = gates.valid_until;
    for (const [failed, code] of [[gates.assessment_valid !== true, "assessment_invalid"], [gates.identity_present !== true, "identity_missing"],
      [gates.duplicate !== false, "duplicate"], [gates.conflict !== false, "duplicate_conflict"]] as const) if (failed) blockers.push(code);
    if (validUntil !== null && !(nowUs < moment(validUntil))) blockers.push("assessment_expired");
    for (const name of PROVEN_FACTS) {
      if (!pyIn(states[name], name === "site_task" ? SITE_TASK_STATES : new Set(["verified_fact"]))) {
        blockers.push(name + (name === "site_task" ? "_not_verified_fact_or_inference" : "_not_verified_fact"));
      } else if (facts[name].primary_sources_usable !== true) blockers.push(`${name}_primary_source_unusable`);
      else if (!facts[name].proofs.length) blockers.push(`${name}_quote_unproven`);
      else if (name === "site_task" && states[name] === "verified_fact" && facts[name].site_specific !== true) blockers.push("site_task_company_level");
    }
    if (gates.facility.valid !== true) blockers.push("facility_invalid");
    for (const [field, [, blocking, code]] of Object.entries(FACILITY_FIELDS)) {
      if (blocking.has(gates.facility[field].value) && gates.facility[field].proven === true) blockers.push(code);
    }
    const checks = outreachOpenChecks(states, validUntil);
    let question: string | null = null;
    if (!pyText(gates.task) || !pyText(gates.site) || ruleVersion !== LEGACY_OUTREACH_RULE_VERSION && !pyText(questionTask(gates.task))) {
      blockers.push("question_task_or_site_missing");
    } else {
      question = outreachReadyQuestion(checks, gates.task, gates.site, { location: gates.location,
        partialAutomation: gates.partial_automation === true, ruleVersion });
      if ((question.match(/\?/g) ?? []).length !== 1) blockers.push("question_not_single");
    }
    if (blockers.length) return { tier: "none", eligible_for_outreach_ready: false, outreach_ready: { ...block, blockers: [...new Set(blockers)] } };
    return { tier: "outreach_ready", eligible_for_outreach_ready: true, outreach_ready: { ...block, open_checks: checks, open_questions: [question!] } };
  } catch {
    return { tier: "none", eligible_for_outreach_ready: false, outreach_ready: { ...block, proving_sources: [], blockers: ["tier_computation_unavailable"] } };
  }
}

/** Python verification.cohort(result_version=v3) for the fields the tier reads and decides: the
 * v2 result of each candidate, Pipeline's duplicate and conflict pass, then each candidate's tier.
 * `evidence` is retainedOutreachEvidence output; anything else proves no quote. The verified path
 * (evaluateLeadCohort, requireVerifiedLead) is unchanged and never reads this. */
export function evaluateOutreachTier(candidates: any[], assessments: Record<string, any>, now: number,
  duplicateChecks: Record<string, any> | null | undefined, evidence: unknown, ruleVersion: OutreachRuleVersion = OUTREACH_RULE_VERSION) {
  if (!isOutreachRuleVersion(ruleVersion)) throw new Error("outreach_rule_version_unknown");
  const results: any[] = candidates.map(candidate => evaluateLeadVerification(candidate,
    own(assessments, candidate?.candidate_key) ? assessments[candidate.candidate_key] : null, now));
  const checks = object(duplicateChecks) ? duplicateChecks! : {};
  const indexed = new Map(results.map(result => [result.candidate_key, result]));
  for (const result of results) {
    const check = own(checks, result.candidate_key) ? checks[result.candidate_key] : undefined;
    if (!object(check) || check.duplicate !== true) continue;
    result.duplicate_check = check; result.eligible_for_qualified_promotion = false;
    let target = check.duplicate_of, resolved = false;
    const visited = new Set([result.candidate_key]);
    while (pyText(check.reason) && typeof target === "string" && indexed.has(target) && !visited.has(target)) {
      visited.add(target);
      const next = Object.hasOwn(checks, target) ? checks[target] : {};
      if (!object(next)) { target = null; continue; }
      if (next.duplicate !== true) { result.identity_key = indexed.get(target).identity_key; result.duplicate_of = target; resolved = true; break; }
      if (!pyText(next.reason)) { target = null; continue; }
      target = next.duplicate_of;
    }
    if (!resolved) {
      result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
      result.reasons.push("duplicate: retain referenced original candidate and equivalence reason; unresolved duplicate cannot inflate verified yield");
    }
  }
  const groups = new Map<string, any[]>();
  results.forEach((result, index) => {
    const key = result.identity_key || `unresolved:${index}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  });
  const conflicted = new Set<any>();
  for (const members of groups.values()) {
    const group = [...members].sort((a, b) => Number(!!a.duplicate_check?.duplicate) - Number(!!b.duplicate_check?.duplicate));
    const conflict = new Set(group.map(result => result.status)).size > 1;
    group.forEach((result, index) => {
      if (conflict) {
        conflicted.add(result); result.status = "unresolved"; result.eligible_for_qualified_promotion = false;
        result.reasons.push("duplicate assessments conflict: resolve the same operator/site/task before promotion");
      }
      if (index) { result.duplicate_of = group[0].candidate_key; result.eligible_for_qualified_promotion = false; }
    });
  }
  const index = outreachEvidenceIndex(evidence), nowUs = BigInt(now) * BigInt(1000);
  const tiered = results.map((result, position) => {
    let gates: ReturnType<typeof outreachGates> | null = null;
    try { gates = outreachGates(result, candidates[position], index, conflicted.has(result)); } catch { gates = null; }
    return { ...result, version: LEAD_OUTREACH_RESULT_VERSION, ...outreachTier(gates, nowUs, ruleVersion) };
  });
  return { outreach_rule_version: ruleVersion, tier_evidence: outreachEvidenceSummary(evidence), results: tiered,
    outreach_ready_count: tiered.filter(result => result.eligible_for_outreach_ready).length };
}
