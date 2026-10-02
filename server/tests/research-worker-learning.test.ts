import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { digest, LEARNING_ROOT } from "../research-learning/contract";
import { verifySourceSnapshot } from "../research-learning/prior-research";
import { makeBusinessHistory } from "../research-learning/business-history";
import { researchLearningHost, researchLearningInstant, type ResearchLearningControl } from "../research-learning/research-worker-host";
import { learningMemoryFirestore, learningEvent, learningSections } from "./fixtures/research-learning";

const now = "2026-10-02T12:00:00.000Z", day = "2026-10-02", principalId = "research-host", subjectKey = "blueprint:research";
function fixture() {
  const f = learningMemoryFirestore(), expiresAt = "2026-10-03T00:00:00.000Z";
  const content = { version: "blueprint.research-learning-source-snapshot.v1", asOf: "2026-10-01T20:00:00.000Z",
    scope: { principalId, crmIds: ["BP-000001"], capabilityIds: [], sections: ["crm", "capabilities", "site_learning"] },
    source: { crm: { recordRef: "blueprintDailyResearch/sites-first/files/crm.json", sourceHash: digest("crm"), capturedAt: "2026-10-01T12:00:00Z" },
      knowledge: { recordRef: "blueprintDailyResearch/sites-first/files/knowledge.json", sourceHash: digest("knowledge"), capturedAt: "2026-09-30T12:00:00Z" },
      knowledgeContentHash: digest("knowledge-content"), reconciliationHash: digest("verified-synthetic-rows") },
    crmRows: [{ crmId: "BP-000001", organization: "Synthetic facility", prospectType: "site", siteLabel: "Warehouse",
      taskHypothesis: "Packing", geography: "Sacramento", sourceCheckedDate: "9/29/2026", verification: "Needs recheck", evidenceMaturity: "Unverified",
      inventoryStage: "Research", publicEvidenceUrls: ["https://example.org/task"], rowHash: digest("row"), canonical: { prospectId: null, siteId: null, taskId: null, caseId: null } }],
    companies: [], capabilities: [], sourcePages: [], researchRuns: [], unknowns: ["source_checks_are_not_refreshed"], parentSnapshotId: null };
  const source = verifySourceSnapshot({ ...content, snapshotId: digest(content), contentHash: digest(content) });
  f.records.set(`${LEARNING_ROOT}/sourceSnapshots/${source.snapshotId}`, source);
  f.records.set("outboundProspects/prospect-1", { researchPublicationId: "BP-000001", siteId: "site-1", taskId: "packing", contactEmail: "PRIVATE_CONTACT@example.org" });
  f.records.set("outboundProspects/unrelated", { researchPublicationId: "BP-000099", privateBody: "PRIVATE_UNRELATED" });
  const event = learningEvent("research_observed"); f.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event);
  const decision = makeBusinessHistory({ kind: "decision", recordId: "BP-DEC-synthetic", subjectKey, contentClass: "blueprint_business_only",
    occurredAt: "2026-10-01T22:00:00.000Z", recordedAt: "2026-10-01T22:01:00.000Z", capturedBy: principalId, supersedesEventId: null,
    sources: [{ system: "chat", threadId: "synthetic-thread", messageId: "synthetic-message", originalTimestamp: "2026-10-01T22:00:00.000Z",
      originalAuthorId: "synthetic-owner", originalAuthorRole: "user", sourceHash: digest("synthetic café observation"), businessExcerpt: "Seek counterevidence at the café." }],
    classification: "explicit_decision", statement: "Seek counterevidence and unexpected opportunities.", rationale: "Interest remains unknown." });
  f.records.set(`${LEARNING_ROOT}/businessHistoryEvents/${decision.eventId}`, decision);
  const control: ResearchLearningControl = { version: "blueprint.research-learning-worker.v1", enabled: true, startDate: day,
    binding: { version: "blueprint.research-learning-consumer-binding.v1", principalId, role: "daily_research", sourceSnapshotId: source.snapshotId,
      crmIds: ["BP-000001"], prospectIds: ["prospect-1"], discoveryCapabilityIds: [], detailCapabilityIds: [], expiresAt },
    selection: { crmIds: ["BP-000001"], prospectIds: [], capabilityIds: [], focus: { city: "Sacramento", industry: "Warehouses" } },
    businessScope: { principalId, subjectKeys: [subjectKey], expiresAt },
    learningGrant: { principalId, prospectIds: ["prospect-1"], sections: [...learningSections], expiresAt }, terminalSubjectKey: subjectKey };
  const host = researchLearningHost(f.db, () => now);
  const daily = () => host({ op: "learning_daily", day, as_of: "2026-10-02T11:45:00.000Z" }, control);
  return { ...f, control, host, daily, decision };
}

