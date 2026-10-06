// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { admitPublishedResearch, recordPublishedHypotheses, runCommunicationsIntake, RESEARCH_WORK_ITEMS } from "../agents/communications-intake";
import { publishedPublicContact, PUBLIC_CONTACT_PREFIX } from "../agents/communications-contact-evidence";
import { previewResearchCommunications, approveResearchCommunications } from "../agents/communications-producer";
import { researchDigest, researchPublicationHypotheses, researchPublicationSource, verifyPublishedResearch } from "../agents/communications-research";
import * as research from "../agents/communications-research";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsDigest, communicationsHandoffSchema, SHEETS_RECEIPT_MAX_LENGTH } from "../agents/communications-contract";
import { LEGACY_OUTREACH_RULE_VERSION } from "../agents/outreach-ready-question";
import { processCommunicationsJob, startCommunicationsQueueLoop } from "../agents/communications-worker";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture, type OutreachReadyBlock } from "./fixtures/published-research";

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

describe("published research days that carry outreach-ready hypotheses (offline, synthetic)", () => {
  const prospects = (f: ReturnType<typeof setup>) => [...f.db.records.keys()].filter(key => key.startsWith("outboundProspects/") && key.split("/").length === 2);
  const origin = (f: ReturnType<typeof setup>, candidateKey: string) => ({ date: f.snapshot.row.date, candidateKey,
    packetDigest: f.snapshot.row.packet_digest, rawArtifactDigest: f.snapshot.row.raw_output_digest });
  const eachEntry = (edit: (entry: any) => void) => (block: OutreachReadyBlock) => {
    for (const entries of [block.sheets, block.notion]) (entries as any[]).forEach(edit);
  };
  // The verified brief may differ only in the provenance that names the whole day.
  const verifiedContent = (brief: any) => {
    const { briefId: _briefId, researchOrigin: { sourceDigest: _sourceDigest, ...researchOrigin }, ...rest } = brief;
    return { ...rest, researchOrigin };
  };
  // Design v1.1 wording, word for word, for the synthetic sorting candidate.
  // Rule v1.2's wording (the fixture's default): the site is "your <City> site" from the location.
  const ask = {
    S: "Is sorting returned parcels done at your Sortville site, or somewhere else in the company?",
    M: "Which parts of sorting returned parcels at your Sortville site still need people, and what has kept them from being automated?",
    A: "What has kept the rest of sorting returned parcels at your Sortville site from being automated so far?",
    U: "Is any of sorting returned parcels at your Sortville site automated today, or is it all done by hand?",
  };
  // Rule v1.1's wording, for a day published under v1.1: the task and site fields verbatim.
  const askV11 = {
    S: "Is sorting returned parcels done at your Synthetic sorting site site, or somewhere else in the company?",
    M: "Which parts of sorting returned parcels at Synthetic sorting site still need people, and what has kept them from being automated?",
    A: "What has kept the remaining sorting returned parcels work at Synthetic sorting site from being automated so far?",
  };
  const questions = [ask.M];
  const designV1Questions = ["Is sorting returned parcels at Synthetic sorting site still done mostly by hand?",
    "Do you already use or plan automation for it?", "Would a short look at whether a robot could take on part of it be useful?"];

  it("admits verified rows on a v3-pinned day that records the tier in shadow mode", async () => {
    const f = setup({ publicContact: true, outreachReady: "shadow" }); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expect(f.records("jobs")).toHaveLength(1);
    expect(f.records("intake")).toEqual([expect.objectContaining({ candidateKey: "candidate-1", state: "admitted" })]);
    expect(researchPublicationHypotheses(f.snapshot)).toEqual({ state: "absent" });
  });

  it("accepts a day with both tiers: the verified row is admitted unchanged and the hypothesis is only recorded", async () => {
    const shadow = setup({ publicContact: true, outreachReady: "shadow" }), both = setup({ publicContact: true, outreachReady: "published" });
    for (const f of [shadow, both]) { await f.workItem(); await runCommunicationsIntake(f.deps); }
    // Verified row: one brief and one job, with the same content as the same day without the hypothesis.
    expect(both.records("briefs")).toHaveLength(1); expect(both.records("jobs")).toHaveLength(1);
    const [brief] = both.records("briefs");
    expect(verifiedContent(brief)).toEqual(verifiedContent(shadow.records("briefs")[0]));
    expect(Object.hasOwn(brief, "qualification")).toBe(false);
    const [{ source }] = both.records("researchSources"), [{ source: baseline }] = shadow.records("researchSources");
    for (const field of ["candidate", "leadVerification", "leadVerificationCohort", "sheetsId", "sheetsProspectId", "notionReceipt"]) {
      expect(source[field], field).toEqual(baseline[field]);
    }
    expect(source.sheetsReceipt).toBe(`sheets:${both.snapshot.row.packet.destinations.sheet_id}:Prospects:BP-000042,BP-000043`);
    expect(verifyPublishedResearch(both.snapshot, brief, both.records("handoffs")[0]).briefDigest).toBe(communicationsDigest(brief));
    // Hypothesis: recorded once, with no brief, prospect, job, research request or send authority.
    const row = both.snapshot.row;
    expect(both.records("intake").filter(item => item.candidateKey === "candidate-2")).toEqual([{
      date: row.date, runKey: row.run_key, candidateKey: "candidate-2", packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest,
      intakeId: expect.stringMatching(/^[a-f0-9]{64}$/), state: "hypothesis_recorded", publishedTier: "outreach_ready", label: "hypothesis",
      sheetsProspectId: "BP-000043", candidateDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      openChecks: ["manual_workflow", "existing_automation", "fit", "interest"], openQuestions: questions,
      validUntil: "2026-10-08T21:00:00.000Z",
      owner: "blueprint-communications-agent", recordedAt: communicationsNow, eligibleForOutreach: false, draftJobCreated: false,
      sendsAuthorized: false, humanContextApprovalRequired: false, sent: false, sessionCreated: false }]);
    expect(prospects(both)).toHaveLength(1);
    expect(both.records("refreshRequests").every(request => request.state === "resolved")).toBe(true);
    const before = structuredClone([...both.db.records.entries()]);
    await recordPublishedHypotheses(both.snapshot, both.deps);
    expect([...both.db.records.entries()]).toEqual(before);
  });

  // Each case names the one check that refuses it, so a removed or reordered check fails here.
  const expectBlockRefused = async (f: ReturnType<typeof setup>, reason: string) => {
    expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "admitted" });
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("briefs")).toHaveLength(1); expect(prospects(f)).toHaveLength(1);
    // The strict send-path check still verifies the verified row's publication.
    const [brief] = f.records("briefs");
    expect(verifyPublishedResearch(f.snapshot, brief, f.records("handoffs")[0]).briefDigest).toBe(communicationsDigest(brief));
    expect(f.records("intake").find(item => item.candidateKey === "hypotheses")).toMatchObject({ state: "needs_research",
      reasons: [`research_hypothesis_block_invalid:${reason}`], sent: false });
    expect(f.records("intake").some(item => item.state === "hypothesis_recorded")).toBe(false);
    expect(f.records("refreshRequests").filter(request => request.state === "pending")).toEqual([
      expect.objectContaining({ candidateKey: "hypotheses", owner: "blueprint-research-agent", kind: "research_owner_refresh" })]);
  };
  it.each<[string, Parameters<typeof publishedResearchFixture>[0], string]>([
    ["an invented question", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = [...entry.open_questions, "Could we schedule a call?"]; }) }, "open_questions_0"],
    ["the design v1 form of up to three fixed questions", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = designV1Questions; }) },
      "open_questions_0"],
    ["only the first design v1 question", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = designV1Questions.slice(0, 1); }) },
      "open_questions_0"],
    ["no question", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = []; }) }, "open_questions_0"],
    ["a question that is not a list", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = ask.M; }) }, "open_questions_0"],
    ["a later template while the manual workflow is open", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = [ask.A]; }) },
      "open_questions_0"],
    ["the site template while the site link is proven", { mutateOutreachReady: eachEntry(entry => { entry.open_questions = [ask.S]; }) },
      "open_questions_0"],
    ["a site link check the assessment does not support", { mutateOutreachReady: eachEntry(entry => {
      entry.open_checks = ["site_link", ...entry.open_checks]; entry.open_questions = [ask.S]; }) }, "open_checks_0"],
    ["the M template with an open site link", { mutateHypothesisAssessment: assessment => { assessment.claims.site_task.status = "inference"; },
      mutateOutreachReady: eachEntry(entry => { entry.open_questions = [ask.M]; }) }, "open_questions_0"],
    ["the M template once the manual workflow is verified", { mutateHypothesisAssessment: assessment => {
      assessment.claims.human_workflow = { ...assessment.claims.site_task }; assessment.claims.plausible_fit.status = "unresolved"; },
      mutateOutreachReady: eachEntry(entry => { entry.open_questions = [ask.M]; }) }, "open_questions_0"],
    ["a malformed published expiry", { mutateHypothesisAssessment: assessment => { assessment.valid_until = "next week"; } }, "valid_until_0"],
    ["a candidate that differs from the packet", { mutateOutreachReady: eachEntry(entry => { entry.candidate.task = "sorting outbound parcels"; }) }, "candidate_0"],
    ["a closed fit check", { mutateOutreachReady: eachEntry(entry => { entry.open_checks = ["manual_workflow", "existing_automation", "interest"]; }) }, "open_checks_0"],
    ["an unknown entry field", { mutateOutreachReady: eachEntry(entry => { entry.approved = true; }) }, "entry_0"],
    ["Notion and Sheets blocks that differ", { mutateOutreachReady: block => { block.notion = []; } }, "notion_payload"],
    ["a block that is not a list", { mutateOutreachReady: block => { block.sheets = "hypotheses"; block.notion = "hypotheses"; } }, "sheets_payload"],
    ["no QA list", { mutateOutreachReady: block => { block.reviewKeys = undefined; block.qaKeys = undefined; } }, "outreach_ready_keys"],
    ["a key QA did not list", { mutateOutreachReady: block => { block.qaKeys = []; } }, "outreach_ready_keys_not_listed_by_qa"],
    ["a key that is also a verified row", { mutateOutreachReady: block => { block.reviewKeys = block.qaKeys = ["candidate-2", "candidate-1"]; } },
      "outreach_ready_keys_overlap_accepted_keys"],
    ["a Sheets row marked like a verified row", { mutateOutreachReady: block => { block.status = "Needs recheck"; } }, "sheet_row_0"],
    ["a retained result without the outreach-ready tier", { mutateOutreachReady: block => { block.retained = { ...block.retained, tier: "none" }; } },
      "lead_verification_0"],
    ["a retained result that claims qualified promotion",
      { mutateOutreachReady: block => { block.retained = { ...block.retained, eligible_for_qualified_promotion: true }; } }, "lead_verification_0"],
    ["a QA check that marks the hypothesis a duplicate",
      { mutateOutreachReady: block => { block.qaCheck = { ...block.qaCheck, duplicate: true, duplicate_of: "candidate-0-unpublished" }; } }, "qa_check_0"],
    ["a v2 result-version pin", { pin: "blueprint.lead-verification-result.v2" }, "lead_verification_result_version"],
    ["a candidate outside the publication scope", { mutateHypothesisCandidate: candidate => { candidate.qualification_status = "qualified"; } },
      "candidate_scope_0"],
    // Declared by the QA list alone: the review keys name a hypothesis that no payload publishes.
    ["review keys and no published block", { mutateOutreachReady: block => { block.sheets = undefined; block.notion = undefined; } }, "sheets_payload"],
  ])("turns a block with %s into needs_research and still admits the verified row", async (_name, options, reason) => {
    const f = setup({ publicContact: true, outreachReady: "published", ...options }); await f.workItem();
    await runCommunicationsIntake(f.deps);
    await expectBlockRefused(f, reason);
  });

  // Reviewer probes: a hypothesis Sheets row never decides the verified row. The receipt is
  // resealed each time, so only the hypothesis row's identity or position is wrong.
  const reseal = (f: ReturnType<typeof setup>) => {
    const sheets = f.snapshot.row.delivery.sheets, plan = sheets.plan;
    plan.body_json = JSON.stringify({ majorDimension: "ROWS", values: plan.sheet_rows });
    plan.request_digest = createHash("sha256").update(plan.body_json).digest("hex");
    sheets.receipt.reference = `sheets:${f.snapshot.row.packet.destinations.sheet_id}:Prospects:${plan.sheet_rows.map((entry: any) => entry[0]).join(",")}`;
  };
  it.each<[string, (f: ReturnType<typeof setup>) => void, string]>([
    ["a malformed hypothesis row ID", f => { f.snapshot.row.delivery.sheets.plan.sheet_rows[1][0] = "BP-43"; reseal(f); }, "sheet_row_id_0"],
    // The receipt still ends trimmed, so the verified row's handoff keeps it byte for byte.
    ["a leading space on the hypothesis row ID", f => { f.snapshot.row.delivery.sheets.plan.sheet_rows[1][0] = " BP-000043"; reseal(f); }, "sheet_row_id_0"],
    ["hypothesis rows written before the verified rows", f => { f.snapshot.row.delivery.sheets.plan.sheet_rows.reverse(); reseal(f); }, "sheet_rows_order"],
    ["a Sheets payload without the block while the plan keeps its row", f => {
      const sheets = f.snapshot.row.delivery.sheets;
      delete sheets.payload.hypotheses;
      sheets.payload_digest = sheets.receipt.payload_digest = sheets.plan.payload_digest = researchDigest(sheets.payload);
      sheets.plan.marker = `[${sheets.key};${sheets.payload_digest}]`;
      for (const entry of sheets.plan.sheet_rows) entry[12] = String(entry[12]).replace(/\n\[.*\]$/, `\n${sheets.plan.marker}`);
      reseal(f);
    }, "sheets_payload"],
  ])("keeps the verified row admitted with %s; only the hypothesis block needs research", async (_name, mutate, reason) => {
    const f = setup({ publicContact: true, outreachReady: "published" });
    mutate(f); await f.workItem();
    await runCommunicationsIntake(f.deps);
    await expectBlockRefused(f, reason);
    expect(f.records("researchSources")[0].source.sheetsProspectId).toBe("BP-000042");
  });

  it("still rejects the day when a hypothesis row reuses a verified row's Sheets ID", async () => {
    // Two rows with one prospect ID make the verified row's CRM identity ambiguous, so this
    // stays a day-level failure, exactly as before hypotheses existed.
    const f = setup({ publicContact: true, outreachReady: "published" });
    f.snapshot.row.delivery.sheets.plan.sheet_rows[1][0] = "BP-000042"; reseal(f); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "needs_research",
      reasons: ["research_adapter_sheet_identity_missing"] });
    expect(f.records("intake").find(item => item.candidateKey === "publication")).toMatchObject({ state: "needs_research",
      reasons: ["research_adapter_sheet_identity_missing"] });
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("intake").some(item => item.state === "hypothesis_recorded")).toBe(false);
  });

  // The handoff schema trims its Sheets receipt and caps its length. A receipt it would
  // change can never verify again on the send path, so such a day is refused at intake.
  const expectDayRefused = (f: ReturnType<typeof setup>) => {
    expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "needs_research",
      reasons: ["research_adapter_sheet_identity_missing"] });
    expect(f.records("intake").find(item => item.candidateKey === "publication")).toMatchObject({ state: "needs_research",
      reasons: ["research_adapter_sheet_identity_missing"] });
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("briefs")).toHaveLength(0); expect(f.records("handoffs")).toHaveLength(0);
    expect(prospects(f)).toHaveLength(0); expect(f.records("intake").some(item => item.state === "hypothesis_recorded")).toBe(false);
  };
  it.each<[string, number, string]>([
    ["the last hypothesis row ID ends in a space", 1, "BP-000043 "],
    ["the last hypothesis row ID ends in a newline", 1, "BP-000043\n"],
    ["the last hypothesis row ID ends in a tab", 1, "BP-000043\t"],
    ["the last hypothesis row ID ends in a no-break space", 1, "BP-000043 "],
    ["the verified row ID ends in a space", 0, "BP-000042 "],
    ["the verified row ID starts with a newline", 0, "\nBP-000042"],
  ])("rejects the day when %s", async (_name, position, id) => {
    const f = setup({ publicContact: true, outreachReady: "published" });
    f.snapshot.row.delivery.sheets.plan.sheet_rows[position][0] = id; reseal(f); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expectDayRefused(f);
  });

  const appendRows = (f: ReturnType<typeof setup>, until: (rows: any[][]) => boolean) => {
    const rows = f.snapshot.row.delivery.sheets.plan.sheet_rows;
    // Copies of the hypothesis row with fresh IDs: the hypotheses block's to check, not the day's.
    while (!until(rows) && rows.length < 1000) rows.push(rows[1].map((cell: string, column: number) => column === 0 ? `BP-${String(42 + rows.length).padStart(6, "0")}` : cell));
    expect(until(rows)).toBe(true);
    reseal(f);
  };
  it("admits the verified row on a 200-row day, and its handoff keeps the whole receipt", async () => {
    const f = setup({ publicContact: true, outreachReady: "published" });
    appendRows(f, rows => rows.length === 200); await f.workItem();
    const receipt = f.snapshot.row.delivery.sheets.receipt.reference;
    expect(receipt.length).toBeGreaterThan(1200);
    await runCommunicationsIntake(f.deps);
    expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "admitted" });
    const [brief] = f.records("briefs"), [handoff] = f.records("handoffs");
    expect(handoff.sheetsReceipt).toBe(receipt);
    expect(communicationsHandoffSchema.parse(handoff).sheetsReceipt).toBe(receipt);
    expect(verifyPublishedResearch(f.snapshot, brief, handoff).briefDigest).toBe(communicationsDigest(brief));
    expect(f.records("intake").find(item => item.candidateKey === "hypotheses")).toMatchObject({ state: "needs_research",
      reasons: ["research_hypothesis_block_invalid:sheet_rows"] });
  });

  it("rejects the day when its Sheets receipt is longer than the handoff can hold", async () => {
    const f = setup({ publicContact: true, outreachReady: "published" });
    const sheetId = f.snapshot.row.packet.destinations.sheet_id;
    appendRows(f, rows => `sheets:${sheetId}:Prospects:${rows.map(entry => entry[0]).join(",")}`.length > SHEETS_RECEIPT_MAX_LENGTH);
    await f.workItem();
    // One row past the limit: every row adds 10 characters.
    const length = f.snapshot.row.delivery.sheets.receipt.reference.length;
    expect(length).toBeGreaterThan(SHEETS_RECEIPT_MAX_LENGTH); expect(length).toBeLessThanOrEqual(SHEETS_RECEIPT_MAX_LENGTH + 10);
    await runCommunicationsIntake(f.deps);
    expectDayRefused(f);
  });

  it("still rejects the day when no Sheets row matches the verified candidate, even with hypotheses declared", async () => {
    // The hypothesis row must never stand in for a verified row it does not match.
    const f = setup({ publicContact: true, outreachReady: "published" });
    f.snapshot.row.delivery.sheets.plan.sheet_rows[0][1] = "Another synthetic organization"; reseal(f); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "needs_research",
      reasons: ["research_adapter_sheet_identity_missing"] });
    expect(f.records("intake").find(item => item.candidateKey === "publication")).toMatchObject({ state: "needs_research",
      reasons: ["research_adapter_sheet_identity_missing"] });
    expect(f.records("jobs")).toHaveLength(0); expect(prospects(f)).toHaveLength(0);
  });

  it("admits the verified rows before recording hypotheses, so a recording failure never holds them", async () => {
    const f = setup({ publicContact: true, outreachReady: "published" }); await f.workItem();
    const recording = vi.spyOn(research, "researchPublicationHypotheses").mockImplementation(() => {
      throw new Error("research_hypothesis_store_unavailable");
    });
    try {
      await runCommunicationsIntake(f.deps);
      expect(recording).toHaveBeenCalledOnce();
      expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "admitted" });
      expect(f.records("jobs")).toHaveLength(1);
      expect(f.records("intake").find(item => item.candidateKey === "publication")).toMatchObject({ state: "needs_research",
        reasons: ["research_hypothesis_store_unavailable"] });
    } finally { recording.mockRestore(); }
  });

  it.each<[string, Parameters<typeof publishedResearchFixture>[0], string[], string]>([
    ["S while the site link is open", { mutateHypothesisAssessment: assessment => { assessment.claims.site_task.status = "inference"; } },
      ["site_link", "manual_workflow", "existing_automation", "fit", "interest"], ask.S],
    ["M while the manual workflow is open", {}, ["manual_workflow", "existing_automation", "fit", "interest"], ask.M],
    ["U once the manual workflow is verified and no automation is shown", { mutateHypothesisAssessment: assessment => {
      assessment.claims.human_workflow = { ...assessment.claims.site_task }; assessment.claims.plausible_fit.status = "unresolved"; } },
      ["existing_automation", "fit", "interest"], ask.U],
    ["A once the manual workflow is verified and automation is shown", { mutateHypothesisAssessment: assessment => {
      assessment.claims.human_workflow = { ...assessment.claims.site_task }; assessment.claims.plausible_fit.status = "unresolved";
      assessment.counterevidence.status = "contradicted"; } },
      ["existing_automation", "fit", "interest"], ask.A],
    ["v1.1's M for a day published under v1.1", { ruleVersion: LEGACY_OUTREACH_RULE_VERSION },
      ["manual_workflow", "existing_automation", "fit", "interest"], askV11.M],
    ["v1.1's A for a day published under v1.1", { ruleVersion: LEGACY_OUTREACH_RULE_VERSION, mutateHypothesisAssessment: assessment => {
      assessment.claims.human_workflow = { ...assessment.claims.site_task }; assessment.claims.plausible_fit.status = "unresolved"; } },
      ["existing_automation", "fit", "interest"], askV11.A],
  ])("records exactly one question: %s", async (_name, options, openChecks, question) => {
    const f = setup({ publicContact: true, outreachReady: "published", ...options }); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expect(f.records("intake").find(item => item.candidateKey === "candidate-1")).toMatchObject({ state: "admitted" });
    expect(f.records("intake").find(item => item.candidateKey === "candidate-2")).toMatchObject({ state: "hypothesis_recorded",
      openChecks, openQuestions: [question] });
    const plan = f.snapshot.row.delivery.sheets.plan;
    expect(plan.sheet_rows[1][12]).toBe(`First email asks: ${question}\n${plan.marker}`);
  });

  it("records an unknown expiry as null beside the freshness check", async () => {
    const f = setup({ publicContact: true, outreachReady: "published",
      mutateHypothesisAssessment: assessment => { assessment.valid_until = null; },
      mutateOutreachReady: eachEntry(entry => { entry.open_checks = ["manual_workflow", "freshness", "existing_automation", "fit", "interest"]; }) });
    await f.workItem(); await runCommunicationsIntake(f.deps);
    expect(f.records("intake").find(item => item.candidateKey === "candidate-2")).toMatchObject({ state: "hypothesis_recorded",
      validUntil: null, openChecks: ["manual_workflow", "freshness", "existing_automation", "fit", "interest"] });
  });

  it("records a day of hypotheses only, without a publication failure or any job", async () => {
    const f = setup({ publicContact: true, outreachReady: "published", acceptVerified: false }); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expect(f.records("intake")).toEqual([expect.objectContaining({ candidateKey: "candidate-2", state: "hypothesis_recorded",
      sheetsProspectId: "BP-000042", openQuestions: questions })]);
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("briefs")).toHaveLength(0);
    expect(f.records("refreshRequests")).toHaveLength(0); expect(prospects(f)).toHaveLength(0);
  });

  it("never sources, admits or verifies a hypothesis as a verified row", async () => {
    const f = setup({ publicContact: true, outreachReady: "published" });
    expect(() => researchPublicationSource(f.snapshot, origin(f, "candidate-2"))).toThrow("research_quality_review_missing");
    expect(await admitPublishedResearch(f.snapshot, "candidate-2", f.deps)).toMatchObject({ state: "needs_research" });
    expect(f.records("briefs")).toHaveLength(0); expect(f.records("jobs")).toHaveLength(0); expect(prospects(f)).toHaveLength(0);
  });

  it.each<[string, (payload: any) => void]>([
    ["a changed verified candidate list", payload => { payload.candidates = []; }],
    ["an unknown key beside the block", payload => { payload.approved = true; }],
  ])("still rejects %s next to a hypotheses block", (_name, tamper) => {
    const f = setup({ publicContact: true, outreachReady: "published" });
    expect(researchPublicationSource(f.snapshot, origin(f, "candidate-1")).sheetsProspectId).toBe("BP-000042");
    const delivery = f.snapshot.row.delivery.sheets;
    tamper(delivery.payload);
    delivery.payload_digest = delivery.receipt.payload_digest = researchDigest(delivery.payload);
    expect(() => researchPublicationSource(f.snapshot, origin(f, "candidate-1"))).toThrow("research_sheets_readback_missing");
    expect(() => researchPublicationHypotheses(f.snapshot)).toThrow("research_sheets_readback_missing");
  });

  it("keeps the exact Sheets row count on a day that declares no hypotheses", () => {
    const f = setup(), plan = f.snapshot.row.delivery.sheets.plan;
    plan.sheet_rows.push(plan.sheet_rows[0].map((cell: string, index: number) => index === 0 ? "BP-000043" : cell));
    plan.body_json = JSON.stringify({ majorDimension: "ROWS", values: plan.sheet_rows });
    plan.request_digest = createHash("sha256").update(plan.body_json).digest("hex");
    f.snapshot.row.delivery.sheets.receipt.reference += ",BP-000043";
    expect(() => researchPublicationSource(f.snapshot, origin(f, f.candidate.candidate_key))).toThrow("research_adapter_sheet_identity_missing");
  });
});
