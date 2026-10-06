import { randomUUID } from "node:crypto";
import { briefRefreshReasons, communicationsBriefSchema, communicationsDigest, staleFactReasons } from "./communications-contract";
import { COMMUNICATIONS_ROOT, prepareCommunicationsEnqueue } from "./communications-store";
import { bindingKey, CONTACT_CLAIM_CHANGED, heldBy, HYPOTHESIS_BLOCKING, HYPOTHESIS_DRAFTS_DISABLED, hypothesisCrmConflict, hypothesisCrmConflictIn,
  hypothesisCrmQueries, hypothesisDraftsEnabled, settledHypothesisRequest, type IntakeDependencies } from "./communications-intake";
import { SCREEN_WORK_ITEMS, screenFacts, screenPublicationHypotheses, screenPublicationSource, screenQualification, type ScreenSnapshotReader,
  type ScreenSource } from "./communications-screen-research";
import { admitScreenContact, verifyScreenContactResolution, type ScreenContactResolution } from "./communications-screen-contact";

/** Site-screen hypotheses (design section 3, owner decisions 2026-10-05): recorded exactly like a published daily
 * hypothesis, then, with hypothesis drafts on, admitted to one draft job each through the same CRM checks, claim and
 * draft-only brief. The bundle names the recipient: a published address is found again on a freshly fetched page of the
 * operator's own domain; a looked-up one counts only with its provider check. Nothing here sends, approves or creates a
 * session; every send path refuses the brief, the prospect and its address. Screen contact requests have their own kind,
 * so the daily contact worker and native contact research never claim them. */
export type ScreenIntakeDependencies = IntakeDependencies & { readScreenAdmission?: ScreenSnapshotReader };
export const SCREEN_CONTACT_KIND = "screen_contact_resolution";
const SCREEN_CONTACT_GAP = "screen_hypothesis_contact_unverified";
const SCREEN_RECIPIENT_MISSING = "screen_recipient_missing";

/** Exhausted deterministic contact checks return to the research owner without another paid lookup. */
function screenContactFailure(tx: FirebaseFirestore.Transaction, root: FirebaseFirestore.DocumentReference, request: FirebaseFirestore.DocumentData, reason: string, now: number) {
  const identity = identityOf(request), intakeId = communicationsDigest(identity);
  tx.set(root.collection("refreshRequests").doc(`research_${intakeId}`), { ...identity, origin: "site_screen", label: "hypothesis",
    owner: "blueprint-research-agent", kind: "research_owner_refresh", state: "pending", scope: "relevant_claims_only",
    reasons: [reason], requestedAt: now, sent: false, sessionCreated: false }, { merge: true });
  tx.set(root.collection("intake").doc(intakeId), { state: "needs_research", reasons: [reason], eligibleForOutreach: false,
    draftJobCreated: false, sendsAuthorized: false, sent: false, sessionCreated: false }, { merge: true });
}

/** A screen hypothesis's intake identity: its admission and site alone, so every pass names the same intake record. */
export const screenIdentity = (admissionId: string | null, siteKey: string) => ({ date: null, runKey: admissionId ? `blueprint-screen-admission:${admissionId}` : null,
  candidateKey: siteKey, packetDigest: admissionId, rawArtifactDigest: null, screenAdmissionId: admissionId });
const identityOf = (value: any) => screenIdentity(typeof value?.screenAdmissionId === "string" ? value.screenAdmissionId : null, value?.candidateKey);
const reasonOf = (error: unknown, fallback: string) => error instanceof Error ? error.message.slice(0, 1200) : fallback;

/** Records every site of one verified admission once, as hypothesis_recorded. No brief, prospect, job or send authority. */
export async function recordScreenHypotheses(snapshot: any, deps: ScreenIntakeDependencies) {
  const entries = screenPublicationHypotheses(snapshot), root = deps.db.doc(COMMUNICATIONS_ROOT), outcomes: FirebaseFirestore.DocumentData[] = [];
  for (const entry of entries) {
    const identity = screenIdentity(snapshot.admission_id, entry.siteKey), intakeId = communicationsDigest(identity);
    const ref = root.collection("intake").doc(intakeId);
    outcomes.push(await deps.db.runTransaction(async tx => {
      const previous = await tx.get(ref);
      if (previous.exists) return previous.data()!;
      const outcome = { ...identity, intakeId, state: "hypothesis_recorded", publishedTier: "outreach_ready", label: "hypothesis", origin: "site_screen",
        sheetsProspectId: entry.sheetsProspectId, candidateDigest: entry.resultDigest, openChecks: entry.openChecks, openQuestions: entry.openQuestions,
        recipientRoute: entry.recipientRoute, recipientLabel: entry.recipientLabel, validUntil: null,
        owner: "blueprint-communications-agent", recordedAt: deps.now(), eligibleForOutreach: false, draftJobCreated: false,
        sendsAuthorized: false, humanContextApprovalRequired: false, sent: false, sessionCreated: false };
      tx.set(ref, outcome);
      return outcome;
    }));
  }
  return outcomes;
}

