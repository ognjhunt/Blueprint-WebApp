import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { hydrateAgentEvidence } from "../agents/private-evidence";
import { renderSourceBoundAssessment, siteAssessmentSchema } from "../agents/site-assessment";
import { browserPendingDecisionKey, type BrowserPending } from "./websiteBrowserPending";
import { verifiedPendingManifest, verifiedPendingMarker } from "./websiteBrowserUploadStatus";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { advisoryContextDigest, advisoryJobId } from "./siteAssessmentContext";
import type { SiteAdvisory } from "../../client/src/types/siteAdvisory";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
const empty = (state: SiteAdvisory["state"], correlationId: string | null = null): SiteAdvisory => ({
  schemaVersion: "site_customer_advisory.v1", state, correlationId, sections: [], unknowns: [], nextAction: null,
});
const actions: Record<string, string> = {
  ask_operator: "Clarify unresolved job facts and success criteria.", inspect_video: "Inspect the video for unresolved job evidence.",
  measure: "Obtain the measurements needed to evaluate the job.", research: "Check current specifications and unresolved evidence.",
  robot_trial: "Consider a bounded physical trial after reviewing the evidence and permissions.",
  process_change: "Evaluate a workflow or fixture change after reviewing the requirements.",
  no_robot: "Keep manual work as an option while clarifying unresolved requirements.",
};
const scrub = (value: string) => value.replace(/(?:https?:\/\/|gs:\/\/)[^\s]+|Bearer\s+[^\s]+|\b[^\s@]+@[^\s@]+\.[^\s@]+/gi, "[private reference omitted]");
// This DTO has no factual bindings for free-form action/question clauses.
// Admit a narrow request form, not arbitrary declarations under a "proposal"
// prefix. These checks do not establish semantic truth or robot suitability.
const firstClause = (value: string) => value.replace(/\s+/g, " ").split(/(?<=[.!?])\s+|;|\b(?:because|since|given that|therefore)\b/i)[0].trim();
const assertionTerms = /\b(?:booked|scheduled|confirmed|completed|published|approved|certified|guaranteed|proven|passed|capable|safely|suitable|ready)\b/i;
const assertionVerbs = /\b(?:is|are|was|were|has|have|had|can|cannot|could|will|would|does|did)\b/i;
const questionForm = /^(?:what|which|how (?:many|much|long|often))\b/i;
// Without clause-level citations, admit one task/requirement query, not a
// relative clause or personal assertion smuggled into its premise.
const hasSideClause = (value: string) => /[,;:]|\b(?:that|which|whose|where|when|we|they|I|he|she|it)\b/i.test(value);
const questionClause = (value: string): string | null => {
  const text = firstClause(value);
  if (!questionForm.test(text) || hasSideClause(text.replace(questionForm, "")) || assertionTerms.test(text)) return null;
  // This narrow DTO cannot bind embedded capability or commitment prose.
  // Ambiguous modal/possession questions fail closed; requirement must/should
  // forms remain supported. Do not broaden this into a free-form grammar.
  if (/\b(?:has|have|had|can|cannot|could|will|would|does|did|may|might|shall)\b/i.test(text)) return null;
  const clauses = text.split(/\b(?:and|or|but|yet|nor)\b/i).map(clause => clause.trim());
  const requirementPredicate = /\b(?:is|are|was|were|must|should|needs?|requires?)\b/i;
  if (clauses.length > 1 && !requirementPredicate.test(clauses[0])) {
    // Before a shared predicate, retain only these simple requirement noun
    // lists and request forms. Other compound premises remain unresolved.
    const last = clauses.at(-1)!, predicate = requirementPredicate.exec(last);
    if (!predicate || !/^(?:should the test achieve|needs? inspection)[.!?]*$/i.test(last.slice(predicate.index))) return null;
    const nouns = clauses.map((clause, index) => {
      const nominal = index === clauses.length - 1 ? clause.slice(0, predicate.index) : clause;
      return (index === 0 ? nominal.replace(questionForm, "") : nominal).trim();
    });
    if (!nouns.every(noun => /^(?:exact )?(?:sequence|final state|handles?|rack endpoints?)$/i.test(noun))) return null;
  }
  let predicateSeen = false;
  for (const [index, clause] of clauses.entries()) {
    // Noun lists before a shared predicate remain supported. After a
    // predicate, every tail must ask another question, regardless of its verb.
    if (index > 0 && predicateSeen && !questionForm.test(clause)) return null;
    if (index > 0 && assertionVerbs.test(clause) && !questionForm.test(clause)) return null;
    if ((clause.match(/\b(?:is|are|was|were)\b/gi) ?? []).length > 1) return null;
    predicateSeen ||= requirementPredicate.test(clause);
  }
  if (clauses.length > 1 && !predicateSeen) return null;
  return text;
};
const requestClause = (value: string): string | null => {
  const text = firstClause(value);
  return /^(?:measure|confirm|inspect|check|research|investigate|compare|record|define|ask|identify|obtain|plan|prepare|consider|evaluate|test)\b/i.test(text)
    && !hasSideClause(text) && !assertionTerms.test(text) && !assertionVerbs.test(text) ? text : null;
};
const uncertaintyClause = (value: string): string | null => {
  const text = firstClause(value);
  const remainder = text.replace(/\b(?:is|are|was|were)\s+(?:unknown|unverified|uncertain|unresolved|not (?:measured|established|provided|visible|observed|confirmed))\b/gi, "")
    .replace(/\b(?:could|would|may) change\b/gi, "");
  return /\b(?:unknown|unverified|uncertain|unresolved|not (?:measured|established|provided|visible|observed|confirmed)|(?:could|would|may) change)\b/i.test(text)
    && !hasSideClause(text) && !assertionTerms.test(remainder) && !assertionVerbs.test(remainder) ? text : null;
};
type AssessmentPresentation = "customer" | "legacy_v1";
type SiteDecisionAssessment = SiteAdvisory & {
  decisionEvidence?: {
    schemaVersion: "site_decision_evidence.v1";
    packetSha256: string;
    qualificationSha256: string;
    legacyReviewCompatible: boolean;
  };
};
/** Internal only: never spread this view into a customer response or model context. */
export type CurrentSiteAssessmentView = {
  customerAdvisory: SiteAdvisory | null;
  decisionAssessment: SiteDecisionAssessment | null;
  compatibleDecisionAssessments: readonly (SiteAdvisory | null)[];
};
const decisionView = (advisory: SiteAdvisory | null): CurrentSiteAssessmentView => ({
  customerAdvisory: advisory, decisionAssessment: advisory, compatibleDecisionAssessments: [],
});
/** Frozen v1 presentation, evaluated against the CURRENT schema and evidence renderer.
 * Privacy-only presentation changes cannot revoke a review; changed evidence still can. */
