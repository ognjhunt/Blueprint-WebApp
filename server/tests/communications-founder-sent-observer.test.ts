// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const bindings = vi.hoisted(() => ({ db: null as any, snapshot: null as any }));
const directionStorage = vi.hoisted(() => ({ raw: "", generation: "1" }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return bindings.db; }, authAdmin: null, default: {} }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => ({ bucketName: "blueprint-8c1ca.appspot.com",
  info: async () => ({ generation: directionStorage.generation, size: Buffer.byteLength(directionStorage.raw) }),
  readText: async () => directionStorage.raw }) }));
vi.mock("../agents/communications-research", async original => ({ ...await original<any>(),
  readExistingResearchSnapshot: vi.fn(async () => bindings.snapshot) }));
vi.mock("../agents/communications-gmail", async original => ({ ...await original<any>(),
  sendFounderMessage: vi.fn(async () => { throw new Error("send_must_not_be_called"); }), hasFounderPriorContact: vi.fn(async () => false) }));
import { communicationsFixture, communicationsNow } from "./fixtures/communications";
import { extraVerifiedBinding, founderDirectionFixture, founderDirectionRef, founderDraftFixture } from "./fixtures/founder-sent";
import { communicationsDigest, communicationsDeliveryKey, founderDraftBindingIdentity, founderSentContentSha256,
  verifyFounderSendObservation } from "../agents/communications-contract";
import { configuredFounderSentObserverPorts, evaluateFounderSentThread, founderSentRepliesAllowed, runCommunicationsFounderSentObserver,
  FOUNDER_SENT_OBSERVER_FLAG, type FounderSentThread } from "../agents/communications-founder-sent-observer";
import { admitFounderSentCommunicationsReplies, runCommunicationsReplyIntake } from "../agents/communications-reply-intake";
import { communicationsSendBlocker, executeCommunicationsSend } from "../agents/communications-send";
import { mirrorCommunicationsGmailDraft } from "../agents/communications-gmail-draft";
import { reviseCommunicationsDraft } from "../agents/communications-draft-revision";
import { firstContactRecipientKey } from "../agents/communications-first-contact";
import { processCommunicationsJob, startCommunicationsQueueLoop } from "../agents/communications-worker";
import { CommunicationsStore } from "../agents/communications-store";
import { sendFounderMessage } from "../agents/communications-gmail";
import { saveFounderCredential, FOUNDER_STORAGE, FOUNDER_CREDENTIAL_COLLECTION } from "../agents/communications-oauth-store";
import { FOUNDER_CONNECTION_ID, type FounderCredential } from "../agents/communications-oauth";
import { FOUNDER_GMAIL_DRAFT_SCOPE, FOUNDER_GMAIL_READ_SCOPE } from "../agents/communications-connection";
import { encryptBoundFieldValue } from "../utils/field-encryption";

const SYNTHETIC_POSTAL_LINE = "Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000";
const HOUR = 3600000;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(communicationsNow); vi.clearAllMocks();
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", SYNTHETIC_POSTAL_LINE);
  vi.stubEnv(FOUNDER_SENT_OBSERVER_FLAG, "true");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN", "");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

function setup() {
  const f = founderDraftFixture(); bindings.db = f.db; bindings.snapshot = f.snapshot;
  const direction = founderDirectionFixture();
  const publish = (value: any = direction, generation = "1") => {
    directionStorage.raw = JSON.stringify(value); directionStorage.generation = generation;
    f.db.records.set(f.root, { ...(f.db.records.get(f.root) ?? {}), founderSentObservationDirection: founderDirectionRef(directionStorage.raw, generation) });
  };
  publish();
  let clock = communicationsNow;
  const thread: FounderSentThread = { threadId: f.threadId, messages: [structuredClone(f.sentMessage)] };
  const ports = { requireCapability: vi.fn(async () => undefined), verifyMailbox: vi.fn(async () => ({})),
    draftExists: vi.fn(async (_draftId: string) => false),
    readThread: vi.fn(async (_threadId: string): Promise<FounderSentThread | null> => structuredClone(thread)) };
  const run = () => runCommunicationsFounderSentObserver(f.db, { now: () => clock, ports });
  const paths = { observation: `${f.root}/founderSendObservations/${f.job.jobId}`, check: `${f.root}/founderSendChecks/${f.job.jobId}`,
    prospect: `outboundProspects/${f.job.prospectId}`, event: `outboundProspects/${f.job.prospectId}/communicationsEvents/founder_sent_${f.job.jobId}`,
    firstTouch: `${f.root}/recipientFirstTouches/${firstContactRecipientKey(f.payload.to)}`, ledger: `action_ledger/${f.ledgerId}`,
    binding: `${f.root}/gmailDraftBindings/${f.job.jobId}`, state: `${f.root}/intakeState/founderSentObserver` };
  const receipts = () => [...f.db.records.keys()].filter(path => path.includes("/sendReceipts/"));
  return { ...f, direction, publish, ports, thread, run, paths, receipts, advance: (ms: number) => { clock += ms; }, now: () => clock };
}

