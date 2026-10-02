import { afterEach, describe, expect, it, vi } from "vitest";
import { digest, LEARNING_ROOT } from "../research-learning/contract";
import { verifySourceSnapshot } from "../research-learning/prior-research";
import { createNativeLearningHooks, chicagoAggregationTime, startNativeLearningScheduler } from "../research-learning/native-hooks";
import { learningMemoryFirestore, learningEvent } from "./fixtures/research-learning";
import { publishedResearchFixture } from "./fixtures/published-research";
import { previewResearchCommunications } from "../agents/communications-producer";
import { communicationsBriefSchema, communicationsDigest, communicationsDeliveryKey } from "../agents/communications-contract";

const now = "2026-10-02T11:45:00.000Z";
function fixture(clock = () => now) {
  const memory = learningMemoryFirestore();
  const body = { version: "blueprint.research-learning-source-snapshot.v1", asOf: "2026-10-01T20:00:00.000Z",
    scope: { principalId: "source-reconciler", crmIds: ["BP-000001"], capabilityIds: ["cap-1"], sections: ["crm", "capabilities"] },
    source: { crm: { recordRef: "blueprintDailyResearch/sites-first/files/crm.json", sourceHash: digest("crm"), capturedAt: "2026-10-01T12:00:00Z" },
      knowledge: { recordRef: "blueprintDailyResearch/sites-first/files/knowledge.json", sourceHash: digest("knowledge"), capturedAt: "2026-09-30T12:00:00Z" }, knowledgeContentHash: digest("knowledge-content"), reconciliationHash: digest("reconciled") },
    crmRows: [{ crmId: "BP-000001", organization: "Synthetic company", prospectType: "site", siteLabel: "Synthetic site", taskHypothesis: "Unknown task", geography: "Sacramento",
      sourceCheckedDate: null, verification: null, evidenceMaturity: null, inventoryStage: null, publicEvidenceUrls: [], rowHash: digest("row"), canonical: { prospectId: null, siteId: null, taskId: null, caseId: null } }],
    companies: [{ companyId: "company-1", name: "Synthetic team", roles: [], sourcePageIds: [] }],
    capabilities: [{ capabilityId: "cap-1", companyId: "company-1", recordType: "reviewed_capability", product: { name: "Synthetic product", version: null }, taskTags: [], geographyTags: [], facts: [] }],
    sourcePages: [], researchRuns: [], unknowns: [], parentSnapshotId: null };
  const source = verifySourceSnapshot({ ...body, snapshotId: digest(body), contentHash: digest(body) });
  memory.records.set(`${LEARNING_ROOT}/sourceSnapshots/${source.snapshotId}`, source);
  memory.records.set("outboundProspects/prospect-1", { researchPublicationId: "BP-000001", siteId: "site-prospect-1", taskId: "packing", privateNotes: "PRIVATE_SENTINEL" });
  for (const kind of ["research_observed", "contact_observed", "outreach_observed"] as const) {
    const event = learningEvent(kind); memory.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event);
  }
  const config = { sourceSnapshotId: source.snapshotId, principalId: "blueprint-learning-host", businessSubjectKeys: ["blueprint:research-learning"], focus: { city: "Sacramento", industry: "Laundromats" } };
  return { ...memory, source, config, hooks: createNativeLearningHooks(memory.db, config, clock) };
}
function nativeBundle(f: ReturnType<typeof fixture>) {
  for (const key of f.records.keys()) if (key.startsWith(`${LEARNING_ROOT}/events/`)) f.records.delete(key);
  const published = publishedResearchFixture();
  const preview = previewResearchCommunications(published.snapshot, "prospect-1", published.prospect, published.input, Date.parse("2026-09-30T23:00:00Z"));
  const brief = communicationsBriefSchema.parse({ ...preview.proposal, qualityReview: { state: "approved", reviewedBy: "offline-fixture", reviewedAt: "2026-09-30T23:00:00.000Z", sourceRecordUrl: preview.sourceRecordUrl } });
  const briefDigest = communicationsDigest(brief), job = { jobId: "job-1", prospectId: brief.prospectId, briefId: brief.briefId, briefDigest, intent: "outreach", inboundMessageId: null };
  const envelope = { version: "blueprint.communications.v1", job, brief, thread: null, output: published.output, approvalState: "pending_approval" };
  const payload = { communications: envelope, to: brief.contact.email, subject: published.output.subject, body: published.output.body, transportBody: published.output.body };
  f.records.set("outboundProspects/prospect-1", { ...published.prospect, siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, researchPublicationId: preview.source.sheetsProspectId });
  const root = "blueprintCommunications/default", receiptPath = `${root}/sendReceipts/${communicationsDeliveryKey(job)}`;
  const records = { [`${root}/jobs/${job.jobId}`]: job, [`${root}/briefs/${brief.briefId}`]: brief,
    [`${root}/handoffs/${briefDigest}`]: { version: "blueprint.communications-handoff.v1", ...brief.qualityReview, briefDigest, sheetsReceipt: preview.source.sheetsReceipt, notionReceipt: preview.source.notionReceipt },
    [`${root}/researchSources/${briefDigest}`]: { briefDigest, source: preview.source }, [receiptPath]: { jobId: job.jobId, state: "sent",
      payloadDigest: communicationsDigest(payload), approvalLedgerId: "communications_job-1", attemptedAt: "2026-09-30T23:10:00.000Z", sentAt: "2026-09-30T23:11:00.000Z", receipt: { messageId: "out-1", threadId: "thread-1" } },
    "action_ledger/communications_job-1": { action_payload: payload } };
  for (const [path, value] of Object.entries(records)) f.records.set(path, value);
  for (const path of f.records.keys()) f.updateTimes.set(path, "2026-10-01T00:00:00.000Z");
  return { receiptPath, jobPath: `${root}/jobs/${job.jobId}`, ledgerPath: "action_ledger/communications_job-1" };
}
afterEach(() => { vi.useRealTimers(); });
describe("native zero-model learning hooks", () => {
  it("includes verified native research/contact/accepted outreach under an advancing clock without stored learning events", async () => {
    let tick = 0; const f = fixture(() => new Date(Date.parse(now)+tick++).toISOString()); nativeBundle(f);
    const result = await f.hooks.daily();
    if (result.state !== "completed") throw new Error("expected native evidence overview");
    expect(tick).toBeGreaterThan(5);
    expect(result.overview.outcomeAnalysis.scopeCounts).toMatchObject({ researchedProspects: 1, acceptedTouches: 1, verifiedDeliveredTouches: 0 });
    expect(result.overview.sourceQuarantine).toEqual([]); expect(result.paidModelCalls).toBe(0);
    expect([...f.records.keys()].some(path => path.startsWith(`${LEARNING_ROOT}/events/`))).toBe(false);
  });
  it.each(["receipt", "ledger"])("keeps earlier research while marking a later %s unavailable, even with a backdated body timestamp", async kind => {
    let tick = 0; const f = fixture(() => new Date(Date.parse(now)+tick++).toISOString()), bundle = nativeBundle(f);
    const path = kind === "receipt" ? bundle.receiptPath : bundle.ledgerPath;
    f.updateTimes.set(path, "2026-10-02T11:46:00.000Z");
    const result = await f.hooks.daily(); if (result.state !== "completed") throw new Error("expected overview");
    expect(result.overview.outcomeAnalysis.scopeCounts).toMatchObject({ researchedProspects: 1, acceptedTouches: 0 });
    expect(result.overview.sourceQuarantine).toContainEqual({ recordRef: path, reason: "source_version_after_frozen_cutoff" });
    expect(result.overview.unknowns).toContain("native_source_coverage_incomplete");
  });
  it.each(["later", "unknown"])("does not infer pre-cutoff evidence from %s mutable source versions", async state => {
    let tick = 0; const f = fixture(() => new Date(Date.parse(now)+tick++).toISOString()), bundle = nativeBundle(f);
    f.updateTimes.set(bundle.jobPath, state === "later" ? "2026-10-02T11:46:00.000Z" : null);
    const result = await f.hooks.daily(); if (result.state !== "completed") throw new Error("expected overview");
    expect(result.overview.outcomeAnalysis.scopeCounts).toMatchObject({ researchedProspects: 0, acceptedTouches: 0 });
    expect(result.overview.sourceQuarantine).toContainEqual({ recordRef: bundle.jobPath, reason: state === "later" ? "source_version_after_frozen_cutoff" : "source_version_time_unknown" });
    expect(result.overview.unknowns).toContain("native_source_coverage_incomplete");
  });
  it.each(["daily_research", "communications"] as const)("applies the native version cutoff to the %s pre-prompt context", async role => {
    let tick = 0; const f = fixture(() => new Date(Date.parse(now)+tick++).toISOString()), bundle = nativeBundle(f);
    const valid = await f.hooks.beforeWork(role, ["prospect-1"]);
    if (!valid.available) throw new Error("expected context");
    expect(valid.history("prospect-1", { pageSize: 25, cursor: null }).events).toHaveLength(3);
    f.updateTimes.set(bundle.receiptPath, "2026-10-02T11:46:00.000Z");
    const later = await f.hooks.beforeWork(role, ["prospect-1"]); if (!later.available) throw new Error("expected partial context");
    expect(new Set(later.history("prospect-1", { pageSize: 25, cursor: null }).events.map(event => event.kind))).toEqual(new Set(["research_observed", "contact_observed"]));
    expect(later.handoff.unknowns).toContain("current_history_incomplete");
    expect(later.handoff.provenance.quarantine).toContainEqual({ recordRef: bundle.receiptPath, reason: "source_version_after_frozen_cutoff" });
  });
  it("binds a self-hashed manifest to its Chicago day, preserving a select projection after where", async () => {
    const f = fixture(); await f.hooks.daily();
    const ref = `${LEARNING_ROOT}/nativeLearningJobs/${f.hooks.jobKey("2026-10-02")}`;
    const { inputHash: _hash, ...body } = f.records.get(ref), changed = { ...body, day: "2026-10-01", asOf: "2026-10-01T12:00:00.000Z" };
    f.records.set(ref, { ...changed, inputHash: digest(changed) });
    await expect(f.hooks.daily()).rejects.toThrow("manifest_changed");
    const selected = await f.db.collection("outboundProspects").select("researchPublicationId").where("researchPublicationId", "==", "BP-000001").get();
    expect(selected.docs[0].data()).toEqual({ researchPublicationId: "BP-000001" });
  });
  it("aggregates at 06:45 Chicago and supplies the same sourced overview to both existing native roles", async () => {
    const f = fixture(), daily = await f.hooks.daily();
    expect(daily.state).toBe("completed"); expect(daily.paidModelCalls).toBe(0);
    if (daily.state !== "completed") throw new Error("expected daily overview");
    const beforeWrites = [...f.writes];
    for (const role of ["daily_research", "communications"] as const) {
      const session = await f.hooks.beforeWork(role, ["prospect-1"]);
      expect(session.available).toBe(true);
      if (!session.available) throw new Error("expected native context");
      expect(session.handoff.role).toBe(role); expect(session.handoff.businessOverview?.overview.overviewId).toBe(daily.overview.overviewId);
      expect(session.handoff.businessOverview?.overview.outcomeAnalysis.scopeCounts.matureReplyRate).toEqual({ numerator: 0, denominator: 1 });
      expect(session.history("prospect-1", { pageSize: 25, cursor: null }).events).toHaveLength(3);
      expect(JSON.stringify(session.handoff)).not.toContain("PRIVATE_SENTINEL");
    }
    expect(f.writes).toEqual(beforeWrites); expect(f.reads.some(path => /oauth|gmail|mailbox/.test(path))).toBe(false);
  });
  it("retains the first manifest/cutoff/prospect scope on later retry and makes no duplicate writes", async () => {
    let current = now; const f = fixture(() => current), first = await f.hooks.daily(), writes = [...f.writes];
    current = "2026-10-02T13:00:00.000Z";
    f.records.set("outboundProspects/later-prospect", { researchPublicationId: "BP-NEW" });
    const replay = await f.hooks.daily();
    expect(replay.state).toBe("completed");
    if (first.state !== "completed" || replay.state !== "completed") throw new Error("expected overview replay");
    expect(replay.replay).toBe(true); expect(replay.overview.overviewId).toBe(first.overview.overviewId);
    expect(replay.overview.scope.prospectIds).toEqual(["prospect-1"]); expect(f.writes).toEqual(writes);
  });
  it("does not fabricate prospect identities or outcome denominators for an empty authorized inventory", async () => {
    const f = fixture(); f.records.delete("outboundProspects/prospect-1");
    expect(await f.hooks.daily()).toMatchObject({ state: "no_authorized_native_prospects", businessRecords: 0, unknowns: ["native_outcome_denominators_unavailable"] });
    expect(f.writes.every(path => path.includes("nativeLearningJobs/"))).toBe(true);
  });
  it("uses the scheduled Chicago civil date across both DST transitions and skips early work without reads", async () => {
    expect(chicagoAggregationTime("2026-03-08T11:44:00.000Z")).toMatchObject({ scheduledAt: "2026-03-08T11:45:00.000Z", due: false });
    expect(chicagoAggregationTime("2026-11-01T12:45:00.000Z")).toMatchObject({ scheduledAt: "2026-11-01T12:45:00.000Z", due: true });
    const f = fixture(() => "2026-10-02T11:44:00.000Z"); expect((await f.hooks.daily()).state).toBe("not_due"); expect(f.reads).toEqual([]); expect(f.writes).toEqual([]);
  });
  it("rejects corrupted manifests and excessive inventories without model calls or source writes", async () => {
    const f = fixture(); await f.hooks.daily();
    const ref = `${LEARNING_ROOT}/nativeLearningJobs/${f.hooks.jobKey("2026-10-02")}`;
    f.records.set(ref, { ...f.records.get(ref), prospectIds: ["unrelated"] });
    await expect(f.hooks.daily()).rejects.toThrow("manifest_changed");
    const wide = fixture(); for (let i = 0; i < 100; i++) wide.records.set(`outboundProspects/prospect-${i+2}`, {});
    await expect(wide.hooks.daily()).rejects.toThrow("partition_required"); expect(wide.writes).toEqual([]);
  });
  it("fails optional native context as unknown on denied IDs or unavailable source", async () => {
    const f = fixture(); expect(await f.hooks.beforeWork("communications", ["unrelated"])).toMatchObject({ available: false, paidModelCalls: 0 });
    f.records.delete(`${LEARNING_ROOT}/sourceSnapshots/${f.source.snapshotId}`);
    expect(await f.hooks.beforeWork("daily_research")).toMatchObject({ available: false, unknown: "native_learning_context_unavailable" });
    expect(f.writes).toEqual([]);
  });
  it("appends exact native observations by source identity and retains changed attempts without leaking bodies", async () => {
    const f = fixture(), ref = "blueprintCommunications/default/jobs/job-1";
    f.records.set(ref, { jobId: "job-1", prospectId: "prospect-1", state: "sent", updatedAt: Date.parse(now), privateBody: "PRIVATE_SENTINEL" });
    const first = await f.hooks.afterNativeWork(ref); expect(first.append).toBe("created");
    expect((await f.hooks.afterNativeWork(ref)).append).toBe("existing");
    f.records.set(ref, { ...f.records.get(ref), state: "failed" });
    const next = await f.hooks.afterNativeWork(ref); expect(next.append).toBe("created"); expect(next.event.recordId).not.toBe(first.event.recordId);
    expect(JSON.stringify([first, next])).not.toContain("PRIVATE_SENTINEL"); expect(f.writes.filter(path => path.includes("businessHistoryEvents/"))).toHaveLength(2);
    const reads = [...f.reads]; await expect(f.hooks.afterNativeWork("mailbox/unrelated")).rejects.toThrow(); expect(f.reads).toEqual(reads);
  });
  it.each(["pending_approval", "awaiting_research", "blocked", "auto_approved"])("records %s as an exact native work state without send/delivery/interest assertions", async state => {
    const f = fixture(), ref = "blueprintCommunications/default/jobs/job-1";
    f.records.set(ref, { jobId: "job-1", prospectId: "prospect-1", state, updatedAt: Date.parse(now) });
    expect((await f.hooks.afterNativeWork(ref)).event).toMatchObject({ state, contextHash: null, sourceSnapshotId: null,
      counts: { acceptedTouches: null, verifiedDeliveredTouches: null, repliedProspects: null }, paidAnalysisCalls: 0 });
  });
  it("drains a single active scheduler tick and shares the same stop promise", async () => {
    vi.useFakeTimers(); let finish: (value: unknown) => void = () => {};
    const run = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const handle = startNativeLearningScheduler({ enabled: true, run }); expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(180000); expect(run).toHaveBeenCalledTimes(1);
    const stopped = handle.stop(); expect(handle.stop()).toBe(stopped); finish({ state: "completed" }); await stopped;
    await vi.advanceTimersByTimeAsync(60000); expect(run).toHaveBeenCalledTimes(1);
  });
  it("avoids repeated completed-day reads and resumes on the next Chicago day", async () => {
    vi.useFakeTimers(); let at = now;
    const run = vi.fn(async () => ({ state: "completed", day: chicagoAggregationTime(at).day }));
    const handle = startNativeLearningScheduler({ enabled: true, run, clock: () => at });
    await vi.advanceTimersByTimeAsync(3600000); expect(run).toHaveBeenCalledTimes(1);
    at = "2026-10-03T11:45:00.000Z"; await vi.advanceTimersByTimeAsync(60000); expect(run).toHaveBeenCalledTimes(2);
    await handle.stop();
  });
});
