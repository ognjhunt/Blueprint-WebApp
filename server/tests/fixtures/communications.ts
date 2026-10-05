import { communicationsDigest, type CommunicationsBrief, type VerifiedThread, type CommunicationsOutput } from "../../agents/communications-contract";
import { researchDigest } from "../../agents/communications-research";
import { syntheticLeadVerification, syntheticVerificationCohort } from "./lead-verification";
import { outreachContext, outreachContract, outreachDraft } from "./outreach-review";

export const communicationsNow = Date.parse("2026-09-30T23:00:00Z");
export function communicationsFixture(intent: "outreach" | "reply" = "outreach") {
  const brief: CommunicationsBrief = {
    version: "blueprint.communications-brief.v1", briefId: "brief-1", revision: 1,
    prospectId: "prospect-1", siteId: "site-1", taskId: "task-1", teamIds: [], capabilityIds: [], caseId: "case-1",
    facilityName: "Synthetic packing facility", boundedJob: "Packing", decision: "Whether robotics learning is relevant", decisionOwner: null,
    facts: [{ id: "fact-1", ...outreachContext.observations[0], sourceUrl: outreachContext.observations[0].source,
      evidenceClass: "primary", sourceCheckedAt: "2026-09-30T20:00:00Z", publishedAt: null, eventAt: null, consequential: false,
    } as any],
    unknowns: ["Robotics interest is unknown"], conflicts: [], stage: { interest: "unknown", evidenceIds: [] },
    contact: { email: String(outreachDraft.to), purpose: "Learn whether packing robotics is relevant", learningQuestion: outreachContract.question,
      sourceUrl: "https://facility.example/contact", sourceCheckedAt: "2026-09-30T20:00:00Z" },
    consent: { status: "public_business_contact", sharingBoundary: "Public sources only; no team disclosure authorized", sourceRefs: ["https://facility.example/contact"] },
    priorConversation: intent === "reply" ? { gmailThreadId: "thread-1", gmailMessageIds: ["message-out-1"] } : null,
    outreachContext: structuredClone(outreachContext),
    qualityReview: { state: "approved", reviewedBy: "blueprint-research-qa-agent", reviewedAt: "2026-09-30T21:00:00Z", sourceRecordUrl: "https://notion.so/case-1" },
    researchOrigin: { date: "2026-09-30", candidateKey: "candidate-1", packetDigest: "", rawArtifactDigest: "" },
  };
  // Exact schema: sources are named sourceUrl, never inherited legacy keys.
  delete (brief.facts[0] as any).source;
  const evidence = [{ claim: brief.facts[0].claim, url: brief.facts[0].sourceUrl, source_checked_at: brief.facts[0].sourceCheckedAt, classification: "operator", claim_kind: "fact" }];
  const packet = { candidates: [{ candidate_key: "candidate-1", organization: brief.facilityName, site: "Synthetic packing site", location: "Synthetic location", task: brief.boundedJob, evidence }], destinations: { sheet_id: "synthetic-sheet", sheet_tab: "Prospects", notion_parent: "synthetic-notion" } };
  const artifact = Buffer.from('{"synthetic":true}');
  const row: any = { date: "2026-09-30", run_key: "blueprint-researcher:2026-09-30", state: "completed", session_id: "research-session-1",
    turn_id: "research-turn-1", remote_completed_at: 1790802000, artifact_downloaded: true, packet,
    raw_output_digest: "df79e42a6fa0b1f2bb0dbce0f0b482c479a24b39e8a2cbef5f560b86a4d3f0b8", evidence_digest: researchDigest([]) };
  // Use actual byte hashes, matching the research Store's immutable artifact contract.
  row.raw_output_digest = requireHash(artifact);
  row.packet_digest = researchDigest(packet);
  row.review = { packet_digest: row.packet_digest, reviewer_reference: "qa-run-1", source_support_verified: true, crm_rechecked: true, accepted_keys: ["candidate-1"], summary: "Synthetic verified research",
    lead_verification: syntheticVerificationCohort(packet.candidates[0], syntheticLeadVerification(packet.candidates[0]), communicationsNow) };
  row.delivery = Object.fromEntries(["sheets", "notion"].map((destination) => {
    const payload = destination === "sheets" ? { sheet_id: packet.destinations.sheet_id, tab: "Prospects", candidates: packet.candidates }
      : { parent_id: packet.destinations.notion_parent, summary: row.review.summary, candidates: packet.candidates };
    const key = `${row.run_key}:${destination}`;
    const payload_digest = researchDigest(payload);
    return [destination, { state: "acknowledged", key, payload, payload_digest, receipt: {
      destination, key, payload_digest, readback_verified: true, reference: `${destination}:real-record-reference`,
    } }];
  }));
  brief.researchOrigin.packetDigest = row.packet_digest;
  brief.researchOrigin.rawArtifactDigest = row.raw_output_digest;
  const snapshot = { schema_version: "blueprint.research-snapshot.v1", row, missing_files: [], files: {
    artifact: artifact.toString("base64"), evidence: Buffer.from("[]").toString("base64"), output: Buffer.from("{}").toString("base64"),
    review: Buffer.from(JSON.stringify({ ...packet, packet_digest: row.packet_digest })).toString("base64"),
  } };
  const thread: VerifiedThread | null = intent === "reply" ? { mailbox: "nijel@tryblueprint.io", threadId: "thread-1", fetchedAt: "2026-09-30T22:59:00Z",
    messages: [
      { gmailMessageId: "message-out-1", rfcMessageId: "<out-1@tryblueprint.io>", gmailThreadId: "thread-1", from: "nijel@tryblueprint.io", to: [brief.contact.email],
        subject: "Packing", body: String(outreachDraft.body), receivedAt: "2026-09-30T22:00:00Z", inReplyTo: null, references: [] },
      { gmailMessageId: "message-in-1", rfcMessageId: "<in-1@facility.example>", gmailThreadId: "thread-1", from: brief.contact.email, to: ["hello@tryblueprint.io"],
        subject: "Re: Packing", body: "I would like to understand packing options.", receivedAt: "2026-09-30T22:30:00Z", inReplyTo: "<out-1@tryblueprint.io>", references: ["<out-1@tryblueprint.io>"] },
    ] } : null;
  const output: CommunicationsOutput = { disposition: "draft", subject: intent === "reply" ? thread!.messages[1].subject : String(outreachDraft.subject), body: String(outreachDraft.body), reason: "Bounded synthetic draft",
    usedFactIds: ["fact-1"], refreshFactIds: [], outreachContract: intent === "outreach" ? structuredClone(outreachContract) : null, requiresHumanReview: true };
  const input = { prospectId: brief.prospectId, briefId: brief.briefId, briefDigest: communicationsDigest(brief), intent, inboundMessageId: intent === "reply" ? "message-in-1" : null };
  const job = { ...input, jobId: communicationsDigest(input) };
  const handoff = { version: "blueprint.communications-handoff.v1", briefDigest: communicationsDigest(brief),
    ...brief.qualityReview, sheetsReceipt: row.delivery.sheets.receipt.reference, notionReceipt: row.delivery.notion.receipt.reference };
  return { brief, job, output, thread, snapshot, handoff };
}
import { createHash } from "node:crypto";
function requireHash(bytes: Buffer) { return createHash("sha256").update(bytes).digest("hex"); }