describe("founder-sent draft observation (all providers faked)", () => {
  it("keeps an unsent copy pending with capped backoff and never reads its thread", async () => {
    const f = setup(); f.ports.draftExists.mockResolvedValue(true);
    expect(await f.run()).toMatchObject({ state: "completed", outcomes: [{ jobId: f.job.jobId, state: "draft_present" }] });
    expect(f.ports.readThread).not.toHaveBeenCalled();
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "pending", reason: "draft_present", draftPresentChecks: 1, nextCheckAt: communicationsNow + 15 * 60000 });
    expect(await f.run()).toMatchObject({ outcomes: [{ state: "not_due" }] });
    expect(f.ports.draftExists).toHaveBeenCalledTimes(1);
    f.advance(15 * 60000); await f.run();
    expect(f.db.records.get(f.paths.check)).toMatchObject({ draftPresentChecks: 2, nextCheckAt: f.now() + 30 * 60000 });
    f.db.records.set(f.paths.check, { ...f.db.records.get(f.paths.check), draftPresentChecks: 40, nextCheckAt: 0 });
    await f.run();
    expect(f.db.records.get(f.paths.check)).toMatchObject({ draftPresentChecks: 41, nextCheckAt: f.now() + 24 * HOUR });
    expect(f.ports.readThread).not.toHaveBeenCalled(); expect(f.db.records.has(f.paths.observation)).toBe(false);
    expect(f.db.records.get(f.paths.prospect).stage).toBe("drafted"); expect(f.receipts()).toEqual([]);
  });

  it.each(["exact", "edited"])("records an %s founder send as hashes and ids only, without a receipt or approval", async kind => {
    const f = setup(), ledger = structuredClone(f.db.records.get(f.paths.ledger)), job = structuredClone(f.db.records.get(`${f.root}/jobs/${f.job.jobId}`));
    const sent = f.thread.messages[0];
    if (kind === "edited") sent.body = sent.body.replace("Is packing a relevant job to discuss?", "Would packing be worth a short call?");
    // Unsent drafts (even mislabelled SENT) and messages sent before the copy
    // existed are never evidence.
    f.thread.messages.push({ ...f.sentMessage, gmailMessageId: "later-unsent-draft", labelIds: ["DRAFT", "SENT"], internalDate: f.sentAt + 60000,
      rfcMessageIds: ["<later-unsent-draft@mail.gmail.example>"] });
    f.thread.messages.unshift({ ...f.sentMessage, gmailMessageId: "earlier-sent", internalDate: f.verifiedAt - 60000,
      rfcMessageIds: ["<earlier-sent@mail.gmail.example>"] });
    expect(await f.run()).toMatchObject({ state: "completed", outcomes: [{ jobId: f.job.jobId, state: "observed" }] });
    const saved = f.db.records.get(f.paths.observation), observation = verifyFounderSendObservation(saved);
    expect(observation).toMatchObject({ contentMatch: kind === "exact" ? "exact" : "differs_from_draft", sendsAuthorized: false, approvalGranted: false,
      recipientSuppressedAtObservation: false, ledgerId: f.ledgerId, payloadDigest: f.binding.content.payloadDigest, recipient: f.payload.to,
      deliveryKey: communicationsDeliveryKey(f.job), directionDigest: communicationsDigest(f.direction),
      gmailDraftBindingDigest: communicationsDigest(founderDraftBindingIdentity(f.binding)),
      sent: { gmailMessageId: "founder-sent-1", threadId: f.threadId, rfcMessageId: "<founder-sent-1@mail.gmail.example>",
        sentAt: new Date(f.sentAt).toISOString(), subjectSha256: founderSentContentSha256(f.payload.subject),
        bodySha256: founderSentContentSha256(sent.body), jobHeaderMatched: true, rfcMatchesDraft: false,
        additionalRecipients: false, matchBasis: "thread_origin" } });
    // Mailbox content stays in Gmail; only its hashes are retained.
    expect(JSON.stringify(saved)).not.toContain("relevant job to discuss"); expect(JSON.stringify(saved)).not.toContain("short call");
    expect(f.db.records.get(f.paths.prospect)).toMatchObject({ stage: "contacted", contactedAtIso: new Date(f.sentAt).toISOString() });
    expect(f.db.records.get(f.paths.event)).toMatchObject({ type: "founder_sent", trust: "founder_authored", observationDigest: observation.evidenceDigest,
      founderSentMessage: { gmailMessageId: "founder-sent-1", rfcMessageId: "<founder-sent-1@mail.gmail.example>" }, sendsAuthorized: false, approvalGranted: false });
    expect(f.db.records.get(f.paths.firstTouch)).toMatchObject({ jobId: f.job.jobId, origin: "founder_send_observed", founderSendObservationDigest: observation.evidenceDigest });
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "observed", observationDigest: observation.evidenceDigest });
    expect(f.db.records.get(f.paths.ledger)).toEqual(ledger); expect(f.db.records.get(`${f.root}/jobs/${f.job.jobId}`)).toEqual(job);
    expect(f.receipts()).toEqual([]);
    await f.run(); expect(f.ports.draftExists).toHaveBeenCalledTimes(1); expect(f.ports.readThread).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["redirected", (f: ReturnType<typeof setup>) => { f.thread.messages[0].to = ["someone-else@facility.example"]; }, "founder_sent_recipient_or_sender_changed"],
    ["alias-sent", (f: ReturnType<typeof setup>) => { f.thread.messages[0].from = ["hello@tryblueprint.io"]; }, "founder_sent_recipient_or_sender_changed"],
    ["oversized", (f: ReturnType<typeof setup>) => { for (let index = 0; index < 20; index++) f.thread.messages.unshift({ ...f.sentMessage,
      gmailMessageId: `older-${index}`, internalDate: f.verifiedAt - (index + 1) * 60000, rfcMessageIds: [`<older-${index}@mail.gmail.example>`] }); },
    "founder_sent_thread_context_limit_exceeded"],
  ])("never anchors a %s send and re-reads its thread only for opt-outs", async (_kind, change, reason) => {
    const f = setup(); change(f);
    expect(await f.run()).toMatchObject({ outcomes: [{ jobId: f.job.jobId, state: "requires_reconciliation", reason }] });
    expect(f.db.records.has(f.paths.observation)).toBe(false); expect(f.db.records.has(f.paths.event)).toBe(false);
    expect(f.db.records.has(f.paths.firstTouch)).toBe(false); expect(f.db.records.get(f.paths.prospect).stage).toBe("drafted");
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "requires_reconciliation", reason, optOutWatch: true, nextCheckAt: communicationsNow + 24 * HOUR });
    await f.run(); expect(f.ports.readThread).toHaveBeenCalledTimes(1);
    f.advance(24 * HOUR); expect(await f.run()).toMatchObject({ outcomes: [{ state: "requires_reconciliation", reason }] });
    expect(f.ports.draftExists).toHaveBeenCalledTimes(1); expect(f.ports.readThread).toHaveBeenCalledTimes(2);
    expect(f.db.records.has(f.paths.observation)).toBe(false);
  });

  it("anchors the earliest send in an outreach copy's own thread, allowing Cc/Bcc and later follow-ups", async () => {
    const f = setup();
    Object.assign(f.thread.messages[0], { cc: ["colleague@facility.example"], bcc: ["crm-dropbox@crm.example"] });
    f.thread.messages.push({ ...f.sentMessage, gmailMessageId: "founder-follow-up", internalDate: f.sentAt + HOUR, blueprintJobIds: [],
      rfcMessageIds: ["<founder-follow-up@mail.gmail.example>"], subject: "Re: Packing", body: "Following up on my note." });
    expect(await f.run()).toMatchObject({ outcomes: [{ jobId: f.job.jobId, state: "observed" }] });
    expect(verifyFounderSendObservation(f.db.records.get(f.paths.observation)).sent).toMatchObject({ gmailMessageId: "founder-sent-1",
      matchBasis: "thread_origin", additionalRecipients: true });
    // Copy addresses are a flag only; they are never retained.
    expect(JSON.stringify([...f.db.records.values()])).not.toContain("crm-dropbox@crm.example");
    expect(f.db.records.get(`${f.root}/founderSentMessages/founder-sent-1`)).toMatchObject({ jobId: f.job.jobId });
  });

  it("lets one Gmail message anchor only one Blueprint copy", async () => {
    const f = setup();
    expect(await f.run()).toMatchObject({ outcomes: [{ state: "observed" }] });
    const secondId = "9".repeat(64), second = structuredClone(f.binding);
    Object.assign(second, { jobId: secondId, ledgerId: `communications_${secondId}`, draftId: "r-synthetic-draft-2",
      content: { ...second.content, jobId: secondId }, receipt: { ...second.receipt, draftId: "r-synthetic-draft-2" } });
    f.db.records.set(`${f.root}/gmailDraftBindings/${secondId}`, second);
    f.db.records.set(`${f.root}/jobs/${secondId}`, { ...f.db.records.get(`${f.root}/jobs/${f.job.jobId}`), jobId: secondId, ledgerId: `communications_${secondId}` });
    expect((await f.run()).outcomes).toContainEqual({ jobId: secondId, state: "requires_reconciliation", reason: "founder_sent_message_already_anchored" });
    expect(f.db.records.has(`${f.root}/founderSendObservations/${secondId}`)).toBe(false);
    expect(f.db.records.get(`${f.root}/founderSentMessages/founder-sent-1`)).toMatchObject({ jobId: f.job.jobId });
  });

  it("persists a recipient opt-out from a copy thread that cannot anchor, then ends the watch", async () => {
    const f = setup(), suppress = vi.fn(async (_email: string, _reason: string) => ({ persisted: true }));
    const run = () => runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: f.ports, suppress });
    f.thread.messages[0].from = ["hello@tryblueprint.io"];
    expect(await run()).toMatchObject({ outcomes: [{ state: "requires_reconciliation", reason: "founder_sent_recipient_or_sender_changed" }] });
    expect(suppress).not.toHaveBeenCalled();
    f.thread.messages.push({ ...f.sentMessage, gmailMessageId: "recipient-opt-out", labelIds: ["INBOX"], from: [f.payload.to],
      to: ["hello@tryblueprint.io"], internalDate: f.sentAt + HOUR, rfcMessageIds: ["<opt-out@facility.example>"], blueprintJobIds: [],
      subject: "Re: Packing", body: "Please remove me from your list." });
    f.advance(24 * HOUR); await run();
    expect(suppress).toHaveBeenCalledWith(f.payload.to, "Founder-thread opt-out recipient-opt-out");
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "requires_reconciliation", optOutWatch: false, optOutSuppressedAt: f.now(), nextCheckAt: null });
    f.advance(48 * HOUR); await run(); expect(f.ports.readThread).toHaveBeenCalledTimes(2); expect(suppress).toHaveBeenCalledOnce();
  });

  it("retries a copy-thread opt-out until its suppression is durable", async () => {
    const f = setup(), suppress = vi.fn(async (_email: string, _reason: string) => ({ persisted: false }));
    f.thread.messages[0].from = ["hello@tryblueprint.io"];
    f.thread.messages.push({ ...f.sentMessage, gmailMessageId: "recipient-opt-out", labelIds: ["INBOX"], from: [f.payload.to],
      to: ["hello@tryblueprint.io"], internalDate: f.sentAt + HOUR, rfcMessageIds: ["<opt-out@facility.example>"], blueprintJobIds: [], body: "Unsubscribe" });
    expect(await runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: f.ports, suppress }))
      .toMatchObject({ outcomes: [{ state: "error", reason: "opt_out_suppression_not_persisted" }] });
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "pending", lastError: "opt_out_suppression_not_persisted" });
  });

  it.each([["system receipt", "system_send_owned", "founder_sent_system_receipt_exists"], ["malformed copy", "requires_reconciliation", "founder_sent_binding_invalid"]])(
    "settles a %s from Firestore alone, without any Gmail call", async (kind, state, reason) => {
      const f = setup();
      if (kind === "system receipt") f.db.records.set(`${f.root}/sendReceipts/${communicationsDeliveryKey(f.job)}`, { state: "unknown", jobId: f.job.jobId });
      else f.db.records.set(f.paths.binding, { ...f.binding, receipt: { ...f.binding.receipt, draftId: "other-draft" } });
      expect(await f.run()).toMatchObject({ outcomes: [{ jobId: f.job.jobId, state, reason }] });
      f.advance(48 * HOUR); await f.run();
      expect(f.ports.verifyMailbox).not.toHaveBeenCalled(); expect(f.ports.draftExists).not.toHaveBeenCalled();
      expect(f.ports.readThread).not.toHaveBeenCalled(); expect(f.db.records.has(f.paths.observation)).toBe(false);
    });

  it("treats a deleted copy as unsent only after three absent checks spanning a day", async () => {
    const f = setup();
    f.ports.readThread.mockResolvedValueOnce({ threadId: f.threadId, messages: [{ ...f.sentMessage, labelIds: ["DRAFT"] }] }).mockResolvedValue(null);
    await f.run();
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "pending", absentChecks: 1, firstAbsentAt: communicationsNow, nextCheckAt: communicationsNow + 12 * HOUR });
    await f.run(); expect(f.ports.draftExists).toHaveBeenCalledTimes(1);
    f.advance(12 * HOUR); await f.run(); expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "pending", absentChecks: 2 });
    f.advance(12 * HOUR); expect(await f.run()).toMatchObject({ outcomes: [{ state: "draft_absent_unsent" }] });
    f.advance(48 * HOUR); await f.run();
    expect(f.ports.draftExists).toHaveBeenCalledTimes(3); expect(f.db.records.has(f.paths.observation)).toBe(false);
    expect(f.db.records.get(f.paths.prospect).stage).toBe("drafted");
  });

  it("treats a concurrent replay of the same evidence as a no-op", async () => {
    const f = setup(), other = { ...f.ports, readThread: vi.fn(async () => structuredClone(f.thread)) };
    f.ports.readThread.mockImplementationOnce(async () => {
      expect(await runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: other })).toMatchObject({ outcomes: [{ state: "observed" }] });
      return structuredClone(f.thread);
    });
    expect(await f.run()).toMatchObject({ outcomes: [{ jobId: f.job.jobId, state: "existing" }] });
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "observed" });
    expect([...f.db.records.keys()].filter(path => path.includes("/founderSendObservations/") || path.includes("/communicationsEvents/founder_sent_"))).toHaveLength(2);
  });

  it("refuses different evidence for an already observed job without overwriting it", async () => {
    const f = setup(), first = { ...f.ports, readThread: vi.fn(async () => structuredClone(f.thread)) };
    const changed = structuredClone(f.thread);
    changed.messages[0] = { ...changed.messages[0], gmailMessageId: "different-sent-message", rfcMessageIds: ["<different-sent@mail.gmail.example>"] };
    f.ports.readThread.mockImplementationOnce(async () => {
      await runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: first });
      return changed;
    });
    const original = () => f.db.records.get(f.paths.observation);
    expect(await f.run()).toMatchObject({ outcomes: [{ state: "requires_reconciliation", reason: "founder_send_observation_changed" }] });
    expect(original().sent.gmailMessageId).toBe("founder-sent-1"); expect(verifyFounderSendObservation(original()).jobId).toBe(f.job.jobId);
    expect(f.db.records.get(f.paths.event).founderSentMessage.gmailMessageId).toBe("founder-sent-1");
  });

  it.each(["flag_off", "send_on", "automatic_on", "no_direction", "expired", "hash", "generation", "send_scope", "wrong_kind", "wrong_scope",
    "extra_field", "extra_binding_field", "lifetime"])(
    "fails closed before any Gmail call or write: %s", async gate => {
      const f = setup();
      if (gate === "flag_off") vi.stubEnv(FOUNDER_SENT_OBSERVER_FLAG, "false");
      if (gate === "send_on") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
      if (gate === "automatic_on") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
      if (gate === "no_direction") f.db.records.set(f.root, {});
      if (gate === "expired") f.publish({ ...f.direction, expiresAt: new Date(communicationsNow).toISOString() });
      if (gate === "hash") directionStorage.raw += " ";
      if (gate === "generation") directionStorage.generation = "2";
      if (gate === "send_scope") f.publish({ ...f.direction, scope: { ...f.direction.scope, sendsAuthorized: true } });
      if (gate === "wrong_kind") f.publish({ ...f.direction, direction: { ...f.direction.direction, kind: "direct_current_chat_human_reply" } });
      if (gate === "wrong_scope") f.publish({ ...f.direction, binding: { ...f.direction.binding, readScope: FOUNDER_GMAIL_DRAFT_SCOPE } });
      // A grant-shaped extra field is refused, not ignored, and so is an unbounded term.
      if (gate === "extra_field") f.publish({ ...f.direction, sendsAuthorized: true });
      if (gate === "extra_binding_field") f.publish({ ...f.direction, binding: { ...f.direction.binding, composeScope: FOUNDER_GMAIL_DRAFT_SCOPE } });
      if (gate === "lifetime") f.publish({ ...f.direction, expiresAt: "9999-12-31T00:00:00.000Z" });
      const before = structuredClone([...f.db.records]);
      const result = await f.run().catch((error: Error) => ({ state: "threw", reason: error.message }));
      expect(result).toMatchObject(["flag_off", "send_on", "automatic_on", "no_direction"].includes(gate)
        ? { state: "disabled" } : { state: "threw", reason: "founder_sent_direction_invalid" });
      for (const port of Object.values(f.ports)) expect(port).not.toHaveBeenCalled();
      expect([...f.db.records]).toEqual(before);
      expect(await founderSentRepliesAllowed(f.db, { now: f.now, requireCapability: f.ports.requireCapability })).toBe(false);
    });

  it("reads at most five verified copies per tick and visits every copy across ticks", async () => {
    const f = setup(); f.ports.draftExists.mockResolvedValue(true);
    for (let index = 0; index < 11; index++) {
      const extra = extraVerifiedBinding(index); f.db.records.set(`${f.root}/gmailDraftBindings/${extra.jobId}`, extra.binding);
      f.db.records.set(`${f.root}/jobs/${extra.jobId}`, extra.job);
    }
    const visited = new Set<string>(), perTick: number[] = [];
    for (let tick = 0; tick < 3; tick++) {
      f.ports.draftExists.mockClear();
      for (const outcome of (await f.run()).outcomes) visited.add(outcome.jobId);
      perTick.push(f.ports.draftExists.mock.calls.length);
    }
    expect(perTick).toEqual([5, 5, 2]); expect(visited.size).toBe(12);
    f.ports.draftExists.mockClear(); await f.run(); expect(f.ports.draftExists).not.toHaveBeenCalled();
    expect(f.ports.readThread).not.toHaveBeenCalled();
  });

  it("runs after bound-thread opt-out intake, inside its own failure boundary", async () => {
    const order: string[] = [];
    const deps: any = { store: { automaticJobs: vi.fn(async () => []), dueJobIds: vi.fn(async () => []) } };
    const stop = startCommunicationsQueueLoop(deps, { observeFounderSends: async () => { order.push("observe"); throw new Error("founder_sent_direction_invalid"); },
      intake: async () => { order.push("intake"); }, copyDrafts: async () => { order.push("copy"); }, processJobs: false });
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(order).toEqual(["intake", "observe", "copy"]);
  });
});

