import { describe, expect, it } from "vitest";
import { digest } from "../research-learning/contract";
import { recordTerminalRun, runDailyBusinessAnalysis, chicagoDate, overviewFreshness, readBusinessOverview } from "../research-learning/business-learning-loop";
import { buildSnapshot } from "../research-learning/snapshot";
import { BusinessHistoryStore, makeBusinessHistory } from "../research-learning/business-history";
import { learningMemoryFirestore, learningEvent } from "./fixtures/research-learning";

const now = "2026-10-02T11:45:00.000Z", subjectKey = "blueprint:research-learning";
const businessScope = { principalId: "learning-host", subjectKeys: [subjectKey], expiresAt: "2026-10-02T13:00:00.000Z" };
const learningGrant = { principalId: businessScope.principalId, prospectIds: ["prospect-1"], sections: ["research", "contact", "outreach", "replies", "outcomes"] as const, expiresAt: businessScope.expiresAt };
const request = { prospectIds: ["prospect-1"], sections: [...learningGrant.sections], asOf: now, maturityDays: 14 };
function setup(clock = () => now) {
  const memory = learningMemoryFirestore();
  const hypothesis = makeBusinessHistory({ kind: "hypothesis", recordId: "BP-HYP-readiness", subjectKey, contentClass: "blueprint_business_only",
    capturedBy: businessScope.principalId, occurredAt: "2026-10-01T23:00:00.000Z", recordedAt: now, supersedesEventId: null,
    sources: [{ system: "chat", threadId: "synthetic-company-chat", messageId: "synthetic-message", originalTimestamp: "2026-10-01T23:00:00.000Z", originalAuthorId: "company-owner", originalAuthorRole: "user", sourceHash: digest("synthetic message"), businessExcerpt: "Treat readiness interest as a provisional hypothesis." }],
    statement: "Some sites may seek readiness information before purchase.", status: "provisional", uncertainty: "No verified market sample.", evidence: [],
    confounders: ["contactability", "response_bias", "delayed_replies"], whatWouldChangeBelief: ["Comparable sites identify another motive."], nextQuestion: "What would change your assessment?", nextTest: "Compare explicit motives and preserve unexpected opportunities.", causalProof: false, hardFilterProspects: false, unexpectedExplorationRequired: true });
  for (const kind of ["research_observed", "contact_observed", "outreach_observed"] as const) {
    const event = learningEvent(kind); memory.records.set(`blueprintResearchLearning/default/events/${event.eventId}`, event);
  }
  memory.records.set("outboundProspects/prospect-1", { siteId: "site-prospect-1", taskId: "packing" });
  const execute = () => runDailyBusinessAnalysis(memory.db, { jobKey: "daily-2026-10-02", businessScope, learningGrant: { ...learningGrant, sections: [...learningGrant.sections] }, request, focus: { city: "Sacramento", industry: "Laundromats" } }, clock);
  return { ...memory, hypothesis, execute };
}
describe("zero-model per-run and daily learning handlers", () => {
  it("persists sourced factual terminal summaries idempotently without changing native source records", async () => {
    const memory = learningMemoryFirestore(), source = { jobId: "job-1", prospectId: "actual-prospect", state: "sent", updatedAt: Date.parse(now), privateBody: "PRIVATE_SENTINEL" }, ref = "blueprintCommunications/default/jobs/job-1";
    memory.records.set(ref, source);
    const input = { recordId: "BP-RUN-job-1", subjectKey, principalId: businessScope.principalId, runId: "job-1", receipt: { recordRef: ref, sourceHash: digest(source), checkedAt: now } };
    const first = await recordTerminalRun(memory.db, input, () => now); expect(first.append).toBe("created");
    expect((await recordTerminalRun(memory.db, { ...input, receipt: { ...input.receipt, checkedAt: "2026-10-02T11:46:00.000Z" } }, () => "2026-10-02T11:46:00.000Z")).append).toBe("existing");
    expect(JSON.stringify(first.event)).not.toContain("PRIVATE_SENTINEL"); expect(memory.records.get(ref)).toEqual(source);
    expect(first.event).toMatchObject({ kind: "run_summary", state: "sent", prospectIds: ["actual-prospect"], nativeTimestamp: now, timeBasis: "native_update", contextHash: null, sourceSnapshotId: null, counts: { verifiedDeliveredTouches: null, acceptedTouches: null } });
    await expect(recordTerminalRun(memory.db, { ...input, prospectIds: ["unrelated-prospect"], counts: { verifiedDeliveredTouches: 999 }, contextHash: digest("fabricated"), finishedAt: now }, () => now)).rejects.toThrow();
    await expect(recordTerminalRun(memory.db, { ...input, runId: "wrong" }, () => now)).rejects.toThrow("identity_changed");
    await expect(recordTerminalRun(memory.db, { ...input, principalId: "another" }, () => now)).rejects.toThrow("retry_identity_changed");
    await expect(recordTerminalRun(memory.db, { ...input, receipt: { ...input.receipt, sourceHash: digest("wrong") } }, () => now)).rejects.toThrow("retry_identity_changed");
  });
  it("retains explicit missing-time/research-join uncertainty and rejects nonterminal or future native records", async () => {
    const memory = learningMemoryFirestore(), ref = "blueprintDailyResearch/sites-first/runs/run-1";
    const source = { state: "awaiting_review", date: "2026-10-02", privateBody: "PRIVATE_SENTINEL" }; memory.records.set(ref, source);
    const input = { recordId: "BP-RUN-run-1", subjectKey, principalId: businessScope.principalId, runId: "run-1", receipt: { recordRef: ref, sourceHash: digest(source), checkedAt: now } };
    expect((await recordTerminalRun(memory.db, input, () => now)).event).toMatchObject({ state: "awaiting_review", nativeTimestamp: null, timeBasis: "terminal_observation", prospectIds: [], contextHash: null });
    for (const data of [{ state: "running" }, { state: "completed", remote_completed_at: Date.parse("2026-10-03T11:45:00.000Z") / 1000 }]) {
      const other = learningMemoryFirestore(); other.records.set(ref, data);
      await expect(recordTerminalRun(other.db, { ...input, receipt: { ...input.receipt, sourceHash: digest(data) } }, () => now)).rejects.toThrow(); expect(other.writes).toEqual([]);
    }
  });

  it("aggregates observed denominators and hypotheses into an immutable daily overview with exact replay", async () => {
    const f = setup(); await new BusinessHistoryStore(f.db, () => now).append(f.hypothesis, { principalId: businessScope.principalId, subjectKeys: [subjectKey], approvedEventId: f.hypothesis.eventId, verifiedSources: f.hypothesis.sources });
    const first = await f.execute(), second = await f.execute();
    expect(first.replay).toBe(false); expect(second.replay).toBe(true); expect(second.overview.overviewId).toBe(first.overview.overviewId);
    expect(first.overview.outcomeAnalysis.scopeCounts.matureReplyRate).toEqual({ numerator: 0, denominator: 1 });
    expect(first.overview.outcomeAnalysis.causalProof).toBe(false); expect(first.overview.hypotheses[0]).toMatchObject({ status: "provisional", hardFilterProspects: false });
    expect(first.overview.nextInvestigations[0].hypothesisRecordId).toBe("BP-HYP-readiness"); expect(first.overview.paidAnalysisCalls).toBe(0); expect(first.overview.sendsAuthorized).toBe(false);
    expect(f.writes.filter(path => path.includes("businessOverviews/"))).toHaveLength(1); expect(f.writes.filter(path => path.includes("businessOverviewRuns/"))).toHaveLength(1);
    expect(f.records.has(`blueprintResearchLearning/default/snapshots/${first.overview.source.outcomeSnapshotId}`)).toBe(true);
    expect(first.reviewExports.sheets.rows).toHaveLength(1); expect(first.reviewExports.notion.hypotheses[0]).toMatchObject({ status: "provisional", hardFilterProspects: false });
    expect(JSON.stringify(first.reviewExports.notion)).not.toContain("synthetic message"); expect(second.reviewExports).toEqual(first.reviewExports);
    expect(overviewFreshness(first.overview, now).stale).toBe(false); expect(overviewFreshness(first.overview, "2026-10-03T14:00:00.000Z").stale).toBe(true);
    expect(overviewFreshness(first.overview, now, digest("changed source")).stale).toBe(true);
  });
  it("rejects changed retry scope and keeps valid evidence through stored-history repair", async () => {
    const f = setup(); await f.execute();
    await expect(runDailyBusinessAnalysis(f.db, { jobKey: "daily-2026-10-02", businessScope, learningGrant: { ...learningGrant, sections: [...learningGrant.sections] }, request: { ...request, maturityDays: 90 }, focus: { city: "Sacramento", industry: "Laundromats" } }, () => now)).rejects.toThrow("job_scope_changed");
    const other = setup(); other.records.set("blueprintResearchLearning/default/events/invalid", { entities: { prospectId: "prospect-1" }, body: "PRIVATE_SENTINEL" });
    const repaired = await other.execute();
    expect(repaired.overview.sourceQuarantine).toContainEqual({ recordRef: "blueprintResearchLearning/default/events/invalid", reason: "stored_event_invalid_reconcile_original_hash_and_identity" });
    expect(repaired.overview.outcomeAnalysis.cohorts[0].counts.matureReplyRate).toEqual({ numerator: 0, denominator: 1 });
    expect(JSON.stringify(repaired)).not.toContain("PRIVATE_SENTINEL");
    expect((await other.execute()).overview.overviewId).toBe(repaired.overview.overviewId);
  });
  it("rejects expiry during replay and before transactional creates", async () => {
    for (const phase of ["replay", "transaction"]) {
      let current = now; const f = setup(() => current);
      if (phase === "replay") {
        await f.execute(); const originalDoc = f.db.doc;
        f.db.doc = (path: string) => {
          const root = originalDoc(path), originalCollection = root.collection;
          root.collection = (name: string) => { const collection = originalCollection(name), original = collection.doc;
            collection.doc = (key: string) => { const ref = original(key), get = ref.get;
              ref.get = async () => { const result = await get(); if (name === "businessOverviewRuns") current = businessScope.expiresAt; return result; }; return ref; }; return collection; }; return root; };
      } else {
        const transaction = f.db.runTransaction;
        f.db.runTransaction = (callback: any) => transaction(async (tx: any) => { const original = tx.get;
          tx.get = async (ref: any) => { const result = await original(ref); current = businessScope.expiresAt; return result; }; return callback(tx); });
      }
      await expect(f.execute()).rejects.toThrow(/expired|scope_denied/);
      if (phase === "transaction") expect(f.writes).toEqual([]);
    }
  });
  it("requires authorized outcome sections before database access and never expands restricted grants", async () => {
    const f = setup(); await expect(runDailyBusinessAnalysis(f.db, { jobKey: "research-only", businessScope,
      learningGrant: { ...learningGrant, sections: ["research"] }, request: { ...request, sections: ["research"] },
      focus: { city: "Sacramento", industry: "Laundromats" } }, () => now)).rejects.toThrow("sections_required");
    expect(f.reads).toEqual([]); expect(f.writes).toEqual([]);
  });
  it("requires export or narrower scope before creating an oversized normalized snapshot", async () => {
    const f = setup();
    for (let i = 0; i < 60; i++) {
      const factIds = Array.from({ length: 100 }, (_, j) => `fact-${i}-${j}-${"f".repeat(100)}`);
      const event = learningEvent("research_observed", "prospect-1", { data: { city: "Sacramento", industry: "Laundromats", factIds,
        factChecks: factIds.map(factId => ({ factId, sourceHash: digest(factId), sourceCheckedAt: "2026-09-01T10:00:00.000Z", grade: "primary" })) } });
      f.records.set(`blueprintResearchLearning/default/events/${event.eventId}`, event);
    }
    await expect(f.execute()).rejects.toThrow("snapshot_export_or_narrow_scope_required"); expect(f.writes).toEqual([]);
  });
  it("rejects replay when the linked outcome snapshot is missing or corrupted", async () => {
    for (const invalid of ["missing", "changed"]) {
      const f = setup(), first = await f.execute(), ref = `blueprintResearchLearning/default/snapshots/${first.overview.source.outcomeSnapshotId}`;
      if (invalid === "missing") f.records.delete(ref); else f.records.set(ref, { ...f.records.get(ref), asOf: "2026-10-01T11:45:00.000Z" });
      await expect(f.execute()).rejects.toThrow();
      await expect(readBusinessOverview(f.db, "daily-2026-10-02", businessScope, request.prospectIds, now, undefined, () => now)).rejects.toThrow();
    }
  });
  it("rejects a valid linked snapshot with a different maturity window and contradictory analysis", async () => {
    const f = setup(), first = await f.execute(), original = f.records.get(`blueprintResearchLearning/default/snapshots/${first.overview.source.outcomeSnapshotId}`);
    const swapped = buildSnapshot(original.rows.flatMap((row: any) => row.history), { ...learningGrant, sections: [...learningGrant.sections] }, { ...request, maturityDays: 90 }, now);
    f.records.set(`blueprintResearchLearning/default/snapshots/${swapped.snapshotId}`, swapped);
    const { overviewId: _id, ...body } = first.overview, changed = { ...body, source: { ...body.source, outcomeSnapshotId: swapped.snapshotId } }, wrong = { ...changed, overviewId: digest(changed) };
    f.records.set(`blueprintResearchLearning/default/businessOverviews/${wrong.overviewId}`, wrong);
    const receiptRef = "blueprintResearchLearning/default/businessOverviewRuns/daily-2026-10-02";
    f.records.set(receiptRef, { ...f.records.get(receiptRef), overviewId: wrong.overviewId });
    await expect(f.execute()).rejects.toThrow("outcome_snapshot_changed");
    await expect(readBusinessOverview(f.db, "daily-2026-10-02", businessScope, request.prospectIds, now, undefined, () => now)).rejects.toThrow("outcome_snapshot_changed");
  });
  it("rejects a replay receipt pointing at valid but out-of-scope analysis", async () => {
    const f = setup(), first = await f.execute(), { overviewId: _id, ...body } = first.overview;
    const changed = { ...body, scope: { ...body.scope, prospectIds: ["unrelated-prospect"] } }, wrong = { ...changed, overviewId: digest(changed) };
    f.records.set(`blueprintResearchLearning/default/businessOverviews/${wrong.overviewId}`, wrong);
    const receiptRef = "blueprintResearchLearning/default/businessOverviewRuns/daily-2026-10-02";
    f.records.set(receiptRef, { ...f.records.get(receiptRef), overviewId: wrong.overviewId });
    await expect(f.execute()).rejects.toThrow("result_scope_changed");
  });
  it("binds stored overview reads to the principal and rechecks expiry after reads", async () => {
    const f = setup(); await f.execute();
    await expect(readBusinessOverview(f.db, "daily-2026-10-02", { ...businessScope, principalId: "unrelated-agent" }, request.prospectIds, now, undefined, () => now)).rejects.toThrow("scope_denied");
    await expect(readBusinessOverview(f.db, "daily-2026-10-02", businessScope, request.prospectIds, now, undefined, () => businessScope.expiresAt)).rejects.toThrow("scope_expired");
  });
  it("uses Chicago calendar dates across DST without assuming fixed UTC offsets", () => {
    expect(chicagoDate("2026-10-02T04:30:00.000Z")).toBe("2026-10-01"); expect(chicagoDate("2026-12-02T05:30:00.000Z")).toBe("2026-12-01");
  });
});
