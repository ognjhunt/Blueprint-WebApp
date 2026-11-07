import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import { screenTaskScope } from "./siteTaskScope";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import type { TaskItem, TaskItemInventoryRecord } from "./taskItemInventory";

/** The recorded site grant covers scene building/evaluation, never resale. */
export function projectWebsiteCaptureRights(record: Record<string, any> | undefined) {
  const request = record?.request ?? {};
  const attestation = request.consent_attestation;
  const revoked = Boolean(attestation?.revoked_at_iso || attestation?.withdrawn_at_iso)
    || [record, request, record?.capture_rights].some(value =>
    value?.consent_revoked === true || Boolean(value?.consent_revoked_at)
    || value?.consent_status === "revoked" || value?.future_processing_allowed === false);
  const granted = !revoked && hasCurrentRecordingConsent(attestation);
  return {
    derived_scene_generation_allowed: granted,
    data_licensing_allowed: false,
    capture_contributor_payout_eligible: false,
    consent_status: revoked ? "revoked" : granted ? "granted" : "unknown",
    consent_revoked: revoked,
    consent_scope: granted ? ["derived_scene_generation", "robot_evaluation"] : [],
    statement_version: attestation?.statement_version ?? null,
    recorded_at_iso: attestation?.recorded_at_iso ?? null,
  };
}

export async function loadWebsiteCaptureRights(requestId: string) {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return projectWebsiteCaptureRights(undefined);
  // Consent is stored in plaintext; owner/contact fields are not needed here.
  return projectWebsiteCaptureRights(snapshot.data());
}

/** A suggestion is our reading of the brief, never the owner's statement, so it joins the
 * task only once the owner photographs it. Seeding one on the first read of the item list
 * must not redefine the task a running preparation grant is bound to. */
export function countsTowardTask(item: Pick<TaskItem, "basis" | "images">): boolean {
  return item.basis !== "suggested" || item.images.length > 0;
}

function projectTaskItem(item: TaskItem, requestId: string) {
  return { item_id: item.itemId, label: item.label, location_note: item.locationNote,
    quantity_hint: item.quantityHint, basis: item.basis,
    // Coverage/asset status are deliberately excluded: images are observations.
    images: item.images.map(image => {
      const prefix = `scenes/site-${requestId}/items/`;
      if (!image.storagePath.startsWith(`${prefix}${item.itemId}/`) || image.storagePath.split("/").some(p => p === ".." || p === "." || !p))
        throw new Error("website_task_item_source_mismatch");
      return { image_id: image.imageId, storage_path: image.storagePath, uploaded_at_iso: image.uploadedAtIso,
        source: image.source ?? null, basis: "owner_supplied_photo", physical_metrology: false };
    }),
  };
}

type TaskContextEvidence = {
  inventory?: TaskItemInventoryRecord | null; captureId?: string; captureBinding?: Record<string, unknown>; purpose?: "scene_preparation";
  /** The task context the job's retained preparation grant was issued for (`preparationGrantContextDigest`). */
  preparationGrantContextDigest?: string;
};

/** The task context digest the job's retained preparation grant was issued for: what its preparation sealed. */
export function preparationGrantContextDigest(record: Record<string, any> | undefined): string | undefined {
  const grant = record?.website_scene_sponsorship;
  return grant?.purpose === "scene_preparation" && typeof grant.task_context_digest === "string"
    && /^sha256:[a-f0-9]{64}$/.test(grant.task_context_digest) ? grant.task_context_digest : undefined;
}

/** Minimal, current task snapshot. Never forwards owner contact or identity.
 *
 * A brief the site confirmed after its preparation sealed the unconfirmed one names that parent
 * (`confirmation_parent_context_digest`) when the confirmation changed nothing the task is: every answer it
 * added accepts our own proposal unchanged, or marks a gate unknown, and its success criteria state nothing
 * (`confirmationParentContextDigests`). The parent is the context the retained preparation grant was issued
 * for, so it is the digest preparation sealed, byte for byte. Only a confirmation that changed answers names
 * it: one that changed nothing but the confirmation is recognised from the context itself. */