describe("durable founder read capability and the read-only Gmail adapter", () => {
  const readonlyCredential: FounderCredential = { version: "blueprint.founder-gmail-credential.v1", binding: FOUNDER_CONNECTION_ID,
    mailbox: "nijel@tryblueprint.io", clientId: "mock-client", refreshToken: "MOCK_PRIVATE_REFRESH", ownerUid: "mock-owner",
    approvalReference: "owner-decision-1", scopes: [FOUNDER_GMAIL_READ_SCOPE], consentedAt: 1000, grantMode: "durable_reviewed", usableUntil: null };
  function configureBinding() {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE", FOUNDER_STORAGE);
    vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", ""); vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID", "mock-owner"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID", "mock-client");
  }
  /** Fake googleapis client. Every mutation is a spy that must stay unused. */
  function fakeGmail(f: ReturnType<typeof setup>) {
    const part = (mimeType: string, text: string) => ({ mimeType, body: { data: Buffer.from(text).toString("base64url") } });
    const message = (id: string, labelIds: string[], internalDate: number, headers: [string, string][], body: string) => ({ id, threadId: f.threadId,
      labelIds, internalDate: String(internalDate), payload: { mimeType: "multipart/alternative", headers: headers.map(([name, value]) => ({ name, value })),
        parts: [part("text/plain", body), part("text/html", "<div>synthetic</div>")] } });
    const thread = { id: f.threadId, messages: [
      message("founder-sent-1", ["SENT"], f.sentAt, [["From", "Nijel Hunt <nijel@tryblueprint.io>"], ["To", f.payload.to],
        ["Subject", `=?UTF-8?B?${Buffer.from(f.payload.subject).toString("base64")}?=`], ["Message-ID", "<founder-sent-1@mail.gmail.example>"],
        ["X-Blueprint-Job-ID", f.job.jobId]], f.payload.transportBody),
      message("unsent-reply-draft", ["DRAFT"], f.sentAt + 60000, [["From", "nijel@tryblueprint.io"], ["To", f.payload.to],
        ["Subject", "Unsent"], ["Message-ID", "<unsent@mail.gmail.example>"]], "Unsent draft text"),
    ] };
    const notFound = () => Object.assign(new Error("Requested entity was not found."), { code: 404, response: { status: 404 } });
    const mutation = () => vi.fn(async () => { throw new Error("mutation_must_not_be_called"); });
    const api: any = { users: {
      getProfile: vi.fn(async () => ({ data: { emailAddress: "nijel@tryblueprint.io" } })),
      settings: { sendAs: { list: vi.fn(async () => ({ data: { sendAs: [{ sendAsEmail: "nijel@tryblueprint.io", isPrimary: true }] } })),
        create: mutation(), update: mutation(), patch: mutation(), delete: mutation() } },
      drafts: { get: vi.fn(async () => { throw notFound(); }), create: mutation(), update: mutation(), send: mutation(), delete: mutation() },
      threads: { get: vi.fn(async () => ({ data: thread })), modify: mutation(), trash: mutation(), untrash: mutation(), delete: mutation() },
      messages: { send: mutation(), insert: mutation(), import: mutation(), modify: mutation(), batchModify: mutation(), trash: mutation(),
        untrash: mutation(), delete: mutation(), batchDelete: mutation(), get: vi.fn(), list: vi.fn() },
      labels: { create: mutation(), update: mutation(), patch: mutation(), delete: mutation() },
    } };
    const mutations = () => [api.users.settings.sendAs.create, api.users.settings.sendAs.update, api.users.settings.sendAs.patch, api.users.settings.sendAs.delete,
      ...Object.values(api.users.messages), ...["create", "update", "send", "delete"].map(name => api.users.drafts[name]),
      ...["modify", "trash", "untrash", "delete"].map(name => api.users.threads[name]), ...Object.values(api.users.labels)] as any[];
    return { api, mutations };
  }

  it("observes through the real adapter with only read calls and never writes a receipt", async () => {
    const f = setup(); configureBinding(); await saveFounderCredential(readonlyCredential, "flow-1");
    const gmail = fakeGmail(f);
    expect(await runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: configuredFounderSentObserverPorts(gmail.api) }))
      .toMatchObject({ state: "completed", outcomes: [{ jobId: f.job.jobId, state: "observed" }] });
    expect(gmail.api.users.getProfile).toHaveBeenCalledOnce(); expect(gmail.api.users.settings.sendAs.list).toHaveBeenCalledOnce();
    expect(gmail.api.users.drafts.get).toHaveBeenCalledWith({ userId: "me", id: f.binding.draftId, format: "minimal" });
    expect(gmail.api.users.threads.get).toHaveBeenCalledWith({ userId: "me", id: f.threadId, format: "full" });
    for (const method of gmail.mutations()) expect(method).not.toHaveBeenCalled();
    const observation = verifyFounderSendObservation(f.db.records.get(f.paths.observation));
    expect(observation).toMatchObject({ contentMatch: "exact", sent: { subjectSha256: founderSentContentSha256(f.payload.subject),
      bodySha256: founderSentContentSha256(f.payload.transportBody), jobHeaderMatched: true } });
    expect(f.receipts()).toEqual([]);
    expect(JSON.stringify([...f.db.records.values()])).not.toContain("MOCK_PRIVATE_REFRESH");
  });

  it.each(["environment_token", "missing_readonly", "missing_binding"])("refuses %s before any Gmail call or write", async kind => {
    const f = setup(); configureBinding(); const gmail = fakeGmail(f);
    if (kind === "environment_token") {
      await saveFounderCredential(readonlyCredential, "flow-1"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN", "MOCK_ENVIRONMENT_TOKEN");
    }
    if (kind === "missing_readonly") {
      const row = { ...readonlyCredential, version: "blueprint.founder-gmail-credential.v3", scopes: [FOUNDER_GMAIL_DRAFT_SCOPE],
        consentPurpose: "draft_upgrade", upgradedFromFlowId: "flow-0", draftApprovalReference: "synthetic-compose-ref" };
      f.db.records.set(`${FOUNDER_CREDENTIAL_COLLECTION}/${FOUNDER_CONNECTION_ID}`, { flowId: "flow-1", ownerUid: "mock-owner", clientId: "mock-client",
        version: row.version, consentPurpose: row.consentPurpose, upgradedFromFlowId: row.upgradedFromFlowId, draftApprovalReference: row.draftApprovalReference,
        scopes: row.scopes, encrypted: await encryptBoundFieldValue(JSON.stringify(row), `${FOUNDER_CONNECTION_ID}:mock-owner:mock-client:flow-1`) });
    }
    const before = structuredClone([...f.db.records]);
    await expect(runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: configuredFounderSentObserverPorts(gmail.api) })).rejects.toThrow();
    expect(gmail.api.users.getProfile).not.toHaveBeenCalled(); expect(gmail.api.users.drafts.get).not.toHaveBeenCalled();
    expect(gmail.api.users.threads.get).not.toHaveBeenCalled(); expect([...f.db.records]).toEqual(before);
    expect(await founderSentRepliesAllowed(f.db, { now: f.now })).toBe(false);
  });

  it.each([["drafts.get", 403], ["getProfile", 401], ["threads.get", 403]] as const)("stops on %s HTTP %i and writes only the blocked state", async (method, status) => {
    const f = setup(); configureBinding(); await saveFounderCredential(readonlyCredential, "flow-1");
    const gmail = fakeGmail(f), denied = Object.assign(new Error("synthetic provider refusal"), { code: status, response: { status } });
    if (method === "drafts.get") gmail.api.users.drafts.get.mockRejectedValue(denied);
    if (method === "getProfile") gmail.api.users.getProfile.mockRejectedValue(denied);
    if (method === "threads.get") gmail.api.users.threads.get.mockRejectedValue(denied);
    const before = new Map(structuredClone([...f.db.records]));
    expect(await runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: configuredFounderSentObserverPorts(gmail.api) }))
      .toMatchObject({ state: "blocked", reason: `founder_sent_gmail_http_${status}` });
    const changed = [...f.db.records.keys()].filter(path => JSON.stringify(f.db.records.get(path)) !== JSON.stringify(before.get(path)));
    expect(changed).toEqual([f.paths.state]);
    expect(f.db.records.get(f.paths.state)).toEqual({ blocked: true, reason: `founder_sent_gmail_http_${status}`, blockedAt: communicationsNow,
      directionDigest: communicationsDigest(f.direction) });
    for (const mutation of gmail.mutations()) expect(mutation).not.toHaveBeenCalled();
  });

  it("pauses Gmail reads for an hour after an access denial, unless the owner direction changes", async () => {
    const f = setup(); configureBinding(); await saveFounderCredential(readonlyCredential, "flow-1");
    const gmail = fakeGmail(f), denied = Object.assign(new Error("synthetic provider refusal"), { code: 401, response: { status: 401 } });
    gmail.api.users.getProfile.mockRejectedValueOnce(denied);
    const run = () => runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: configuredFounderSentObserverPorts(gmail.api) });
    expect(await run()).toMatchObject({ state: "blocked", reason: "founder_sent_gmail_http_401" });
    f.advance(30 * 60000);
    expect(await run()).toEqual({ state: "blocked", reason: "founder_sent_gmail_http_401", outcomes: [] });
    expect(gmail.api.users.getProfile).toHaveBeenCalledOnce();
    f.publish({ ...f.direction, direction: { ...f.direction.direction, text: `${f.direction.direction.text} Renewed.` } }, "2");
    expect(await run()).toMatchObject({ state: "completed", outcomes: [{ state: "observed" }] });
    expect(f.db.records.get(f.paths.state)).toMatchObject({ blocked: false, reason: null, blockedAt: null });
  });

  it("times out a hung Gmail read without holding the tick", async () => {
    const f = setup(); configureBinding(); await saveFounderCredential(readonlyCredential, "flow-1");
    const gmail = fakeGmail(f); gmail.api.users.threads.get.mockImplementation(() => new Promise(() => undefined));
    const pending = runCommunicationsFounderSentObserver(f.db, { now: f.now, ports: configuredFounderSentObserverPorts(gmail.api) });
    await vi.advanceTimersByTimeAsync(30000);
    expect(await pending).toMatchObject({ state: "completed", outcomes: [{ state: "error", reason: "founder_sent_gmail_timeout" }] });
    expect(f.db.records.get(f.paths.check)).toMatchObject({ state: "pending", lastError: "founder_sent_gmail_timeout" });
  });
});

