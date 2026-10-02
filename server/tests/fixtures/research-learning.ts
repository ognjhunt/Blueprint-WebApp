import { makeEvent, digest, type EventInput, type LearningEvent, type LearningGrant, type SnapshotRequest } from "../../research-learning/contract";

export const learningNow = "2026-10-01T17:00:00.000Z";
export const learningSections = ["research", "contact", "outreach", "replies", "outcomes"] as const;
export function learningEvent(kind: LearningEvent["kind"], prospectId = "prospect-1", changes: Record<string, any> = {}): LearningEvent {
  const at = "2026-09-01T10:00:00.000Z";
  const entities = { prospectId, crmId: `BP-${prospectId}`, companyId: null, siteId: `site-${prospectId}`, taskId: "packing",
    caseId: `case-${prospectId}`, teamIds: ["team-1"], capabilityIds: ["cap-1"] };
  const refs = { jobId: `job-${prospectId}`, threadId: `thread-${prospectId}`, messageId: `message-${prospectId}`, outreachVersion: "blueprint.outreach.v1" };
  const datas: Record<LearningEvent["kind"], any> = {
    research_observed: { city: "Sacramento", industry: "Laundromats", factIds: ["fact-1"],
      factChecks: [{ factId: "fact-1", sourceHash: digest("public fact"), sourceCheckedAt: at, grade: "primary" }] },
    contact_observed: { availability: "verified_business_route" },
    outreach_observed: { ...refs, status: "accepted", intent: "outreach", payloadDigest: digest("approved payload"),
      messageDigest: digest("message-copy-1"), messageVariant: "copy-1", approvalLedgerId: `communications_${refs.jobId}`, campaignId: "campaign-1", timingWindow: "September-AM" },
    delivery_observed: { ...refs, status: "verified_delivered" },
    reply_observed: { ...refs, messageId: `reply-${prospectId}`, classification: { label: "curiosity", interest: "informational_curiosity", objections: [], confidence: 0.9, method: "human", uncertain: false } },
    outcome_observed: { outcome: "call_held", ownerConfirmed: true, outcomeRecordId: `outcome-${prospectId}` },
  };
  const bases = { research_observed: "public_research", contact_observed: "contact_proof", outreach_observed: "provider_acceptance",
    delivery_observed: "delivery_notification", reply_observed: "correlated_reply", outcome_observed: "human_attestation" };
  return makeEvent({ occurredAt: at, recordedAt: learningNow, entities,
    writer: ["research_observed", "contact_observed"].includes(kind) ? "research_adapter" : kind === "outcome_observed" ? "outcome_adapter" : "communications_adapter",
    actorId: "fixture-adapter", correctsEventId: null, kind,
    evidence: [{ sourceSystem: "firestore", recordRef: `synthetic/${prospectId}/${kind}`, sourceHash: digest(`${prospectId}:${kind}`), checkedAt: at, basis: bases[kind] },
      ...(kind === "reply_observed" ? [{ sourceSystem: "human", recordRef: `synthetic/${prospectId}/classification`, sourceHash: digest("human classification"), checkedAt: at, basis: "human_attestation" }] : [])],
    data: datas[kind], ...changes } as EventInput);
}
export function learningScope(prospectIds = ["prospect-1"]): { grant: LearningGrant; request: SnapshotRequest } {
  return { grant: { principalId: "research-agent", prospectIds, sections: [...learningSections], expiresAt: "2026-11-01T00:00:00.000Z" },
    request: { prospectIds, sections: [...learningSections], asOf: learningNow, maturityDays: 14 } };
}
export function learningCorrection(original: LearningEvent, changes: Record<string, any> = {}): LearningEvent {
  const { eventId: _id, version: _version, ...input } = original;
  return makeEvent({ ...input, writer: "human_correction", actorId: "operator-1", correctsEventId: original.eventId,
    evidence: [...original.evidence, { sourceSystem: "human", recordRef: "reviews/correction-1", sourceHash: digest(changes),
      checkedAt: learningNow, basis: "human_attestation" }], ...changes } as EventInput);
}

