// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { communicationsFixture, communicationsNow, memoryFirestore } from "./fixtures/communications";
import { communicationsDigest, communicationsDeliveryKey } from "../agents/communications-contract";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { reviseCommunicationsDraft } from "../agents/communications-draft-revision";
import { appendCommercialEmailFooter } from "../utils/email-suppression";
import { appendFirstContactFooter } from "../agents/communications-first-contact-footer";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, storageAdmin: null, default: {} }));

const SYNTHETIC_POSTAL_LINE = "Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000";
beforeEach(() => {
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", SYNTHETIC_POSTAL_LINE);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE", "false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
});
afterEach(() => vi.unstubAllEnvs());

function fixture(intent: "outreach" | "reply" = "outreach") {
  const { job, brief, handoff, output, thread } = communicationsFixture(intent);
  output.usedFactIds = ["unknown-fact"];
  output.body += " We guarantee a result.";
  const ledgerId = `communications_${job.jobId}`, ledgerPath = `action_ledger/${ledgerId}`;
  const jobPath = `blueprintCommunications/default/jobs/${job.jobId}`;
  const payload = { from: "nijel@tryblueprint.io", replyTo: "nijel@tryblueprint.io", to: brief.contact.email.toLowerCase(),
    emailTransport: "founder_gmail", subject: output.subject, body: output.body,
    transportBody: appendCommercialEmailFooter({ text: output.body, email: brief.contact.email, scope: "growth_campaign" }),
    outreachContext: brief.outreachContext, outreachContract: output.outreachContract,
    ...(thread ? { gmailThreadId: thread.threadId, inReplyTo: thread.messages[1].rfcMessageId } : {}),
    communications: { version: "blueprint.communications.v1", job, brief, output, thread, approvalState: "pending_approval" } };
  Object.assign(payload, { communicationsDraftDiagnostics: { blockers: ["used_fact_missing", "pressure_or_guarantee"] } });
  const ledger = { status: "pending_approval", action_type: "send_email", action_tier: 3, lane: "outbound_prospect",
    source_collection: "outboundProspects", source_doc_id: job.prospectId, action_payload: payload,
    draft_output: output, approved_by: null, approved_at: null, sent_at: null, execution_attempts: 0,
    outreach_semantic_review: { digest: "old" }, outreach_reviewed_by: "old-reviewer", created_at: new Date(communicationsNow - 1000) };
  const savedJob = { ...job, state: "pending_approval", ledgerId, output, reviewDigest: reviewCommunicationsPayload(payload, communicationsNow).digest,
    attempts: 2, checkpoint: { createClaimedAt: communicationsNow - 100, sessionId: "real-session", turnId: "real-turn" },
    usage: { chargedAmount: 0.0123 }, outputSource: { rawOutput: "ORIGINAL RAW BYTES", rawOutputSha256: "original-sha" } };
  const sourcePath = `outboundProspects/${job.prospectId}`;
  const db = memoryFirestore(new Map([
    [ledgerPath, ledger], [jobPath, savedJob], [sourcePath, { contactEmail: brief.contact.email, stage: "drafted", siteId: brief.siteId, taskId: brief.taskId,
      communications: { jobId: job.jobId, ledgerId, briefDigest: job.briefDigest, state: "pending_approval", draft: output } }],
    [`blueprintCommunications/default/briefs/${brief.briefId}`, brief],
    [`blueprintCommunications/default/handoffs/${job.briefDigest}`, handoff],
    [`blueprintCommunications/default/firstTouches/${communicationsDeliveryKey(job)}`, { jobId: job.jobId }],
  ]));
  const repaired = communicationsFixture(intent).output;
  const input = { expectedReviewDigest: savedJob.reviewDigest!, output: repaired };
  return { db, ledgerId, ledgerPath, jobPath, sourcePath, input, job, brief, payload, ledger, savedJob };
}