describe("reply-copy matching in a shared conversation thread", () => {
  function replyCase() {
    const f = setup();
    const own = { ...f.sentMessage, gmailMessageId: "founder-own-reply", subject: "Re: Packing", body: "My own words, not the copy.",
      blueprintJobIds: [], rfcMessageIds: ["<founder-own-reply@mail.gmail.example>"] };
    return { f, own, thread: (...messages: typeof own[]) => ({ threadId: f.threadId, messages }) };
  }
  it("refuses a founder-written reply that carries no link to the Blueprint copy", () => {
    const { f, own, thread } = replyCase();
    expect(evaluateFounderSentThread(thread(own), f.binding, "reply")).toEqual({ kind: "reconcile", reason: "founder_sent_reply_unlinked", threadVerified: true });
    // The same message in an outreach copy's own new thread is that copy, however edited.
    expect(evaluateFounderSentThread(thread(own), f.binding, "outreach")).toMatchObject({ kind: "match", basis: "thread_origin" });
  });
  it.each([
    ["job_header", (f: ReturnType<typeof setup>, own: any) => ({ ...own, blueprintJobIds: [f.job.jobId] })],
    ["rfc_message_id", (f: ReturnType<typeof setup>, own: any) => ({ ...own, rfcMessageIds: [f.binding.receipt.observedRfcMessageId] })],
    ["exact_content", (f: ReturnType<typeof setup>, own: any) => ({ ...own, subject: f.binding.content.subject, body: f.binding.content.body })],
  ])("anchors the one reply linked by %s among the founder's own replies", (basis, link) => {
    const { f, own, thread } = replyCase(), linked = { ...link(f, own), gmailMessageId: "linked-copy", internalDate: f.sentAt + HOUR };
    expect(evaluateFounderSentThread(thread(own, linked), f.binding, "reply")).toEqual({ kind: "match", message: linked, basis });
  });
  it("refuses two linked replies and a linked reply from another sender", () => {
    const { f, own, thread } = replyCase();
    const first = { ...own, blueprintJobIds: [f.job.jobId] }, second = { ...first, gmailMessageId: "second-copy", internalDate: f.sentAt + HOUR };
    expect(evaluateFounderSentThread(thread(first, second), f.binding, "reply")).toMatchObject({ kind: "reconcile", reason: "founder_sent_multiple_matches" });
    expect(evaluateFounderSentThread(thread({ ...first, from: ["hello@tryblueprint.io"] }), f.binding, "reply"))
      .toMatchObject({ kind: "reconcile", reason: "founder_sent_recipient_or_sender_changed" });
  });
});

