import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { digest, LEARNING_ROOT } from "../research-learning/contract";
import { learningMemoryFirestore } from "./fixtures/research-learning";
const fixture = vi.hoisted(() => ({
  config: { sourceSnapshotId: "a".repeat(64), principalId: "blueprint-learning-host",
    businessSubjectKeys: ["blueprint:research-learning"], focus: { city: "Sacramento", industry: "Laundromats" }, maturityDays: 14 },
  daily: vi.fn(async () => ({ state: "completed" })),
  prepare: vi.fn(async () => ({ preparedAt: "2026-10-02T12:00:00.000Z", inputHash: "b".repeat(64),
    recordRef: "blueprintResearchLearning/default/nativeLearningInputs/test", handoff: { unknowns: [], businessOverview: { overviewId: "c".repeat(64) } },
    relevantHistory: { businessHistory: [{ history: { pages: [], complete: true } }] }, unknown: null })),
  factory: vi.fn(), historyFactory: vi.fn(), history: vi.fn(async()=>({ok:true,rows:[{record_id:"chosen"}],semantic:{status:"not_authorized"}})),
  realHooks: false,
}));
vi.mock("../research-learning/native-hooks", async importOriginal => {
  const actual = await importOriginal<typeof import("../research-learning/native-hooks")>();
  return { REVIEWED_NATIVE_LEARNING_CONFIG: fixture.config,
    createNativeLearningHooks: (...args: Parameters<typeof actual.createNativeLearningHooks>) => {
      fixture.factory(...args);
      return fixture.realHooks ? actual.createNativeLearningHooks(...args)
        : { daily: fixture.daily, prepareNativeJob: fixture.prepare };
    } };
});
vi.mock("../research-learning/company-history",()=>({createCompanyHistoryTools:(...args:any[])=>{fixture.historyFactory(...args);return fixture.history;}}));
import { researchLearningHost, researchLearningControlSchema } from "../research-learning/research-worker-host";
const now = "2026-10-02T12:00:00.000Z";
const control = () => ({ version: "blueprint.research-learning-worker.v1", enabled: true, startDate: "2026-10-01",
  binding: { version: "blueprint.research-learning-consumer-binding.v1", role: "daily_research", principalId: fixture.config.principalId,
    sourceSnapshotId: fixture.config.sourceSnapshotId, crmIds: ["BP-000001"], prospectIds: ["exact-native-prospect"],
    discoveryCapabilityIds: [], detailCapabilityIds: [], expiresAt: "2026-10-03T00:00:00Z" },
  selection: { crmIds: ["BP-000001"], prospectIds: ["exact-native-prospect"], capabilityIds: [], focus: fixture.config.focus, maturityDays: 14 },
  businessScope: { principalId: fixture.config.principalId, subjectKeys: fixture.config.businessSubjectKeys, expiresAt: "2026-10-02T13:00:00Z" },
  learningGrant: { principalId: fixture.config.principalId, prospectIds: ["exact-native-prospect"],
    sections: ["research", "contact", "outreach", "replies", "outcomes"], expiresAt: "2026-10-02T14:00:00Z" },
  terminalSubjectKey: fixture.config.businessSubjectKeys[0] });