export function projectWebsiteTaskContext(brief: SiteTaskBriefRecord, captureRights?: ReturnType<typeof projectWebsiteCaptureRights>,
  evidence?: TaskContextEvidence) {
  // Legacy confirmed captures retain their digest. An unconfirmed proposal
  // must bind its explicit task semantics before any native preparation can
  // default it into a narrower evaluator; old ambiguous grants fail closed.
  const inferred = screenTaskScope({ summary: brief.summary, successDefinition: brief.successCriteria?.successDefinition });
  const family = brief.taskFamily !== undefined || !brief.confirmedAtIso || !inferred.supported
    ? inferred.kind ?? "general_task" : undefined;
  const value = {
    schema_version: "website_site_task_context.v1",
    ...(evidence?.purpose ? { purpose: evidence.purpose } : {}),
    request_id: brief.requestId,
    scene_id: `site-${brief.requestId}`,
    capture_id: evidence?.captureId ?? `walkthrough-${brief.requestId}`,
    description: brief.summary,
    ...(family ? { task_family: family } : {}),
    confirmed: Boolean(brief.confirmedAtIso),
    confirmed_at: brief.confirmedAtIso,
    operator_answers: brief.operatorAnswers ?? {},
    unresolved: brief.operatorUnknown ?? brief.unresolved,
    capture_rights: captureRights ?? projectWebsiteCaptureRights(undefined),
    ...(brief.operatorTaskDetails ? { operator_task_details: brief.operatorTaskDetails } : {}),
    ...(brief.successCriteria ? { success_criteria: brief.successCriteria } : {}),
    ...(brief.operatorTaskDetails || brief.successCriteria ? { task_evidence_provenance: {
      item_details: "owner_stated_unverified", success_criteria: "owner_stated_target",
      success_rate_unit: "percent", cycle_time_unit: "seconds", physical_measurements_verified: false,
    } } : {}),
    ...(evidence?.captureBinding ? { capture_binding: evidence.captureBinding } : {}),
    ...(evidence?.inventory?.items.some(countsTowardTask) ? { task_items: evidence.inventory.items.filter(countsTowardTask)
      .map(item => projectTaskItem(item, brief.requestId)) } : {}),
  };
  const sealed = evidence?.preparationGrantContextDigest;
  const parent = brief.confirmedAtIso && sealed && confirmationParents(brief, captureRights, evidence).answered.includes(sealed)
    ? sealed : undefined;
  const stated = parent ? { ...value, confirmation_parent_context_digest: parent } : value;
  return { ...stated, context_digest: canonicalArtifactDigest(stated, "context_digest") };
}

/** What a site's confirmation of its brief may change in its task context without changing the task (the
 * Pipeline's `website_task_context_lineage`): the consent itself, the site's answers to the screening gates and
 * a success criterion that states nothing. */
const CONFIRMATION_FIELDS = ["confirmed", "confirmed_at", "operator_answers", "unresolved", "success_criteria",
  "task_evidence_provenance", "confirmation_parent_context_digest"] as const;
/** The proposals a confirmation may accept unchanged: what the site told us and what we saw, which preparation was built on. */
const ACCEPTABLE_PROPOSAL_BASES: ReadonlySet<string> = new Set(["description", "observation"]);

/** Success criteria that state nothing: no definition, and unknown or without a rate and a cycle time. */
export function successCriteriaStateNothing(criteria: SiteTaskBriefRecord["successCriteria"]): boolean {
  if (!criteria) return true;
  const definition = criteria.successDefinition;
  return (definition === null || definition === undefined || (typeof definition === "string" && !definition.trim()))
    && (criteria.unknown === true || (criteria.successRate == null && criteria.cycleTimeSeconds == null));
}

/** The brief before the site confirmed it, when the confirmation changed nothing else: its confirmation time not
 * yet stored (null, or absent as older briefs had it), and, when every answer it added accepts our own proposal
 * unchanged, its answers, unknown gates and empty success criteria not yet given. An answer that differs from the
 * proposal is a correction: task content, so no such parent exists. */
function confirmationParentBriefs(brief: SiteTaskBriefRecord) {
  const at = [null, undefined] as unknown as SiteTaskBriefRecord["confirmedAtIso"][];
  const pure = at.map(confirmedAtIso => ({ ...brief, confirmedAtIso }));
  const accepted = Object.entries(brief.operatorAnswers ?? {}).every(([fieldId, value]) => (brief.proposed ?? []).some(answer =>
    answer.fieldId === fieldId && answer.value === value && ACCEPTABLE_PROPOSAL_BASES.has(answer.basis)));
  const answered = (accepted ? [null, brief.operatorAnswers] : [brief.operatorAnswers]).flatMap(operatorAnswers =>
    (successCriteriaStateNothing(brief.successCriteria) ? [null, brief.successCriteria ?? null] : [brief.successCriteria ?? null])
      .flatMap(successCriteria => at.map(confirmedAtIso => ({ ...brief, confirmedAtIso, operatorAnswers,
        operatorUnknown: null, successCriteria }))));
  return { pure, answered };
}