describe("a reconciliation verdict fences every system send, Gmail copy and revision path", () => {
  async function reconciled() {
    const f = setup(); f.thread.messages[0].from = ["hello@tryblueprint.io"];
    expect(await f.run()).toMatchObject({ outcomes: [{ state: "requires_reconciliation" }] });
    return f;
  }
  it("refuses the send blocker and send execution even after sending is enabled", async () => {
    const f = await reconciled(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBe("founder_send_requires_reconciliation");
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("founder_send_requires_reconciliation");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.receipts()).toEqual([]);
  });
  it("refuses a new Gmail copy and a revision", async () => {
    const f = await reconciled(), binding = structuredClone(f.db.records.get(f.paths.binding)), ledger = structuredClone(f.db.records.get(f.paths.ledger));
    const ports = { enabled: () => true, allowsRevision: () => true, requireCapability: vi.fn(async () => undefined), verifyMailbox: vi.fn(async () => ({})),
      priorContact: vi.fn(async () => false), find: vi.fn(async () => null), write: vi.fn(async () => ({ draftId: "never" })) };
    await expect(mirrorCommunicationsGmailDraft(f.db, f.ledgerId, "owner", { expectedReviewDigest: f.reviewDigest, expectedRevisionId: null, mode: "write" },
      ports, communicationsNow)).rejects.toThrow("gmail_draft_founder_send_requires_reconciliation");
    expect(ports.write).not.toHaveBeenCalled(); expect(f.db.records.get(f.paths.binding)).toEqual(binding);
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner@tryblueprint.io", { expectedReviewDigest: f.reviewDigest, output: f.output },
      communicationsNow)).rejects.toThrow("may already hold a sent copy");
    expect(f.db.records.get(f.paths.ledger)).toEqual(ledger);
  });
});