function prepareSiteAssessment(packet: Record<string, any>, admittedDuration: number | null) {
  if (packet.schema_version !== "site_assessment.v2" || !Array.isArray(packet.sources) || packet.sources.length > 100
    || Buffer.byteLength(JSON.stringify(packet)) > 1_000_000) throw Error("site_advisory_packet_invalid");
  const sources = new Map(packet.sources.map((source: any) => [source.source_id, source]));
  const duration = packet.sources.find((source: any) => source.kind === "video")?.content?.duration_seconds
    ?? packet.video_duration_seconds ?? null;
  // Video interval validation needs the original admitted duration, supplied by the reader.
  const raw = siteAssessmentSchema.parse(packet.raw_model_assessment);
  const rendered = renderSourceBoundAssessment(raw, sources as any,
    admittedDuration ?? duration);
  const privateReferences = [packet.request_id, ...packet.sources.flatMap((source: any) => [source.source_id, source.canonical_ref, source.sha256])]
    .filter((value): value is string => typeof value === "string" && value.length > 0).sort((a, b) => b.length - a.length);
  const customerText = (value: string): string | null => {
    if (!value.trim() || value.length > 4000) return null;
    for (const reference of privateReferences) value = value.split(reference).join("[private reference omitted]");
    return scrub(value).trim();
  };
  return { raw, rendered, customerText };
}
function projectSiteAssessment({ raw, rendered, customerText }: ReturnType<typeof prepareSiteAssessment>, correlationId: string,
  presentation: AssessmentPresentation): SiteAdvisory {
  const result = empty("ready", correlationId);
  if (presentation === "legacy_v1") {
    const titles: Record<string, string> = { job: "The job", objects_motions_conditions_variations: "What the evidence shows",
      operator_success: "The site's success criteria", known: "Supported information" };
    for (const [field, title] of Object.entries(titles)) {
      const claims = ((rendered.assessment as any)[field] as any[]).filter(claim => claim.verification_status === "source_bound")
        .slice(0, 12).flatMap(claim => {
          if (typeof claim.text !== "string" || claim.text.length > 4000) return [];
          return [{ text: customerText(claim.text)!, basis: claim.basis, verificationStatus: "source_bound" as const, evidence: claim.evidence.map((reference: any) => ({
            kind: reference.selector?.kind === "video_observation" ? "video" : reference.selector?.kind === "operator_statement" ? "operator" : "specification",
            atSeconds: reference.at_seconds ?? null,
          })) }];
        });
      if (claims.length) result.sections.push({ title, claims });
    }
  }
  // Full analysis is admitted only to the private legacy digest basis.
  result.unknowns = ["Video analysis and supplied statements are not independently verified measurements or proof of robot suitability."];
  if ((presentation !== "legacy_v1" && rendered.assessment.missing.length) || rendered.verification.unverified_claims || rendered.verification.interpretation_claims || rendered.assessment.status === "needs_operator_input")
    result.unknowns.push("Some job facts and interpretations remain unresolved. Clarify them before choosing an approach.");
  for (const claim of rendered.assessment.missing) {
    // Source binding does not turn an internal evidence paragraph into a
    // customer question. Every missing fact must fit the same safe form.
    const sourceBound = (claim as any).verification_status === "source_bound";
    const retained = presentation === "legacy_v1" && sourceBound ? claim.text
      : claim.basis === "unknown" || sourceBound ? uncertaintyClause(claim.text) : null;
    const text = retained && customerText(retained);
    if (text) result.unknowns.push(`Unresolved: ${text}`);
  }
  for (const question of rendered.assessment.questions) {
    const guarded = presentation === "customer";
    const clause = guarded ? questionClause(question.question) : firstClause(question.question);
    if (!clause || !guarded && (!questionForm.test(clause)
      || hasSideClause(clause.replace(questionForm, "")) || assertionTerms.test(clause))) continue;
    const text = customerText(`${clause.replace(/[.!?]+$/, "")}?`), effect = firstClause(question.decision_it_changes);
    const consequence = !hasSideClause(effect.replace(/^(?:whether|which|what|how)\b/i, "")) && !assertionTerms.test(effect)
      && (/^(?:whether|which|what|how)\b/i.test(effect) || !assertionVerbs.test(effect))
      ? customerText(effect) : null;
    if (text) result.unknowns.push(`Question to resolve: ${text} ${consequence ? `Decision it changes: ${consequence}` : "Decision consequence remains unverified."}`);
  }
  const action = rendered.assessment.next_action;
  const proposed = !rendered.verification.unverified_claims && action.kind === raw.next_action.kind
    ? requestClause(raw.next_action.action) : null;
  result.nextAction = `Recommended next step (proposal): ${(proposed && customerText(proposed)) || actions[action.kind] || actions.research}`;
  if (presentation === "legacy_v1") {
    const retainedReason = ["unknown", "estimate"].includes(action.why.basis) ? uncertaintyClause(action.why.text) : action.why.text;
    const reason = retainedReason && customerText(retainedReason);
    if (reason) result.nextAction += ` ${["unknown", "estimate"].includes(action.why.basis) ? "Reasoning to check" : "Why"}: ${reason}`;
  }
  result.unknowns = [...new Set(result.unknowns)];
  return result;
}