function confirmationParents(brief: SiteTaskBriefRecord, captureRights?: ReturnType<typeof projectWebsiteCaptureRights>,
  evidence?: TaskContextEvidence): { pure: string[]; answered: string[] } {
  if (!brief.confirmedAtIso) return { pure: [], answered: [] };
  const base = { ...evidence, preparationGrantContextDigest: undefined };
  const without = (context: Record<string, unknown>, fields: readonly string[]) => canonicalArtifactDigest(
    Object.fromEntries(Object.entries(context).filter(([key]) => !fields.includes(key))), "context_digest");
  const current = projectWebsiteTaskContext(brief, captureRights, base);
  const parents = (briefs: SiteTaskBriefRecord[], fields: readonly string[]) => [...new Set(briefs
    .map(parent => projectWebsiteTaskContext(parent, captureRights, base))
    .filter(parent => without(parent, fields) === without(current, fields)).map(parent => parent.context_digest))];
  const { pure, answered } = confirmationParentBriefs(brief);
  // Only the confirmation changed: the Pipeline recognises that parent from the context itself.
  const confirmationOnly = parents(pure, ["confirmed", "confirmed_at"]);
  return { pure: confirmationOnly,
    answered: parents(answered, CONFIRMATION_FIELDS).filter(digest => !confirmationOnly.includes(digest)) };
}

/** The digests this brief's context had before the site confirmed it, while confirming changed nothing the task is.
 * Confirming a brief records consent and the site's answers to the screening gates; neither changes what the task
 * is. So a context that differs from the earlier one only in `confirmed`, `confirmed_at`, answers that accept our
 * own proposals unchanged, gates marked unknown and success criteria that state nothing is that context's
 * confirmed successor (the Pipeline's `website_task_context_lineage`). Empty for an unconfirmed brief, or when
 * the confirmation corrected an answer or changed anything else (the summary, the task family it infers, a stated
 * success definition, item details, rights). Only a digest a retained record holds is ever matched against
 * these. The confirmation itself is the brief's own. */
export function confirmationParentContextDigests(brief: SiteTaskBriefRecord,
  captureRights?: ReturnType<typeof projectWebsiteCaptureRights>,
  evidence?: Parameters<typeof projectWebsiteTaskContext>[2]): string[] {
  const { pure, answered } = confirmationParents(brief, captureRights, evidence);
  return [...pure, ...answered];
}

/** Reconstruct only the earlier v1 routing projection; no owner fact is removed.
 * Callers must independently admit the current assessment and retained grant.
 */
export function legacyRoutingTaskContextDigest(context: ReturnType<typeof projectWebsiteTaskContext>) {
  if (!context.task_family) return undefined;
  const { context_digest: _digest, task_family: _family, ...value } = context;
  return canonicalArtifactDigest(value, "context_digest");
}

/** Operator renewal compatibility only: prove the old projection against today's
 * complete records. Never restores an unphotographed suggestion as task evidence. */
export function legacySuggestedTaskContextDigest(context: ReturnType<typeof projectWebsiteTaskContext>,
  inventory: TaskItemInventoryRecord | null) {
  if (!inventory?.items.some(item => !countsTowardTask(item))) return undefined;
  const { context_digest: _digest, ...value } = context;
  return canonicalArtifactDigest({ ...value, task_items: inventory.items.map(item => projectTaskItem(item, context.request_id)) }, "context_digest");
}

/** One projection used by the signed read and the spending/publication checks. */
export async function loadWebsiteTaskInventory(requestId: string): Promise<TaskItemInventoryRecord | null> {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const record = (await db.collection("siteTaskItemInventories").doc(requestId).get()).data();
  if (!record) return null;
  if (record.requestId !== requestId || !Array.isArray(record.items)) throw new Error("website_task_item_inventory_invalid");
  return record as TaskItemInventoryRecord;
}