describe("observed jobs refuse every system send, Gmail copy and revision path", () => {
  async function observed() {
    const f = setup(); expect(await f.run()).toMatchObject({ outcomes: [{ state: "observed" }] });
    return f;
  }
  it("refuses the send blocker and send execution even after sending is enabled", async () => {
    const f = await observed(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBe("founder_send_already_observed");
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("founder_send_already_observed");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.receipts()).toEqual([]);
  });
  it.each(["write", "reconcile"])("refuses a Gmail draft copy in %s mode before any provider call", async mode => {
    const f = await observed(), binding = structuredClone(f.db.records.get(f.paths.binding));
    const ports = { enabled: () => true, allowsRevision: () => true, requireCapability: vi.fn(async () => undefined), verifyMailbox: vi.fn(async () => ({})),
      priorContact: vi.fn(async () => false), find: vi.fn(async () => null), write: vi.fn(async () => ({ draftId: "never" })) };
    await expect(mirrorCommunicationsGmailDraft(f.db, f.ledgerId, "owner", { expectedReviewDigest: f.reviewDigest, expectedRevisionId: null, mode },
      ports, communicationsNow)).rejects.toThrow("gmail_draft_founder_send_observed");
    expect(ports.find).not.toHaveBeenCalled(); expect(ports.write).not.toHaveBeenCalled();
    expect(f.db.records.get(f.paths.binding)).toEqual(binding);
  });
  it("refuses an authenticated draft revision", async () => {
    const f = await observed(), ledger = structuredClone(f.db.records.get(f.paths.ledger));
    await expect(reviseCommunicationsDraft(f.db, f.ledgerId, "owner@tryblueprint.io", { expectedReviewDigest: f.reviewDigest, output: f.output },
      communicationsNow)).rejects.toThrow("already sent from the founder mailbox");
    expect(f.db.records.get(f.paths.ledger)).toEqual(ledger);
  });
});

