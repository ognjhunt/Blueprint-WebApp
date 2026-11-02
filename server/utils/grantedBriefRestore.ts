/**
 * Put a website job's brief back to the task its scene grant was issued for.
 *
 * Before WebApp #1182, a model reading could fold an inferred answer into an
 * unconfirmed brief after the job's scene grant was issued. That moved the task
 * context the grant is bound to, and the intake worker then revoked the job
 * (capture-447ae4f4, 2026-11-02). This finds the smallest set of model-read
 * proposals whose removal reproduces the grant's context digest exactly, and
 * acts only when that set is unique. It never touches the operator's confirmed
 * answers (`operatorAnswers`), a confirmed brief, or a measurement they gave.
 * Each removed proposal is kept for the site's review.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { TASK_BRIEFS_COLLECTION, unresolvedGates, type ProposedGateAnswer,
  type SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";

/** Bases a model reading produces. A measurement is the operator's figure and stays. */
const MODEL_READ_BASES = new Set(["description", "observation", "assumption"]);
/** 2^12 candidate removals at most; a brief carries one proposal per site question. */
const MAX_REMOVABLE = 12;

export type GrantedBriefRestorePlan =
  | { status: "matches_grant" | "no_grant" | "confirmed" }
  | { status: "not_reproducible" | "ambiguous" | "too_many_proposals"; candidates: number }
  | { status: "restorable"; remove: number[]; restored: SiteTaskBriefRecord };

export function planGrantedBriefRestore(record: Record<string, any>, brief: SiteTaskBriefRecord,
  inventory: TaskItemInventoryRecord | null): GrantedBriefRestorePlan {
  const grant = record.website_scene_sponsorship;
  if (!grant) return { status: "no_grant" };
  const rights = projectWebsiteCaptureRights(record);
  const purpose = grant.purpose === "scene_preparation" ? "scene_preparation" as const : undefined;
  const context = (value: SiteTaskBriefRecord) =>
    projectWebsiteTaskContext(value, rights, { inventory, purpose }).context_digest;
  if (context(brief) === grant.task_context_digest) return { status: "matches_grant" };
  if (brief.confirmedAtIso) return { status: "confirmed" };
  const rows: readonly ProposedGateAnswer[] = brief.proposed ?? [];
  const removable = rows.flatMap((row, index) => MODEL_READ_BASES.has(row.basis) ? [index] : []);
  if (removable.length > MAX_REMOVABLE) return { status: "too_many_proposals", candidates: 0 };
  const without = (remove: number[]): SiteTaskBriefRecord => {
    const kept = rows.filter((_row, index) => !remove.includes(index));
    return { ...brief, proposed: kept, unresolved: unresolvedGates(brief.captureMode, kept) };
  };
  const matches: number[][] = [];
  for (let mask = 1; mask < 1 << removable.length; mask++) {
    const remove = removable.filter((_index, bit) => mask & (1 << bit));
    if (context(without(remove)) === grant.task_context_digest) matches.push(remove);
  }
  if (!matches.length) return { status: "not_reproducible", candidates: 0 };
  const fewest = Math.min(...matches.map(remove => remove.length));
  const smallest = matches.filter(remove => remove.length === fewest);
  if (smallest.length !== 1) return { status: "ambiguous", candidates: smallest.length };
  return { status: "restorable", remove: smallest[0], restored: without(smallest[0]) };
}

/** Plan, and with ``apply`` write, the restore in one transaction that re-plans on the latest records. */
export async function restoreGrantedBrief(requestId: string, { apply }: { apply: boolean }) {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  const requestRef = store.collection("inboundRequests").doc(requestId);
  const briefRef = store.collection(TASK_BRIEFS_COLLECTION).doc(requestId);
  const inventoryRef = store.collection("siteTaskItemInventories").doc(requestId);
  return store.runTransaction(async transaction => {
    const [request, brief, inventory] = await Promise.all([
      transaction.get(requestRef), transaction.get(briefRef), transaction.get(inventoryRef)]);
    if (!request.exists || !brief.exists) throw new Error("task_brief_missing");
    const record = request.data()!, current = brief.data() as SiteTaskBriefRecord;
    const plan = planGrantedBriefRestore(record, current,
      inventory.exists ? inventory.data() as TaskItemInventoryRecord : null);
    if (plan.status !== "restorable") return { applied: false, ...plan };
    const removed = plan.remove.map(index => current.proposed[index]);
    const summary = { status: plan.status, removed_fields: removed.map(row => row.fieldId),
      removed_bases: removed.map(row => row.basis), brief_digest: humanDecisionDigest(current) };
    if (!apply) return { applied: false, ...summary };
    const note = { source: { kind: "grant_restore", grant_authority_digest: record.website_scene_sponsorship.authority_digest,
      brief_digest: summary.brief_digest }, proposals: removed, state: "grant_review_required" };
    transaction.set(briefRef.collection("footageProposals").doc(humanDecisionDigest(note.source)), note);
    transaction.set(briefRef, plan.restored);
    return { applied: true, ...summary };
  });
}