/** Why a screen hypothesis is not drafted, recorded as for a daily one: an unverified recipient goes to the screen
 * contact worker; a known candidate is blocked and its request closed; anything else goes to the research owner. */
async function screenNeedsAttention(deps: ScreenIntakeDependencies, identity: ReturnType<typeof screenIdentity>, reason: string) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT), intakeId = communicationsDigest(identity), ref = root.collection("intake").doc(intakeId);
  const requestRef = root.collection("refreshRequests").doc(`intake_${intakeId}`);
  return deps.db.runTransaction(async tx => {
    const [previous, request] = await Promise.all([tx.get(ref), tx.get(requestRef)]), saved = previous.data(), prior = request.data();
    if (saved && (saved.label !== "hypothesis" || ["admitted", "blocked"].includes(saved.state))) return saved;
    const blocked = HYPOTHESIS_BLOCKING.has(reason), contactGap = reason === SCREEN_CONTACT_GAP;
    const outcome = { ...(saved ?? {}), ...identity, intakeId, state: blocked ? "blocked" : "needs_research", reasons: [reason], label: "hypothesis",
      origin: "site_screen", owner: "blueprint-communications-agent", requestedAt: saved?.requestedAt ?? deps.now(), eligibleForOutreach: false,
      draftJobCreated: false, sendsAuthorized: false, humanContextApprovalRequired: false, sent: false, sessionCreated: false };
    if (blocked) {
      if (prior && !["resolved", "terminal"].includes(prior.state)) tx.set(requestRef, { state: "terminal", reason, completedAt: deps.now(),
        nextAttemptAt: 0, lease: { owner: prior.lease?.owner ?? null, until: 0 }, sent: false, sessionCreated: false }, { merge: true });
    } else {
      const owner = contactGap ? "blueprint-communications-agent" : "blueprint-research-agent", kind = contactGap ? SCREEN_CONTACT_KIND : "research_owner_refresh";
      const handedOver = !!prior && (prior.owner !== owner || prior.kind !== kind);
      tx.set(requestRef, { ...identity, label: "hypothesis", origin: "site_screen", owner, kind,
        state: !prior || handedOver ? "pending" : prior.state ?? "pending", scope: "relevant_claims_only", reasons: [reason],
        observerReceiptRequired: false, requestedAt: outcome.requestedAt,
        ...(handedOver ? { nextAttemptAt: 0, lease: { owner: prior.lease?.owner ?? null, until: 0 } } : {}) }, { merge: true });
    }
    tx.set(ref, outcome);
    return outcome;
  });
}

/** The checks before any contact work: the admission, row and direction re-verify from this snapshot, the candidate is
 * not already in the CRM, the proven facts are at most 7 days old, and the bundle names a recipient. */
async function screenBeforeContact(snapshot: any, siteKey: string, deps: ScreenIntakeDependencies) {
  const { source } = screenPublicationSource(snapshot, siteKey, deps.now());
  const key = bindingKey(source), prospectId = `research-${key}`;
  const conflict = await hypothesisCrmConflict(deps, source, prospectId);
  if (conflict) throw new Error(conflict);
  const stale = staleFactReasons(screenFacts(source), deps.now());
  if (stale.length) throw new Error(`research_adapter_review_required:${stale.join(",")}`);
  if (!source.recipient) throw new Error(SCREEN_RECIPIENT_MISSING);
  return { source, key, prospectId };
}

/** The screen hypothesis brief before review metadata: the proven quotes, the record's own one question, the recipient
 * with its founder-facing label, and the owner direction. */