afterEach(() => { fixture.realHooks = false; vi.clearAllMocks(); });
describe("actual private research learning bridge ABI", () => {
  it("uses canonical native hooks with exactly the existing control scope and earliest expiry, then freezes complete input bytes", async () => {
    const result = await researchLearningHost({} as any, () => now)({ op: "learning_context", day: "2026-10-02", allow_create: true }, control());
    expect(fixture.factory).toHaveBeenCalledWith({}, fixture.config, expect.any(Function), {
      binding: { ...researchLearningControlSchema.parse(control()).binding, expiresAt: "2026-10-02T13:00:00.000Z" },
      selection: researchLearningControlSchema.parse(control()).selection });
    expect(fixture.daily).toHaveBeenCalledTimes(1);
    expect(fixture.prepare).toHaveBeenCalledWith("daily_research", "blueprintDailyResearch/sites-first/runs/2026-10-02", [], { allowCreate: true });
    if (!("content_json" in result)) throw new Error("expected context");
    expect(result.inputHash).toBe(createHash("sha256").update(result.content_json).digest("hex"));
    expect(JSON.parse(result.content_json)).toMatchObject({ nativeInputHash: "b".repeat(64), relevantHistory: { businessHistory: expect.any(Array) }, sendsAuthorized: false });
  });
  it("observes recovery without aggregate/input creation and reuses the exact earlier bytes", async () => {
    const host = researchLearningHost({} as any, () => now), original = await host({ op: "learning_context", day: "2026-10-02", allow_create: true }, control());
    fixture.daily.mockClear();
    const recovered = await host({ op: "learning_context", day: "2026-10-02", allow_create: false }, control());
    expect(recovered).toEqual(original); expect(fixture.daily).not.toHaveBeenCalled();
    expect(fixture.prepare).toHaveBeenLastCalledWith("daily_research", "blueprintDailyResearch/sites-first/runs/2026-10-02", [], { allowCreate: false });
  });
  it.each(["expired", "principal", "snapshot", "subjects", "unapproved_prospect", "unapproved_crm", "maturity", "disabled"])("refuses %s control before source calls", async kind => {
    const value = control();
    if (kind === "expired") value.businessScope.expiresAt = now;
    if (kind === "principal") value.binding.principalId = "other-host";
    if (kind === "snapshot") value.binding.sourceSnapshotId = "d".repeat(64);
    if (kind === "subjects") value.businessScope.subjectKeys = ["private:personal"];
    if (kind === "unapproved_prospect") value.selection.prospectIds = ["another-native-prospect"];
    if (kind === "unapproved_crm") value.selection.crmIds = ["BP-999999"];
    if (kind === "maturity") value.selection.maturityDays = 2;
    if (kind === "disabled") value.enabled = false;
    await expect(researchLearningHost({} as any, () => now)({ op: "learning_context", day: "2026-10-02", allow_create: true }, value)).rejects.toThrow();
    expect(fixture.factory).not.toHaveBeenCalled(); expect(fixture.daily).not.toHaveBeenCalled();
  });
  it.each(["learning_daily", "learning_terminal", "learning_reconcile"])("does not duplicate the TS scheduler or writer through %s", async op => {
    await expect(researchLearningHost({} as any, () => now)({ op, day: "2026-10-02" }, control())).rejects.toThrow("operation_invalid");
    expect(fixture.daily).not.toHaveBeenCalled(); expect(fixture.prepare).not.toHaveBeenCalled();
  });
  it("requires an explicit create versus recovery mode before any aggregate or input creation", async () => {
    await expect(researchLearningHost({} as any, () => now)({ op: "learning_context", day: "2026-10-02" }, control()))
      .rejects.toThrow("allow_create_required");
    expect(fixture.daily).not.toHaveBeenCalled(); expect(fixture.prepare).not.toHaveBeenCalled();
  });
  it("admits an already scoped source-only corpus without manufacturing native prospect joins", async () => {
    const value = control(); value.binding.prospectIds = []; value.selection.prospectIds = []; value.learningGrant.prospectIds = [];
    await researchLearningHost({} as any, () => now)({ op: "learning_context", day: "2026-10-02", allow_create: false }, value);
    expect(fixture.factory.mock.calls[0][3].binding.prospectIds).toEqual([]);
    expect(fixture.daily).not.toHaveBeenCalled();
  });
});

describe("bound after-run observation through the real canonical writer", () => {
  it("retains reviewed partial publication as unknown outcomes and replays unchanged evidence once", async () => {
    fixture.realHooks = true;
    const memory = learningMemoryFirestore(), recordRef = "blueprintDailyResearch/sites-first/runs/2026-10-02";
    const raw = { state: "reviewed", qa: { state: "validated" },
      delivery: { notion: { state: "acknowledged" }, sheets: { state: "pending" } } };
    const record = { date: "2026-10-02", state: raw.state, blob: digest(raw), qa_state: raw.qa.state,
      session_id: "sess_retained_research", turn_id: "turn_retained_research" };
    memory.records.set(recordRef, record);
    const host = researchLearningHost(memory.db, () => now), value = control();
    value.binding.prospectIds = []; value.selection.prospectIds = []; value.learningGrant.prospectIds = [];
    const first = await host({ op: "learning_after_run", day: "2026-10-02" }, value);
    expect(first).toMatchObject({ append: "created", event: { kind: "run_summary", state: "reviewed", prospectIds: [],
      nativeTimestamp: null, timeBasis: "terminal_observation", paidAnalysisCalls: 0,
      counts: { researchedProspects: null, acceptedTouches: null, verifiedDeliveredTouches: null,
        repliedProspects: null, matureNonresponseProspects: null, pendingProspects: null },
      sources: [{ recordRef, sourceHash: digest(record) }] } });
    expect(first).toHaveProperty("event.recordId", `BP-RUN-${digest({ recordRef, sourceHash: digest(record) })}`);
    const replay = await host({ op: "learning_after_run", day: "2026-10-02" }, value);
    expect(replay).toMatchObject({ append: "existing" });
    expect(memory.records.get(recordRef)).toEqual(record);
    expect(memory.writes.filter(path => path.startsWith(`${LEARNING_ROOT}/businessHistoryEvents/`))).toHaveLength(1);
    expect(memory.writes.every(path => path.startsWith(`${LEARNING_ROOT}/businessHistoryEvents/`))).toBe(true);
    expect(fixture.daily).not.toHaveBeenCalled(); expect(fixture.prepare).not.toHaveBeenCalled();
  });
  it.each(["expired", "before_start", "future"])("refuses %s after-run scope before canonical source calls", async reason => {
    const memory = learningMemoryFirestore(), value = control();
    if (reason === "expired") value.businessScope.expiresAt = now;
    const day = reason === "before_start" ? "2026-09-30" : reason === "future" ? "2026-10-03" : "2026-10-02";
    await expect(researchLearningHost(memory.db, () => now)({ op: "learning_after_run", day }, value)).rejects.toThrow();
    expect(memory.reads).toEqual([]); expect(memory.writes).toEqual([]);
    expect(fixture.daily).not.toHaveBeenCalled(); expect(fixture.prepare).not.toHaveBeenCalled();
  });
  it("refuses a still-running source without changing its committed research result", async () => {
    fixture.realHooks = true;
    const memory = learningMemoryFirestore(), recordRef = "blueprintDailyResearch/sites-first/runs/2026-10-02";
    const record = { date: "2026-10-02", state: "running", blob: "d".repeat(64) };
    memory.records.set(recordRef, record);
    await expect(researchLearningHost(memory.db, () => now)({ op: "learning_after_run", day: "2026-10-02" }, control()))
      .rejects.toThrow("business_run_not_terminal");
    expect(memory.records.get(recordRef)).toEqual(record); expect(memory.writes).toEqual([]);
  });
});

