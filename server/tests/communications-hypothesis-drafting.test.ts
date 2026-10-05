// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { HYPOTHESIS_DRAFTS_FLAG, runCommunicationsIntake } from "../agents/communications-intake";
import { processCommunicationsJob } from "../agents/communications-worker";
import { reviseCommunicationsDraft } from "../agents/communications-draft-revision";
import { CommunicationsStore } from "../agents/communications-store";
import { communicationsBriefSchema } from "../agents/communications-contract";
import { COMMUNICATIONS_HYPOTHESIS_GUIDANCE, COMMUNICATIONS_OUTREACH_GUIDANCE } from "../agents/communications-instructions";
import { COMMUNICATIONS_HYPOTHESIS_PROFILE } from "../agents/communications-saved-agent";
import { hypothesisDraft, hypothesisSetup } from "./fixtures/hypothesis";

// Invented operators, *.example hosts and synthetic evidence only. The model is a mock; no network or mailbox.
afterEach(() => { vi.unstubAllEnvs(); });

async function admitted(options: Parameters<typeof hypothesisSetup>[0] = {}) {
  vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
  const f = hypothesisSetup(options);
  await f.workItem(); await runCommunicationsIntake(f.deps);
  const intake = f.hypothesisIntake();
  const brief = communicationsBriefSchema.parse(f.records("briefs").find(item => item.briefId === intake.briefId));
  const verifiedJob = f.records("jobs").find(job => job.prospectId !== brief.prospectId);
  const store = new CommunicationsStore(f.db, f.deps.now, "drafting-owner");
  let output = hypothesisDraft(brief);
  const seen: { input: any; checkpoint: any; feedback: unknown }[] = [];
  const api = { run: vi.fn(async (params: any) => {
    seen.push({ input: JSON.parse(params.input), checkpoint: structuredClone(params.checkpoint), feedback: await params.validateOutput?.(output) });
    return { output, checkpoint: params.checkpoint, usage: { input_tokens: 1 } };
  }), cancel: vi.fn(async () => true), reconcileSaved: vi.fn(async () => null as any) };
  const deps = { ...f.deps, store, api, verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn(async () => ({ persisted: true })) };
  return { f, intake, brief, verifiedJob, store, api, deps, seen, setOutput: (value: typeof output) => { output = value; } };
}