function screenBriefProposal(source: ScreenSource, contact: ReturnType<typeof verifyScreenContactResolution>, prospectId: string, key: string) {
  const facts = screenFacts(source);
  return { version: "blueprint.communications-brief.v1" as const, revision: 1, prospectId, siteId: `screen-site:${key}`, taskId: `screen-task:${key}`,
    teamIds: [], caseId: `screen-case:${key}`, capabilityIds: [], facilityName: source.candidate.organization, boundedJob: source.candidate.task,
    decision: "Whether to ask the one open question about this screened site and task", decisionOwner: null, facts, unknowns: [], conflicts: [],
    stage: { interest: "unknown" as const, evidenceIds: [] },
    contact: { email: contact.email, purpose: "Ask the one open question about the screened task; interest, fit and automation are unknown",
      learningQuestion: source.hypothesis.openQuestions[0], sourceUrl: contact.sourceUrl, sourceCheckedAt: contact.sourceCheckedAt, scope: contact.scope,
      resolvedMissingContactGaps: contact.resolvedGaps, recipient: contact.recipient },
    consent: { status: contact.consent, sharingBoundary: contact.consent === "looked_up_business_contact"
      ? "A provider-verified business address of a named person (looked-up, not published); public sources only; site permission required before any team disclosure"
      : "Public sources only; site permission required before any team disclosure", sourceRefs: [contact.sourceUrl] },
    priorConversation: null,
    outreachContext: { observations: facts.map(fact => ({ claim: fact.claim, source: fact.sourceUrl })), teamObservations: [], verifiedCapabilities: [],
      connectionEvidence: null },
    qualification: screenQualification(source),
    researchOrigin: { date: source.date, candidateKey: source.candidateKey, packetDigest: source.packetDigest, rawArtifactDigest: source.rawArtifactDigest,
      screenAdmissionId: source.screenAdmissionId, sourceDigest: communicationsDigest(source), contactEvidenceDigest: contact.evidenceDigest,
      contactEvidenceKind: "screen_recipient_resolution" as const } };
}

/** Moves one screen hypothesis to one draft job once every check holds, as admitPublishedHypothesis does for a daily one:
 * the admission re-verifies from this snapshot, the candidate is not in the CRM, and the recipient proof holds. One
 * transaction claims the intake item, so a replay or a concurrent admission creates nothing more. */