/** Customer basics only; canonical analysis and legacy decision bases remain internal. */
export function projectCustomerSiteAdvisory(packet: Record<string, any>, correlationId: string, admittedDuration: number | null = null): SiteAdvisory {
  return projectSiteAssessment(prepareSiteAssessment(packet, admittedDuration), correlationId, "customer");
}

/** Only the fenced internal reader and offline tests consume this private view. */
export function projectCurrentSiteAssessmentView(packet: Record<string, any>, correlationId: string, admittedDuration: number | null = null): CurrentSiteAssessmentView {
  const prepared = prepareSiteAssessment(packet, admittedDuration);
  const customerAdvisory = projectSiteAssessment(prepared, correlationId, "customer");
  const legacy = projectSiteAssessment(prepared, correlationId, "legacy_v1");
  return { customerAdvisory,
    decisionAssessment: { ...legacy, decisionEvidence: {
      schemaVersion: "site_decision_evidence.v1", packetSha256: hash(packet), qualificationSha256: hash(prepared.rendered),
      legacyReviewCompatible: prepared.rendered.verification.unverified_claims === 0
        && legacy.sections.some(section => section.claims.some(claim => claim.verificationStatus === "source_bound")),
    } },
    // Reduced historical DTOs lack an immutable reviewed evidence identity.
    // Their hashes cannot establish unchanged qualifications; fail closed.
    compatibleDecisionAssessments: [] };
}