/** Invented outreach-ready block for hermetic tests. It names no real owner record or direction. */
export function syntheticQualification(task = "Packing", site = "Synthetic packing site"): NonNullable<CommunicationsBrief["qualification"]> {
  // Design v1.1: one question, template M while the manual workflow is open.
  return { tier: "outreach_ready", label: "hypothesis", openChecks: ["manual_workflow", "existing_automation", "fit", "interest"],
    openQuestions: [`Which parts of ${task} at ${site} still need people, and what has kept them from being automated?`],
    ownerDecision: { reference: "synthetic://owner-decision/outreach-ready",
      direction: { uri: "synthetic://direction/outreach-ready", generation: "1", sha256: "c".repeat(64) } },
    sendsAuthorized: false };
}

export function memoryFirestore(records = new Map<string, any>()) {
  const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
  const merge = (a: any, b: any): any => {
    const next = { ...a };
    for (const [key, value] of Object.entries(b)) next[key] = value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
      ? merge(next[key] ?? {}, value) : clone(value);
    return next;
  };
  const apply = (path: string, value: any, partial = false) => records.set(path, partial ? merge(records.get(path) ?? {}, value) : clone(value));
  const snapshot = (path: string): any => ({ id: path.split("/").at(-1), ref: doc(path), exists: records.has(path), data: () => clone(records.get(path)) });
  let counter = 0;
  const doc = (path: string): any => ({ id: path.split("/").at(-1), path, get: async () => snapshot(path),
    set: async (value: any, options?: any) => { apply(path, value, options?.merge); }, update: async (value: any) => { apply(path, value, true); },
    collection: (name: string) => collection(`${path}/${name}`) });
  const collection = (path: string): any => {
    const query = (filters: any[] = [], limit = 1000, ordered = false, cursor: string | null = null): any => ({
      where: (key: string, op: string, value: any) => query([...filters, [key, op, value]], limit, ordered, cursor),
      limit: (count: number) => query(filters, count, ordered, cursor),
      orderBy: (_key: string) => query(filters, limit, true, cursor),
      startAfter: (value: string) => query(filters, limit, ordered, value),
      get: async () => {
        let paths = [...records.keys()].filter((key) => key.startsWith(path + "/") && key.split("/").length === path.split("/").length + 1)
          .filter((key) => filters.every(([field, op, value]) => op === "in" ? value.includes(records.get(key)[field]) : records.get(key)[field] === value));
        if (ordered) paths.sort();
        if (cursor) paths = paths.filter(key => key.split("/").at(-1)! > cursor);
        paths = paths.slice(0, limit);
        return { docs: paths.map(snapshot), empty: !paths.length, size: paths.length };
      },
    });
    return { ...query(), doc: (id = `generated-${++counter}`) => doc(`${path}/${id}`),
      add: async (value: any) => { const ref = doc(`${path}/generated-${++counter}`); await ref.set(value); return ref; } };
  };
  let lock = Promise.resolve();
  const db: any = { records, doc, collection, batch: () => {
    const writes: (() => void)[] = [];
    return { set: (ref: any, value: any, options?: any) => writes.push(() => apply(ref.path, value, options?.merge)), commit: async () => writes.forEach((write) => write()) };
  }, runTransaction: (fn: any) => {
    const task = lock.then(async () => {
      const writes: (() => void)[] = [];
      const result = await fn({ get: (ref: any) => ref.get(), create: (ref: any, value: any) => {
        if (records.has(ref.path)) throw new Error("already_exists"); writes.push(() => apply(ref.path, value));
      }, set: (ref: any, value: any, options?: any) => writes.push(() => apply(ref.path, value, options?.merge)),
        update: (ref: any, value: any) => writes.push(() => apply(ref.path, value, true)) });
      writes.forEach((write) => write());
      return result;
    });
    lock = task.catch(() => undefined);
    return task;
  } };
  return db;
}

