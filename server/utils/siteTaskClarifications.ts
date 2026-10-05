import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";

export function clarificationRevision(brief: unknown, request: Record<string, any>) {
  return humanDecisionDigest({ brief, answers: request.siteTaskGates,
    triage: request.site_task_triage, confirmed: Boolean(request.site_task_brief_confirmed_at) });
}

export async function readSiteClarification(requestId: string) {
  if (!db) throw new Error("clarification_store_unavailable");
  const [request, brief] = await Promise.all([db.collection("inboundRequests").doc(requestId).get(),
    db.collection("siteTaskBriefs").doc(requestId).get()]);
  if (!request.exists || !brief.exists) throw new Error("clarification_missing");
  const value = request.data()!;
  return { revision: clarificationRevision(brief.data(), value),
    questions: value.site_task_triage?.open_questions || [],
    needed: value.site_task_triage?.disposition === "needs_conversation",
    response: value.site_task_clarification || null };
}

/** Owner evidence is retained for the existing reviewer; prose never clears a gate. */
export async function submitSiteClarification(requestId: string, revision: string, explanation: string) {
  if (!db) throw new Error("clarification_store_unavailable");
  if (!/^[a-f0-9]{64}$/.test(revision) || explanation.trim().length < 10 || explanation.length > 4000) {
    throw new Error("clarification_invalid");
  }
  const ref = db.collection("inboundRequests").doc(requestId);
  const id = humanDecisionDigest({ requestId, revision, explanation: explanation.trim() });
  return db.runTransaction(async tx => {
    const responseRef = ref.collection("clarifications").doc(id);
    const [request, brief, prior] = await Promise.all([tx.get(ref),
      tx.get(db!.collection("siteTaskBriefs").doc(requestId)), tx.get(responseRef)]);
    if (prior.exists) return { id, state: prior.data()!.state };
    const value = request.data();
    if (!value || !brief.exists || clarificationRevision(brief.data(), value) !== revision) throw new Error("clarification_revision_changed");
    if (value.site_task_triage?.disposition !== "needs_conversation" || !value.site_task_brief_confirmed_at) throw new Error("clarification_not_needed");
    const response = { id, revision, explanation: explanation.trim(), state: "review_required",
      submitted_by: "owner_link", submitted_at: new Date().toISOString() };
    tx.create(responseRef, response);
    tx.set(ref, { site_task_clarification: response,
      ops: { next_step: "Review the owner's written clarification under Screening; record the outcome without requiring a call." } }, { merge: true });
    return { id, state: response.state };
  });
}