describe("founder-sent thread reply intake", () => {
  async function observedThread(options: { replyBody?: string; edited?: boolean } = {}) {
    const f = setup();
    if (options.edited) f.thread.messages[0].body += "\nA founder-added closing line.";
    expect(await f.run()).toMatchObject({ outcomes: [{ state: "observed" }] });
    const thread = f.verifiedThread(options.replyBody, f.thread.messages[0].body);
    const readThread = vi.fn(async (_threadId: string) => structuredClone(thread));
    const suppressionPath = `email_suppressions/${f.payload.to}`;
    const suppress = vi.fn(async (email: string, _reason: string) => {
      await f.db.doc(`email_suppressions/${email.toLowerCase()}`).set({ email: email.toLowerCase(), suppressed_scopes: ["all"], source: "communications_reply" });
      return { persisted: true };
    });
    const deps = { db: f.db, readResearch: vi.fn(async () => f.snapshot), readThread, now: () => communicationsNow, suppress,
      isSuppressed: vi.fn(async (email: string) => !!f.db.records.get(`email_suppressions/${email.toLowerCase()}`)?.suppressed_scopes?.includes("all")),
      founderSentRepliesAllowed: () => founderSentRepliesAllowed(f.db, { now: () => communicationsNow, requireCapability: f.ports.requireCapability }) };
    const replyJobs = () => [...f.db.records.entries()].filter(([key, value]) => key.startsWith(`${f.root}/jobs/`) && value.intent === "reply").map(([, value]) => value);
    return { ...f, verified: thread, readThread, suppress, deps, replyJobs, suppressionPath };
  }

  it("records a founder-thread reply for learning only: never drafted, approved or sent", async () => {
    const f = await observedThread();
    expect(await runCommunicationsReplyIntake(f.deps)).toEqual([{ observationId: f.job.jobId, state: "learning_only", jobId: expect.any(String) }]);
    const [job] = f.replyJobs(), observation = f.db.records.get(f.paths.observation);
    const brief = f.db.records.get(`${f.root}/briefs/${job.briefId}`);
    expect(brief).toMatchObject({ replyOrigin: { origin: "founder_send_observed", parentBriefId: f.brief.briefId, parentBriefDigest: f.job.briefDigest,
      founderSendObservationId: f.job.jobId, founderSendObservationDigest: observation.evidenceDigest },
      priorConversation: { gmailThreadId: f.threadId, gmailMessageIds: ["founder-sent-1"] } });
    expect(brief.consent).toEqual(f.brief.consent); expect(brief.qualityReview).toEqual(f.brief.qualityReview);
    expect(f.db.records.get(`${f.root}/replyBindings/${job.briefDigest}`)).toMatchObject({ version: "blueprint.communications-reply-binding.v2",
      replyOrigin: "founder_send_observed", gmailDraftBindingDigest: observation.gmailDraftBindingDigest, directionDigest: observation.directionDigest,
      outgoingBodySha256: observation.sent.bodySha256, sendsAuthorized: false, approvalGranted: false });
    expect(f.db.records.get(`${f.root}/replyIntake/${communicationsDeliveryKey(job)}`)).toMatchObject({ version: "blueprint.communications-reply-intake.v2",
      replyOrigin: "founder_send_observed", founderSendObservationId: f.job.jobId, state: "learning_only" });
    expect(job).toMatchObject({ state: "learning_only", reason: "founder_thread_reply_learning_only" });
    // The reply itself is retained as untrusted evidence for learning.
    expect(f.db.records.get(`${f.paths.prospect}/communicationsEvents/reply_founder-reply-in-1`))
      .toMatchObject({ type: "reply_received", untrusted: true, jobId: job.jobId });
    // Even a job forced back to queued finishes as learning-only, with no thread read, model call or approval row.
    const jobPath = `${f.root}/jobs/${job.jobId}`, reads = f.readThread.mock.calls.length;
    f.db.records.set(jobPath, { ...f.db.records.get(jobPath), state: "queued" });
    const api = { run: vi.fn(), cancel: vi.fn(async () => true), reconcileSaved: vi.fn(async () => null) };
    const store = new CommunicationsStore(f.db, () => communicationsNow, "founder-reply-test");
    expect(await processCommunicationsJob(job.jobId, { ...f.deps, store, api, verifyMailbox: vi.fn(async () => ({})) } as any)).toMatchObject({ state: "learning_only" });
    expect(api.run).not.toHaveBeenCalled(); expect(f.readThread.mock.calls.length).toBe(reads);
    expect(f.db.records.get(jobPath)).toMatchObject({ state: "learning_only" });
    expect(f.db.records.has(`action_ledger/communications_${job.jobId}`)).toBe(false);
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ state: "existing", jobId: job.jobId }]);
    expect(f.replyJobs()).toHaveLength(1); expect(f.receipts()).toEqual([]);
  });

  it("refuses a founder-origin reply at every approval, copy, revision and send step", async () => {
    const f = await observedThread();
    await runCommunicationsReplyIntake(f.deps);
    const [job] = f.replyJobs(), brief = f.db.records.get(`${f.root}/briefs/${job.briefId}`), output = communicationsFixture("reply").output;
    const identity = { jobId: job.jobId, prospectId: job.prospectId, briefId: job.briefId, briefDigest: job.briefDigest, intent: "reply" as const,
      inboundMessageId: job.inboundMessageId };
    // A synthetic approved row, as if one had been created by older code.
    const payload = structuredClone(f.payload), ledgerId = `communications_${job.jobId}`;
    payload.communications = { ...payload.communications, job: identity, brief, thread: f.verified, output };
    f.db.records.set(`action_ledger/${ledgerId}`, { ...f.db.records.get(f.paths.ledger), action_payload: payload, idempotency_key: `communications:${job.jobId}`,
      status: "operator_approved", approved_by: "owner@x.example" });
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    expect(await communicationsSendBlocker(payload, ledgerId)).toBe("founder_origin_reply_learning_only");
    await expect(executeCommunicationsSend(payload)).rejects.toThrow("founder_origin_reply_learning_only");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.receipts()).toEqual([]);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    const ports = { enabled: () => true, allowsRevision: () => true, requireCapability: vi.fn(async () => undefined), verifyMailbox: vi.fn(async () => ({})),
      priorContact: vi.fn(async () => false), find: vi.fn(async () => null), write: vi.fn(async () => ({ draftId: "never" })) };
    await expect(mirrorCommunicationsGmailDraft(f.db, ledgerId, "owner", { expectedReviewDigest: "a".repeat(64), expectedRevisionId: null, mode: "write" },
      ports, communicationsNow)).rejects.toThrow("gmail_draft_founder_origin_reply_learning_only");
    expect(ports.write).not.toHaveBeenCalled();
    await expect(reviseCommunicationsDraft(f.db, ledgerId, "owner@tryblueprint.io", { expectedReviewDigest: "a".repeat(64), output },
      communicationsNow)).rejects.toThrow("recorded for learning only");
    const store = new CommunicationsStore(f.db, () => communicationsNow, "founder-commit-test"), jobPath = `${f.root}/jobs/${job.jobId}`;
    f.db.records.set(jobPath, { ...f.db.records.get(jobPath), lease: { owner: "founder-commit-test", until: communicationsNow + 60000 } });
    await expect(store.commitDraft(identity, output, payload as any, "a".repeat(64), null)).rejects.toThrow("founder_origin_reply_learning_only");
  });

  it("keeps the reply brief bound to the unchanged observation and draft copy", async () => {
    const f = await observedThread();
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ state: "learning_only" }]);
    const [job] = f.replyJobs(), store = new CommunicationsStore(f.db, () => communicationsNow, "founder-binding-test");
    const observation = structuredClone(f.db.records.get(f.paths.observation)), binding = structuredClone(f.db.records.get(f.paths.binding));
    await expect(store.brief(job.briefId)).resolves.toMatchObject({ briefId: job.briefId });
    // Observation-time context is outside the evidence digest.
    f.db.records.set(f.paths.observation, { ...observation, recipientSuppressedAtObservation: true });
    await expect(store.brief(job.briefId)).resolves.toMatchObject({ briefId: job.briefId });
    f.db.records.set(f.paths.observation, { ...observation, sent: { ...observation.sent, gmailMessageId: "other-sent-message" } });
    await expect(store.brief(job.briefId)).rejects.toThrow("reply_parent_observation_or_handoff_changed");
    f.db.records.set(f.paths.observation, observation);
    f.db.records.set(f.paths.binding, { ...binding, receipt: { ...binding.receipt, threadId: "other-thread" } });
    await expect(store.brief(job.briefId)).rejects.toThrow("reply_parent_observation_or_handoff_changed");
  });

  it("accepts the founder's edited sent copy as the anchor", async () => {
    const f = await observedThread({ edited: true });
    expect(verifyFounderSendObservation(f.db.records.get(f.paths.observation)).contentMatch).toBe("differs_from_draft");
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ state: "learning_only" }]);
  });

  it("refuses a thread whose sent bytes no longer match the observation", async () => {
    const f = await observedThread(); f.verified.messages[0].body += "\nChanged after observation";
    f.readThread.mockResolvedValue(structuredClone(f.verified));
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ observationId: f.job.jobId, state: "blocked", reason: "reply_founder_sent_thread_content_changed" }]);
    expect(f.replyJobs()).toHaveLength(0);
  });

  it("persists an all-scope opt-out before the claim, then closes the prospect without queueing inference", async () => {
    const f = await observedThread({ replyBody: "Please don't contact us again." });
    const claimsWhenSuppressed: number[] = [];
    f.suppress.mockImplementation(async (email: string) => {
      claimsWhenSuppressed.push([...f.db.records.keys()].filter(path => path.includes("/replyIntake/")).length);
      await f.db.doc(`email_suppressions/${email.toLowerCase()}`).set({ email: email.toLowerCase(), suppressed_scopes: ["all"], source: "communications_reply" });
      return { persisted: true };
    });
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ observationId: f.job.jobId, state: "opted_out" }]);
    expect(claimsWhenSuppressed).toEqual([0]);
    expect(f.db.records.get(f.suppressionPath)).toMatchObject({ suppressed_scopes: ["all"] });
    expect(f.db.records.get(f.paths.prospect)).toMatchObject({ stage: "closed", closedReason: "recipient_opt_out" });
    expect(f.replyJobs()).toMatchObject([{ state: "opted_out" }]);
  });

  it("does not admit a founder-thread opt-out until its suppression is durable", async () => {
    const f = await observedThread({ replyBody: "Unsubscribe" }); f.suppress.mockResolvedValue({ persisted: false });
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ state: "blocked", reason: "opt_out_suppression_not_persisted" }]);
    expect(f.replyJobs()).toHaveLength(0); expect(f.db.records.get(f.paths.prospect).stage).toBe("contacted");
  });

  it("ignores quoted opt-out text", async () => {
    const f = await observedThread({ replyBody: "Thanks for the explanation.\nOn Tuesday someone wrote:\n> Unsubscribe" });
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ state: "learning_only" }]);
    expect(f.suppress).not.toHaveBeenCalled(); expect(f.db.records.has(f.suppressionPath)).toBe(false);
  });

  it("creates no job for a reply from an already suppressed recipient", async () => {
    const f = await observedThread();
    f.db.records.set(f.suppressionPath, { email: f.payload.to, suppressed_scopes: ["all"], source: "earlier_opt_out" });
    expect(await runCommunicationsReplyIntake(f.deps)).toMatchObject([{ observationId: f.job.jobId, state: "suppressed" }]);
    expect(f.replyJobs()).toHaveLength(0);
  });

  it("never reads a founder-sent thread while the owner gate is closed", async () => {
    const f = await observedThread(); vi.stubEnv(FOUNDER_SENT_OBSERVER_FLAG, "false");
    expect(await runCommunicationsReplyIntake(f.deps)).toEqual([]);
    await expect(admitFounderSentCommunicationsReplies(f.job.jobId, f.deps)).rejects.toThrow("founder_sent_reply_intake_not_authorized");
    expect(await runCommunicationsReplyIntake({ ...f.deps, founderSentRepliesAllowed: undefined })).toEqual([]);
    expect(f.readThread).not.toHaveBeenCalled(); expect(f.replyJobs()).toHaveLength(0);
    // The pause is visible rather than silent.
    expect(f.db.records.get(`${f.root}/intakeState/founderSentReplies`)).toMatchObject({ paused: true, reason: "founder_sent_reply_gate_closed" });
  });
});