export function learningScenario() {
  const ids = ["curious", "nonresponse", "pending", "bounced", "unknown-ack", "comparison", "rejection", "uncontacted"];
  const events: LearningEvent[] = [];
  for (const prospectId of ids) {
    const research = learningEvent("research_observed", prospectId);
    if (research.kind === "research_observed") {
      if (["bounced", "comparison"].includes(prospectId)) research.data.city = prospectId === "bounced" ? "Stockton" : "Oakland";
      if (["unknown-ack", "rejection"].includes(prospectId)) research.data.industry = "Retail";
    }
    const { eventId: _id, version: _version, ...input } = research;
    events.push(makeEvent(input as EventInput), learningEvent("contact_observed", prospectId));
    if (prospectId === "uncontacted") continue;
    let touch = learningEvent("outreach_observed", prospectId);
    if (prospectId === "pending") touch = learningEvent("outreach_observed", prospectId, { occurredAt: "2026-09-29T10:00:00.000Z" });
    if (prospectId === "unknown-ack" && touch.kind === "outreach_observed") touch = learningEvent("outreach_observed", prospectId, {
      data: { ...touch.data, status: "unknown", messageId: null, threadId: null }, evidence: [{ ...touch.evidence[0], basis: "send_attempt" }] });
    events.push(touch);
    if (prospectId === "curious") events.push(learningEvent("reply_observed", prospectId, { occurredAt: "2026-09-02T10:00:00.000Z" }));
    if (prospectId === "bounced") events.push(learningEvent("delivery_observed", prospectId, { occurredAt: "2026-09-02T10:00:00.000Z",
      data: { ...learningEvent("delivery_observed", prospectId).data, status: "bounced" } }));
    if (prospectId === "rejection") {
      const reply = learningEvent("reply_observed", prospectId);
      if (reply.kind === "reply_observed") events.push(learningEvent("reply_observed", prospectId, { occurredAt: "2026-09-02T10:00:00.000Z",
        data: { ...reply.data, classification: { ...reply.data.classification, label: "rejection", interest: "unknown" } } }));
    }
  }
  return { events, ...learningScope(ids) };
}

/** Narrow Firestore test double with atomic create-only commits and nested
 * field queries. Throws on any source update/set/delete. */
export function learningMemoryFirestore() {
  const records = new Map<string, any>(), writes: string[] = [], reads: string[] = [], updateTimes = new Map<string, string | null>();
  const getPath = (path: string, obj: any) => path.split(".").reduce((v, part) => v?.[part], obj);
  const snap = (path: string): any => {
    const at = updateTimes.get(path), millis = at ? Date.parse(at) : NaN, seconds = Math.floor(millis/1000);
    return { exists: records.has(path), id: path.split("/").at(-1), data: () => structuredClone(records.get(path)),
      updateTime: Number.isFinite(millis) ? { seconds, nanoseconds: (millis-seconds*1000)*1000000 } : undefined };
  };
  const doc = (path: string): any => ({ path, get: async () => { reads.push(path); return snap(path); }, collection: (name: string) => collection(`${path}/${name}`) });
  const collection = (path: string): any => {
    const query = (filters: [string, any][] = [], limit = 10000, fields?: string[]): any => ({
      doc: (name: string) => doc(`${path}/${name}`), where: (key: string, _op: string, value: any) => query([...filters, [key, value]], limit, fields),
      select: (...selected: string[]) => query(filters, limit, selected),
      limit: (n: number) => query(filters, n, fields), get: async () => {
        reads.push(path);
        const docs = [...records].filter(([key, value]) => key.startsWith(`${path}/`) && key.slice(path.length + 1).split("/").length === 1
          && filters.every(([field, expected]) => getPath(field, value) === expected)).slice(0, limit).map(([key]) => {
            const original = snap(key);
            return fields ? { ...original, data: () => Object.fromEntries(fields.map(field => [field, getPath(field, original.data())])) } : original;
          });
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    });
    return query();
  };
  const db: any = { doc, collection, runTransaction: async (callback: any) => {
    const pending: [string, any][] = [];
    const result = await callback({ get: async (ref: any) => ref.path ? ref.get() : ref.get(), create: (ref: any, value: any) => {
      if (!ref.path.startsWith("blueprintResearchLearning/default/")) throw new Error("source_write_forbidden");
      pending.push([ref.path, structuredClone(value)]);
    } });
    for (const [path] of pending) if (records.has(path)) throw new Error("already_exists");
    for (const [path, value] of pending) { records.set(path, value); writes.push(path); }
    return result;
  } };
  return { db, records, writes, reads, updateTimes };
}
