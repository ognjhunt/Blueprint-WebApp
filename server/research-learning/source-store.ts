import { readQueryPages } from "./query-pages";
import { LEARNING_ROOT } from "./contract";
import { authorizeSources, scopeSourceSnapshot, verifySourceSnapshot, validatedReconciliationSnapshot, type reconcilePriorResearch, type SourceGrant, type SourceRequest } from "./prior-research";
import { siteLearningHistory, validateSiteCorrection, validateSiteLearning } from "./site-learning";
import { digest } from "./contract";
import type { SiteLearningEvent } from "./site-learning";

/** Constructed by an authorized human-source adapter, never from agent metadata. */
export type SiteLearningWriterContext = { grant: SourceGrant; request: SourceRequest; sourceSnapshotId: string;
  attestation: SiteLearningEvent["attestation"]; briefBinding: SiteLearningEvent["brief"] };

/** Inject only the existing Admin binding. No source, lease, pointer or publisher writes. */
export class ResearchSourceStore {
  constructor(private db: FirebaseFirestore.Firestore, private now = () => new Date().toISOString()) {}
  async stage(report: ReturnType<typeof reconcilePriorResearch>, grant: SourceGrant, request: SourceRequest): Promise<"created" | "existing"> {
    const snapshot = validatedReconciliationSnapshot(report);
    const authorized = authorizeSources(grant, request, this.now());
    if (snapshot.scope.principalId !== authorized.grant.principalId || snapshot.asOf !== authorized.request.asOf || snapshot.parentSnapshotId !== null
      || digest(snapshot.scope.crmIds) !== digest([...authorized.request.crmIds].sort())
      || digest(snapshot.scope.capabilityIds) !== digest([...authorized.request.capabilityIds].sort())
      || digest(snapshot.scope.sections) !== digest([...authorized.request.sections].sort())
      || Buffer.byteLength(JSON.stringify(snapshot)) > 900000) throw new Error("learning_source_stage_invalid");
    const ref = this.db.doc(LEARNING_ROOT).collection("sourceSnapshots").doc(snapshot.snapshotId);
    return this.db.runTransaction(async tx => {
      const saved = await tx.get(ref);
      if (saved.exists) { if (verifySourceSnapshot(saved.data()).snapshotId !== snapshot.snapshotId) throw new Error("learning_source_stage_conflict"); return "existing"; }
      tx.create(ref, snapshot); return "created";
    });
  }
  async read(snapshotId: string, grant: SourceGrant, request: SourceRequest) {
    authorizeSources(grant, request, this.now());
    if (!/^[a-f0-9]{64}$/.test(snapshotId)) throw new Error("learning_source_snapshot_id_invalid");
    const saved = await this.db.doc(LEARNING_ROOT).collection("sourceSnapshots").doc(snapshotId).get();
    if (!saved.exists) throw new Error("learning_source_snapshot_missing");
    const source = verifySourceSnapshot(saved.data());
    if (source.snapshotId !== snapshotId) throw new Error("learning_source_snapshot_id_mismatch");
    return scopeSourceSnapshot(source, grant, request, this.now());
  }
  async appendSiteLearning(value: unknown, context: SiteLearningWriterContext) {
    const event = validateSiteLearning(value);
    const { grant, request } = authorizeSources(context.grant, context.request, this.now());
    if (grant.principalId !== event.capturedBy || !request.crmIds.includes(event.crmId) || !request.sections.includes("site_learning")
      || event.recordedAt > request.asOf || digest(context.attestation) !== digest(event.attestation)
      || digest(context.briefBinding) !== digest(event.brief) || !/^[a-f0-9]{64}$/.test(context.sourceSnapshotId)) throw new Error("site_learning_writer_scope_denied");
    const records = this.db.doc(LEARNING_ROOT).collection("siteLearningEvents"), ref = records.doc(event.eventId);
    return this.db.runTransaction(async tx => {
      const saved = await tx.get(ref);
      if (saved.exists) { if (validateSiteLearning(saved.data()).eventId !== event.eventId) throw new Error("site_learning_append_conflict"); return "existing"; }
      const source = await tx.get(this.db.doc(LEARNING_ROOT).collection("sourceSnapshots").doc(context.sourceSnapshotId));
      if (!source.exists) throw new Error("site_learning_subject_source_missing");
      const snapshot = verifySourceSnapshot(source.data());
      if (snapshot.snapshotId !== context.sourceSnapshotId) throw new Error("site_learning_subject_source_invalid");
      const row = scopeSourceSnapshot(snapshot, grant, { ...request, sections: ["crm"] }, this.now()).crmRows.find(row => row.crmId === event.crmId);
      if (!row || digest([row.canonical.prospectId, row.canonical.siteId, row.canonical.taskId]) !== digest([event.canonicalProspectId, event.siteId, event.taskId])) throw new Error("site_learning_subject_join_changed");
      if (event.correctsEventId) {
        const original = await tx.get(records.doc(event.correctsEventId)), siblings = await tx.get(records.where("correctsEventId", "==", event.correctsEventId).limit(1));
        if (!original.exists || !siblings.empty) throw new Error("site_learning_correction_missing_or_conflicted");
        validateSiteCorrection(validateSiteLearning(original.data()), event);
      }
      tx.create(ref, event); return "created";
    });
  }
  async readSiteLearning(grant: SourceGrant, request: SourceRequest) {
    const { request: selected } = authorizeSources(grant, request, this.now());
    if (!selected.sections.includes("site_learning")) return { history: [], current: [] };
    const records = this.db.doc(LEARNING_ROOT).collection("siteLearningEvents"), values: unknown[] = [];
    for (const crmId of selected.crmIds) {
      const rows = await readQueryPages(records.where("crmId", "==", crmId));
      values.push(...rows.map(row => {
        const event = validateSiteLearning(row.data());
        if (event.eventId !== row.id || event.crmId !== crmId) throw new Error("site_learning_document_identity_changed");
        return event;
      }));
    }
    return siteLearningHistory(values, grant, request, this.now());
  }
}