export async function admitScreenHypothesis(snapshot: any, siteKey: string, deps: ScreenIntakeDependencies,
  resolution?: { proof: ScreenContactResolution; requestId: string; leaseOwner: string }) {
  const admissionId = typeof snapshot?.admission_id === "string" ? snapshot.admission_id : null;
  const identity = screenIdentity(admissionId, siteKey), intakeId = communicationsDigest(identity);
  if (!hypothesisDraftsEnabled()) {
    if (resolution) throw new Error(HYPOTHESIS_DRAFTS_DISABLED);
    return { ...identity, intakeId, state: "not_admitted", reasons: [HYPOTHESIS_DRAFTS_DISABLED], label: "hypothesis", eligibleForOutreach: false,
      draftJobCreated: false, sendsAuthorized: false, sent: false, sessionCreated: false };
  }
  const root = deps.db.doc(COMMUNICATIONS_ROOT), intakeRef = root.collection("intake").doc(intakeId);
  const recorded = (await intakeRef.get()).data();
  if (recorded && ["admitted", "blocked"].includes(recorded.state)) {
    if (resolution) {
      const requestRef = root.collection("refreshRequests").doc(resolution.requestId);
      await deps.db.runTransaction(async tx => {
        if (heldBy((await tx.get(requestRef)).data(), resolution.leaseOwner, deps.now())) {
          tx.set(requestRef, settledHypothesisRequest(recorded, resolution.leaseOwner, deps.now()), { merge: true });
        }
      });
    }
    return recorded;
  }
  try {
    if (recorded && recorded.label !== "hypothesis") throw new Error("research_hypothesis_claim_changed");
    const { source, key, prospectId } = await screenBeforeContact(snapshot, siteKey, deps);
    if (!resolution) throw new Error(SCREEN_CONTACT_GAP);
    const contact = verifyScreenContactResolution(resolution.proof, source, prospectId);
    if (await deps.isSuppressed(contact.email)) throw new Error("recipient_suppressed");
    const holder = await hypothesisCrmConflict(deps, source, prospectId, contact.email);
    if (holder) throw new Error(holder);
    const proposal = screenBriefProposal(source, contact, prospectId, key);
    const briefId = `hypothesis-${communicationsDigest({ proposal, sourceDigest: communicationsDigest(source) })}`;
    const brief = communicationsBriefSchema.parse({ ...proposal, briefId, qualityReview: { state: "approved",
      reviewedBy: "blueprint-communications-intake", reviewedAt: new Date(deps.now()).toISOString(), sourceRecordUrl: source.sourceRecordUrl } });
    if (brief.facts.some((fact, index) => fact.claim !== proposal.facts[index].claim)) throw new Error("research_adapter_source_text_would_change");
    const stale = briefRefreshReasons(brief, deps.now());
    if (stale.length) throw new Error(`research_adapter_review_required:${stale.join(",")}`);
    const digest = communicationsDigest(brief);
    const prospectRef = deps.db.collection("outboundProspects").doc(prospectId), bindingRef = root.collection("researchBindings").doc(key);
    const proofRef = root.collection("contactProofs").doc(contact.evidenceDigest);
    const queries = hypothesisCrmQueries(deps, source, contact.email), requestRef = root.collection("refreshRequests").doc(resolution.requestId);
    return await deps.db.runTransaction(async tx => {
      const [intake, prospect, binding, existing, proof, request, bound, named, holders] = await Promise.all([tx.get(intakeRef), tx.get(prospectRef),
        tx.get(bindingRef), tx.get(root.collection("briefs").doc(brief.briefId)), tx.get(proofRef), tx.get(requestRef), tx.get(queries.bound),
        tx.get(queries.named), tx.get(queries.holders!)]);
      const claimed = intake.data(), lease = request.data();
      if (claimed && ["admitted", "blocked"].includes(claimed.state)) {
        if (heldBy(lease, resolution.leaseOwner, deps.now())) tx.set(requestRef, settledHypothesisRequest(claimed, resolution.leaseOwner, deps.now()), { merge: true });
        return claimed;
      }
      if (claimed && claimed.label !== "hypothesis") throw new Error("research_hypothesis_claim_changed");
      if (lease?.lease?.owner !== resolution.leaseOwner || lease.lease.until <= deps.now() || lease.state !== "running"
        || communicationsDigest(identityOf(lease)) !== communicationsDigest(identity)) throw new Error(CONTACT_CLAIM_CHANGED);
      if (proof.exists && communicationsDigest(proof.data()) !== contact.evidenceDigest) throw new Error("contact_resolution_immutable_conflict");
      const conflict = hypothesisCrmConflictIn(source, prospectId, binding.data()?.prospectId, bound, named, holders);
      if (conflict) throw new Error(conflict);
      if (prospect.exists || binding.exists) throw new Error("outreach_ready_candidate_already_known");
      if (existing.exists) throw new Error("research_adapter_immutable_conflict");
      const queued = await prepareCommunicationsEnqueue(tx, deps.db, { prospectId, briefId: brief.briefId, briefDigest: digest,
        intent: "outreach", inboundMessageId: null }, deps.now());
      if (queued.record.state === "superseded") throw new Error("communications_research_admission_superseded");
      const { reasons: _reasons, ...kept } = claimed ?? {};
      const outcome = { ...kept, ...identity, intakeId, state: "admitted", label: "hypothesis", origin: "site_screen", publishedTier: "outreach_ready",
        sheetsProspectId: source.sheetsProspectId, sourceDigest: communicationsDigest(source), prospectId, briefId: brief.briefId, briefDigest: digest,
        jobId: queued.record.jobId, contactEvidenceDigest: contact.evidenceDigest, recipientRoute: contact.route, recipientLabel: contact.label,
        owner: "blueprint-communications-agent", admittedAt: deps.now(), draftJobCreated: true, eligibleForOutreach: false, sendsAuthorized: false,
        humanContextApprovalRequired: false, sent: false, sessionCreated: false, gmailDraftCreated: false };
      tx.create(root.collection("briefs").doc(brief.briefId), brief);
      tx.create(root.collection("handoffs").doc(digest), { version: "blueprint.communications-handoff.v1", ...brief.qualityReview,
        briefDigest: digest, sheetsReceipt: source.sheetsReceipt, notionReceipt: source.notionReceipt });
      tx.create(root.collection("researchSources").doc(digest), { briefDigest: digest, source, label: "hypothesis", origin: "site_screen",
        contactSourceIdentifiesRecipient: true });
      if (!proof.exists) tx.create(proofRef, resolution.proof);
      tx.create(bindingRef, { prospectId, sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId });
      tx.create(prospectRef, { facilityName: source.candidate.organization, facilityAddress: source.candidate.location,
        facilitySite: source.candidate.site, locationSource: "site_screen_input_location_not_verified_street_address",
        contactEmail: contact.email, hypothesisedTask: source.candidate.task, stage: "drafted", inferredGates: {}, gateAnswerSources: {},
        contactedAtIso: null, observations: brief.outreachContext.observations,
        reasonForContact: "Ask the one open question about the screened task. Outreach-ready hypothesis: draft only.",
        createdAtIso: new Date(deps.now()).toISOString(), siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId,
        researchPublicationId: source.sheetsProspectId, entityAdmission: "research_hypothesis", qualificationTier: "outreach_ready",
        screenAdmissionId: source.screenAdmissionId, sendAuthority: "none", recipientLabel: contact.label,
        communicationsContextReview: { briefId: brief.briefId, briefDigest: digest } });
      queued.commit();
      tx.set(intakeRef, outcome);
      tx.set(requestRef, { state: "resolved", owner: "blueprint-communications-agent", resolvedAt: deps.now(), jobId: queued.record.jobId,
        briefDigest: digest, contactProofDigest: contact.evidenceDigest, lease: { owner: resolution.leaseOwner, until: 0 } }, { merge: true });
      tx.set(prospectRef.collection("communicationsEvents").doc(`intake_${intakeId}`), outcome);
      return outcome;
    });
  } catch (error) {
    const reason = reasonOf(error, "communications_intake_invalid");
    if (resolution && reason === CONTACT_CLAIM_CHANGED) throw error;
    return screenNeedsAttention(deps, identity, reason);
  }
}