describe("drafting v2 for outreach-ready hypotheses (synthetic)", () => {
  it("drafts with the hypothesis guidance and session profile, to a human-review draft that never sends", async () => {
    const h = await admitted();
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(h.api.run).toHaveBeenCalledOnce();
    const [{ input, checkpoint, feedback }] = h.seen;
    expect(input.firstTouchPolicy).toBe(COMMUNICATIONS_HYPOTHESIS_GUIDANCE);
    expect(input.researchBrief.qualification.openQuestions).toEqual(h.brief.qualification!.openQuestions);
    expect(checkpoint.draftProfile).toBe(COMMUNICATIONS_HYPOTHESIS_PROFILE);
    expect(feedback).toBeNull();
    const ledger = h.f.db.records.get(`action_ledger/${result.ledgerId}`);
    expect(ledger).toMatchObject({ status: "pending_approval", action_tier: 3, approved_by: null, sent_at: null,
      qualification_tier: "outreach_ready", send_authority: "none", approval_reason: "outreach_ready_hypothesis_draft_only" });
    expect(ledger).not.toHaveProperty("first_contact_authority");
    expect(ledger.action_payload.communications.brief.qualification).toEqual(h.brief.qualification);
  });

  it("keeps a hypothesis draft draft-only through a founder's revision", async () => {
    const h = await admitted();
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint Robotics, Inc. · 1 Synthetic Road, Testville, TX 75001");
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    h.f.advance(181000); // The drafting worker's lease has ended.
    const job = h.f.records("jobs").find(item => item.jobId === h.intake.jobId);
    const revised = { ...job.output, subject: "About sorting returned parcels at your site" };
    const saved = await reviseCommunicationsDraft(h.f.db, result.ledgerId, "Synthetic Operator 1",
      { expectedReviewDigest: job.reviewDigest, output: revised }, h.f.deps.now());
    expect(saved).toMatchObject({ state: "pending_approval", sent: false, review: { hardChecksPassed: true } });
    expect(h.f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ status: "pending_approval",
      qualification_tier: "outreach_ready", send_authority: "none", approval_reason: "outreach_ready_hypothesis_draft_only" });
    // A revision that breaks blueprint.outreach.v2 is kept for repair but stays draft only and fails review.
    const broken = { ...revised, body: `${revised.body}\n\nIs this the right inbox?` };
    const again = await reviseCommunicationsDraft(h.f.db, result.ledgerId, "Synthetic Operator 1",
      { expectedReviewDigest: saved.review.digest, output: broken }, h.f.deps.now());
    expect(again.review).toMatchObject({ hardChecksPassed: false, blockers: expect.arrayContaining(["exactly_one_initial_question_required"]) });
    expect(h.f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ approval_reason: "outreach_ready_hypothesis_draft_only",
      send_authority: "none" });
  });

  it("keeps verified drafting unchanged on the same day", async () => {
    const h = await admitted();
    // The verified row's own v1 draft, as the phase-1 intake test writes it.
    const verifiedBrief = communicationsBriefSchema.parse(h.f.records("briefs").find(item => item.briefId === h.verifiedJob.briefId));
    const output = structuredClone(h.f.output);
    output.usedFactIds = [verifiedBrief.facts[0].id];
    output.body = output.body.replace((output.outreachContract as any).question, verifiedBrief.contact.learningQuestion);
    (output.outreachContract as any).question = verifiedBrief.contact.learningQuestion;
    h.setOutput(output);
    const outcome = await processCommunicationsJob(h.verifiedJob.jobId, h.deps);
    expect(outcome).toMatchObject({ state: "pending_approval" });
    const [{ input, checkpoint }] = h.seen;
    expect(input.firstTouchPolicy).toBe(COMMUNICATIONS_OUTREACH_GUIDANCE);
    expect(input.researchBrief).not.toHaveProperty("qualification");
    expect(checkpoint).not.toHaveProperty("draftProfile");
    const ledger = h.f.db.records.get(`action_ledger/communications_${h.verifiedJob.jobId}`);
    expect(ledger).toMatchObject({ status: "pending_approval", approval_reason: "requires_human_review" });
    expect(ledger).not.toHaveProperty("qualification_tier");
    expect(ledger).not.toHaveProperty("send_authority");
  });

  it("never applies automatic first contact to a hypothesis, even with every automation flag on", async () => {
    const h = await admitted();
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint Robotics, Inc. · 1 Synthetic Road, Testville, TX 75001");
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result).toMatchObject({ state: "pending_approval", sent: false });
    const job = h.f.records("jobs").find(item => item.jobId === h.intake.jobId);
    expect(job).not.toHaveProperty("automationPolicyVersion");
    expect(h.f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ status: "pending_approval", auto_approve_reason: null });
  });

  it("gives the writer repairable feedback for blueprint.outreach.v2 issues", async () => {
    const h = await admitted();
    const draft = hypothesisDraft(h.brief);
    h.setOutput({ ...draft, body: `${draft.body}\n\nAre you the right person to ask?` });
    await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(h.seen[0].feedback).toEqual(expect.arrayContaining([expect.objectContaining({ code: "exactly_one_initial_question_required",
      path: "outreachContract.questions" })]));
  });

  it.each<[string, (draft: ReturnType<typeof hypothesisDraft>) => ReturnType<typeof hypothesisDraft>, string]>([
    ["a second question", draft => ({ ...draft, body: `${draft.body}\n\nAre you the right person to ask?` }), "exactly_one_initial_question_required"],
    ["a reworded question", draft => {
      const question = "Is sorting returned parcels at Synthetic sorting site still done by hand?";
      return { ...draft, body: draft.body.replace((draft.outreachContract as any).questions[0].question, question),
        outreachContract: { ...(draft.outreachContract as any), questions: [{ question, checks: ["manual_workflow"] }] } };
    }, "hypothesis_question_not_published"],
    ["the verified-lead contract", draft => ({ ...draft, outreachContract: null }), "outreach_contract_missing_or_invalid"],
  ])("rejects a final draft with %s: no ledger row, nothing copied or sent", async (_name, change, blocker) => {
    const h = await admitted();
    h.setOutput(change(hypothesisDraft(h.brief)));
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/^hypothesis_draft_contract_failed:|^communications_context_not_repairable:/);
    expect(result.reason).toContain(blocker);
    expect([...h.f.db.records.keys()].some(key => key.startsWith("action_ledger/"))).toBe(false);
  });

  it("stops before inference when the published hypothesis no longer verifies", async () => {
    const h = await admitted();
    h.f.snapshot.row.review.lead_verification.tier_evidence.pages = 9;
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result).toMatchObject({ state: "blocked", reason: "outreach_ready_evidence_changed" });
    expect(h.api.run).not.toHaveBeenCalled();
  });
});
