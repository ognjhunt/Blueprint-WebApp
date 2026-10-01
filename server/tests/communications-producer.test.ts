// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { previewResearchCommunications, approveResearchCommunications } from "../agents/communications-producer";
import { communicationsDigest } from "../agents/communications-contract";
import { verifyPublishedResearch } from "../agents/communications-research";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { processCommunicationsJob } from "../agents/communications-worker";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";

function setup() {
  const fixture = publishedResearchFixture();
  const preview = () => previewResearchCommunications(fixture.snapshot, "prospect-1", fixture.prospect, fixture.input, communicationsNow);
  return { ...fixture, preview };
}

describe("published research → human reviewed communications producer (offline)", () => {
  it("preserves original QA, Sheets ID, dates, vendor class, quotes and cached source IDs without claiming interest", () => {
    const f = setup(), preview = f.preview();
    expect(preview.source.sheetsProspectId).toBe("BP-000042");
    expect(preview.proposal.prospectId).toBe("prospect-1");
    expect(preview.source.candidate).toEqual(f.candidate);
    expect(preview.source.researchReview.reviewer_reference).toContain("qa-turn-1");
    expect(preview.proposal.facts.map(x => x.evidenceClass)).toEqual(["operator_stated", "vendor_reported", "operator_stated", "vendor_reported"]);
    expect(preview.proposal.facts[3].sourceCheckedAt).toBe("2026-09-29T20:00:00Z");
    expect(preview.proposal.facts[3].assertionScope).toBe("as_of_background");
    expect(preview.source.candidate.evidence[3].snapshot_fact_id).toBe("snapshot-fact-9");
    expect(preview.proposal.unknowns).toEqual(f.candidate.unknowns);
    expect(preview.proposal.stage).toEqual({ interest: "unknown", evidenceIds: [] });
    expect(preview.proposal.priorConversation).toBeNull();
    expect(preview.proposal).not.toHaveProperty("qualityReview");
    expect(preview.sessionCreated).toBe(false);
    expect(f.preview().previewDigest).toBe(preview.previewDigest);
    // Previously persisted API-source digests must retain their original shape.
    expect(preview.source).not.toHaveProperty("sourceRecordUrl");
  });

  it.each([
    ["unpublished Sheets", (f: any) => { f.snapshot.row.delivery.sheets.state = "pending"; }],
    ["unreviewed", (f: any) => { f.snapshot.row.review.accepted_keys = []; }],
    ["missing plan", (f: any) => { delete f.snapshot.row.delivery.sheets.plan; }],
    ["wrong external ID", (f: any) => { f.snapshot.row.delivery.sheets.receipt.reference = `sheets:${f.snapshot.row.packet.destinations.sheet_id}:Prospects:BP-000999`; }],
    ["changed sheet row", (f: any) => { f.snapshot.row.delivery.sheets.plan.sheet_rows[0][1] = "Different site"; }],
    ["missing QA", (f: any) => { delete f.snapshot.files.qa; }],
    ["unbound reviewer", (f: any) => { f.snapshot.row.review.reviewer_reference = "invented"; }],
    ["changed artifact", (f: any) => { f.snapshot.files.artifact = Buffer.from("changed").toString("base64"); }],
    ["changed packet", (f: any) => { f.snapshot.row.packet.candidates[0].unknowns.push("Changed after QA"); }],
    ["wrong contact", (f: any) => { f.input.context.contactSourceEmail = "wrong@facility.example"; }],
    ["unknown permission", (f: any) => { f.input.context.consent.status = "unknown"; }],
    ["unreviewed contact", (f: any) => { f.input.context.contactSourceIdentifiesRecipient = false; }],
    ["wrong facility", (f: any) => { f.prospect.facilityName = "Another facility"; }],
    ["wrong task", (f: any) => { f.prospect.hypothesisedTask = "Another task"; }],
    ["changed binding", (f: any) => { f.prospect.siteId = "other-site"; }],
    ["contacted prospect", (f: any) => { f.prospect.stage = "contacted"; }],
    ["stale contact", (f: any) => { f.input.context.contactSourceCheckedAt = "2026-07-01"; }],
    ["future contact", (f: any) => { f.input.context.contactSourceCheckedAt = "2026-10-02"; }],
    ["compound question", (f: any) => { f.input.context.learningQuestion = "One? Two?"; }],
    ["conflict", (f: any) => { f.input.context.conflicts = ["Contact source conflicts"]; }],
    ["invented facts", (f: any) => { f.input.facts = [{ claim: "Invented" }]; }],
    ["invented approval", (f: any) => { f.input.qualityReview = { state: "approved" }; }],
    ["credentials", (f: any) => { f.input.refreshToken = "UNACCEPTED_MOCK"; }],
  ])("refuses %s without producing a handoff", (_name, change) => {
    const f = setup(); change(f); expect(f.preview).toThrow();
  });

  it("allows unavailable Notion projection with truthful null receipt and canonical source URL", () => {
    const f = setup(); f.snapshot.row.delivery.notion.state = "pending";
    const preview = f.preview();
    expect(preview.source.notionReceipt).toBeNull();
    expect(preview.sourceRecordUrl).toContain("docs.google.com/spreadsheets/");
  });

  it("refuses source overflow rather than truncating candidate unknowns", () => {
    const f = publishedResearchFixture({ unknowns: Array.from({ length: 17 }, (_, i) => `Unknown ${i}`) });
    expect(() => previewResearchCommunications(f.snapshot, "prospect-1", f.prospect, f.input, communicationsNow)).toThrow(/unknowns/);
    const long = publishedResearchFixture({ taskClaim: "a".repeat(1300) });
    expect(() => previewResearchCommunications(long.snapshot, "prospect-1", long.prospect, long.input, communicationsNow)).toThrow(/claim/);
  });

  it("atomically writes immutable separate approval and source records, then replays without a new revision", async () => {
    const f = setup(), db = memoryFirestore();
    await db.collection("outboundProspects").doc("prospect-1").set(f.prospect);
    const preview = f.preview();
    const result = await approveResearchCommunications(db, preview, f.input, preview.previewDigest, "operator-1", communicationsNow);
    expect(result.created).toBe(true);
    expect(await new CommunicationsStore(db).brief(result.brief.briefId)).toEqual(result.brief);
    expect(verifyPublishedResearch(f.snapshot, result.brief, result.handoff).briefDigest).toBe(result.briefDigest);
    const provenance = db.records.get(`${COMMUNICATIONS_ROOT}/researchSources/${result.briefDigest}`);
    expect(provenance.source.candidate).toEqual(f.candidate);
    expect(result.brief.researchOrigin.sourceDigest).toBe(communicationsDigest(provenance.source));
    const nextPreview = previewResearchCommunications(f.snapshot, "prospect-1", db.records.get("outboundProspects/prospect-1"), f.input, communicationsNow + 1000);
    expect(nextPreview.previewDigest).toBe(preview.previewDigest);
    const replay = await approveResearchCommunications(db, nextPreview, f.input, preview.previewDigest, "operator-2", communicationsNow + 1000);
    expect(replay.created).toBe(false); expect(replay.briefDigest).toBe(result.briefDigest);
    expect(replay.brief.qualityReview.reviewedBy).toBe("operator-1");
    expect([...db.records.keys()].filter((x: string) => x.includes("/jobs/"))).toHaveLength(0);
  });

  it("requires the displayed preview and rechecks canonical context inside the transaction", async () => {
    const f = setup(), db = memoryFirestore(), preview = f.preview();
    await db.collection("outboundProspects").doc("prospect-1").set(f.prospect);
    await expect(approveResearchCommunications(db, preview, f.input, "a".repeat(64), "operator", communicationsNow)).rejects.toThrow("preview_changed");
    await db.collection("outboundProspects").doc("prospect-1").update({ contactEmail: "changed@facility.example" });
    await expect(approveResearchCommunications(db, preview, f.input, preview.previewDigest, "operator", communicationsNow)).rejects.toThrow("canonical_context_changed");
    expect([...db.records.keys()]).toEqual(["outboundProspects/prospect-1"]);
  });

  it("fences concurrent duplicate WebApp prospects against the same published Sheets identity", async () => {
    const f = setup(), db = memoryFirestore();
    for (const prospectId of ["prospect-1", "prospect-2"]) await db.collection("outboundProspects").doc(prospectId).set(f.prospect);
    const results = await Promise.allSettled(["prospect-1", "prospect-2"].map(prospectId => {
      const preview = previewResearchCommunications(f.snapshot, prospectId, f.prospect, f.input, communicationsNow);
      return approveResearchCommunications(db, preview, f.input, preview.previewDigest, "operator", communicationsNow);
    }));
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect((results.find(x => x.status === "rejected") as PromiseRejectedResult).reason.message).toBe("research_adapter_source_already_bound");
    expect([...db.records.keys()].filter((key: string) => key.includes("/briefs/"))).toHaveLength(1);
    expect([...db.records.keys()].filter((key: string) => key.includes("/researchBindings/"))).toHaveLength(1);
  });

  it("runs the existing worker on producer output with fake inference, retaining tier-3 human send approval", async () => {
    const f = setup(), db = memoryFirestore(), preview = f.preview();
    await db.collection("outboundProspects").doc("prospect-1").set(f.prospect);
    const result = await approveResearchCommunications(db, preview, f.input, preview.previewDigest, "operator", communicationsNow);
    const store = new CommunicationsStore(db, () => communicationsNow, "worker");
    const job = await store.enqueue({ prospectId: "prospect-1", briefId: result.brief.briefId, briefDigest: result.briefDigest, intent: "outreach", inboundMessageId: null });
    const api = { run: vi.fn().mockResolvedValue({ output: { ...f.output, usedFactIds: [result.brief.facts[0].id] },
      checkpoint: { createClaimedAt: null, sessionId: "mock-session", turnId: "mock-turn" }, usage: { synthetic: true } }),
      cancel: vi.fn(), reconcileSaved: vi.fn() };
    const response = await processCommunicationsJob(job.jobId, { store, api, readResearch: async () => f.snapshot,
      verifyMailbox: vi.fn().mockResolvedValue({ synthetic: true }), readThread: vi.fn(), isSuppressed: async () => false,
      suppress: vi.fn(), now: () => communicationsNow });
    expect(response).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(api.run).toHaveBeenCalledOnce();
    const ledger = db.records.get(`action_ledger/communications_${job.jobId}`);
    expect(ledger).toMatchObject({ action_tier: 3, status: "pending_approval", approved_by: null, auto_approve_reason: null });
    expect(ledger.action_payload.communications.brief.researchOrigin.sourceDigest).toBe(result.brief.researchOrigin.sourceDigest);
  });
});