/** Every site of one verified admission, one admission each. */
export async function admitScreenHypotheses(snapshot: any, deps: ScreenIntakeDependencies) {
  const outcomes: FirebaseFirestore.DocumentData[] = [];
  for (const entry of screenPublicationHypotheses(snapshot)) outcomes.push(await admitScreenHypothesis(snapshot, entry.siteKey, deps));
  return outcomes;
}

/** One bounded page of completed screen admissions per worker tick, with a private lease and cursor; the cursor wraps
 * after an empty page. An admission that fails verification is one needs_research record for the research owner. */
export async function runScreenAdmissionIntake(deps: ScreenIntakeDependencies) {
  if (!deps.readScreenAdmission) return;
  const stateRef = deps.db.doc(COMMUNICATIONS_ROOT).collection("intakeState").doc("screenAdmissions"), owner = randomUUID();
  const cursor = await deps.db.runTransaction(async tx => {
    const current = (await tx.get(stateRef)).data();
    if ((current?.lease?.until ?? 0) > deps.now()) return undefined;
    tx.set(stateRef, { cursor: current?.cursor ?? null, lease: { owner, until: deps.now() + 180000 } });
    return current?.cursor ?? null;
  });
  if (cursor === undefined) return;
  let last: string | null = null;
  try {
    let query = deps.db.collection(SCREEN_WORK_ITEMS).orderBy("__name__").limit(5);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      last = doc.id;
      const item = doc.data();
      if (item.stage !== "completed" || item.admission_id !== doc.id) continue;
      try {
        const snapshot: any = await deps.readScreenAdmission(doc.id);
        if (snapshot?.admission_id !== doc.id || snapshot?.work_item?.state_blob !== item.state_blob) throw new Error("screen_admission_work_item_changed");
        await recordScreenHypotheses(snapshot, deps);
        if (hypothesisDraftsEnabled()) await admitScreenHypotheses(snapshot, deps);
      } catch (error) {
        await screenNeedsAttention(deps, screenIdentity(doc.id, "admission"), reasonOf(error, "screen_admission_unavailable"));
      }
    }
  } finally {
    await deps.db.runTransaction(async tx => {
      const current = (await tx.get(stateRef)).data();
      if (current?.lease?.owner === owner) tx.set(stateRef, { cursor: last, lease: { owner, until: 0 } });
    });
  }
}

/** Verifies one screen recipient per tick: claims a screen contact request, re-verifies the admission, fetches the
 * published address's page afresh (or checks the looked-up address's provider record), then admits. A failure a later
 * pass may clear waits; anything else is terminal and asks for no contact research. */
