import type { Firestore } from "firebase-admin/firestore";

import { taskEvaluationResultAccessAllowed } from "./taskEvaluationResultAccess";
import { parseVerifiedTaskEvaluationRunPublication } from "./taskEvaluationRunContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";

export type ResultInboxActor = { uid: string | null; tenantId: string; isOps: boolean };
export type ResultInboxRecord = Record<string, any> & {
  record_id: string;
  owner_user_id: string;
  organization_id: string;
  access_visibility: "owner_only" | "organization_members" | "unlisted_public";
  publication: Record<string, any>;
};

/** The UI list and internal delivery readback share this exact query/access boundary. */
export async function readTaskEvaluationResultInbox(db: Firestore, actor: ResultInboxActor) {
  if (!actor.uid) throw new Error("result_inbox_authentication_required");
  const collection = db.collection("captureTaskEvaluationRuns");
  const snapshot = actor.isOps
    ? await collection.limit(250).get()
    : actor.tenantId
      ? await collection.where("organization_id", "==", actor.tenantId).limit(250).get()
      : await collection.where("owner_user_id", "==", actor.uid).limit(250).get();
  const records: ResultInboxRecord[] = [];
  for (const document of snapshot.docs) {
    const raw = { ...document.data(), record_id: document.id } as ResultInboxRecord;
    const verified = parseVerifiedTaskEvaluationRunPublication(publicationFromResultRecord(raw));
    if (verified.ok && taskEvaluationResultAccessAllowed(raw, actor)) {
      records.push({ ...raw, publication: verified.publication });
    }
  }
  return { scope: actor.isOps ? "blueprint_operations" : actor.tenantId ? "organization" : "owner", records };
}
