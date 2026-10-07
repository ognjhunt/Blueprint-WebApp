import { communicationsDigest, type CommunicationsBrief } from "./communications-contract";
import { readEvaluationReadiness } from "./communications-readiness";
import { replyFollowupRef, verifyReplyFollowup } from "./communications-reply-followup";

const ROOT = "blueprintCommunications/default";
export function readinessFollowupRef(db: FirebaseFirestore.Firestore, handoffId: string) {
  return db.doc(`${ROOT}/readinessFollowups/${handoffId}`);
}
export function readinessFollowupPointer(brief: CommunicationsBrief, handoffId: string) {
  return { version: "blueprint.readiness-followup-pointer.v1", handoffId, prospectId: brief.prospectId,
    siteId: brief.siteId, taskId: brief.taskId, owner: "nijel@tryblueprint.io", sendingAuthorized: false };
}

/** Free CRM preparation on the existing worker lap, including when paid
 * inference is disabled. One stable row and one readiness action per thread;
 * availability never creates another answer to the same inbound message. */
export async function refreshReadinessFollowup(db: FirebaseFirestore.Firestore, pointer: ReturnType<typeof readinessFollowupPointer>,
  isSuppressed: (email: string) => Promise<boolean>, now: number) {
  const ref = replyFollowupRef(db, pointer.prospectId, pointer.handoffId), watchRef = readinessFollowupRef(db, pointer.handoffId);
  const original = verifyReplyFollowup((await ref.get()).data());
  if (original.handoffId !== pointer.handoffId || original.prospectId !== pointer.prospectId
    || original.siteId !== pointer.siteId || original.taskId !== pointer.taskId || original.audienceRole !== "site") throw new Error("readiness_followup_binding_changed");
  const readiness = await readEvaluationReadiness(db, pointer, now);
  const suppressed = await isSuppressed(original.recipient);
  return db.runTransaction(async tx => {
    const [row, watch, prospect] = await Promise.all([tx.get(ref), tx.get(watchRef), tx.get(db.doc(`outboundProspects/${pointer.prospectId}`))]);
    const saved = verifyReplyFollowup(row.data()), prior = watch.data();
    if (saved.evidenceDigest !== original.evidenceDigest || communicationsDigest(saved.review) !== communicationsDigest(original.review)
      || communicationsDigest(Object.fromEntries(Object.keys(pointer).map(key => [key, prior?.[key]]))) !== communicationsDigest(pointer)) {
      throw new Error("readiness_followup_binding_changed");
    }
    const closed = suppressed || prospect.data()?.stage === "closed" || saved.state === "opted_out" || saved.nextAction === "no_action";
    const linked = prospect.data()?.contactEmail?.toLowerCase() === saved.recipient
      && prospect.data()?.siteId === saved.siteId && prospect.data()?.taskId === saved.taskId && !saved.contextMissing;
    const interested = saved.state === "reviewed" && ["exploratory_interest", "explicit_commitment"].includes(saved.responseMeaning);
    const state = closed ? "closed" : !linked ? "repair_context" : !interested ? "awaiting_interest_review"
      : readiness.state === "available" ? "ready_for_owner_review" : "waiting_for_capability";
    const eventRef = ref.collection("readinessActions").doc("capability_available"), event = await tx.get(eventRef);
    const action = { version: "blueprint.readiness-followup.v1", state, evidenceDigest: saved.evidenceDigest,
      reviewRevisionId: saved.review?.revisionId ?? null, readiness,
      owner: pointer.owner, nextAction: state === "ready_for_owner_review" ? "Review current capability evidence and the site's task, pilot purpose, constraints and timing; prepare a bounded draft only if still useful."
        : state === "waiting_for_capability" ? "Continue useful task scoping; revisit evaluation after current owner-system evidence confirms access."
        : state === "closed" ? "Retain context; prepare no follow-up." : "Review or repair the actual reply context before considering a capability follow-up.",
      readinessActionRef: event.exists || state === "ready_for_owner_review" ? eventRef.path : null,
      authority: { sending: false, spending: false, matching: false, pilotCommitment: false } };
    // Suppression and every current review are rechecked even after the first
    // action. A lost/stale capability returns the watch to waiting.
    if (state === "ready_for_owner_review" && !event.exists) tx.create(eventRef, { ...action, preparedAt: now });
    const { observedAt: _observed, ...binding } = action.readiness;
    const comparable = { ...action, readiness: binding };
    const priorAction = saved.readinessFollowup;
    const priorComparable = priorAction ? { ...priorAction, readiness: Object.fromEntries(Object.entries(priorAction.readiness).filter(([key]) => key !== "observedAt")) } : null;
    if (communicationsDigest(comparable) !== communicationsDigest(priorComparable)) {
      tx.update(ref, { readinessFollowup: action });
      tx.set(watchRef, { ...pointer, state, updatedAt: now, readinessDigest: readiness.bindingDigest });
    }
    return action;
  });
}

export async function runCommunicationsReadinessFollowups(db: FirebaseFirestore.Firestore,
  isSuppressed: (email: string) => Promise<boolean>, now: () => number, canContinue: () => boolean = () => true) {
  const cursorRef = db.doc(`${ROOT}/readinessFollowupState/current`), cursor = (await cursorRef.get()).data()?.cursor;
  let query = db.doc(ROOT).collection("readinessFollowups").orderBy("__name__").limit(25);
  if (cursor) query = query.startAfter(cursor);
  const rows = await query.get(); let last = cursor ?? null;
  for (const row of rows.docs) {
    if (!canContinue()) break;
    const saved = row.data();
    const pointer = Object.fromEntries(["version", "handoffId", "prospectId", "siteId", "taskId", "owner", "sendingAuthorized"].map(key => [key, saved[key]])) as ReturnType<typeof readinessFollowupPointer>;
    try { await refreshReadinessFollowup(db, pointer, isSuppressed, now()); }
    catch { await row.ref.set({ state: "needs_repair", reason: "readiness_followup_context_or_evidence_invalid" }, { merge: true }); }
    last = row.id;
  }
  if (canContinue()) await cursorRef.set({ cursor: rows.empty ? null : last });
}
