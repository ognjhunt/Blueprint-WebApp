import { leadTaskSourceSupports, requireVerifiedLead } from "./lead-verification";
import { randomUUID } from "node:crypto";
import { communicationsBriefSchema, communicationsDigest, briefRefreshReasons,
  verifyCommunicationsHandoff, type CommunicationsBrief } from "./communications-contract";
import { publishedPublicContact, contactUnknowns, PUBLIC_CONTACT_PREFIX } from "./communications-contact-evidence";
import { resolvePublicContact, verifyContactResolution, type ContactResolution } from "./communications-contact-resolution";
import type { ContactPageReader } from "./communications-contact-fetch";
import { previewResearchCommunications, type CommunicationsResearchInput } from "./communications-producer";
import { researchPublicationSource, verifyPublishedResearch, type ResearchSnapshotReader } from "./communications-research";
import { COMMUNICATIONS_ROOT, CommunicationsStore, prepareCommunicationsEnqueue } from "./communications-store";
import { firstContactLearningQuestion } from "./communications-first-contact";
import { qualifiedSourceContact } from "./communications-source-assessment";
import { sameOperatorUrl } from "./communications-contact-evidence";
import type { ContactDiscovery } from "./communications-contact-research";

// Read-only discovery of the existing pinned research owner's completed work.
export const RESEARCH_WORK_ITEMS = "blueprintDailyResearch/sites-first/workItems";
type IntakeDependencies = { db: FirebaseFirestore.Firestore; readResearch: ResearchSnapshotReader;
  isSuppressed: (email: string) => Promise<boolean>; now: () => number; readContactPage?: ContactPageReader;
  requestContactResearch?: (source: any, prospectId: string, reason: string) => Promise<boolean>;
  readContactDiscovery?: (source: any, prospectId: string) => Promise<ContactDiscovery | null> };
const bindingKey = (source: any) => communicationsDigest(source.admissionId
  ? { sourceRecordId: source.sheetsProspectId } : { sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId });
const sourceIdentity = (row: any, candidateKey: string) => ({ date: row.date ?? null, runKey: row.run_key ?? row.runKey ?? null, candidateKey,
  packetDigest: row.packet_digest ?? row.packetDigest ?? null, rawArtifactDigest: row.raw_output_digest ?? row.rawArtifactDigest ?? null,
  ...(row.admission_id || row.admissionId ? { admissionId: row.admission_id ?? row.admissionId } : {}) });

