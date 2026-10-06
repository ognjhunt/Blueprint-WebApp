// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { admitPublishedHypothesis, HYPOTHESIS_DRAFTS_FLAG, runCommunicationsContactRefresh, runCommunicationsIntake } from "../agents/communications-intake";
import { runCommunicationsFactRefresh } from "../agents/communications-fact-refresh";
import { hypothesisPublicationSource, verifyPublishedHypothesisForDraft, verifyPublishedResearch } from "../agents/communications-research";
import { COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsBriefSchema, communicationsDigest, OUTREACH_READY_OWNER_DECISION_REFERENCE, OUTREACH_READY_SEND_REFUSAL,
  verifyCommunicationsHandoff } from "../agents/communications-contract";
import { prospectResearchTier } from "../utils/outboundProspects";
import { LEGACY_OUTREACH_RULE_VERSION, leadIdentityKey, OUTREACH_RULE_VERSION, verificationDigest, type OutreachRuleVersion } from "../agents/lead-verification";
import { communicationsNow } from "./fixtures/communications";
import { publishedResearchFixture, TIER_SOURCES } from "./fixtures/published-research";
import { ADDRESS, hypothesisSetup as setup, prospects, QUESTION } from "./fixtures/hypothesis";

// Invented operators, *.example hosts and synthetic evidence only. No network, model or mailbox.
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
const HYPOTHESIS_KEY = publishedResearchFixture({ outreachReady: "published" }).hypothesis.candidate_key;