describe("isolated research learning caller", () => {
  it.each([["2026-11-01", "2026-11-01T12:45:00.000Z"], ["2027-03-14", "2027-03-14T11:45:00.000Z"]])("binds %s to Chicago 06:45 across DST", (day, expected) => {
    expect(researchLearningInstant(day)).toBe(expected);
  });
  it("aggregates once and consumes the actual overview and current relevant history before the prompt", async () => {
    const f = fixture(), before = new Map(f.records), first: any = await f.daily(), replay: any = await f.daily();
    expect(replay).toMatchObject({ replay: true, overviewId: first.overviewId, paidAnalysisCalls: 0, sendsAuthorized: false });
    const writesBeforeRead = f.writes.length;
    const input: any = await f.host({ op: "learning_context", day }, f.control), content = JSON.parse(input.content_json);
    expect(input.inputHash).toBe(createHash("sha256").update(input.content_json).digest("hex"));
    expect(content.handoff.businessOverview.overview.overviewId).toBe(first.overviewId);
    expect(content.handoff.businessHistory.explicitDecisions[0].eventId).toBe(f.decision.eventId);
    expect(content.relevantHistory.businessHistory[0].history.pages[0].events[0].sources[0].messageId).toBe("synthetic-message");
    expect(content.handoff.priorContactAndOutcomes.missingRecordsMean).toBe("unknown_not_no_contact_no_reply_or_rejection");
    expect(f.writes).toHaveLength(writesBeforeRead); expect(f.reads).not.toContain("outboundProspects/unrelated");
    expect(input.content_json).not.toContain("PRIVATE_");
    for (const [path, value] of before) expect(f.records.get(path)).toEqual(value);
    expect(f.writes.every(path => path.startsWith(`${LEARNING_ROOT}/`))).toBe(true);
  });
  it("requires a retained overview and does not silently skip it", async () => {
    const f = fixture(); await expect(f.host({ op: "learning_context", day }, f.control)).rejects.toThrow("overview_required");
    expect(f.writes).toEqual([]);
  });
  it("never broadens an expired, partial or conflicting trusted grant", async () => {
    for (const mutate of [
      (control: any) => { control.learningGrant.sections = ["research"]; },
      (control: any) => { control.learningGrant.prospectIds = ["another"]; },
      (control: any) => { control.binding.expiresAt = now; control.businessScope.expiresAt = now; control.learningGrant.expiresAt = now; },
      (control: any) => { control.terminalSubjectKey = "another"; },
    ]) {
      const f = fixture(); mutate(f.control); await expect(f.daily()).rejects.toThrow(); expect(f.reads).toEqual([]); expect(f.writes).toEqual([]);
    }
  });
  it("rejects a moved daily time/date and changed same-date analysis scope before replacing evidence", async () => {
    const f = fixture(); await expect(f.host({ op: "learning_daily", day, as_of: now }, f.control)).rejects.toThrow("schedule_changed");
    await expect(f.host({ op: "learning_daily", day: "2026-10-03", as_of: "2026-10-03T11:45:00.000Z" }, f.control)).rejects.toThrow("not_due");
    await f.daily(); f.control.selection.focus.industry = "Manufacturing";
    await expect(f.daily()).rejects.toThrow("job_scope_changed");
    expect(f.writes.filter(path => path.includes("businessOverviewRuns/"))).toHaveLength(1);
  });
  it("captures an exact native terminal observation once and retains unknown outcome counts", async () => {
    const f = fixture(), ref = `blueprintDailyResearch/sites-first/runs/${day}`;
    const row = { date: day, state: "completed", metadata: { run_key: `blueprint-researcher:${day}` }, blob: digest("immutable-row"), cleanup_required: true };
    f.records.set(ref, row);
    const first: any = await f.host({ op: "learning_terminal", day }, f.control), second: any = await f.host({ op: "learning_terminal", day }, f.control);
    expect(second).toMatchObject({ append: "existing", eventId: first.eventId });
    const event = f.records.get(`${LEARNING_ROOT}/businessHistoryEvents/${first.eventId}`);
    expect(event).toMatchObject({ state: "completed", counts: { researchedProspects: null, verifiedDeliveredTouches: null }, contextHash: null, timeBasis: "terminal_observation" });
    expect(event.sources[0].sourceHash).toBe(digest(row)); expect(f.records.get(ref)).toEqual(row);
    expect(await f.host({ op: "learning_terminal", day: "2026-10-01" }, f.control)).toMatchObject({ state: "learning_outside_scope" });
  });
  it("recovers only admitted dated native projections and refuses an incomplete recovery set", async () => {
    const f = fixture(), root = "blueprintDailyResearch/sites-first";
    for (const date of [day, "2026-10-01"]) f.records.set(`${root}/runs/${date}`, { date, state: "failed", metadata: { run_key: `blueprint-researcher:${date}` } });
    f.records.set(`${root}/canaries/unrelated/runs/${day}`, { state: "completed", privateBody: "PRIVATE_UNRELATED" });
    expect(await f.host({ op: "learning_reconcile" }, f.control)).toMatchObject({ observed: 1, paidAnalysisCalls: 0 });
    expect(f.reads).not.toContain(`${root}/runs/2026-10-01`);
    expect(f.writes.filter(path => path.includes("businessHistoryEvents"))).toHaveLength(1);
    for (let i = 0; i < 101; i++) f.records.set(`${root}/runs/excess-${i}`, { date: day, state: "failed" });
    const writes = f.writes.length;
    await expect(f.host({ op: "learning_reconcile" }, f.control)).rejects.toThrow("terminal_export_required");
    expect(f.writes).toHaveLength(writes);
  });
});
