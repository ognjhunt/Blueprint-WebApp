import { z } from "zod";
import { communicationsDigest, type EvaluationReadiness } from "./communications-contract";
import { resolvePublishedLaunchProfileCatalog, resolveTaskEvaluationProfileCatalogUrl } from "../utils/taskEvaluationLaunchContract";
export type { EvaluationReadiness } from "./communications-contract";

export const EVALUATION_READINESS_REF = "blueprintCommunications/default/evaluationReadiness/current";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/);
// A communications record, draft or prospect cannot establish capability.
const ownerRef = z.string().regex(/^[a-zA-Z0-9_.:-]+(?:\/[a-zA-Z0-9_.:-]+)+$/)
  .refine(value => value.split("/").length % 2 === 0
    && !/^(?:blueprintCommunications|outboundProspects|action_ledger)\//.test(value));
export const evaluationReadinessPublicationSchema = z.object({
  version: z.literal("blueprint.evaluation-readiness-publication.v1"),
  requiredCapabilities: z.array(z.object({ capabilityId: id, recordRef: ownerRef, recordDigest: hash }).strict()).min(1).max(8),
}).strict().refine(value => new Set(value.requiredCapabilities.map(item => item.capabilityId)).size === value.requiredCapabilities.length);

/** Normalized, dated owner-system evidence embedded in its canonical record.
 * Announcements, model output, environment flags and fixtures are not proof. */
export const capabilityReadinessEvidenceSchema = z.object({
  version: z.literal("blueprint.capability-readiness-evidence.v1"), capabilityId: id,
  status: z.enum(["available", "unavailable", "unknown"]),
  sourceSystem: z.string().trim().min(1).max(160), proofBasis: z.literal("owner_system"),
  claimCeiling: z.literal("operational"),
  checkedAt: z.string().datetime({ offset: true }), expiresAt: z.string().datetime({ offset: true }),
  siteId: id.nullable(), taskId: id.nullable(),
}).strict().refine(value => (value.siteId === null) === (value.taskId === null));

/** Read-only. A missing/unreadable publication never blocks a useful reply. */
export async function readEvaluationReadiness(db: FirebaseFirestore.Firestore,
  scope: { siteId: string; taskId: string }, now: number): Promise<EvaluationReadiness> {
  const capabilities: EvaluationReadiness["capabilities"] = [], blockers: string[] = [];
  try {
    const publicationRecord = await db.doc(EVALUATION_READINESS_REF).get();
    const publication = evaluationReadinessPublicationSchema.safeParse(publicationRecord.data());
    if (!publication.success) {
      // An absent optional projection falls back to the real Pipeline-owned
      // catalog already used by the evaluation launch route. Static env profile
      // declarations never establish live availability for communications.
      if (publicationRecord.exists) blockers.push("capability_readiness_evidence_missing");
      else if (resolveTaskEvaluationProfileCatalogUrl()) {
        const catalog = await resolvePublishedLaunchProfileCatalog();
        const matching = catalog.profiles.filter(profile => profile.task_evaluation_run?.scene_id === scope.siteId
          && profile.task_evaluation_run.task_id === scope.taskId);
        if (catalog.blocker || !matching.length) blockers.push(catalog.blocker ?? "pipeline_task_capability_not_published");
        else {
          // Catalog profiles are alternative launch recipes, rather than a
          // list of required dependencies. Prefer one operational live recipe.
          const profile = matching.find(item => item.claim_ceiling === "partner_run_pending_physical_join" && item.execution_admission.live_enabled)
            ?? matching.find(item => item.claim_ceiling === "partner_run_pending_physical_join") ?? matching[0];
          const operational = profile.claim_ceiling === "partner_run_pending_physical_join";
          const status = !operational ? "unknown" : profile.execution_admission.live_enabled ? "available" : "unavailable";
          capabilities.push({ capabilityId: profile.profile_id, status, recordRef: resolveTaskEvaluationProfileCatalogUrl(),
            recordDigest: communicationsDigest(profile), checkedAt: null, expiresAt: null, basis: "live_pipeline_catalog" });
          if (status !== "available") blockers.push(`${operational ? "capability_unavailable" : "capability_readiness_unknown"}:${profile.profile_id}`);
        }
      } else blockers.push("capability_readiness_evidence_missing");
    }
    else {
      const records = await Promise.all(publication.data.requiredCapabilities.map(item => db.doc(item.recordRef).get()));
      for (let index = 0; index < records.length; index++) {
        const pointer = publication.data.requiredCapabilities[index], raw = records[index].data();
        const parsed = capabilityReadinessEvidenceSchema.safeParse(raw?.communicationsReadiness);
        const evidence = parsed.success ? parsed.data : null;
        const valid = evidence && communicationsDigest(raw) === pointer.recordDigest
          && evidence.capabilityId === pointer.capabilityId
          && Date.parse(evidence.checkedAt) <= now && Date.parse(evidence.expiresAt) > now
          && Date.parse(evidence.expiresAt) > Date.parse(evidence.checkedAt)
          && now - Date.parse(evidence.checkedAt) <= 7 * 86400000
          && (evidence.siteId === null || evidence.siteId === scope.siteId && evidence.taskId === scope.taskId);
        const status = valid ? evidence.status : "unknown";
        capabilities.push({ ...pointer, status, checkedAt: evidence?.checkedAt ?? null, expiresAt: evidence?.expiresAt ?? null });
        if (status !== "available") blockers.push(`${status === "unavailable" ? "capability_unavailable" : "capability_readiness_unknown"}:${pointer.capabilityId}`);
      }
      if (communicationsDigest((await db.doc(EVALUATION_READINESS_REF).get()).data()) !== communicationsDigest(publication.data)) {
        capabilities.length = 0; blockers.length = 0; blockers.push("capability_readiness_publication_changed");
      }
    }
  } catch { capabilities.length = 0; blockers.length = 0; blockers.push("capability_readiness_evidence_unreadable"); }
  const state: EvaluationReadiness["state"] = capabilities.some(item => item.status === "unavailable") ? "unavailable"
    : capabilities.length && capabilities.every(item => item.status === "available") ? "available" : "unknown";
  const binding = { version: "blueprint.communications-evaluation-readiness.v1" as const, state, capabilities, blockers };
  return { ...binding, observedAt: new Date(now).toISOString(), bindingDigest: communicationsDigest(binding) };
}

export const SITE_INTEREST_REPLY_GUIDANCE = `When a site expresses interest, offer a useful, description-first conversation to scope the job even while evaluation access is unavailable or unverified. Acknowledge their actual purpose: operational improvement, a learning pilot or preparing for future robotics are all valid, including nonurgent interest. Interest is not a match, pilot booking or team commitment.
Use evaluationReadiness as dated capability evidence. If unavailable, say only that the relevant evaluation access is not available yet; if unknown, say that access still needs to be confirmed. Do not name Atlas as a blocker unless the evidence actually identifies it as a required unavailable capability. If available, discuss only the evidenced bounded next step; availability does not prove fit, supply, scheduling or acceptance. Do not invent an evaluation, robot supply, a launch date, match or pilot commitment.
Offer to help clarify the job and what a useful pilot would improve or teach them. Progressively learn the task, pilot purpose/desired outcome, constraints and timing from the actual thread; ask at most one useful unanswered question per reply, without a questionnaire. Keep it short and natural. Video is optional and never a condition of replying or continuing this conversation; do not request footage or private data without existing permission.
Retain the conditional follow-up in the supplied durable CRM record for owner review when capability is evidenced available. Do not promise a date or an automatic email; say we can revisit evaluation when access is confirmed, if relevant. This is draft-only: no sending, sharing, spending, access change or commitment authority.`;

/** Deterministic checks supplement semantic review of the actual reply. */
export function siteReplyPromiseBlockers(body: string, readiness?: EvaluationReadiness) {
  const blockers: string[] = [];
  const text = body.replace(/[’‘]/g, "'");
  const atlas = readiness?.capabilities.find(item => item.capabilityId.toLowerCase() === "atlas");
  if (/\bevaluation(?: access)?\s+(?:is|isn't|is not|remains)\s+(?:unavailable|not (?:ready|available|open)|(?:available|ready|open) yet)\b/i.test(text)
    && readiness?.state !== "unavailable") blockers.push("reply_readiness_status_not_evidenced");
  if (/\bAtlas(?: access)?\b.{0,30}\b(?:unavailable|not (?:ready|available|open)|blocked|awaiting|waiting|launches)\b|\b(?:wait(?:ing)? (?:on|for)|until)\s+Atlas\b/i.test(text)
    && atlas?.status !== "unavailable") blockers.push("reply_atlas_blocker_not_evidenced");
  if (/\bAtlas(?: access)?\s+is\s+(?:ready|available|open)\b|\b(?:we can|you can)\s+(?:use|access)\s+Atlas\b/i.test(text)
    && atlas?.status !== "available") blockers.push("reply_atlas_access_not_evidenced");
  if (/\b(?:we|Blueprint|I)(?:'ll| will| can| could| are able to)\s+(?:provide|supply|deliver|ship|send|reserve)\s+(?:(?:you|a|the|your|our|free|an?|physical)\s+){0,3}(?:robots?|hardware)\b/i.test(text)
    || /\b(?:we|Blueprint|I)\s+(?:already )?have\b.{0,50}\b(?:robots?|robot team|hardware)\b.{0,30}\b(?:ready|available|reserved)\b/i.test(text)
    || /\b(?:robots?|robot teams?|hardware)\s+(?:is|are|will be)\s+(?:ready|available|reserved)\b/i.test(text)
    || /\b(?:we(?:'ll| will)|Blueprint will|I(?:'ll| will))\s+(?:match you|find you (?:a |the )?robot|book (?:a |the |your )?pilot|start (?:a |the |your )?pilot)\b/i.test(text)
    || /\b(?:your pilot is (?:confirmed|booked)|we have (?:a match|matched you)|you(?:'re| are) matched)\b/i.test(text)) blockers.push("unsupported_reply_commitment");
  if (/\b(?:we(?:'ll| will| are| expect to)|Blueprint (?:will|is)|I(?:'ll| will| am))\s+(?:launch|launching|open|opening|release|releasing|enable|enabling)\b/i.test(text)
    || /\b(?:evaluation(?: access)?|Atlas(?: access)?)\s+(?:will be|is going to be)\s+(?:available|ready|open)\s+(?:by|on|in|next|tomorrow)\b/i.test(text)) blockers.push("unsupported_reply_launch_date");
  if (/\b(?:we|Blueprint|I)(?:'ll| will| can)\s+(?:evaluate|run|start|schedule|perform|provide)\b[^.!?\n]{0,100}\b(?:next (?:week|month|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|tomorrow|on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|by (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|\d{4}-\d{2}-\d{2})\b/i.test(text)) blockers.push("unsupported_reply_launch_date");
  if (readiness?.state !== "available" && /\b(?:we|Blueprint|I)(?:'ll| will| can| could| are able to)\s+(?:(?:run|start|offer|provide|perform|do|schedule)\s+(?:an? |the |your )?evaluation|evaluate)\b|\b(?:evaluation(?: access)?|Atlas(?: access)?)\s+is\s+(?:(?:already|now)\s+)?(?:ready|available|open)\b|\b(?:you can|we can) (?:use|access) Atlas\b/i.test(text)) {
    blockers.push("reply_evaluation_readiness_not_evidenced");
  }
  if (text.split(/[.!?\n]/).some(sentence => /\b(?:need|require|must|have to)\b.{0,60}\b(?:video|footage)\b/i.test(sentence)
    && !/\b(?:don't|do not|not|no|never|optional|without)\b/i.test(sentence))) blockers.push("reply_video_condition");
  return blockers;
}
