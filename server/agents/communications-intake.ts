import { randomUUID } from "node:crypto";
import { communicationsBriefSchema, communicationsDigest, briefRefreshReasons,
  verifyCommunicationsHandoff, type CommunicationsBrief } from "./communications-contract";
import { publishedPublicContact, PUBLIC_CONTACT_PREFIX } from "./communications-contact-evidence";
import { previewResearchCommunications, type CommunicationsResearchInput } from "./communications-producer";
import { researchPublicationSource, verifyPublishedResearch, type ResearchSnapshotReader } from "./communications-research";
import { COMMUNICATIONS_ROOT, CommunicationsStore, prepareCommunicationsEnqueue } from "./communications-store";

// Read-only discovery of the existing pinned research owner's completed work.
export const RESEARCH_WORK_ITEMS = "blueprintDailyResearch/sites-first/workItems";
type IntakeDependencies = { db: FirebaseFirestore.Firestore; readResearch: ResearchSnapshotReader;
  isSuppressed: (email: string) => Promise<boolean>; now: () => number };
const bindingKey = (source: any) => communicationsDigest({ sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId });
const sourceIdentity = (row: any, candidateKey: string) => ({ date: row.date ?? null, runKey: row.run_key ?? null, candidateKey,
  packetDigest: row.packet_digest ?? null, rawArtifactDigest: row.raw_output_digest ?? null });

/** Missing source facts remain an agent-owned research task, never an operator form. */
async function needsResearch(deps: IntakeDependencies, identity: ReturnType<typeof sourceIdentity>, reason: string) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT), intakeId = communicationsDigest(identity);
  return deps.db.runTransaction(async tx => {
    const ref = root.collection("intake").doc(intakeId), previous = await tx.get(ref);
    if (previous.exists && previous.data()?.state === "admitted") return previous.data()!;
    const state = reason === "communications_first_touch_already_requested" ? "already_requested"
      : ["recipient_suppressed", "recipient_closed_or_already_contacted"].includes(reason) ? "blocked" : "needs_research";
    const outcome = { ...identity, intakeId, state, reasons: [reason],
      owner: "blueprint-communications-agent", requestedAt: previous.data()?.requestedAt ?? deps.now(),
      humanContextApprovalRequired: false, sent: false, sessionCreated: false };
    tx.set(ref, outcome);
    if (state === "needs_research") tx.set(root.collection("refreshRequests").doc(`intake_${intakeId}`), { ...identity,
      owner: "blueprint-research-agent", state: "pending", scope: "relevant_claims_only", reasons: [reason],
      requiredContactEvidence: PUBLIC_CONTACT_PREFIX, observerReceiptRequired: false,
      requestedAt: outcome.requestedAt });
    return outcome;
  });
}

/** Verify a previous full handoff, not the bare canonical email field. Reuse is
 * limited to this exact immutable publication and keeps original contact dates. */