export async function runScreenContactRefresh(deps: ScreenIntakeDependencies) {
  if (!deps.readContactPage || !deps.readScreenAdmission) return;
  const root = deps.db.doc(COMMUNICATIONS_ROOT), stateRef = root.collection("intakeState").doc("screenContactRefresh"), owner = randomUUID();
  const cursor = await deps.db.runTransaction(async tx => {
    const state = (await tx.get(stateRef)).data();
    if ((state?.lease?.until ?? 0) > deps.now()) return undefined;
    tx.set(stateRef, { cursor: state?.cursor ?? null, lease: { owner, until: deps.now() + 180000 } });
    return state?.cursor ?? null;
  });
  if (cursor === undefined) return;
  let last: string | null = null;
  try {
    let query = root.collection("refreshRequests").orderBy("__name__").limit(10);
    if (cursor) query = query.startAfter(cursor);
    for (const doc of (await query.get()).docs) {
      last = doc.id;
      const claim = await deps.db.runTransaction(async tx => {
        const request = (await tx.get(doc.ref)).data();
        if (request?.kind !== SCREEN_CONTACT_KIND || !["pending", "retry_wait", "running"].includes(request.state)
          || (request.lease?.until ?? 0) > deps.now() || (request.nextAttemptAt ?? 0) > deps.now() || !hypothesisDraftsEnabled()) return null;
        if ((request.attempts ?? 0) >= 2) {
          tx.set(doc.ref, { state: "terminal", reason: "contact_refresh_attempts_exhausted", lease: { owner, until: 0 } }, { merge: true });
          screenContactFailure(tx, root, request, "contact_refresh_attempts_exhausted", deps.now());
          return null;
        }
        const claimed: FirebaseFirestore.DocumentData = { ...request, state: "running", attempts: (request.attempts ?? 0) + 1, lease: { owner, until: deps.now() + 180000 },
          startedAt: deps.now() };
        tx.set(doc.ref, claimed);
        return claimed;
      });
      if (!claim) continue;
      try {
        const snapshot: any = await deps.readScreenAdmission(claim.screenAdmissionId);
        let prepared: Awaited<ReturnType<typeof screenBeforeContact>>;
        try { prepared = await screenBeforeContact(snapshot, claim.candidateKey, deps); }
        catch (error) {
          await screenNeedsAttention(deps, identityOf(claim), reasonOf(error, "communications_intake_invalid"));
          break;
        }
        if (!hypothesisDraftsEnabled()) throw new Error(HYPOTHESIS_DRAFTS_DISABLED);
        const proof = await admitScreenContact(prepared.source, prepared.prospectId, deps.readContactPage, deps.now);
        // Re-read the immutable admission after network work, before admission.
        await admitScreenHypothesis(await deps.readScreenAdmission(claim.screenAdmissionId), claim.candidateKey, deps,
          { proof, requestId: doc.id, leaseOwner: owner });
      } catch (error) {
        const reason = reasonOf(error, "contact_refresh_failed");
        if (reason === CONTACT_CLAIM_CHANGED) break;
        const restore = !hypothesisDraftsEnabled() || reason === HYPOTHESIS_DRAFTS_DISABLED;
        const transient = /contact_fetch_(?:timeout|dns_timeout|incomplete|failed)|ECONN|ENOTFOUND|EAI_AGAIN/.test(reason) && claim.attempts < 2;
        await deps.db.runTransaction(async tx => {
          const current = (await tx.get(doc.ref)).data();
          if (current?.lease?.owner !== owner || current.state !== "running" || current.lease.until <= deps.now()) return;
          tx.set(doc.ref, restore ? { state: "pending", attempts: claim.attempts - 1, lease: { owner, until: 0 } }
            : { state: transient ? "retry_wait" : "terminal", reason, completedAt: deps.now(), nextAttemptAt: transient ? deps.now() + 300000 : 0,
              lease: { owner, until: 0 }, sent: false, sessionCreated: false }, { merge: true });
          if (!restore && !transient) screenContactFailure(tx, root, current, reason, deps.now());
        });
      }
      break;
    }
  } finally {
    await deps.db.runTransaction(async tx => {
      const state = (await tx.get(stateRef)).data();
      if (state?.lease?.owner === owner) tx.set(stateRef, { cursor: last, lease: { owner, until: 0 } });
    });
  }
}
