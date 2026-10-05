// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { admitPublishedResearch, runCommunicationsIntake, RESEARCH_WORK_ITEMS } from "../agents/communications-intake";
import { publishedPublicContact, PUBLIC_CONTACT_PREFIX } from "../agents/communications-contact-evidence";
import { previewResearchCommunications, approveResearchCommunications } from "../agents/communications-producer";
import { verifyPublishedResearch } from "../agents/communications-research";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsDigest } from "../agents/communications-contract";
import { processCommunicationsJob, startCommunicationsQueueLoop } from "../agents/communications-worker";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";

function setup(options: Parameters<typeof publishedResearchFixture>[0] = { publicContact: true }) {
  const fixture = publishedResearchFixture(options), db = memoryFirestore();
  const deps = { db, readResearch: vi.fn(async (_date: string) => fixture.snapshot), isSuppressed: vi.fn(async (_email: string) => false), now: () => communicationsNow };
  const records = (name: string) => [...db.records.entries()].filter(([key]) => key.startsWith(`${COMMUNICATIONS_ROOT}/${name}/`)).map(([, value]) => value);
  const admit = () => admitPublishedResearch(fixture.snapshot, fixture.candidate.candidate_key, deps);
  const workItem = async (date = fixture.snapshot.row.date) => db.doc(`${RESEARCH_WORK_ITEMS}/${date}`).set({
    date, run_key: fixture.snapshot.row.run_key, packet_digest: fixture.snapshot.row.packet_digest, stage: "completed" });
  return { ...fixture, db, deps, records, admit, workItem };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("agent-owned published research intake (offline)", () => {
  it("admits today's verified publication byte for byte", async () => {
    // Recorded before outreach-ready hypotheses existed: the brief, its source and
    // every admission record keep the same bytes.
    const f = setup(), admitted: any = await f.admit();
    expect(admitted).toMatchObject({ state: "admitted", briefDigest: "1301a0696e5c375f1a8cc7a22a899914491f46a11f817324da23da6172148825",
      sourceDigest: "7a8a8a1fb0fdd0930bb38310a352f9a5d7c17617c9de5b906bb3cca8c4139c62",
      briefId: "research-cdb8d02eccc3a67f8e943308cb87e0778bf0472b816d2268b1ab1cc74bc0c4fa" });
    const records = [...f.db.records.entries()].filter(([key]) => key.startsWith(`${COMMUNICATIONS_ROOT}/`) || key.startsWith("outboundProspects/"));
    expect(communicationsDigest(records)).toBe("b1151fe4470f01c5557ea8807640d32d32550d76d8f7033dff2baaef1e9221bf");
  });
  it("does not report cached admission as eligible after its bound verification expires", async () => {
    const f = setup();
    const first: any = await f.admit();
    expect(first.state).toBe("admitted");
    const before = structuredClone([...f.db.records.entries()]);
    f.deps.now = () => communicationsNow + 9 * 86400000;
    const stale: any = await f.admit();
    expect(stale).toMatchObject({ state: "needs_research", eligibleForOutreach: false });
    expect(stale.reasons.join(" ")).toContain("lead_verification_required");
    expect([...f.db.records.entries()]).toEqual(before);
  });
  it("admits exact source contact and derives internal context without a human API; mock drafting never calls Gmail", async () => {
    const f = setup(), admitted: any = await f.admit();
    expect(admitted).toMatchObject({ state: "admitted", humanContextApprovalRequired: false, sent: false, sessionCreated: false });
    const brief = f.records("briefs")[0], handoff = f.records("handoffs")[0];
    expect(brief).toMatchObject({ stage: { interest: "unknown", evidenceIds: [] }, teamIds: [], capabilityIds: [], priorConversation: null,
      qualityReview: { reviewedBy: "blueprint-communications-intake" }, researchOrigin: { contactEvidenceDigest: publishedPublicContact(f.candidate).evidenceDigest } });
    expect(brief.contact.sourceCheckedAt).toBe(f.candidate.evidence[4].source_checked_at);
    expect(brief.outreachContext.observations[0].claim).toBe(f.candidate.evidence[0].claim);
    expect(f.records("researchSources")[0].source.candidate).toEqual(f.candidate);
    expect(verifyPublishedResearch(f.snapshot, brief, handoff).briefDigest).toBe(admitted.briefDigest);
    expect(f.db.records.get(`outboundProspects/${admitted.prospectId}`)).toMatchObject({ entityAdmission: "research_provisional", contactEmail: brief.contact.email, stage: "drafted" });
    const output = structuredClone(f.output);
    output.usedFactIds = [brief.facts[0].id];
    output.body = output.body.replace(output.outreachContract!.question, brief.contact.learningQuestion);
    output.outreachContract!.question = brief.contact.learningQuestion;
    const store = new CommunicationsStore(f.db, f.deps.now, "offline-owner");
    const api = { run: vi.fn(async () => ({ output, checkpoint: f.records("jobs")[0].checkpoint, usage: {} })), cancel: vi.fn(), reconcileSaved: vi.fn() };
    const verifyMailbox = vi.fn(async () => { throw new Error("no_credentials_in_offline_draft"); });
    const readThread = vi.fn();
    const result = await processCommunicationsJob(admitted.jobId, { ...f.deps, store, api, verifyMailbox, readThread, suppress: vi.fn() });
    expect(result).toMatchObject({ state: "pending_approval", gmailDraftCreated: false, sent: false });
    expect(api.run).toHaveBeenCalledOnce(); expect(verifyMailbox).not.toHaveBeenCalled(); expect(readThread).not.toHaveBeenCalled();
    expect(f.db.records.get(`action_ledger/${(result as any).ledgerId}`)).toMatchObject({ action_tier: 3, status: "pending_approval", approved_by: null, sent_at: null });
  });

  it("runs concurrent admission and exact replay with one canonical prospect, handoff and queue record", async () => {
    const f = setup();
    const outcomes = await Promise.all([f.admit(), f.admit()]);
    // A competing transaction can defer on the canonical fingerprint; next tick resumes.
    expect(outcomes.some(x => x.state === "admitted")).toBe(true);
    const replay: any = await f.admit(); expect(replay.state).toBe("admitted");
    for (const name of ["briefs", "handoffs", "researchSources", "researchBindings", "firstTouches", "jobs"]) expect(f.records(name)).toHaveLength(1);
    expect([...f.db.records.keys()].filter(x => x.startsWith("outboundProspects/") && x.split("/").length === 2)).toHaveLength(1);
    expect(f.records("intake")[0].admittedAt).toBe(communicationsNow);
  });

  it.each(["missing", "bare_email", "vendor", "hypothesis", "snapshot", "wrong_site", "wrong_host", "lookalike_host", "quote_mismatch", "support_only", "prohibited", "ambiguous", "invalid_json", "unknown_contact", "stale", "oversize_unknown"])("leaves %s evidence in agent-owned needs_research without a job", async kind => {
    const f = setup({ publicContact: !["missing", "bare_email"].includes(kind),
      unknowns: kind === "unknown_contact" ? ["Public business contact is unverified"] : kind === "oversize_unknown" ? ["x".repeat(1201)] : undefined,
      mutateCandidate: candidate => {
        const entry = candidate.evidence.at(-1);
        if (kind === "bare_email") candidate.evidence[0].quote += " Business inquiries: ops@facility.example";
        if (kind === "vendor") entry.classification = "vendor";
        if (kind === "hypothesis") entry.claim_kind = "hypothesis";
        if (kind === "snapshot") entry.origin = "snapshot";
        if (kind === "wrong_site") entry.claim = entry.claim.replace("Synthetic packing site", "Different site");
        if (kind === "wrong_host") entry.url = "https://other.example/contact";
        if (kind === "lookalike_host") entry.url = "https://attackerfacility.example/contact";
        if (kind === "quote_mismatch") entry.quote = "Business inquiries: different@facility.example";
        if (kind === "support_only") entry.quote += " Support only";
        if (kind === "prohibited") entry.quote += " No unsolicited contact";
        if (kind === "invalid_json") entry.claim = PUBLIC_CONTACT_PREFIX + "{}";
        if (kind === "ambiguous") {
          const value = JSON.parse(entry.claim.slice(PUBLIC_CONTACT_PREFIX.length));
          candidate.evidence.push({ ...entry, claim: PUBLIC_CONTACT_PREFIX + JSON.stringify({ ...value, email: "other@facility.example" }), quote: "Business inquiries: other@facility.example" });
        }
        if (kind === "stale") entry.source_checked_at = "2026-08-01T20:00:00Z";
      } });
    const outcome: any = await f.admit();
    expect(outcome.state).toBe("needs_research"); expect(outcome.humanContextApprovalRequired).toBe(false);
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("briefs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "pending",
      owner: ["missing", "unknown_contact"].includes(kind) ? "blueprint-communications-agent" : "blueprint-research-agent", scope: "relevant_claims_only" });
    expect([...f.db.records.keys()].some(x => x.startsWith("outboundProspects/"))).toBe(false);
    const first = f.records("intake")[0]; await f.admit(); expect(f.records("intake")[0]).toEqual(first);
  });

  it("can reuse an exact previously verified immutable contact handoff without another human gate", async () => {
    const f = setup({});
    await f.db.doc("outboundProspects/prospect-1").set(f.prospect);
    const preview = previewResearchCommunications(f.snapshot, "prospect-1", f.prospect, f.input, communicationsNow);
    const saved = await approveResearchCommunications(f.db, preview, f.input, preview.previewDigest, "original-operator", communicationsNow);
    const result: any = await f.admit();
    expect(result).toMatchObject({ state: "admitted", prospectId: "prospect-1", briefDigest: saved.briefDigest, humanContextApprovalRequired: false });
    expect(f.records("briefs")).toHaveLength(1); expect(f.records("jobs")).toHaveLength(1);
    expect(f.records("briefs")[0].contact.sourceCheckedAt).toBe(f.input.context.contactSourceCheckedAt);
  });

  it.each(["No public business contact has been identified.", "Permission to email this site is not established.",
    "The business contact is not available."])("refuses contradictory unknown: %s", async unknown => {
    const f = setup({ publicContact: true, unknowns: [unknown] });
    expect(await f.admit()).toMatchObject({ state: "needs_research", reasons: ["verified_contact_conflicting_unknowns"] });
    expect(f.records("jobs")).toHaveLength(0);
  });

  it("does not associate a technical/support address with a separate business route in the same quote", async () => {
    const f = setup({ publicContact: true, mutateCandidate: candidate => {
      candidate.evidence.at(-1).quote += " Technical assistance only; business inquiries: other@facility.example";
    } });
    expect((await f.admit()).state).toBe("needs_research"); expect(f.records("jobs")).toHaveLength(0);
  });

  it.each(["handoff", "source", "email", "binding"])("rejects a corrupted prior %s instead of trusting an email field", async kind => {
    const f = setup({}); await f.db.doc("outboundProspects/prospect-1").set(f.prospect);
    const preview = previewResearchCommunications(f.snapshot, "prospect-1", f.prospect, f.input, communicationsNow);
    const saved = await approveResearchCommunications(f.db, preview, f.input, preview.previewDigest, "original-operator", communicationsNow);
    if (kind === "handoff") f.db.records.delete(`${COMMUNICATIONS_ROOT}/handoffs/${saved.briefDigest}`);
    if (kind === "source") await f.db.doc(`${COMMUNICATIONS_ROOT}/researchSources/${saved.briefDigest}`).update({ contactSourceIdentifiesRecipient: false });
    if (kind === "email") await f.db.doc("outboundProspects/prospect-1").update({ contactEmail: "other@facility.example" });
    if (kind === "binding") { const key = [...f.db.records.keys()].find(x => x.startsWith(`${COMMUNICATIONS_ROOT}/researchBindings/`))!; f.db.records.delete(key); }
    expect((await f.admit()).state).toBe("needs_research"); expect(f.records("jobs")).toHaveLength(0);
  });

  it.each(["suppressed", "contacted", "closed", "converted", "changed_email"])("preserves canonical %s without resetting it", async kind => {
    const f = setup();
    await f.db.doc("outboundProspects/prospect-1").set({ ...f.prospect, researchPublicationId: "BP-000042",
      stage: ["contacted", "closed", "converted"].includes(kind) ? kind : "drafted",
      contactEmail: kind === "changed_email" ? "other@facility.example" : f.prospect.contactEmail });
    if (kind === "suppressed") f.deps.isSuppressed.mockResolvedValue(true);
    const before = f.db.records.get("outboundProspects/prospect-1");
    const result = await f.admit(); expect(result.state).not.toBe("admitted");
    expect(f.db.records.get("outboundProspects/prospect-1")).toEqual(before); expect(f.records("jobs")).toHaveLength(0);
    if (kind !== "changed_email") expect(f.records("refreshRequests")).toHaveLength(0);
  });

  it("does not queue a second first-touch revision, including legacy jobs without claims", async () => {
    const f = setup(), first: any = await f.admit(), store = new CommunicationsStore(f.db, f.deps.now);
    for (const [key] of f.db.records) if (key.startsWith(`${COMMUNICATIONS_ROOT}/firstTouches/`)) f.db.records.delete(key);
    await expect(store.enqueue({ prospectId: first.prospectId, briefId: "different-revision", briefDigest: "a".repeat(64), intent: "outreach", inboundMessageId: null }))
      .rejects.toThrow("communications_first_touch_already_requested");
    expect(f.records("jobs")).toHaveLength(1);
  });

  it("automatically replaces a proven stale pre-inference job after a verified research refresh", async () => {
    const f = setup(), first: any = await f.admit();
    let time = communicationsNow + 8 * 86400000;
    f.deps.now = () => time;
    const store = new CommunicationsStore(f.db, f.deps.now, "refresh-owner"), api = { run: vi.fn(), cancel: vi.fn(), reconcileSaved: vi.fn() };
    expect(await processCommunicationsJob(first.jobId, { ...f.deps, store, api, verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn() })).toMatchObject({ state: "awaiting_research" });
    expect(api.run).not.toHaveBeenCalled();
    time += 181000;
    // Algorithm-only source update: this synthetic later accepted publication
    // does not prove the research owner's CRM dedup/refresh publishing policy.
    const refreshed = publishedResearchFixture({ publicContact: true, verificationAssessedAt: new Date(time - 30000).toISOString(), date: new Date(time).toISOString().slice(0, 10), mutateCandidate: candidate => {
      for (const fact of candidate.evidence) {
        fact.source_checked_at = new Date(time - 60000).toISOString(); fact.checked_date = fact.source_checked_at.slice(0, 10);
        fact.origin = "live"; fact.snapshot_loaded_at = null; fact.snapshot_record_id = null; fact.snapshot_fact_id = null;
      }
    } });
    const next: any = await admitPublishedResearch(refreshed.snapshot, refreshed.candidate.candidate_key, f.deps);
    expect(next).toMatchObject({ state: "admitted", prospectId: first.prospectId });
    expect(next.jobId).not.toBe(first.jobId);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${first.jobId}`)).toMatchObject({ state: "superseded", replacedBy: next.jobId });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${next.jobId}`).state).toBe("queued");
    expect(f.records("firstTouches")[0].jobId).toBe(next.jobId);
  });

  it.each(["session_ambiguity", "ledger", "send_receipt", "active_lease"])("never replaces a first-touch job with %s", async kind => {
    const f = setup(), first: any = await f.admit();
    await f.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${first.jobId}`).update({ state: "awaiting_research",
      ...(kind === "session_ambiguity" ? { checkpoint: { createClaimedAt: new Date(communicationsNow).toISOString(), sessionId: null, turnId: null } } : {}),
      ...(kind === "active_lease" ? { lease: { owner: "old", until: communicationsNow + 1000 } } : {}) });
    if (kind === "ledger") await f.db.doc(`action_ledger/communications_${first.jobId}`).set({ status: "pending_approval" });
    if (kind === "send_receipt") {
      const key = [...f.db.records.keys()].find(x => x.startsWith(`${COMMUNICATIONS_ROOT}/firstTouches/`))!.split("/").at(-1);
      await f.db.doc(`${COMMUNICATIONS_ROOT}/sendReceipts/${key}`).set({ state: "claimed" });
    }
    const store = new CommunicationsStore(f.db, f.deps.now);
    await expect(store.enqueue({ prospectId: first.prospectId, briefId: "revised", briefDigest: "b".repeat(64), intent: "outreach", inboundMessageId: null }))
      .rejects.toThrow("communications_first_touch_already_requested");
    expect(f.records("jobs")).toHaveLength(1);
  });

  it("fails closed when source provenance changes before model work", async () => {
    const f = setup(), admitted: any = await f.admit(), brief = f.records("briefs")[0], handoff = f.records("handoffs")[0];
    f.snapshot.files.qa = Buffer.from("{}").toString("base64");
    expect(() => verifyPublishedResearch(f.snapshot, brief, handoff)).toThrow("research_adapter_qa_binding_missing");
  });

  it("paginates past old unavailable rows to a newer publication, then wraps on restart; no research writes", async () => {
    const f = setup(); await f.workItem();
    for (let i = 1; i <= 6; i++) await f.db.doc(`${RESEARCH_WORK_ITEMS}/2026-09-0${i}`).set({ date: `2026-09-0${i}`, run_key: "old", packet_digest: "a".repeat(64), stage: "completed" });
    const before = [...f.db.records.entries()].filter(([key]) => key.startsWith("blueprintDailyResearch/"));
    f.deps.readResearch.mockImplementation(async date => { if (date !== f.snapshot.row.date) throw new Error("old_snapshot_unavailable"); return f.snapshot; });
    await runCommunicationsIntake(f.deps); expect(f.records("jobs")).toHaveLength(0);
    await runCommunicationsIntake(f.deps); expect(f.records("jobs")).toHaveLength(1);
    await runCommunicationsIntake(f.deps); expect(f.records("intakeState")[0].cursor).toBeNull();
    await runCommunicationsIntake(f.deps); expect(f.records("jobs")).toHaveLength(1);
    expect([...f.db.records.entries()].filter(([key]) => key.startsWith("blueprintDailyResearch/"))).toEqual(before);
  });

  it("runs the one-minute automatic intake with paid work disabled and waits for active intake on stop", async () => {
    vi.useFakeTimers(); vi.setSystemTime(communicationsNow);
    const f = setup(); await f.workItem();
    const store = new CommunicationsStore(f.db, f.deps.now), api = { run: vi.fn(), cancel: vi.fn(), reconcileSaved: vi.fn() };
    const verifyMailbox = vi.fn(), readThread = vi.fn();
    const stop = startCommunicationsQueueLoop({ ...f.deps, store, api, verifyMailbox, readThread, suppress: vi.fn() }, {
      intake: () => runCommunicationsIntake(f.deps), processJobs: false });
    expect(f.records("jobs")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(f.records("jobs")).toHaveLength(1); expect(api.run).not.toHaveBeenCalled(); expect(verifyMailbox).not.toHaveBeenCalled(); expect(readThread).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