async function existingVerifiedBrief(deps: IntakeDependencies, snapshot: any, source: any, prospectId: string, prospect: any) {
  const pointer = prospect?.communicationsContextReview;
  if (!pointer?.briefId || !pointer.briefDigest) throw new Error("verified_public_business_contact_missing");
  const store = new CommunicationsStore(deps.db), brief = await store.brief(pointer.briefId);
  const digest = communicationsDigest(brief);
  const root = deps.db.doc(COMMUNICATIONS_ROOT);
  const savedSource = (await root.collection("researchSources").doc(digest).get()).data();
  const binding = (await root.collection("researchBindings").doc(bindingKey(source)).get()).data();
  if (prospect.connectionEvidence || prospect.verifiedCapabilities?.length
    || pointer.briefDigest !== digest || brief.prospectId !== prospectId || brief.priorConversation
    || brief.consent.status !== "public_business_contact" || !savedSource?.contactSourceIdentifiesRecipient
    || savedSource.briefDigest !== digest || communicationsDigest(savedSource.source) !== brief.researchOrigin.sourceDigest
    || communicationsDigest(source) !== brief.researchOrigin.sourceDigest || binding?.prospectId !== prospectId
    || binding?.sheetsId !== source.sheetsId || binding?.sheetsProspectId !== source.sheetsProspectId
    || brief.contact.email.toLowerCase() !== prospect.contactEmail?.toLowerCase()
    || brief.facilityName !== source.candidate.organization || brief.boundedJob !== source.candidate.task
    || brief.siteId !== prospect.siteId || brief.taskId !== prospect.taskId || brief.caseId !== prospect.caseId
    || brief.conflicts.length || brief.stage.interest !== "unknown") throw new Error("verified_contact_handoff_binding_invalid");
  verifyPublishedResearch(snapshot, brief, await store.handoff(brief));
  const stale = briefRefreshReasons(brief, deps.now());
  if (stale.length) throw new Error(`verified_contact_handoff_stale:${stale.join(",")}`);
  return brief;
}