/** Reader is observational; caller establishes owner-token or account authority before invoking it. */
async function readCurrentSiteAdvisory(requestId: string, captureId: string,
  authorization: { ownerUid?: string; expectedOwnerUid?: string | null }, includeDecisionBases: boolean): Promise<CurrentSiteAssessmentView> {
  if (!db || !id(requestId) || captureId !== `walkthrough-${requestId}`) return decisionView(empty("unavailable"));
  try {
    const requestRef = db.collection("inboundRequests").doc(requestId);
    const briefRef = db.collection("siteTaskBriefs").doc(requestId);
    const sessionRef = db.collection("captureUploadSessions").doc(captureId);
    const [requestSnap, briefSnap, sessionSnap] = await Promise.all([requestRef.get(), briefRef.get(), sessionRef.get()]);
    const raw = requestSnap.data(), brief = briefSnap.data() ?? null, session = sessionSnap.data();
    if (!raw) return decisionView(empty("unavailable"));
    if (Object.prototype.hasOwnProperty.call(authorization, "expectedOwnerUid") && (raw.account_owner_uid ?? null) !== authorization.expectedOwnerUid) return decisionView(empty("unavailable"));
    if (authorization.ownerUid && raw.account_owner_uid !== authorization.ownerUid) return decisionView(empty("unavailable"));
    const pointer = raw.site_advisory;
    if (!pointer) return decisionView(null);
    const rights = projectWebsiteCaptureRights(raw);
    if (!rights.derived_scene_generation_allowed) return decisionView(empty(rights.consent_revoked ? "authority_ended" : "unavailable"));
    if (!/^advisory-[a-f0-9]{64}$/.test(pointer.job_id)) return decisionView(empty("unavailable"));
    const pending = session?.browser_pending_delivery as BrowserPending | undefined;
    if (!pending || pending.state !== "published" || pending.request_id !== requestId || pending.capture_id !== captureId
      || pending.scene_id !== `site-${requestId}` || session?.browser_upload_reservation || session?.browser_stored_upload)
      return decisionView(empty("unavailable"));
    const sourceKey = browserPendingDecisionKey(pending), context = advisoryContextDigest(raw, brief);
    if (pointer.job_id !== advisoryJobId(requestId, sourceKey, context) || pointer.source_key !== sourceKey || pointer.context_digest !== context) return decisionView(empty("unavailable"));
    const jobRef = db.collection("siteAssessmentJobs").doc(pointer.job_id), job = (await jobRef.get()).data();
    if (!job || job.schema_version !== "site_assessment_job.v1" || job.request_id !== requestId
      || job.source_key !== sourceKey || job.context_digest !== context || job.state !== pointer.state) return decisionView(empty("unavailable"));
    const correlation = `bp-advisory-${pointer.job_id.replace(/^advisory-/, "").slice(0, 16)}`;
    const manifestText = await verifiedPendingManifest(pending);
    if (!manifestText || !await verifiedPendingMarker(pending)) return decisionView(empty("unavailable", correlation));
    const manifest = JSON.parse(manifestText), privacy = raw.capture_privacy_source_bound_decision;
    if (!privacy?.proceeded || !["approved", "unscreened"].includes(privacy.eligibility) || privacy.capture_id !== captureId
      || privacy.producer_source?.kind !== "browser_pending" || privacy.producer_source.key !== sourceKey)
      return decisionView(empty("unavailable", correlation));
    let result = decisionView(empty(["queued", "running", "needs_review", "authority_ended"].includes(job.state) ? job.state : "unavailable", correlation));
    let retainedRun: { ref: FirebaseFirestore.DocumentReference; stored: Record<string, any> } | null = null;
    if (job.state === "completed") {
      if (!id(job.run_id) || !/^[a-f0-9]{64}$/.test(job.packet_sha256)) return decisionView(empty("unavailable", correlation));
      const runRef = db.collection("agentRuns").doc(job.run_id), runSnap = await runRef.get(), stored = runSnap.data();
      if (!stored || stored.status !== "completed" || stored.task_kind !== "site_assessment") return decisionView(empty("unavailable", correlation));
      retainedRun = { ref: runRef, stored };
      const run = await hydrateAgentEvidence(stored, { collection: "agentRuns", id: job.run_id });
      const packet = run.artifacts?.site_assessment_packet, admission = run.artifacts?.source_admission;
      if (!packet || packet.request_id !== requestId || hash(packet) !== job.packet_sha256 || admission?.request_id !== requestId
        || admission.schema_version !== "site_assessment_source.v1" || admission.capture_id !== captureId || admission.source_key !== sourceKey || admission.context_digest !== context
        || admission.advisory_job_id !== pointer.job_id
        || admission.video_bytes !== pending.video.size_bytes || typeof admission.video_ref !== "string"
        || admission.video_ref !== `gs://${process.env.BLUEPRINT_CAPTURE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com"}/${pending.video.object_name}#generation=${pending.video.generation}`
        || !/^[a-f0-9]{64}$/.test(admission.video_sha256) || !Array.isArray(packet.sources)
        || packet.sources.some((source: any) => source.kind === "video" && (source.sha256 !== admission.video_sha256 || source.canonical_ref !== admission.video_ref))
        || !packet.sources.some((source: any) => source.kind === "video")
        || hash(admission.manifest) !== hash(pending.manifest) || admission.duration_seconds !== manifest.duration_seconds)
        return decisionView(empty("unavailable", correlation));
      result = includeDecisionBases ? projectCurrentSiteAssessmentView(packet, correlation, admission.duration_seconds)
        : decisionView(projectCustomerSiteAdvisory(packet, correlation, admission.duration_seconds));
    }
    // Check the same persisted authority again, without side effects or provider calls.
    return await db.runTransaction(async transaction => {
      const [r, b, s, j] = await Promise.all([transaction.get(requestRef), transaction.get(briefRef), transaction.get(sessionRef), transaction.get(jobRef)]);
      if (hash(r.data()) !== hash(raw) || hash(b.data() ?? null) !== hash(brief) || hash(s.data()) !== hash(session) || hash(j.data()) !== hash(job))
        return decisionView(empty("unavailable", correlation));
      if (retainedRun && hash((await transaction.get(retainedRun.ref)).data()) !== hash(retainedRun.stored))
        return decisionView(empty("unavailable", correlation));
      return result;
    });
  } catch { return decisionView(empty("unavailable")); }
}

/** Overall read deadline; all late work is read-only and cannot dispatch or commit. */
async function loadSiteAssessmentView(requestId: string, captureId: string, authorization: {ownerUid?:string;expectedOwnerUid?:string|null},
  includeDecisionBases: boolean): Promise<CurrentSiteAssessmentView> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([readCurrentSiteAdvisory(requestId, captureId, authorization, includeDecisionBases),
    new Promise<CurrentSiteAssessmentView>(resolve => { timer = setTimeout(() => resolve(decisionView(empty("unavailable"))), 4000); })]); }
  finally { clearTimeout(timer); }
}

/** Internal decision read: same evidence fetch/deadline/fence as the public reader. */
export async function loadCurrentSiteAssessmentView(requestId: string, captureId: string, authorization: {ownerUid?:string;expectedOwnerUid?:string|null} = {}) {
  return loadSiteAssessmentView(requestId, captureId, authorization, true);
}

/** Public polling computes only the safe customer projection, never legacy analysis. */
export async function loadCurrentSiteAdvisory(requestId: string, captureId: string, authorization: {ownerUid?:string;expectedOwnerUid?:string|null} = {}) {
  return (await loadSiteAssessmentView(requestId, captureId, authorization, false)).customerAdvisory;
}