/** Synthetic owner direction/phase; never a production approval or credential. */
export function cancelledContinuationFixture(now = communicationsNow) {
  const f = communicationsFixture(), child: any = { createClaimedAt: new Date(now - 3600000).toISOString(),
    sessionId: "cancelled-session", turnId: "cancelled-turn", requestDigest: "b".repeat(64),
    historyProfile: "agent-history-v1", historyConfigurationDigest: "c".repeat(64),
    finalRepairProfile: "same-session-final-v1", finalRepairSettled: true, gmailMcp: { synthetic: true } };
  const checkpoint: any = { createClaimedAt: child.createClaimedAt, sessionId: null, turnId: null, requestDigest: "a".repeat(64),
    rejectedCreateRecovery: { checkpoint: child } };
  const authority: any = { version: "blueprint.communications-cancelled-continuation-authority.v1", owner: "Nijel Hunt",
    direction: { kind: "direct_current_chat_human_reply", questionItemId: ["request_user_input_async", "call_synthetic", 0],
      question: "What combined daily spending limit do you want for research and communications while we prove the draft-only end-to-end loop? I’m fixing the timeout independently; no sends are included.",
      answer: "$10 per day", messageId: null }, approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 86400000).toISOString(),
    binding: { jobId: f.job.jobId, prospectId: f.job.prospectId, briefDigest: f.job.briefDigest, originalCheckpointDigest: communicationsDigest(checkpoint),
      sessionId: child.sessionId, originalRequestDigest: checkpoint.requestDigest, correctedRequestDigest: child.requestDigest,
      baselineTurnIds: [child.turnId], terminalReceiptSha256: "d".repeat(64) },
    allocation: { timezone: "America/Chicago", maxCombinedDailyUsd: 10, researchReservationUsd: 5, communicationsReservationUsd: 5,
      originalUnknownPolicyReservationUsd: 1, correctedKnownModelMicros: 55334 },
    scope: { draftOnly: true, sendsAuthorized: false, schedulesEnabled: false, newSessionsAuthorized: false, accessChangesAuthorized: false,
      existingHistoryBindingDigest: "e".repeat(64), existingMcpDigest: communicationsDigest(child.gmailMcp) },
    provenance: { originalUsageState: "unresolved", knownCostBasis: "recorded_provider_usage_model_estimate_not_invoice", terminalReceiptGeneration: "1" } };
  const bytes = Buffer.from(JSON.stringify(authority)), ref = { uri: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/agent-e2e-daily-budget-owner-direction.json",
    generation: "1", sha256: requireHash(bytes) };
  const intent: any = { version: "owner-cancelled-continuation-v1", authorityRef: ref, authority, authorityDigest: communicationsDigest(authority),
    sessionBindingDigest: communicationsDigest({ createClaimedAt: child.createClaimedAt, sessionId: child.sessionId,
      requestDigest: child.requestDigest, historyProfile: child.historyProfile, historyConfigurationDigest: child.historyConfigurationDigest,
      gmailMcp: child.gmailMcp, executionWindow: null, finalRepairProfile: child.finalRepairProfile }),
    window: { version: "communications-execution-window-v1", preparedAt: new Date(now).toISOString(),
      deadlineAt: new Date(now + 1200000).toISOString(), timeoutSeconds: 1200 },
    event: { type: "agent.session.input.message", input: [{ role: "user", content: [{ type: "input_text", text: "Synthetic continuation" }] }] },
    requestDigest: "0".repeat(64), idempotencyKey: "synthetic-only" };
  const phase: any = { intent, intentDigest: communicationsDigest(intent), state: "prepared", checkpoint: { ...child, turnId: null } };
  return { ...f, child, checkpoint, authority, bytes, ref, phase };
}