/** Deterministic agent intake. This never calls a model, Gmail or an operator API. */
export async function admitPublishedResearch(snapshot: any, candidateKey: string, deps: IntakeDependencies) {
  const row = snapshot?.row, identity = sourceIdentity(row ?? {}, candidateKey);
  try {
    const source = researchPublicationSource(snapshot, { date: identity.date, candidateKey,
      packetDigest: identity.packetDigest, rawArtifactDigest: identity.rawArtifactDigest });
    const root = deps.db.doc(COMMUNICATIONS_ROOT), key = bindingKey(source), bindingRef = root.collection("researchBindings").doc(key);
    const binding = (await bindingRef.get()).data();
    const matches = await deps.db.collection("outboundProspects").where("researchPublicationId", "==", source.sheetsProspectId).limit(3).get();
    if (matches.size > 1 || (binding && matches.docs.some(doc => doc.id !== binding.prospectId))) throw new Error("research_adapter_source_already_bound");
    const prospectId = binding?.prospectId ?? matches.docs[0]?.id ?? `research-${key}`;
    const prospectRef = deps.db.collection("outboundProspects").doc(prospectId), canonical = await prospectRef.get();
    const original = canonical.data();
    if (canonical.exists && original?.stage !== "drafted") throw new Error("recipient_closed_or_already_contacted");
    let contact: ReturnType<typeof publishedPublicContact> | null = null, reused: CommunicationsBrief | null = null;
    try { contact = publishedPublicContact(source.candidate); }
    catch (error) {
      // A conflicting assertion never falls back to an older handoff.
      if (!(error instanceof Error) || error.message !== "verified_public_business_contact_missing" || !canonical.exists) throw error;
      reused = await existingVerifiedBrief(deps, snapshot, source, prospectId, original);
    }
    const email = contact?.email ?? reused!.contact.email.toLowerCase();
    if (await deps.isSuppressed(email)) throw new Error("recipient_suppressed");
    const taskFact = source.candidate.evidence.find((entry: any) => entry.role === "task" && entry.classification === "operator"
      && entry.claim_kind === "fact" && !entry.claim.startsWith(PUBLIC_CONTACT_PREFIX));
    if (!taskFact) throw new Error("research_adapter_public_task_fact_missing");
    const projection = original ?? { facilityName: source.candidate.organization, facilityAddress: source.candidate.location,
      locationSource: "published_research_location_not_verified_street_address",
      contactEmail: email, hypothesisedTask: source.candidate.task, stage: "drafted", inferredGates: {}, gateAnswerSources: {}, contactedAtIso: null,
      observations: [{ claim: taskFact.claim, source: taskFact.url }],
      reasonForContact: "Learn whether the published recurring task is relevant for robotics research", createdAtIso: new Date(deps.now()).toISOString() };
    const context: CommunicationsResearchInput["context"] = {
      siteId: projection.siteId ?? `research-site:${key}`, taskId: projection.taskId ?? `research-task:${key}`,
      caseId: projection.caseId ?? `research-case:${key}`, decision: "Whether robotics learning for the published recurring task is relevant",
      decisionOwner: null, purpose: "Learn whether robotics for the published recurring task is relevant; no interest presumed",
      learningQuestion: "Is exploring robotics for this recurring task relevant to your site?",
      contactSourceEmail: email, contactSourceUrl: contact?.sourceUrl ?? reused!.contact.sourceUrl,
      contactSourceCheckedAt: contact?.sourceCheckedAt ?? reused!.contact.sourceCheckedAt, contactSourceIdentifiesRecipient: true,
      consent: { status: "public_business_contact", sharingBoundary: "Public sources only; site permission required before any team disclosure",
        sourceRefs: [contact?.sourceUrl ?? reused!.contact.sourceUrl] }, conflicts: [],
    };
    const preview = reused ? null : previewResearchCommunications(snapshot, prospectId, projection,
      { date: identity.date, candidateKey, context }, deps.now(), contact!.evidenceDigest);
    const proposed = reused ?? communicationsBriefSchema.parse({ ...preview!.proposal, qualityReview: {
      state: "approved", reviewedBy: "blueprint-communications-intake", reviewedAt: new Date(deps.now()).toISOString(),
      sourceRecordUrl: preview!.sourceRecordUrl } });
    const intakeId = communicationsDigest(identity), intakeRef = root.collection("intake").doc(intakeId);
    return await deps.db.runTransaction(async tx => {
      const [current, currentBinding, existing, intake] = await Promise.all([tx.get(prospectRef), tx.get(bindingRef),
        tx.get(root.collection("briefs").doc(proposed.briefId)), tx.get(intakeRef)]);
      if (current.exists !== canonical.exists || communicationsDigest(current.data() ?? null) !== communicationsDigest(original ?? null)) {
        throw new Error("research_adapter_canonical_context_changed");
      }
      if (currentBinding.exists && (currentBinding.data()?.prospectId !== prospectId
        || currentBinding.data()?.sheetsId !== source.sheetsId || currentBinding.data()?.sheetsProspectId !== source.sheetsProspectId)) {
        throw new Error("research_adapter_source_already_bound");
      }
      let brief = proposed;
      if (existing.exists) {
        brief = communicationsBriefSchema.parse(existing.data());
        const { qualityReview: _a, ...a } = brief, { qualityReview: _b, ...b } = proposed;
        if (communicationsDigest(a) !== communicationsDigest(b)) throw new Error("research_adapter_immutable_conflict");
        const digest = communicationsDigest(brief);
        const handoff = (await tx.get(root.collection("handoffs").doc(digest))).data();
        const provenance = (await tx.get(root.collection("researchSources").doc(digest))).data();
        verifyCommunicationsHandoff(handoff, brief);
        if (!provenance || provenance.briefDigest !== digest || communicationsDigest(provenance.source) !== communicationsDigest(source)) {
          throw new Error("research_adapter_immutable_conflict");
        }
      } else if (reused) throw new Error("research_adapter_immutable_conflict");
      const digest = communicationsDigest(brief);
      const queued = await prepareCommunicationsEnqueue(tx, deps.db, { prospectId, briefId: brief.briefId, briefDigest: digest,
        intent: "outreach", inboundMessageId: null }, deps.now());
      const outcome = { ...identity, intakeId, sourceDigest: communicationsDigest(source), state: "admitted", prospectId,
        briefId: brief.briefId, briefDigest: digest, jobId: queued.record.jobId, owner: "blueprint-communications-agent",
        admittedAt: intake.data()?.admittedAt ?? deps.now(), humanContextApprovalRequired: false,
        sent: false, sessionCreated: false, gmailDraftCreated: false };
      if (!existing.exists) {
        tx.create(root.collection("briefs").doc(brief.briefId), brief);
        tx.create(root.collection("handoffs").doc(digest), { version: "blueprint.communications-handoff.v1", ...brief.qualityReview,
          briefDigest: digest, sheetsReceipt: source.sheetsReceipt, notionReceipt: source.notionReceipt });
        tx.create(root.collection("researchSources").doc(digest), { briefDigest: digest, source,
          previewDigest: preview!.previewDigest, contactSourceIdentifiesRecipient: true });
      }
      if (!currentBinding.exists) tx.create(bindingRef, { prospectId, sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId });
      if (!current.exists) tx.create(prospectRef, { ...projection, siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId,
        researchPublicationId: source.sheetsProspectId, entityAdmission: "research_provisional",
        communicationsContextReview: { briefId: brief.briefId, briefDigest: digest } });
      else tx.set(prospectRef, { siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, researchPublicationId: source.sheetsProspectId,
        communicationsContextReview: { briefId: brief.briefId, briefDigest: digest } }, { merge: true });
      queued.commit();
      tx.set(intakeRef, outcome);
      tx.set(root.collection("refreshRequests").doc(`intake_${intakeId}`), { state: "resolved", owner: "blueprint-research-agent", resolvedAt: deps.now() }, { merge: true });
      tx.set(prospectRef.collection("communicationsEvents").doc(`intake_${intakeId}`), outcome);
      return outcome;
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 1200) : "communications_intake_invalid";
    return needsResearch(deps, identity, reason);
  }
}

/** One bounded page per existing worker tick, with a private lease/cursor.
 * Cursor wraps after an empty page, allowing unresolved sources to be reconsidered. */
export async function runCommunicationsIntake(deps: IntakeDependencies) {
  const stateRef = deps.db.doc(COMMUNICATIONS_ROOT).collection("intakeState").doc("publishedResearch"), owner = randomUUID();
  const cursor = await deps.db.runTransaction(async tx => {
    const current = (await tx.get(stateRef)).data();
    if ((current?.lease?.until ?? 0) > deps.now()) return undefined;
    tx.set(stateRef, { cursor: current?.cursor ?? null, lease: { owner, until: deps.now() + 180000 } });
    return current?.cursor ?? null;
  });
  if (cursor === undefined) return;
  try {
    let query = deps.db.collection(RESEARCH_WORK_ITEMS).orderBy("__name__").limit(5);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      const item = doc.data();
      if (item.stage !== "completed") continue;
      if (doc.id !== item.date) continue;
      try {
        const snapshot: any = await deps.readResearch(item.date);
        if (snapshot?.row?.date !== item.date || snapshot?.row?.packet_digest !== item.packet_digest
          || snapshot?.row?.run_key !== item.run_key) throw new Error("communications_intake_work_item_changed");
        const keys = snapshot.row.review?.accepted_keys;
        if (!Array.isArray(keys) || !keys.length || keys.length > 100) throw new Error("communications_intake_accepted_candidates_missing_or_overflow");
        for (const key of keys) await admitPublishedResearch(snapshot, key, deps);
      } catch (error) {
        await needsResearch(deps, sourceIdentity(item, "publication"), error instanceof Error ? error.message.slice(0, 1200) : "research_publication_unavailable");
      }
    }
    await deps.db.runTransaction(async tx => {
      const current = (await tx.get(stateRef)).data();
      if (current?.lease?.owner !== owner || current.lease.until <= deps.now()) throw new Error("communications_intake_lease_lost");
      tx.set(stateRef, { cursor: page.docs.at(-1)?.id ?? null, lease: { owner, until: 0 } });
    });
  } catch (error) {
    await deps.db.runTransaction(async tx => {
      const current = (await tx.get(stateRef)).data();
      if (current?.lease?.owner === owner) tx.set(stateRef, { lease: { owner, until: 0 } }, { merge: true });
    });
    throw error;
  }
}