describe("outreach-ready hypothesis admission for drafting (offline, synthetic)", () => {
  it("records hypotheses only, with no contact research or prospect, while hypothesis drafts are off", async () => {
    const f = setup(); await f.workItem();
    await runCommunicationsIntake(f.deps);
    expect(f.hypothesisIntake()).toMatchObject({ state: "hypothesis_recorded", draftJobCreated: false, sendsAuthorized: false });
    expect(f.records("refreshRequests").some(item => item.candidateKey === f.hypothesis.candidate_key)).toBe(false);
    expect(prospects(f).some(item => item.researchPublicationId === "BP-000043")).toBe(false);
    expect(f.deps.readContactPage).not.toHaveBeenCalled();
  });

  it("admits nothing once hypothesis drafts are off, and puts a contact request claimed before that back to wait", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const resolution = await f.resolution();
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
    const before = structuredClone([...f.db.records.entries()]);
    await expect(admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, resolution)).rejects.toThrow("hypothesis_drafts_disabled");
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps))
      .toMatchObject({ state: "not_admitted", reasons: ["hypothesis_drafts_disabled"], draftJobCreated: false, sendsAuthorized: false });
    expect([...f.db.records.entries()]).toEqual(before);
    // The contact worker claimed a hypothesis request; drafts are turned off while it reads the operator's pages.
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const g = setup();
    expect(await admitPublishedHypothesis(g.snapshot, g.hypothesis.candidate_key, g.deps)).toMatchObject({ reasons: ["hypothesis_public_contact_missing"] });
    const read = g.deps.readContactPage.getMockImplementation()!;
    g.deps.readContactPage.mockImplementation(async (...args) => { vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false"); return read(...args); });
    const requestContactResearch = vi.fn(async () => true);
    await runCommunicationsContactRefresh({ ...g.deps, requestContactResearch });
    expect(g.deps.readContactPage).toHaveBeenCalled();
    expect(requestContactResearch).not.toHaveBeenCalled();
    expect(g.records("refreshRequests")).toEqual([expect.objectContaining({ kind: "public_contact_resolution", state: "pending", attempts: 0,
      lease: expect.objectContaining({ until: 0 }) })]);
    expect(g.hypothesisIntake()).toMatchObject({ state: "needs_research", reasons: ["hypothesis_public_contact_missing"] });
    for (const name of ["briefs", "jobs", "contactProofs"]) expect(g.records(name)).toHaveLength(0);
  });

  it("hands a missing contact to communications-owned contact research and never drafts without one", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const outcome: any = await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps);
    expect(outcome).toMatchObject({ state: "needs_research", label: "hypothesis", reasons: ["hypothesis_public_contact_missing"],
      eligibleForOutreach: false, draftJobCreated: false, sendsAuthorized: false, sent: false });
    expect(f.records("refreshRequests")).toEqual([expect.objectContaining({ candidateKey: f.hypothesis.candidate_key, label: "hypothesis",
      kind: "public_contact_resolution", owner: "blueprint-communications-agent", state: "pending" })]);
    for (const name of ["briefs", "handoffs", "jobs", "researchBindings"]) expect(f.records(name)).toHaveLength(0);
    expect(prospects(f)).toHaveLength(0);
  });

  it("admits a re-verified hypothesis once: one prospect, one brief with the qualification block and one queued draft job", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup(); await f.workItem();
    await runCommunicationsIntake(f.deps);
    const intake = f.hypothesisIntake();
    expect(intake).toMatchObject({ state: "admitted", label: "hypothesis", publishedTier: "outreach_ready", draftJobCreated: true,
      eligibleForOutreach: false, sendsAuthorized: false, sent: false, sessionCreated: false, gmailDraftCreated: false });
    const brief = communicationsBriefSchema.parse(f.records("briefs").find(item => item.briefId === intake.briefId));
    expect(brief.qualification).toEqual({ tier: "outreach_ready", label: "hypothesis",
      openChecks: ["manual_workflow", "existing_automation", "fit", "interest"], openQuestions: [QUESTION],
      ownerDecision: { reference: OUTREACH_READY_OWNER_DECISION_REFERENCE, direction: { uri: f.snapshot.row.outreach_ready.uri,
        generation: f.snapshot.row.outreach_ready.generation, sha256: f.snapshot.row.outreach_ready.direction_sha256 } }, sendsAuthorized: false });
    expect(brief.contact).toMatchObject({ email: ADDRESS, learningQuestion: QUESTION, sourceUrl: "https://hypothesis-operator.example/contact",
      recipient: { kind: "inbox", addressee: "whoever runs sorting returned parcels at Synthetic sorting site",
        person: { name: "Synthetic Person", role: "operations manager", sourceUrl: TIER_SOURCES.news.url } } });
    // The proven facts are the quotes the tier proved, at their sources, as dated background.
    expect(brief.facts.map(fact => [fact.claim, fact.sourceUrl, fact.evidenceClass, fact.assertionScope])).toEqual([
      [TIER_SOURCES.site.quote, TIER_SOURCES.site.url, "operator_stated", "as_of_background"],
      [TIER_SOURCES.task.quote, TIER_SOURCES.task.url, "operator_stated", "as_of_background"]]);
    expect(brief.outreachContext.observations).toEqual(brief.facts.map(fact => ({ claim: fact.claim, source: fact.sourceUrl })));
    expect(brief.researchOrigin).toMatchObject({ candidateKey: f.hypothesis.candidate_key, contactEvidenceKind: "public_source_resolution" });
    const handoff = f.records("handoffs").find(item => item.briefDigest === communicationsDigest(brief));
    expect(verifyCommunicationsHandoff(handoff, brief).sheetsReceipt).toBe(f.snapshot.row.delivery.sheets.receipt.reference);
    const prospect = prospects(f).find(item => item.id === brief.prospectId)!;
    expect(prospect).toMatchObject({ qualificationTier: "outreach_ready", stage: "drafted", contactEmail: ADDRESS, researchPublicationId: "BP-000043",
      communicationsContextReview: { briefId: brief.briefId, briefDigest: communicationsDigest(brief) } });
    expect(prospectResearchTier(prospect)).toBe("hypothesis");
    expect(f.records("jobs").filter(job => job.prospectId === brief.prospectId)).toEqual([expect.objectContaining({ state: "queued",
      intent: "outreach", briefDigest: communicationsDigest(brief) })]);
    // The strict send-path verification stays closed; the draft-only one accepts the brief.
    expect(() => verifyPublishedResearch(f.snapshot, brief, handoff)).toThrow(OUTREACH_READY_SEND_REFUSAL);
    const proof = f.records("contactProofs").find(item => communicationsDigest(item) === brief.researchOrigin.contactEvidenceDigest);
    expect(verifyPublishedHypothesisForDraft(f.snapshot, brief, handoff, proof, communicationsNow).briefDigest).toBe(communicationsDigest(brief));
    // Exact replay, and another tick, create nothing more; the replayed claim is settled by the admitted job.
    const replay = await f.resolution(), claimPath = `${COMMUNICATIONS_ROOT}/refreshRequests/${replay.requestId}`;
    const kept = () => [...f.db.records.entries()].filter(([key]) => !key.includes("/intakeState/") && key !== claimPath);
    const before = structuredClone(kept());
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, replay)).toMatchObject({ state: "admitted" });
    await runCommunicationsIntake(f.deps);
    expect(kept()).toEqual(before);
    expect(f.db.records.get(claimPath)).toMatchObject({ state: "resolved", jobId: intake.jobId, lease: { owner: replay.leaseOwner, until: 0 } });
  });

  it("keeps a pending hypothesis contact request for contact research across a stale-fact refresh pass", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ state: "needs_research" });
    const before = structuredClone(f.records("refreshRequests"));
    // The stale-fact worker runs first in every tick; it must not consume the contact request.
    await runCommunicationsFactRefresh(f.db, f.deps.readContactPage, f.deps.now);
    expect(f.records("refreshRequests")).toEqual(before);
    await runCommunicationsContactRefresh(f.deps);
    expect(f.hypothesisIntake()).toMatchObject({ state: "admitted", draftJobCreated: true });
  });

  it("claims each hypothesis once under concurrent admissions", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const resolution = await f.resolution();
    await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps);
    const outcomes = await Promise.all([1, 2, 3].map(() => admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, resolution)));
    expect(outcomes.every((outcome: any) => outcome.state === "admitted" && outcome.jobId === (outcomes[0] as any).jobId)).toBe(true);
    for (const name of ["briefs", "handoffs", "researchSources", "researchBindings", "jobs", "contactProofs", "firstTouches"]) {
      expect(f.records(name), name).toHaveLength(1);
    }
    expect(prospects(f)).toHaveLength(1);
    // An admission that lost the race settles the claim it held; it is never left running.
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/${resolution.requestId}`)).toMatchObject({ state: "resolved",
      jobId: (outcomes[0] as any).jobId, lease: { owner: resolution.leaseOwner, until: 0 } });
  });

  it("settles a claimed contact request when another pass already admitted or blocked the hypothesis", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup(); await f.workItem(); await runCommunicationsIntake(f.deps);
    const admitted = f.hypothesisIntake(), claim = await f.resolution();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, claim)).toMatchObject({ state: "admitted", jobId: admitted.jobId });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/${claim.requestId}`)).toMatchObject({ state: "resolved", jobId: admitted.jobId,
      lease: { owner: claim.leaseOwner, until: 0 } });
    const g = setup();
    await g.db.doc("outboundProspects/existing-prospect").set({ researchPublicationId: "BP-000043", contactEmail: "someone@another.example", stage: "drafted" });
    expect(await admitPublishedHypothesis(g.snapshot, g.hypothesis.candidate_key, g.deps)).toMatchObject({ state: "blocked" });
    const blockedClaim = await g.resolution();
    expect(await admitPublishedHypothesis(g.snapshot, g.hypothesis.candidate_key, g.deps, blockedClaim)).toMatchObject({ state: "blocked" });
    expect(g.db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/${blockedClaim.requestId}`)).toMatchObject({ state: "terminal",
      reason: "outreach_ready_candidate_already_known", lease: { owner: blockedClaim.leaseOwner, until: 0 } });
    expect(g.records("jobs")).toHaveLength(0);
  });

  it("closes a hypothesis's open contact request when it is blocked, so no contact work follows", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ reasons: ["hypothesis_public_contact_missing"] });
    await f.db.doc("outboundProspects/existing-prospect").set({ facilityName: f.hypothesis.organization, facilitySite: f.hypothesis.site,
      facilityAddress: f.hypothesis.location, hypothesisedTask: f.hypothesis.task, contactEmail: "someone@another.example", stage: "drafted" });
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ state: "blocked",
      reasons: ["outreach_ready_candidate_already_known"] });
    expect(f.records("refreshRequests")).toEqual([expect.objectContaining({ kind: "public_contact_resolution", state: "terminal",
      reason: "outreach_ready_candidate_already_known", lease: expect.objectContaining({ until: 0 }) })]);
    const requestContactResearch = vi.fn(async () => true);
    await runCommunicationsContactRefresh({ ...f.deps, requestContactResearch });
    expect(f.deps.readContactPage).not.toHaveBeenCalled();
    expect(requestContactResearch).not.toHaveBeenCalled();
    expect(f.records("refreshRequests")).toEqual([expect.objectContaining({ state: "terminal" })]);
  });

  it.each<[string, (f: ReturnType<typeof setup>) => Promise<void>, string]>([
    ["the same operator, site and task, before any page is read", async f => {
      await f.db.doc("outboundProspects/existing-prospect").set({ facilityName: f.hypothesis.organization, facilitySite: f.hypothesis.site,
        facilityAddress: f.hypothesis.location, hypothesisedTask: f.hypothesis.task, contactEmail: "someone@another.example", stage: "drafted" });
    }, "outreach_ready_candidate_already_known"],
    ["the contact address, once it is resolved", async f => {
      await f.db.doc("outboundProspects/existing-prospect").set({ facilityName: "Synthetic unrelated operator", contactEmail: ADDRESS, stage: "drafted" });
    }, "outreach_ready_recipient_already_known"],
  ])("blocks a candidate the CRM gained before contact research ran, with no contact research for it: %s", async (_name, seed, reason) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ reasons: ["hypothesis_public_contact_missing"] });
    await seed(f);
    const requestContactResearch = vi.fn(async () => true);
    await runCommunicationsContactRefresh({ ...f.deps, requestContactResearch });
    expect(requestContactResearch).not.toHaveBeenCalled();
    expect(f.hypothesisIntake()).toMatchObject({ state: "blocked", reasons: [reason], draftJobCreated: false });
    expect(f.records("refreshRequests")).toEqual([expect.objectContaining({ state: "terminal", reason, lease: expect.objectContaining({ until: 0 }) })]);
    for (const name of ["briefs", "jobs", "contactProofs"]) expect(f.records(name)).toHaveLength(0);
  });

  it("admits the verified row on the same day byte for byte whether hypothesis drafts are on or off", async () => {
    const run = async (enabled: boolean) => {
      vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, enabled ? "true" : "false");
      const f = setup(); await f.workItem(); await runCommunicationsIntake(f.deps);
      return { f, records: new Map([...f.db.records.entries()].filter(([key]) => !key.includes("/intakeState/"))) };
    };
    const off = await run(false), on = await run(true);
    const hypothesisIntake = on.f.hypothesisIntake().intakeId;
    for (const [key, value] of off.records) if (!key.endsWith(`/intake/${hypothesisIntake}`)) expect(on.records.get(key), key).toEqual(value);
    expect(on.f.records("jobs")).toHaveLength(2);
    expect(off.f.records("jobs")).toHaveLength(1);
  });

  it.each<[string, Parameters<typeof publishedResearchFixture>[0], string]>([
    ["a changed proving source in the published tier block", { mutateOutreachReady: block => {
      block.retained.outreach_ready.proving_sources[0].tool_result_sha256 = "f".repeat(64); } }, "outreach_ready_tier_mismatch"],
    ["a published tier block with no question", { mutateOutreachReady: block => { block.retained.outreach_ready.open_questions = []; } },
      "outreach_ready_tier_mismatch"],
    ["retained tier evidence that no longer matches", { mutateRow: row => { row.review.lead_verification.tier_evidence.pages = 3; } },
      "outreach_ready_evidence_changed"],
    ["a run without a frozen owner direction", { mutateRow: row => { delete row.outreach_ready; } }, "outreach_ready_direction_unusable"],
    ["a direction that authorizes sends", { mutateRow: row => { row.outreach_ready.sends_authorized = true; } }, "outreach_ready_direction_unusable"],
    ["a direction for another path", { mutateRow: row => { row.outreach_ready.paths = ["site_screen"]; } }, "outreach_ready_direction_unusable"],
    ["an expired direction", { mutateRow: row => { row.outreach_ready.valid_until = "2026-09-30T00:00:00+00:00"; } }, "outreach_ready_direction_expired"],
    // The tier is recomputed from the review's retained results and duplicate checks; both must be QA's own.
    ["a cohort member's retained assessment that QA did not record, re-sealed", { mutateRow: row => {
      const result = row.review.lead_verification.results.find((item: any) => item.candidate_key !== HYPOTHESIS_KEY);
      result.assessment = structuredClone(result.assessment);
      result.assessment.sources[0].publisher = "Synthetic publisher changed after QA";
      result.assessment_digest = verificationDigest(result.assessment);
    } }, "research_adapter_lead_verification_binding_missing"],
    ["duplicate checks that QA did not record", { mutateRow: row => {
      for (const check of Object.values<any>(row.review.lead_verification.duplicate_checks)) check.reason = "Synthetic reason changed after QA";
    } }, "research_adapter_lead_verification_binding_missing"],
    ["duplicate checks with a member missing", { mutateRow: row => {
      for (const key of Object.keys(row.review.lead_verification.duplicate_checks)) if (key !== HYPOTHESIS_KEY) delete row.review.lead_verification.duplicate_checks[key];
    } }, "research_adapter_lead_verification_binding_missing"],
  ])("sends %s to the research owner as needs_research, never a draft", async (_name, options, reason) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup(options);
    const outcome: any = await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps);
    expect(outcome).toMatchObject({ state: "needs_research", reasons: [reason], draftJobCreated: false, sendsAuthorized: false });
    expect(f.records("refreshRequests")).toEqual([expect.objectContaining({ owner: "blueprint-research-agent", kind: "research_owner_refresh",
      label: "hypothesis", reasons: [reason] })]);
    for (const name of ["briefs", "jobs"]) expect(f.records(name)).toHaveLength(0);
  });

  it("re-runs the phase-1 publication checks on the fresh snapshot before drafting", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const resolution = await f.resolution();
    // The hypothesis Sheets row no longer matches the published payload.
    f.snapshot.row.delivery.sheets.plan.sheet_rows[1][16] = "Verified";
    // Found with a contact resolution, it is the research owner's, as it is without one.
    for (const claim of [resolution, undefined]) {
      expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, claim))
        .toMatchObject({ state: "needs_research", reasons: [expect.stringMatching(/^research_/)] });
    }
    expect(f.records("refreshRequests").find(item => item.kind === "research_owner_refresh")).toMatchObject({ owner: "blueprint-research-agent",
      state: "pending" });
    expect(f.records("jobs")).toHaveLength(0);
  });

  it("refuses an expired assessment and lets unknown freshness through only while its facts are a week old or less", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const expired = setup();
    expired.advance(9 * 86400000);
    expect(await admitPublishedHypothesis(expired.snapshot, expired.hypothesis.candidate_key, expired.deps))
      .toMatchObject({ state: "needs_research", reasons: ["outreach_ready_assessment_expired"] });
    const unknown = setup({ mutateHypothesisAssessment: assessment => { assessment.valid_until = null; } });
    expect(hypothesisPublicationSource(unknown.snapshot, unknown.hypothesis.candidate_key, communicationsNow).entry.openChecks)
      .toEqual(["manual_workflow", "freshness", "existing_automation", "fit", "interest"]);
    const admitted: any = await admitPublishedHypothesis(unknown.snapshot, unknown.hypothesis.candidate_key, unknown.deps, await unknown.resolution());
    expect(admitted.state).toBe("admitted");
    const stale = setup({ mutateHypothesisAssessment: assessment => { assessment.valid_until = null; } });
    stale.advance(8 * 86400000);
    expect(await admitPublishedHypothesis(stale.snapshot, stale.hypothesis.candidate_key, stale.deps, await stale.resolution()))
      .toMatchObject({ state: "needs_research", reasons: [expect.stringMatching(/^research_adapter_review_required:stale_fact:/)] });
    expect(stale.records("jobs")).toHaveLength(0);
  });

  it("checks the proven facts' freshness before asking for a contact: stale facts go to the research owner", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup({ mutateHypothesisAssessment: assessment => { assessment.valid_until = null; } });
    f.advance(8 * 86400000);
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ state: "needs_research",
      reasons: [expect.stringMatching(/^research_adapter_review_required:stale_fact:/)] });
    expect(f.records("refreshRequests")).toEqual([expect.objectContaining({ owner: "blueprint-research-agent", kind: "research_owner_refresh",
      state: "pending" })]);
    expect(f.deps.readContactPage).not.toHaveBeenCalled();
  });

  it.each<[string, (f: ReturnType<typeof setup>) => void]>([
    ["before the contact worker runs", f => { f.advance(8 * 86400000); }],
    ["between the contact worker's own check and its admission", f => {
      // The proven facts were checked at 21:00 on Sep 30. Fresh by 30 seconds when the worker checks them, stale
      // by 30 seconds when it re-reads the snapshot for admission, all within the worker's lease.
      f.advance(7 * 86400000 - 2 * 3600000 - 30000);
      const read = f.deps.readResearch.getMockImplementation()!;
      let calls = 0;
      f.deps.readResearch.mockImplementation(async (...args) => { if (++calls === 2) f.advance(60000); return read(...args); });
    }],
  ])("routes a research failure found at contact time to the research owner, end to end: facts go stale %s", async (_name, age) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup({ mutateHypothesisAssessment: assessment => { assessment.valid_until = null; } });
    await f.workItem();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ reasons: ["hypothesis_public_contact_missing"] });
    age(f);
    const requestContactResearch = vi.fn(async () => true);
    const deps = { ...f.deps, requestContactResearch };
    await runCommunicationsContactRefresh(deps);
    expect(requestContactResearch).not.toHaveBeenCalled();
    expect(f.hypothesisIntake()).toMatchObject({ state: "needs_research", reasons: [expect.stringMatching(/^research_adapter_review_required:stale_fact:/)],
      draftJobCreated: false });
    const routed = { owner: "blueprint-research-agent", kind: "research_owner_refresh", state: "pending", lease: expect.objectContaining({ until: 0 }),
      reasons: [expect.stringMatching(/^research_adapter_review_required:stale_fact:/)] };
    const requests = () => f.records("refreshRequests").filter(item => item.candidateKey === f.hypothesis.candidate_key);
    expect(requests()).toEqual([expect.objectContaining(routed)]);
    for (const name of ["briefs", "jobs", "contactProofs"]) expect(f.records(name)).toHaveLength(0);
    // It stays with the research owner: contact research and the stale-fact worker leave it, and intake keeps it there.
    const reads = f.deps.readContactPage.mock.calls.length;
    f.advance(300001);
    await runCommunicationsContactRefresh(deps);
    await runCommunicationsFactRefresh(f.db, f.deps.readContactPage, f.deps.now);
    await runCommunicationsIntake(deps);
    expect(f.deps.readContactPage.mock.calls).toHaveLength(reads);
    expect(requests()).toEqual([expect.objectContaining(routed)]);
    expect(f.hypothesisIntake()).toMatchObject({ state: "needs_research", reasons: [expect.stringMatching(/^research_adapter_review_required:stale_fact:/)] });
  });

  it("asks for no contact research when another pass takes a hypothesis request over while contact research works on it", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ reasons: ["hypothesis_public_contact_missing"] });
    const [path] = [...f.db.records.keys()].filter(key => key.includes("/refreshRequests/"));
    const read = f.deps.readContactPage.getMockImplementation()!;
    let taken = false;
    f.deps.readContactPage.mockImplementation(async (...args) => {
      if (!taken) {
        taken = true;
        await f.db.doc(path).set({ owner: "blueprint-research-agent", kind: "research_owner_refresh", state: "pending",
          reasons: ["outreach_ready_crm_check_incomplete"], lease: { owner: null, until: 0 } }, { merge: true });
      }
      return read(...args);
    });
    const requestContactResearch = vi.fn(async () => true);
    await runCommunicationsContactRefresh({ ...f.deps, requestContactResearch });
    expect(requestContactResearch).not.toHaveBeenCalled();
    expect(f.db.records.get(path)).toMatchObject({ owner: "blueprint-research-agent", kind: "research_owner_refresh", state: "pending" });
    for (const name of ["briefs", "jobs"]) expect(f.records(name)).toHaveLength(0);
  });

  it("moves a terminal contact request to the research owner when a later pass finds a research problem", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup({ mutateHypothesisAssessment: assessment => { assessment.valid_until = null; } });
    await f.workItem();
    f.setContactBody("<p>Synthetic hypothesis operator: no address is published here.</p>");
    await runCommunicationsIntake(f.deps);
    expect(f.records("refreshRequests").find(item => item.candidateKey === f.hypothesis.candidate_key))
      .toMatchObject({ kind: "public_contact_resolution", state: "terminal" });
    f.advance(8 * 86400000);
    // The intake cursor wraps after an empty page, so the second pass reads the day again.
    await runCommunicationsIntake(f.deps); await runCommunicationsIntake(f.deps);
    expect(f.hypothesisIntake()).toMatchObject({ state: "needs_research", reasons: [expect.stringMatching(/^research_adapter_review_required:stale_fact:/)] });
    expect(f.records("refreshRequests").find(item => item.candidateKey === f.hypothesis.candidate_key)).toMatchObject({
      owner: "blueprint-research-agent", kind: "research_owner_refresh", state: "pending" });
  });

  it.each<[string, (f: ReturnType<typeof setup>) => Promise<void>, string]>([
    ["a canonical prospect for the same operator, site and task", async f => {
      await f.db.doc("outboundProspects/existing-prospect").set({ facilityName: f.hypothesis.organization, facilitySite: f.hypothesis.site,
        facilityAddress: f.hypothesis.location, hypothesisedTask: f.hypothesis.task, contactEmail: "someone@another.example", stage: "drafted" });
    }, "outreach_ready_candidate_already_known"],
    ["a prospect already bound to the hypothesis Sheets row", async f => {
      await f.db.doc("outboundProspects/existing-prospect").set({ researchPublicationId: "BP-000043", contactEmail: "someone@another.example", stage: "drafted" });
    }, "outreach_ready_candidate_already_known"],
    ["a prospect that already holds the contact address", async f => {
      await f.db.doc("outboundProspects/existing-prospect").set({ facilityName: "Synthetic unrelated operator", contactEmail: ADDRESS, stage: "drafted" });
    }, "outreach_ready_recipient_already_known"],
  ])("blocks a candidate already in the CRM: %s", async (_name, seed, reason) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const resolution = await f.resolution();
    await seed(f);
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, resolution)).toMatchObject({ state: "blocked", reasons: [reason] });
    // Blocked is terminal for the hypothesis: a later pass, with or without a contact, keeps it.
    expect(f.hypothesisIntake()).toMatchObject({ state: "blocked", reasons: [reason], draftJobCreated: false, sendsAuthorized: false });
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ state: "blocked", reasons: [reason] });
    expect(f.records("jobs")).toHaveLength(0);
    expect(prospects(f).map(item => item.id)).toEqual(["existing-prospect"]);
  });

  it("rechecks the CRM inside the claiming transaction, so a prospect created after the first check still blocks", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const resolution = await f.resolution();
    // Another writer adds a prospect for the same address while this admission is between its checks and its claim.
    const original = f.db.runTransaction;
    f.db.runTransaction = async (fn: any) => {
      if (!f.db.records.has("outboundProspects/racing-prospect")) {
        await f.db.doc("outboundProspects/racing-prospect").set({ facilityName: "Synthetic unrelated operator", contactEmail: ADDRESS, stage: "drafted" });
      }
      return original(fn);
    };
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, resolution))
      .toMatchObject({ state: "blocked", reasons: ["outreach_ready_recipient_already_known"] });
    f.db.runTransaction = original;
    expect(f.records("jobs")).toHaveLength(0);
    expect(prospects(f).map(item => item.id)).toEqual(["racing-prospect"]);
  });

  it("blocks a suppressed recipient and stops at the draft-only verification when the brief or its proof changes", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const suppressed = setup();
    suppressed.deps.isSuppressed.mockResolvedValue(true);
    expect(await admitPublishedHypothesis(suppressed.snapshot, suppressed.hypothesis.candidate_key, suppressed.deps, await suppressed.resolution()))
      .toMatchObject({ state: "blocked", reasons: ["recipient_suppressed"] });
    expect(suppressed.hypothesisIntake()).toMatchObject({ state: "blocked", reasons: ["recipient_suppressed"] });
    const f = setup(); await f.workItem(); await runCommunicationsIntake(f.deps);
    const brief = communicationsBriefSchema.parse(f.records("briefs").find(item => item.qualification));
    const handoff = f.records("handoffs").find(item => item.briefDigest === communicationsDigest(brief));
    const proof = f.records("contactProofs")[0];
    const reseal = (changed: any) => [changed, { ...handoff, briefDigest: communicationsDigest(changed) }] as const;
    const changes: [string, (value: any) => void][] = [
      ["a different question", value => { value.qualification.openQuestions = ["What has kept the remaining sorting returned parcels work at Synthetic sorting site from being automated so far?"];
        value.qualification.openChecks = ["existing_automation", "fit", "interest"]; }],
      ["another owner direction", value => { value.qualification.ownerDecision.direction.generation = "2"; }],
      ["another recipient", value => { value.contact.recipient = { kind: "named_person", name: "Synthetic Person", role: "operations manager",
        sourceUrl: TIER_SOURCES.news.url }; }],
      ["an unproven fact", value => { value.facts[0].claim = "The operator says sorting is fully manual"; value.outreachContext.observations[0].claim = value.facts[0].claim; }],
    ];
    for (const [name, change] of changes) {
      const value = structuredClone(brief); change(value);
      const [changed, rehandoff] = reseal(value);
      expect(() => verifyPublishedHypothesisForDraft(f.snapshot, changed, rehandoff, proof, communicationsNow), name).toThrow();
    }
    expect(() => verifyPublishedHypothesisForDraft(f.snapshot, brief, handoff, { ...proof, addressIsPersonal: true }, communicationsNow)).toThrow();
    expect(() => verifyPublishedHypothesisForDraft(f.snapshot, { ...brief, qualification: undefined } as any, handoff, proof, communicationsNow))
      .toThrow("research_hypothesis_brief_required");
  });

  it("never rewrites an intake record that is not a hypothesis record", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup(); await f.workItem(); await runCommunicationsIntake(f.deps);
    const intake = f.hypothesisIntake(), path = `${COMMUNICATIONS_ROOT}/intake/${intake.intakeId}`;
    const foreign = { ...intake, label: undefined, state: "needs_research", reasons: ["verified_public_business_contact_missing"] };
    delete foreign.label;
    await f.db.doc(path).set(foreign);
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toEqual(foreign);
    expect(f.db.records.get(path)).toEqual(foreign);
  });

  it("keeps the identity of every admitted hypothesis on the prospect so every send guard reads it as a hypothesis", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup(); await f.workItem(); await runCommunicationsIntake(f.deps);
    const prospect = prospects(f).find(item => item.qualificationTier)!;
    expect(leadIdentityKey({ organization: prospect.facilityName, site: prospect.facilitySite, location: prospect.facilityAddress,
      task: prospect.hypothesisedTask })).toBe(leadIdentityKey(f.hypothesis));
    expect(prospect).toMatchObject({ qualificationTier: "outreach_ready", entityAdmission: "research_hypothesis", sendAuthority: "none" });
  });
});

// A row keeps the wording of the rule it was published under: v1.1 rows v1.1, v1.2 rows v1.2. Never mixed.
describe("outreach-ready rule versions in hypothesis admission (synthetic)", () => {
  const QUESTION_V11 = "Which parts of sorting returned parcels at Synthetic sorting site still need people, and what has kept them from being automated?";
  const everyEntry = (edit: (entry: any) => void) => (block: any) => { for (const entries of [block.sheets, block.notion]) entries.forEach(edit); };

  it.each<[string, OutreachRuleVersion, string]>([
    ["a v1.1 row with v1.1 wording", LEGACY_OUTREACH_RULE_VERSION, QUESTION_V11],
    ["a v1.2 row with v1.2 wording", OUTREACH_RULE_VERSION, QUESTION],
  ])("admits %s, and its draft-only verification accepts it", async (_name, ruleVersion, question) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup({ ruleVersion });
    expect(f.snapshot.row.review.lead_verification.outreach_rule_version).toBe(ruleVersion);
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, await f.resolution())).toMatchObject({ state: "admitted" });
    const brief = communicationsBriefSchema.parse(f.records("briefs")[0]);
    expect(brief.qualification!.openQuestions).toEqual([question]);
    expect(brief.contact.learningQuestion).toBe(question);
    const handoff = f.records("handoffs")[0], proof = f.records("contactProofs")[0];
    expect(verifyPublishedHypothesisForDraft(f.snapshot, brief, handoff, proof, communicationsNow).briefDigest).toBe(communicationsDigest(brief));
  });

  it.each<[string, Parameters<typeof publishedResearchFixture>[0], string]>([
    ["a v1.1 row published with v1.2 wording", { ruleVersion: LEGACY_OUTREACH_RULE_VERSION,
      mutateOutreachReady: everyEntry(entry => { entry.open_questions = [QUESTION]; }) }, "research_hypothesis_block_invalid:open_questions_0"],
    ["a v1.2 row published with v1.1 wording", { mutateOutreachReady: everyEntry(entry => { entry.open_questions = [QUESTION_V11]; }) },
      "research_hypothesis_block_invalid:open_questions_0"],
    ["a v1.2 cohort under a direction frozen at v1.1", { mutateRow: row => { row.outreach_ready.rule_version = LEGACY_OUTREACH_RULE_VERSION; } },
      "outreach_ready_rule_version_mismatch"],
    ["a v1.1 cohort under a direction frozen at v1.2", { ruleVersion: LEGACY_OUTREACH_RULE_VERSION,
      mutateRow: row => { row.outreach_ready.rule_version = OUTREACH_RULE_VERSION; } }, "outreach_ready_rule_version_mismatch"],
    ["a result block under another rule than its cohort", { mutateOutreachReady: block => {
      block.retained.outreach_ready.rule_version = LEGACY_OUTREACH_RULE_VERSION; } }, "outreach_ready_tier_mismatch"],
    ["a cohort under an unknown rule", { mutateRow: row => { row.review.lead_verification.outreach_rule_version = "blueprint.outreach-ready-rule.v1.3"; } },
      "research_hypothesis_block_invalid:outreach_rule_version"],
    ["a direction under an unknown rule", { mutateRow: row => { row.outreach_ready.rule_version = "blueprint.outreach-ready-rule.v1.3"; } },
      "outreach_ready_direction_unusable"],
  ])("refuses %s: the research owner gets it, and nothing is drafted", async (_name, options, reason) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup(options);
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ state: "needs_research",
      reasons: [reason], draftJobCreated: false, sendsAuthorized: false });
    for (const name of ["briefs", "jobs"]) expect(f.records(name)).toHaveLength(0);
    expect(prospects(f)).toHaveLength(0);
  });
});