describe("agent-owned history query bridge",()=>{
 it("passes agent-chosen filters/paging and selected record IDs without legacy relevance selection or frozen input",async()=>{
  const clock=()=>now,host=researchLearningHost({}as any,clock),value=control();
  await host({op:"history_search",day:"2026-10-02",query:"unusual operator outcomes",filters:{city:"Seattle"},page_size:5,cursor:"retained-page"},value);
  expect(fixture.historyFactory).toHaveBeenCalledWith({}, {principalId:"blueprint-learning-host",expiresAt:"2026-10-02T13:00:00.000Z",sourceSnapshotId:fixture.config.sourceSnapshotId,companyWide:false,prospectIds:["exact-native-prospect"],crmIds:["BP-000001"],capabilityIds:[],discoveryCapabilityIds:[],businessSubjectKeys:fixture.config.businessSubjectKeys},{now:clock});
  expect(fixture.history).toHaveBeenCalledWith("search_company_history",{query:"unusual operator outcomes",filters:{city:"Seattle"},page_size:5,cursor:"retained-page"});
  await host({op:"history_fetch",day:"2026-10-02",record_id:"chosen"},value);
  expect(fixture.history).toHaveBeenLastCalledWith("fetch_company_history_record",{record_id:"chosen"});
  expect(fixture.factory).not.toHaveBeenCalled();expect(fixture.daily).not.toHaveBeenCalled();expect(fixture.prepare).not.toHaveBeenCalled();
 });
 it("fallback retains capability detail authority without promoting discovery summaries into full-record grants", async () => {
  const value = control(); value.binding.discoveryCapabilityIds=["summary-only","detail-authorized"]; value.binding.detailCapabilityIds=["detail-authorized"];
  await researchLearningHost({} as any,()=>now)({op:"history_search",day:"2026-10-02",query:""},value);
  expect(fixture.historyFactory.mock.calls.at(-1)![1]).toMatchObject({companyWide:false,crmIds:["BP-000001"],capabilityIds:["detail-authorized"],discoveryCapabilityIds:["summary-only","detail-authorized"]});
 });
 it("new history ignores legacy focus/grant expiry, and whole company requires exact explicit trusted grant", async () => {
  const value: any = control(); value.selection.focus.city = "agent chooses elsewhere"; value.learningGrant.expiresAt = "2020-01-01T00:00:00Z";
  const host = researchLearningHost({} as any, () => now);
  await host({op:"history_search",day:"2026-10-02",query:""},value);
  expect(fixture.historyFactory.mock.calls.at(-1)![1]).toMatchObject({companyWide:false,expiresAt:"2026-10-02T13:00:00.000Z"});
  value.history_access = {version:"blueprint.company-history-access.v1",principalId:fixture.config.principalId,expiresAt:"2026-10-02T12:30:00Z",scope:"company_business_history",authorityRef:"owner-approved-new-profile-read"};
  await host({op:"history_fetch",day:"2026-10-02",record_id:"chosen"},value);
  expect(fixture.historyFactory.mock.calls.at(-1)![1]).toEqual({principalId:fixture.config.principalId,companyWide:true,expiresAt:"2026-10-02T12:30:00.000Z",sourceSnapshotId:fixture.config.sourceSnapshotId});
  value.history_access.principalId="other"; await expect(host({op:"history_search",day:"2026-10-02",query:""},value)).rejects.toThrow();
 });
 it.each(["expired","principal","future"])("denies %s trusted control before a history read",async reason=>{
  const value=control();if(reason==="expired")value.businessScope.expiresAt=now;if(reason==="principal")value.binding.principalId="model-principal";
  await expect(researchLearningHost({}as any,()=>now)({op:"history_search",day:reason==="future"?"2026-10-03":"2026-10-02",query:""},value)).rejects.toThrow();
  expect(fixture.history).not.toHaveBeenCalled();expect(fixture.historyFactory).not.toHaveBeenCalled();
 });
});
