import { readQueryPages } from "./query-pages";
import { LEARNING_ROOT, authorize, validateEvent, type LearningEvent, type LearningGrant, type SnapshotRequest } from "./contract";
import { buildSnapshot, validateCorrection, verifySnapshot, type LearningSnapshot } from "./snapshot";

export type WriterContext = { writer: LearningEvent["writer"]; actorId: string; prospectIds: string[] };

/** Server-only library. No scheduler, environment changes, source rewrites or
 * automatic cutover. Existing Firebase Admin binding is supplied by the owner. */
export class ResearchLearningStore {
  constructor(private db: FirebaseFirestore.Firestore, private now = () => new Date().toISOString()) {}
  private collection(name: "events" | "snapshots") { return this.db.doc(LEARNING_ROOT).collection(name); }

  async append(value: unknown, context: WriterContext): Promise<"created" | "existing"> {
    const event = validateEvent(value);
    if (event.writer !== context.writer || event.actorId !== context.actorId || !context.prospectIds.includes(event.entities.prospectId)
      || Date.parse(event.recordedAt) > Date.parse(this.now())) throw new Error("learning_writer_scope_denied");
    const ref = this.collection("events").doc(event.eventId);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        const saved = validateEvent(existing.data());
        if (saved.eventId !== event.eventId) throw new Error("learning_append_conflict");
        return "existing";
      }
      if (event.correctsEventId) {
        const target = await tx.get(this.collection("events").doc(event.correctsEventId));
        const siblings = await tx.get(this.collection("events").where("correctsEventId", "==", event.correctsEventId).limit(1));
        if (!target.exists || !siblings.empty) throw new Error("learning_correction_target_missing_or_conflicted");
        // Stored ancestry is already append-validated. A direct edge avoids
        // rejecting second/later corrections because an ancestor wasn't loaded.
        validateCorrection(validateEvent(target.data()), event);
      }
      tx.create(ref, event);
      return "created";
    });
  }

  async materialize(grant: LearningGrant, request: SnapshotRequest): Promise<LearningSnapshot> {
    const now = this.now();
    authorize(grant, request, now);
    const values: unknown[] = [];
    for (const prospectId of request.prospectIds) {
      const records = await readQueryPages(this.collection("events").where("entities.prospectId", "==", prospectId));
      values.push(...records.map(doc => doc.data()));
    }
    const snapshot = buildSnapshot(values, grant, request, now);
    if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 900000) throw new Error("learning_snapshot_scope_too_large");
    const ref = this.collection("snapshots").doc(snapshot.snapshotId);
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) verifySnapshot(existing.data() as LearningSnapshot, grant, now);
      else tx.create(ref, snapshot);
    });
    return this.read(snapshot.snapshotId, grant);
  }

  async read(snapshotId: string, grant: LearningGrant): Promise<LearningSnapshot> {
    if (!/^[a-f0-9]{64}$/.test(snapshotId)) throw new Error("learning_snapshot_id_invalid");
    const saved = await this.collection("snapshots").doc(snapshotId).get();
    if (!saved.exists) throw new Error("learning_snapshot_missing");
    const snapshot = verifySnapshot(saved.data() as LearningSnapshot, grant, this.now());
    if (snapshot.snapshotId !== snapshotId) throw new Error("learning_snapshot_id_mismatch");
    return snapshot;
  }
}