describe("authenticated draft revision", () => {
  it("repairs unsafe wording and unknown fact references without new inference, authority or delivery", async () => {
    const f = fixture(), oldJob = structuredClone(f.savedJob), oldSource = structuredClone(f.db.records.get(f.sourcePath));
    expect(reviewCommunicationsPayload(f.payload, communicationsNow).blockers).toEqual(expect.arrayContaining(["used_fact_missing", "pressure_or_guarantee"]));
    const result = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner@tryblueprint.io", f.input, communicationsNow);
    expect(result).toMatchObject({ state: "pending_approval", sent: false, modelSessionCreated: false, review: { hardChecksPassed: true } });
    const ledger = f.db.records.get(f.ledgerPath), job = f.db.records.get(f.jobPath), source = f.db.records.get(f.sourcePath);
    expect(ledger).toMatchObject({ status: "pending_approval", action_tier: 3, approved_by: null, approved_at: null, sent_at: null,
      outreach_semantic_review: null, outreach_reviewed_by: null, approval_reason: "requires_human_review" });
    expect(ledger.action_payload.body).toBe(f.input.output.body);
    expect(ledger.action_payload.communicationsDraftDiagnostics).toBeNull();
    expect(ledger.action_payload.transportBody).toBe(appendFirstContactFooter(f.input.output.body, f.brief.contact.email));
    expect(ledger.action_payload).toMatchObject({ commercialEmail: true, emailSuppressionScope: "growth_campaign" });
    expect(new URL(ledger.action_payload.unsubscribeUrl).searchParams.get("scope")).toBe("all");
    expect(job.checkpoint).toEqual(oldJob.checkpoint); expect(job.usage).toEqual(oldJob.usage);
    expect(job.attempts).toBe(2); expect(job.outputSource).toEqual(oldJob.outputSource);
    expect(source.communications.state).toBe(oldSource.communications.state);
    expect(source.communications.draftOrigin).toBe("authenticated_operator_revision");
    expect(f.db.records.get(`blueprintCommunications/default/briefs/${f.brief.briefId}`)).toEqual(f.brief);
    expect([...f.db.records.keys()].filter(path => path.includes("/firstTouches/")).length).toBe(1);
    expect([...f.db.records.keys()].some(path => path.includes("/sendReceipts/"))).toBe(false);
    const audit = f.db.records.get(`blueprintCommunications/default/draftRevisions/${result.revisionId}`);
    expect(audit).toMatchObject({ version: "blueprint.communications-draft-revision.v1", requestedBy: "owner@tryblueprint.io", previousOutput: f.savedJob.output,
      output: f.input.output, sent: false, modelSessionCreated: false });
    expect(audit.previousPayload).toEqual(f.payload);
    expect(audit.previousPayloadDigest).toBe(communicationsDigest(f.payload));
    expect(audit.footerPolicy).toBe("owner_configured_first_contact");
    expect(audit.previousDiagnostics.blockers).toContain("used_fact_missing");
  });

  it("repairs a legacy transport/footer mismatch only on an explicit save and retains its exact private history", async () => {
    const f = fixture(), ledger = f.db.records.get(f.ledgerPath);
    const previousPayload = structuredClone(ledger.action_payload);
    previousPayload.transportBody = previousPayload.transportBody.replace("/privacy", "/old-privacy");
    ledger.action_payload = previousPayload;
    const review = reviewCommunicationsPayload(previousPayload, communicationsNow);
    expect(review.blockers).toContain("transport_body_changed");
    const beforeJob = structuredClone(f.db.records.get(f.jobPath));
    const result = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, expectedReviewDigest: review.digest }, communicationsNow);
    expect(result).toMatchObject({ state: "pending_approval", sent: false, modelSessionCreated: false, review: { hardChecksPassed: true } });
    const audit = f.db.records.get(`blueprintCommunications/default/draftRevisions/${result.revisionId}`);
    expect(audit.previousPayload).toEqual(previousPayload);
    expect(audit.previousReview.blockers).toContain("transport_body_changed");
    expect(f.db.records.get(f.jobPath).outputSource).toEqual(beforeJob.outputSource);
    expect(f.db.records.get(f.jobPath).checkpoint).toEqual(beforeJob.checkpoint);
    expect(f.db.records.get(f.jobPath).usage).toEqual(beforeJob.usage);
    expect(f.db.records.get(f.ledgerPath).action_payload.transportBody).toBe(appendFirstContactFooter(f.input.output.body, f.brief.contact.email));
    expect(audit.previousPayload.transportBody).toBe(previousPayload.transportBody);
  });

  it("does not substitute a public or client postal address when approved server configuration is unavailable", async () => {
    const f = fixture(), before = structuredClone([...f.db.records]);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "");
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", f.input, communicationsNow))
      .rejects.toMatchObject({ status: 503, message: expect.stringContaining("approved outreach mailing footer is unavailable") });
    expect([...f.db.records]).toEqual(before);
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, postalLine: SYNTHETIC_POSTAL_LINE }, communicationsNow))
      .rejects.toMatchObject({ status: 400 });
    expect([...f.db.records]).toEqual(before);
  });

  it("preserves a reply footer without requiring first-contact postal configuration", async () => {
    const f = fixture("reply");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "");
    const result = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", f.input, communicationsNow);
    expect(result.review.hardChecksPassed).toBe(true);
    expect(f.db.records.get(f.ledgerPath).action_payload.transportBody.slice(f.input.output.body.length))
      .toBe(f.payload.transportBody.slice(f.payload.body.length));
    expect(f.db.records.get(`blueprintCommunications/default/draftRevisions/${result.revisionId}`).footerPolicy).toBe("preserve_reply_footer");
  });

  it("refreshes a changed approved footer on an explicit unchanged-text save while keeping acknowledgement retries harmless", async () => {
    const f = fixture(), ledger = f.db.records.get(f.ledgerPath);
    // Start with an already canonical footer and make a same-text revision,
    // leaving its pre/post review digest equal.
    ledger.action_payload.transportBody = appendFirstContactFooter(f.payload.body, f.brief.contact.email);
    const request = { expectedReviewDigest: reviewCommunicationsPayload(ledger.action_payload, communicationsNow).digest!, output: f.savedJob.output };
    const first = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", request, communicationsNow);
    expect(first.review.digest).toBe(request.expectedReviewDigest);
    expect(await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", request, communicationsNow + 1)).toEqual(first);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint Robotics, Inc. · Another synthetic test location, ZZ 00000");
    const second = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", request, communicationsNow + 2);
    expect(second.revisionId).not.toBe(first.revisionId);
    expect(second.review.digest).not.toBe(first.review.digest);
    expect(second.review.blockers).not.toContain("transport_body_changed");
    expect(f.db.records.get(f.ledgerPath).action_payload.transportBody).toBe(appendFirstContactFooter(f.payload.body, f.brief.contact.email));
    expect(await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", request, communicationsNow + 3)).toEqual(second);
    const audit = f.db.records.get(`blueprintCommunications/default/draftRevisions/${second.revisionId}`);
    expect(audit.previousPayload.transportBody).toContain(SYNTHETIC_POSTAL_LINE);
  });

  it("retains remaining diagnostics and allows a second repair rather than stranding the draft", async () => {
    const f = fixture();
    const first = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, output: { ...f.input.output, usedFactIds: ["unknown"] } }, communicationsNow);
    expect(first.review.blockers).toContain("used_fact_missing");
    expect(f.db.records.get(f.ledgerPath).action_payload.communicationsDraftDiagnostics.blockers).toEqual(first.review.blockers);
    const second = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, expectedReviewDigest: first.review.digest }, communicationsNow + 1);
    expect(second.review.hardChecksPassed).toBe(true);
    expect([...f.db.records.keys()].filter(path => path.includes("/draftRevisions/")).length).toBe(2);
  });

  it("deduplicates acknowledged saves and refuses stale concurrent edits", async () => {
    const f = fixture();
    const first = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", f.input, communicationsNow);
    expect(await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", f.input, communicationsNow + 1)).toEqual(first);
    const after = structuredClone([...f.db.records]);
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, output: { ...f.input.output, subject: "A different question" } }, communicationsNow)).rejects.toThrow("draft changed");
    expect([...f.db.records]).toEqual(after);
  });

  it("retains separate audit entries when an owner cycles between earlier draft versions", async () => {
    const f = fixture(), a = f.input.output, b = { ...a, subject: "Another wording" };
    let digest = f.input.expectedReviewDigest;
    const ids = [];
    for (const output of [a, b, a, b]) {
      const result = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { expectedReviewDigest: digest, output }, communicationsNow);
      ids.push(result.revisionId); digest = result.review.digest!;
    }
    expect(new Set(ids).size).toBe(4);
    expect([...f.db.records.keys()].filter(path => path.includes("/draftRevisions/")).length).toBe(4);
    expect(f.db.records.get(`blueprintCommunications/default/draftRevisions/${ids[3]}`).previousRevisionId).toBe(ids[2]);
  });

  it.each(["sent", "approved", "attempted", "unknown_ack", "auto_authority", "source_changed", "lease", "job_changed", "canonical_pointer_changed", "first_touch_changed"])("refuses edits with %s without changing any record", async kind => {
    const f = fixture();
    const ledger = f.db.records.get(f.ledgerPath), record = f.db.records.get(f.jobPath);
    if (kind === "sent") ledger.sent_at = new Date(communicationsNow);
    if (kind === "approved") ledger.approved_by = "owner";
    if (kind === "attempted") ledger.execution_attempts = 1;
    if (kind === "unknown_ack") f.db.records.set(`blueprintCommunications/default/sendReceipts/${communicationsDeliveryKey(f.job)}`, { state: "unknown" });
    if (kind === "auto_authority") ledger.first_contact_authority = { policy: "standing" };
    if (kind === "source_changed") f.db.records.get(f.sourcePath).contactEmail = "different@example.com";
    if (kind === "lease") record.lease = { until: communicationsNow + 1000 };
    if (kind === "job_changed") record.output.subject = "Changed canonical draft";
    if (kind === "canonical_pointer_changed") f.db.records.get(f.sourcePath).communications.jobId = "another-job";
    if (kind === "first_touch_changed") f.db.records.get(`blueprintCommunications/default/firstTouches/${communicationsDeliveryKey(f.job)}`).jobId = "another-job";
    const before = structuredClone([...f.db.records]);
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", f.input, communicationsNow)).rejects.toThrow();
    expect([...f.db.records]).toEqual(before);
  });

  it("rejects client authority and names invalid fields; harmless metadata stays inert in the audit", async () => {
    const f = fixture();
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "unknown-operator", f.input, communicationsNow)).rejects.toMatchObject({ status: 403 });
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, approved: true }, communicationsNow)).rejects.toMatchObject({ status: 400 });
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { expectedReviewDigest: f.input.expectedReviewDigest }, communicationsNow))
      .rejects.toMatchObject({ status: 400, issues: [expect.objectContaining({ path: ["output"] })] });
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, output: { ...f.input.output, requiresHumanReview: false } }, communicationsNow))
      .rejects.toMatchObject({ status: 400, issues: [expect.objectContaining({ path: "/requiresHumanReview" })] });
    const result = await reviseCommunicationsDraft(f.db, f.ledgerId, "owner", { ...f.input, output: { ...f.input.output, approved: true } }, communicationsNow);
    const audit = f.db.records.get(`blueprintCommunications/default/draftRevisions/${result.revisionId}`);
    expect(audit.submittedOutput.approved).toBe(true); expect(audit.normalizedMetadataPaths).toEqual(["/approved"]);
    expect(audit.output.approved).toBeUndefined(); expect(f.db.records.get(f.ledgerPath).approved_by).toBeNull();
    expect(communicationsDigest(f.db.records.get(f.jobPath).outputSource)).toBe(communicationsDigest(f.savedJob.outputSource));
  });
});