/** Missing source facts remain an agent-owned research task, never an operator form. */
async function needsResearch(deps: IntakeDependencies, identity: ReturnType<typeof sourceIdentity>, reason: string) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT), intakeId = communicationsDigest(identity);
  return deps.db.runTransaction(async tx => {
    const ref = root.collection("intake").doc(intakeId), previous = await tx.get(ref);
    if (previous.exists && previous.data()?.state === "admitted") {
      const saved = previous.data()!;
      if (reason.startsWith("lead_verification_required:")) return { ...saved, state: "needs_research", reasons: [reason],
        eligibleForOutreach: false };
      return reason === "communications_research_admission_superseded"
        ? { ...saved, state: "already_requested", reasons: [reason] } : saved;
    }
    const state = reason === "communications_first_touch_already_requested" ? "already_requested"
      : ["recipient_suppressed", "recipient_closed_or_already_contacted"].includes(reason) ? "blocked" : "needs_research";
    const outcome = { ...identity, intakeId, state, reasons: [reason],
      owner: "blueprint-communications-agent", requestedAt: previous.data()?.requestedAt ?? deps.now(),
      humanContextApprovalRequired: false, sent: false, sessionCreated: false };
    if (state === "needs_research") {
      const request = root.collection("refreshRequests").doc(`intake_${intakeId}`), prior = (await tx.get(request)).data();
      const contactGap = ["verified_public_business_contact_missing", "verified_contact_conflicting_unknowns"].includes(reason);
      tx.set(request, { ...identity, owner: contactGap ? "blueprint-communications-agent" : "blueprint-research-agent",
        kind: contactGap ? "public_contact_resolution" : "research_owner_refresh", state: prior?.state ?? "pending",
        scope: "relevant_claims_only", reasons: [reason], observerReceiptRequired: false,
        requestedAt: outcome.requestedAt }, { merge: true });
    }
    tx.set(ref, outcome);
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
  verifyPublishedResearch(snapshot, brief, await store.handoff(brief), await store.contactProof(brief), deps.now());
  const stale = briefRefreshReasons(brief, deps.now());
  if (stale.length) throw new Error(`verified_contact_handoff_stale:${stale.join(",")}`);
  return brief;
}

/** Deterministic agent intake. This never calls a model, Gmail or an operator API. */
export async function admitPublishedResearch(snapshot: any, candidateKey: string, deps: IntakeDependencies,
  resolution?: { proof: ContactResolution; requestId: string; leaseOwner: string }) {
  const row = snapshot?.row, identity = sourceIdentity(row ?? {}, candidateKey);
  try {
    const source = researchPublicationSource(snapshot, { date: identity.date, candidateKey,
      packetDigest: identity.packetDigest, rawArtifactDigest: identity.rawArtifactDigest,
      ...(identity.admissionId ? { admissionId: identity.admissionId } : {}) });
    requireVerifiedLead(source, deps.now());
    const root = deps.db.doc(COMMUNICATIONS_ROOT), key = bindingKey(source), bindingRef = root.collection("researchBindings").doc(key);
    const binding = (await bindingRef.get()).data();
    const matches = await deps.db.collection("outboundProspects").where("researchPublicationId", "==", source.sheetsProspectId).limit(3).get();
    if (matches.size > 1 || (binding && matches.docs.some(doc => doc.id !== binding.prospectId))) throw new Error("research_adapter_source_already_bound");
    const prospectId = binding?.prospectId ?? matches.docs[0]?.id ?? `research-${key}`;
    const prospectRef = deps.db.collection("outboundProspects").doc(prospectId), canonical = await prospectRef.get();
    const original = canonical.data();
    if (canonical.exists && original?.stage !== "drafted") throw new Error("recipient_closed_or_already_contacted");
    let contact: ReturnType<typeof publishedPublicContact> | ReturnType<typeof verifyContactResolution> | null = null, reused: CommunicationsBrief | null = null;
    try { contact = resolution ? verifyContactResolution(resolution.proof, source, prospectId) : qualifiedSourceContact(source); }
    catch (error) {
      // A conflicting assertion never falls back to an older handoff.
      const unknowns = contactUnknowns(source.candidate);
      if (resolution || !(error instanceof Error) || !(error.message === "verified_public_business_contact_missing"
        || (error.message === "verified_contact_conflicting_unknowns" && unknowns.gaps.length && !unknowns.blocked.length)) || !canonical.exists) throw error;
      reused = await existingVerifiedBrief(deps, snapshot, source, prospectId, original);
    }
    const email = contact?.email ?? reused!.contact.email.toLowerCase();
    if (await deps.isSuppressed(email)) throw new Error("recipient_suppressed");
    const taskFact = source.candidate.evidence.find((entry: any) => entry.role === "task" && ["operator", "independent"].includes(entry.classification)
      && entry.claim_kind === "fact" && entry.origin === "live" && entry.assertion_scope === "current_operational"
      && (!entry.visibility || entry.visibility === "public") && (sameOperatorUrl(entry.url, source.candidate.organization_url) || leadTaskSourceSupports(source, entry))
      && !entry.claim.startsWith(PUBLIC_CONTACT_PREFIX));
    if (!taskFact) throw new Error("research_adapter_public_task_fact_missing");
    const projection: FirebaseFirestore.DocumentData = original ? { ...original,
      ...((!original.contactEmail && !original.communicationsContextReview)
        || (source.admissionId && original.entityAdmission === "research_provisional") ? { contactEmail: email } : {}) } : { facilityName: source.candidate.organization, facilityAddress: source.candidate.location,
      facilitySite: source.candidate.site,
      locationSource: "published_research_location_not_verified_street_address",
      contactEmail: email, hypothesisedTask: source.candidate.task, stage: "drafted", inferredGates: {}, gateAnswerSources: {}, contactedAtIso: null,
      observations: [{ claim: taskFact.claim, source: taskFact.url }],
      reasonForContact: "Learn whether the published recurring task is relevant for robotics research", createdAtIso: new Date(deps.now()).toISOString() };
    const context: CommunicationsResearchInput["context"] = {
      siteId: projection.siteId ?? `research-site:${key}`, taskId: projection.taskId ?? `research-task:${key}`,
      caseId: projection.caseId ?? `research-case:${key}`, decision: "Whether robotics learning for the published recurring task is relevant",
      decisionOwner: null, purpose: "Learn whether robotics for the published recurring task is relevant; no interest presumed",
      learningQuestion: firstContactLearningQuestion(source.candidate.task),
      contactSourceEmail: email, contactSourceUrl: contact?.sourceUrl ?? reused!.contact.sourceUrl,
      contactSourceCheckedAt: contact?.sourceCheckedAt ?? reused!.contact.sourceCheckedAt, contactSourceIdentifiesRecipient: true,
      consent: { status: "public_business_contact", sharingBoundary: "Public sources only; site permission required before any team disclosure",
        sourceRefs: [contact?.sourceUrl ?? reused!.contact.sourceUrl] }, conflicts: [],
    };
    const preview = reused ? null : previewResearchCommunications(snapshot, prospectId, projection,
      { date: identity.date, candidateKey, context }, deps.now(), contact!.evidenceDigest, contact!);
    const proposed = reused ?? communicationsBriefSchema.parse({ ...preview!.proposal, qualityReview: {
      state: "approved", reviewedBy: "blueprint-communications-intake", reviewedAt: new Date(deps.now()).toISOString(),
      sourceRecordUrl: preview!.sourceRecordUrl } });
    const intakeId = communicationsDigest(identity), intakeRef = root.collection("intake").doc(intakeId);
    return await deps.db.runTransaction(async tx => {
      const [current, currentBinding, existing, intake] = await Promise.all([tx.get(prospectRef), tx.get(bindingRef),
        tx.get(root.collection("briefs").doc(proposed.briefId)), tx.get(intakeRef)]);
      const proofRef = resolution ? root.collection("contactProofs").doc(contact!.evidenceDigest) : null;
      const existingProof = proofRef ? await tx.get(proofRef) : null;
      if (resolution) {
        const request = (await tx.get(root.collection("refreshRequests").doc(resolution.requestId))).data();
        if (request?.lease?.owner !== resolution.leaseOwner || request.lease.until <= deps.now()
          || request.state !== "running" || communicationsDigest(sourceIdentity(request, candidateKey)) !== communicationsDigest(identity)) throw new Error("contact_refresh_lease_or_source_changed");
        if (existingProof?.exists && communicationsDigest(existingProof.data()) !== contact!.evidenceDigest) throw new Error("contact_resolution_immutable_conflict");
      }
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
      // Historical source readback remains valid for receipts; cached admission
      // must never move the first-touch claim back to an obsolete job.
      if (queued.record.state === "superseded") throw new Error("communications_research_admission_superseded");
      const outcome = { ...identity, intakeId, sourceDigest: communicationsDigest(source), state: "admitted", prospectId,
        briefId: brief.briefId, briefDigest: digest, jobId: queued.record.jobId, owner: "blueprint-communications-agent",
        admittedAt: intake.data()?.admittedAt ?? deps.now(), humanContextApprovalRequired: false,
        sent: false, sessionCreated: false, gmailDraftCreated: false };
      if (!existing.exists) {
        tx.create(root.collection("briefs").doc(brief.briefId), brief);
        tx.create(root.collection("handoffs").doc(digest), { version: "blueprint.communications-handoff.v1", ...brief.qualityReview,
          briefDigest: digest, sheetsReceipt: source.sheetsReceipt, notionReceipt: source.notionReceipt,
          ...(source.recordReceipt ? { recordReceipt: source.recordReceipt } : {}) });
        tx.create(root.collection("researchSources").doc(digest), { briefDigest: digest, source,
          previewDigest: preview!.previewDigest, contactSourceIdentifiesRecipient: true });
      }
      if (proofRef && !existingProof?.exists) tx.create(proofRef, resolution!.proof);
      if (!currentBinding.exists) tx.create(bindingRef, { prospectId, sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId });
      if (!current.exists) tx.create(prospectRef, { ...projection, siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId,
        researchPublicationId: source.sheetsProspectId, entityAdmission: "research_provisional",
        communicationsContextReview: { briefId: brief.briefId, briefDigest: digest } });
      else tx.set(prospectRef, { siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, researchPublicationId: source.sheetsProspectId,
        ...(!original?.contactEmail || (source.admissionId && original.entityAdmission === "research_provisional") ? { contactEmail: brief.contact.email } : {}),
        communicationsContextReview: { briefId: brief.briefId, briefDigest: digest } }, { merge: true });
      queued.commit();
      tx.set(intakeRef, outcome);
      tx.set(root.collection("refreshRequests").doc(`intake_${intakeId}`), { state: "resolved", owner: "blueprint-communications-agent",
        resolvedAt: deps.now(), jobId: queued.record.jobId, briefDigest: digest,
        ...(resolution ? { contactProofDigest: contact!.evidenceDigest, lease: { owner: resolution.leaseOwner, until: 0 } } : {}) }, { merge: true });
      tx.set(prospectRef.collection("communicationsEvents").doc(`intake_${intakeId}`), outcome);
      return outcome;
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 1200) : "communications_intake_invalid";
    if (resolution) throw error;
    return needsResearch(deps, identity, reason);
  }
}

/** Fulfill one communications-owned contact gap per tick. Retry survives restart;
 * terminal gaps are visible and never masquerade as fulfilled research. */
export async function runCommunicationsContactRefresh(deps: IntakeDependencies) {
  if (!deps.readContactPage) return;
  const root = deps.db.doc(COMMUNICATIONS_ROOT), stateRef = root.collection("intakeState").doc("contactRefresh"), owner = randomUUID();
  const cursor = await deps.db.runTransaction(async tx => {
    const state = (await tx.get(stateRef)).data();
    if ((state?.lease?.until ?? 0) > deps.now()) return undefined;
    tx.set(stateRef, { cursor: state?.cursor ?? null, lease: { owner, until: deps.now() + 180000 } });
    return state?.cursor ?? null;
  });
  if (cursor === undefined) return;
  let lastId: string | null = null;
  try {
    let query = root.collection("refreshRequests").orderBy("__name__").limit(10);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      lastId = doc.id;
      const claim = await deps.db.runTransaction(async tx => {
        const request = (await tx.get(doc.ref)).data();
        // Accept the old prefix-era pending contact requests without touching the research owner.
        const contactGap = request?.kind === "public_contact_resolution" || (!request?.kind
          && request?.reasons?.some((reason: string) => ["verified_public_business_contact_missing", "verified_contact_conflicting_unknowns"].includes(reason)));
        if (!request || !contactGap || !["pending", "retry_wait", "running", "agent_research_wait"].includes(request.state)
          || (request.lease?.until ?? 0) > deps.now() || (request.nextAttemptAt ?? 0) > deps.now()) return null;
        const waitingForAgent = request.state === "agent_research_wait" || request.waitingForAgent === true;
        if (!waitingForAgent && (request.attempts ?? 0) >= 2) { tx.set(doc.ref, { state: "terminal", reason: "contact_refresh_attempts_exhausted", lease: { owner, until: 0 } }, { merge: true }); return null; }
        const claimed: FirebaseFirestore.DocumentData = { ...request, owner: "blueprint-communications-agent", kind: "public_contact_resolution", state: "running",
          attempts: (request.attempts ?? 0) + (waitingForAgent ? 0 : 1),
          waitingForAgent, lease: { owner, until: deps.now() + 180000 }, startedAt: deps.now() };
        tx.set(doc.ref, claimed); return claimed;
      });
      if (!claim) continue;
      let source: any = null, prospectId: string | null = null;
      try {
        const snapshot: any = await deps.readResearch(claim.date, claim.admissionId);
        if (communicationsDigest(sourceIdentity(snapshot?.row ?? {}, claim.candidateKey)) !== communicationsDigest(sourceIdentity(claim, claim.candidateKey))) throw new Error("contact_refresh_source_changed");
        source = researchPublicationSource(snapshot, { date: claim.date, candidateKey: claim.candidateKey,
          packetDigest: claim.packetDigest, rawArtifactDigest: claim.rawArtifactDigest,
          ...(claim.admissionId ? { admissionId: claim.admissionId } : {}) });
        requireVerifiedLead(source, deps.now());
        const binding = (await root.collection("researchBindings").doc(bindingKey(source)).get()).data();
        const matches = await deps.db.collection("outboundProspects").where("researchPublicationId", "==", source.sheetsProspectId).limit(3).get();
        if (matches.size > 1 || (binding && matches.docs.some(doc => doc.id !== binding.prospectId))) throw new Error("research_adapter_source_already_bound");
        prospectId = binding?.prospectId ?? matches.docs[0]?.id ?? `research-${bindingKey(source)}`;
        const canonical = (await deps.db.collection("outboundProspects").doc(prospectId!).get()).data();
        if (canonical && canonical.stage !== "drafted") throw new Error("recipient_closed_or_already_contacted");
        const discovery = await deps.readContactDiscovery?.(source, prospectId!);
        if (claim.waitingForAgent && !discovery) {
          await deps.db.runTransaction(async tx => {
            const current = (await tx.get(doc.ref)).data();
            if (current?.lease?.owner !== owner || current.state !== "running" || current.lease.until <= deps.now()) return;
            tx.set(doc.ref, { state: "agent_research_wait", lease: { owner, until: 0 },
              nextAttemptAt: deps.now() + 300000 }, { merge: true });
          });
          break;
        }
        const proof = await resolvePublicContact(source, prospectId!, deps.readContactPage, deps.now, discovery ?? undefined);
        // Re-read the immutable published snapshot after network work, before admission.
        await admitPublishedResearch(await deps.readResearch(claim.date, claim.admissionId), claim.candidateKey, deps, { proof, requestId: doc.id, leaseOwner: owner });
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 1200) : "contact_refresh_failed";
        const transient = /contact_fetch_(?:timeout|dns_timeout|incomplete|failed)|ECONN|ENOTFOUND|EAI_AGAIN/.test(reason) && claim.attempts < 2;
        const researchQueued = !transient && source && prospectId && await deps.requestContactResearch?.(source, prospectId, reason);
        await deps.db.runTransaction(async tx => {
          const current = (await tx.get(doc.ref)).data();
          if (current?.lease?.owner !== owner || current.state !== "running" || current.lease.until <= deps.now()) return;
          tx.set(doc.ref, { state: transient ? "retry_wait" : researchQueued ? "agent_research_wait" : "terminal", reason, completedAt: deps.now(),
            nextAttemptAt: transient || researchQueued ? deps.now() + 300000 : 0, lease: { owner, until: 0 },
            waitingForAgent: Boolean(researchQueued), sent: false, sessionCreated: false }, { merge: true });
        });
      }
      break;
    }
  } finally {
    await deps.db.runTransaction(async tx => {
      const state = (await tx.get(stateRef)).data();
      if (state?.lease?.owner === owner) tx.set(stateRef, { cursor: lastId, lease: { owner, until: 0 } });
    });
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
  await runCommunicationsContactRefresh(deps);
}
