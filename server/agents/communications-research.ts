import { createHash } from "node:crypto";
import { verificationDigest, researchDigest } from "./research-digest";
export { researchDigest } from "./research-digest";
import { evaluateLeadCohort, evaluateLeadVerification, evaluateOutreachTier, LEAD_OUTREACH_RESULT_VERSION, LEAD_VERIFICATION_RESULT_VERSION, leadIdentityKey,
  isOutreachRuleVersion, leadPacketCandidates, outreachEvidenceSummary, outreachQuoteProver, requireVerifiedLead, retainedOutreachEvidence,
  type OutreachRuleVersion } from "./lead-verification";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { communicationsDigest, OUTREACH_READY_OWNER_DECISION_REFERENCE, outreachReadyQuestion, outreachReadySendRefusal, SHEETS_RECEIPT_MAX_LENGTH,
  verifyCommunicationsHandoff, type CommunicationsBrief } from "./communications-contract";
import { publishedPeople, publishedPublicContact } from "./communications-contact-evidence";
import { verifyContactResolution, verifyHypothesisContactResolution, type HypothesisPersonEvidence } from "./communications-contact-resolution";
import { qualifiedSourceContact } from "./communications-source-assessment";
import { REVIEWED_RESEARCH_ROOT, reviewedResearchPublication } from "./communications-reviewed-research";

export type ResearchSnapshotReader = (date: string, admissionId?: string) => Promise<unknown>;
// The research owner owns the pinned Store, its blobs and scheduler. This reader
// has no control writes and never acquires/replaces the research runner's lease.
export async function readExistingResearchSnapshot(db: FirebaseFirestore.Firestore, date: string, admissionId?: string) {
  if (admissionId) {
    if (!/^[a-f0-9]{64}$/.test(admissionId)) throw new Error("reviewed_research_identity_changed");
    return (await db.collection(REVIEWED_RESEARCH_ROOT).doc(admissionId).get()).data();
  }
  const modulePath = pathToFileURL(resolve("dist/daily-research/release/tools/daily_research/firestore_bridge.mjs"));
  const { Store } = await import(/* @vite-ignore */ modulePath.href);
  return new Store(db).snapshot(date);
}

/** A reviewed work item alone does not prove publication to either canonical hub.
 * This stays the strict send-path check: an outreach-ready hypothesis never passes. */
export function verifyPublishedResearch(snapshot: any, brief: CommunicationsBrief, approval: unknown, contactProof?: unknown, now = Date.now()) {
  const hypothesis = outreachReadySendRefusal(brief);
  if (hypothesis) throw new Error(hypothesis);
  const handoff = verifyCommunicationsHandoff(approval, brief);
  const verified = verifyResearchPublication(snapshot, brief.researchOrigin);
  const { row, candidate } = verified;
  requireVerifiedLead({ candidate, leadVerification: verified.verification.assessment,
    ...("leadVerificationCohort" in verified ? { leadVerificationCohort: verified.leadVerificationCohort } : {}) }, now);
  if (handoff.sheetsReceipt !== verified.sheetsReceipt || handoff.notionReceipt !== verified.notionReceipt) {
    throw new Error("research_publication_receipt_changed");
  }
  if (brief.researchOrigin.admissionId && handoff.recordReceipt !== (verified as any).recordReceipt) throw new Error("research_publication_receipt_changed");
  if (brief.researchOrigin.sourceDigest
    && communicationsDigest(researchPublicationSource(snapshot, brief.researchOrigin)) !== brief.researchOrigin.sourceDigest) {
    throw new Error("research_adapter_source_changed");
  }
  if (brief.researchOrigin.contactEvidenceDigest) {
    const contact = brief.researchOrigin.contactEvidenceKind === "public_operator_resolution"
      ? verifyContactResolution(contactProof, researchPublicationSource(snapshot, brief.researchOrigin), brief.prospectId)
      : qualifiedSourceContact(researchPublicationSource(snapshot, brief.researchOrigin));
    if (contact.evidenceDigest !== brief.researchOrigin.contactEvidenceDigest
      || contact.email !== brief.contact.email.toLowerCase() || contact.sourceUrl !== brief.contact.sourceUrl
      || contact.sourceCheckedAt !== brief.contact.sourceCheckedAt || brief.consent.status !== "public_business_contact"
      || (brief.contact.scope && brief.contact.scope !== contact.scope)
      || communicationsDigest(brief.contact.resolvedMissingContactGaps ?? []) !== communicationsDigest(contact.resolvedGaps)) {
      throw new Error("research_contact_evidence_changed");
    }
  }
  if (brief.researchOrigin.contactEvidenceKind === "public_operator_resolution" && !brief.researchOrigin.contactEvidenceDigest) {
    throw new Error("research_contact_resolution_binding_missing");
  }
  for (const fact of brief.facts) {
    if (!candidate.evidence?.some((entry: any) => entry.claim === fact.claim && entry.url === fact.sourceUrl
      && Date.parse(entry.source_checked_at ?? entry.checked_date) === Date.parse(fact.sourceCheckedAt)
      && (fact.assertionScope === undefined || fact.assertionScope === (entry.assertion_scope ?? "as_of_background"))
      && (entry.claim_kind === "hypothesis" ? fact.evidenceClass === "inference"
        : entry.claim_kind === "vendor_claim" || entry.classification === "vendor" ? fact.evidenceClass === "vendor_reported"
        : entry.claim_kind === "fact" && ["operator", "independent"].includes(entry.classification)
          && ["primary", "corroborated", "operator_stated"].includes(fact.evidenceClass)))) {
      throw new Error("brief_fact_not_in_published_research");
    }
  }
  return { runKey: row.run_key, packetDigest: row.packet_digest,
    sheetsReceipt: verified.sheetsReceipt, notionReceipt: verified.notionReceipt,
    briefDigest: communicationsDigest(brief) };
}

type PublicationOrigin = Pick<CommunicationsBrief["researchOrigin"], "date" | "packetDigest" | "rawArtifactDigest">;
const HYPOTHESIS_INVALID = "research_hypothesis_block_invalid";
const hasPayloadHypotheses = (payload: unknown) => !!payload && typeof payload === "object" && !Array.isArray(payload)
  && Object.hasOwn(payload, "hypotheses");

/** The verified part of a delivery payload. A day with outreach-ready hypotheses adds
 * a `hypotheses` key beside the verified candidates, and everything else must still
 * equal what QA accepted. Without that key this is the original exact comparison. */
function verifiedPayloadDigest(delivery: any) {
  if (!hasPayloadHypotheses(delivery?.payload)) return delivery?.payload_digest;
  const { hypotheses: _hypotheses, ...verified } = delivery.payload;
  return researchDigest(verified);
}

/** True when a published day carries the outreach-ready block: a non-empty QA key
 * list on the review, or a `hypotheses` key in a delivery payload. */
export function publishedHypothesesDeclared(row: any) {
  const keys = row?.review?.outreach_ready_keys;
  return (keys !== undefined && !(Array.isArray(keys) && !keys.length))
    || ["sheets", "notion"].some(destination => hasPayloadHypotheses(row?.delivery?.[destination]?.payload));
}

/** Shared read-only publication checks, also used before a brief exists. */
export function verifyResearchPublication(snapshot: any, origin: CommunicationsBrief["researchOrigin"]) {
  if (origin.admissionId || snapshot?.schema_version === "blueprint.reviewed-research-snapshot.v1") return reviewedResearchPublication(snapshot, origin);
  const { row, selected } = publishedResearchDay(snapshot, origin, origin.candidateKey);
  const candidate = row.packet?.candidates?.find((item: any) => item.candidate_key === origin.candidateKey);
  if (!candidate) throw new Error("research_candidate_missing");
  const leadVerification = row.review?.lead_verification?.results?.find((result: any) => result.candidate_key === origin.candidateKey)?.assessment ?? null;
  const pinned = row.packet?.lead_verification_result_version;
  const leadVerificationCohort = leadVerification != null ? { candidates: leadPacketCandidates(row.packet),
    assessments: Object.fromEntries(row.review.lead_verification.results.map((result: any) => [result.candidate_key, result.assessment])),
    duplicateChecks: row.review.lead_verification.duplicate_checks ?? {}, ...(pinned ? { resultVersion: pinned } : {}) } : undefined;
  const verification = leadVerificationCohort ? evaluateLeadCohort(leadVerificationCohort.candidates,
    leadVerificationCohort.assessments, Date.now(), leadVerificationCohort.duplicateChecks,
    pinned ?? LEAD_VERIFICATION_RESULT_VERSION).find(result => result.candidate_key === origin.candidateKey)!
    : evaluateLeadVerification(candidate, leadVerification, Date.now());
  return { row, candidate, selected, ...(leadVerificationCohort ? { leadVerificationCohort } : {}), verification,
    sheetsReceipt: row.delivery.sheets.receipt.reference,
    notionReceipt: row.delivery?.notion?.state === "acknowledged" ? row.delivery.notion.receipt.reference : null,
  };
}

/** Day-level binding of a published row: snapshot, artifact, packet, QA review and
 * both delivery receipts. A null `candidateKey` checks a day that publishes only
 * outreach-ready hypotheses, which has no verified row to name. */
function publishedResearchDay(snapshot: any, origin: PublicationOrigin, candidateKey: string | null) {
  const row = snapshot?.row;
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  if (snapshot?.schema_version !== "blueprint.research-snapshot.v1" || !row
    || row.date !== origin.date || row.state !== "completed" || !row.session_id || !row.turn_id
    || row.remote_completed_at == null || row.artifact_downloaded !== true
    || row.packet_digest !== origin.packetDigest || row.raw_output_digest !== origin.rawArtifactDigest
    || !snapshot.files?.artifact || snapshot.missing_files?.length) throw new Error("research_publication_context_missing");
  if (hash(Buffer.from(snapshot.files.artifact, "base64")) !== origin.rawArtifactDigest) throw new Error("research_artifact_digest_mismatch");
  if (researchDigest(row.packet) !== origin.packetDigest) throw new Error("research_packet_digest_mismatch");
  const savedReview = JSON.parse(Buffer.from(snapshot.files.review, "base64").toString("utf8"));
  const { packet_digest: savedDigest, ...savedPacket } = savedReview;
  if (savedDigest !== origin.packetDigest || researchDigest(savedPacket) !== origin.packetDigest) throw new Error("research_review_packet_mismatch");
  const evidenceBytes = Buffer.from(snapshot.files.evidence, "base64");
  JSON.parse(evidenceBytes.toString("utf8"));
  // The producer writes canonical Python JSON plus one LF. Hash its retained
  // bytes: parsing/re-encoding loses provider float lexemes such as 1.0/0.0.
  const canonicalEvidence = evidenceBytes.at(-1) === 0x0a ? evidenceBytes.subarray(0, -1) : evidenceBytes;
  if (hash(canonicalEvidence) !== row.evidence_digest) throw new Error("research_evidence_digest_mismatch");
  const review = row.review;
  if (review?.packet_digest !== origin.packetDigest || !review.reviewer_reference
    || review.source_support_verified !== true || review.crm_rechecked !== true
    || !(candidateKey === null ? Array.isArray(review.accepted_keys) : review.accepted_keys?.includes(candidateKey))) throw new Error("research_quality_review_missing");
  const selected = row.packet.candidates.filter((item: any) => review.accepted_keys.includes(item.candidate_key));
  if (!row.packet.destinations?.sheet_id || typeof review.summary !== "string") throw new Error("research_publication_target_missing");
  const expected: Record<string, unknown> = {
    sheets: { sheet_id: row.packet.destinations.sheet_id, tab: "Prospects", candidates: selected },
    notion: { parent_id: row.packet.destinations.notion_parent, summary: review.summary, candidates: selected },
  };
  for (const destination of ["sheets", "notion"]) {
    const delivery = row.delivery?.[destination];
    if (destination === "notion" && delivery?.state !== "acknowledged") continue;
    const receipt = delivery?.receipt;
    if (delivery?.state !== "acknowledged" || receipt?.readback_verified !== true || !receipt.reference
      || receipt.key !== delivery.key || receipt.payload_digest !== delivery.payload_digest
      || researchDigest(delivery.payload) !== delivery.payload_digest
      || delivery.key !== `${row.run_key}:${destination}`
      || researchDigest(expected[destination]) !== verifiedPayloadDigest(delivery)
      || receipt.destination !== destination) throw new Error(`research_${destination}_readback_missing`);
  }
  return { row, selected };
}

/** The QA turn behind the row's review. A null `candidateKey` checks a hypothesis-only day. */
function publishedQaResult(snapshot: any, row: any, origin: PublicationOrigin, candidateKey: string | null) {
  const qa = row.qa;
  const qaBytes = Buffer.from(snapshot.files.qa ?? "", "base64");
  if (qa?.state !== "validated" || qa.turn_status !== "completed" || !qa.turn_id
    || row.review.reviewer_reference !== `agent-turn:${row.session_id}:${qa.turn_id}`
    || createHash("sha256").update(qaBytes).digest("hex") !== qa.artifact_digest
    || row.review.qa_artifact_digest !== qa.artifact_digest
    || communicationsDigest(qa.decision) !== communicationsDigest(row.review)) throw new Error("research_adapter_qa_binding_missing");
  const qaResult = JSON.parse(qaBytes.toString("utf8"));
  if (qaResult.schema_version !== "blueprint.research-qa.v1" || qaResult.packet_digest !== origin.packetDigest
    || qaResult.crm_digest !== qa.crm_digest || qaResult.source_support_verified !== true
    || qaResult.summary !== row.review.summary || !Array.isArray(qaResult.accepted_keys)
    || !Array.isArray(qaResult.checks) || (candidateKey !== null && (!qaResult.accepted_keys.includes(candidateKey)
      || !qaResult.checks.some((check: any) => check.candidate_key === candidateKey
        && check.source_support_verified === true && check.duplicate === false)))) throw new Error("research_adapter_qa_binding_missing");
  return qaResult;
}

const SHEETS_PROSPECT_ID = /^BP-\d{6}$/;
/** Exactly `BP-` and six digits, with no whitespace on either side. The anchored pattern
 * already refuses it (no multiline flag); the explicit trim keeps that true if it changes. */
const isSheetsProspectId = (value: unknown): value is string => typeof value === "string" && value === value.trim()
  && SHEETS_PROSPECT_ID.test(value);
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** The Sheets plan behind the receipt. The receipt covers every row. Day-level identity
 * covers the verified rows only: each is found byte-identical, in QA order, with a
 * well-formed ID of its own. On a day without hypotheses that is exactly the old
 * positional check. Any other row is the hypotheses block's to check, except a row that
 * reuses a verified row's ID or content: that makes the verified row's CRM identity
 * ambiguous, so it still rejects the day. */
function publishedSheetRows(row: any, selected: any[], sheetsReceipt: unknown) {
  const delivery = row.delivery.sheets, plan = delivery.plan;
  const rows = plan?.sheet_rows;
  if (!Array.isArray(rows) || (publishedHypothesesDeclared(row) ? rows.length < selected.length : rows.length !== selected.length)
    || plan.destination !== "sheets" || plan.key !== delivery.key || plan.payload_digest !== delivery.payload_digest
    || plan.marker !== `[${delivery.key};${delivery.payload_digest}]`
    || plan.body_json !== JSON.stringify({ majorDimension: "ROWS", values: rows })
    || plan.request_digest !== createHash("sha256").update(plan.body_json).digest("hex")) throw new Error("research_adapter_sheet_identity_missing");
  const ids: unknown[] = rows.map((entry: unknown) => Array.isArray(entry) ? entry[0] : undefined);
  // The handoff keeps this receipt and is checked against it on the send path. Its schema
  // trims and caps the receipt, so a receipt it would change could never verify again.
  if (typeof sheetsReceipt !== "string" || sheetsReceipt !== sheetsReceipt.trim() || sheetsReceipt.length > SHEETS_RECEIPT_MAX_LENGTH
    || sheetsReceipt !== `sheets:${row.packet.destinations.sheet_id}:Prospects:${ids.join(",")}`) throw new Error("research_adapter_sheet_identity_missing");
  const verifiedPositions: number[] = [];
  for (const item of selected) {
    const task = item.evidence?.find((entry: any) => entry.role === "task");
    const capability = item.evidence?.find((entry: any) => entry.role === "capability");
    if (!task || !capability && item.potential_robot_match !== "unknown" || !["unqualified", "needs_review"].includes(item.qualification_status)) throw new Error("research_adapter_candidate_invalid");
    const expected = (id: unknown) => [id, item.organization, "Facility / site", item.site, "", "", "Needs recheck", "",
      item.potential_robot_match, task.url, "Research", "", `${item.proposed_next_action}\n${plan.marker}`, "", item.task,
      capability?.url || "", "Unverified", item.location, row.date];
    let position = (verifiedPositions.at(-1) ?? -1) + 1;
    while (position < rows.length && !(isSheetsProspectId(ids[position])
      && researchDigest(rows[position]) === researchDigest(expected(ids[position])))) position++;
    if (position >= rows.length) throw new Error("research_adapter_sheet_identity_missing");
    verifiedPositions.push(position);
  }
  const verifiedIds = verifiedPositions.map(position => ids[position] as string);
  const verifiedContent = new Set(verifiedPositions.map(position => researchDigest(rows[position].slice(1))));
  const hypothesisPositions = rows.map((_entry: unknown, position: number) => position).filter((position: number) => !verifiedPositions.includes(position));
  if (new Set(verifiedIds).size !== verifiedIds.length || hypothesisPositions.some((position: number) => verifiedIds.includes(ids[position] as string)
    || (Array.isArray(rows[position]) && verifiedContent.has(researchDigest(rows[position].slice(1)))))) throw new Error("research_adapter_sheet_identity_missing");
  return { plan, rows, ids, verifiedIds, verifiedPositions, hypothesisPositions };
}

/** Exact producer-owned candidate, QA and publication identity. No research writes. */
export function researchPublicationSource(snapshot: any, origin: CommunicationsBrief["researchOrigin"]) {
  if (origin.admissionId || snapshot?.schema_version === "blueprint.reviewed-research-snapshot.v1") return reviewedResearchPublication(snapshot, origin).source;
  const { row, candidate, selected, sheetsReceipt, notionReceipt } = verifyResearchPublication(snapshot, origin);
  const qa = row.qa;
  const qaResult = publishedQaResult(snapshot, row, origin, origin.candidateKey);
  const check = qaResult.checks.find((check: any) => check.candidate_key === origin.candidateKey);
  const assessment = check?.lead_verification;
  const retained = row.review.lead_verification?.results?.find((result: any) => result.candidate_key === origin.candidateKey);
  if ((assessment != null || retained != null) && (!retained
    || verificationDigest(assessment ?? null) !== retained.assessment_digest
    || verificationDigest(assessment ?? null) !== verificationDigest(retained.assessment ?? null))) throw new Error("research_adapter_lead_verification_binding_missing");
  if (assessment != null) {
    for (const member of leadPacketCandidates(row.packet)) {
      const raw = qaResult.checks.find((entry: any) => entry.candidate_key === member.candidate_key)?.lead_verification ?? null;
      const result = row.review.lead_verification.results.find((entry: any) => entry.candidate_key === member.candidate_key);
      if (!result || result.candidate_digest !== verificationDigest(member)
        || result.assessment_digest !== verificationDigest(raw)
        || verificationDigest(result.assessment ?? null) !== verificationDigest(raw)) throw new Error("research_adapter_lead_verification_binding_missing");
    }
  }
  const duplicateChecks = Object.fromEntries(qaResult.checks.map((check: any) => [check.candidate_key,
    { duplicate: check.duplicate, duplicate_of: check.duplicate_of ?? null, reason: check.reason }]));
  if (row.review.lead_verification?.duplicate_checks && communicationsDigest(duplicateChecks)
    !== communicationsDigest(row.review.lead_verification.duplicate_checks)) throw new Error("research_adapter_lead_verification_binding_missing");
  const { plan, verifiedIds } = publishedSheetRows(row, selected, sheetsReceipt);
  if (notionReceipt !== null && (typeof notionReceipt !== "string" || !/^notion:[a-f0-9-]{32,36}$/.test(notionReceipt))) throw new Error("research_adapter_notion_identity_missing");
  return {
    version: "blueprint.communications-research-source.v1" as const,
    runKey: row.run_key, date: origin.date, candidateKey: origin.candidateKey,
    packetDigest: origin.packetDigest, rawArtifactDigest: origin.rawArtifactDigest,
    candidate, researchReview: row.review, qaArtifactDigest: qa.artifact_digest,
    ...(assessment != null ? { leadVerification: assessment, leadVerificationCohort: {
      candidates: leadPacketCandidates(row.packet), assessments: Object.fromEntries(qaResult.checks.map((check: any) => [check.candidate_key, check.lead_verification ?? null])), duplicateChecks,
      // Only pinned (v2, or v3 on outreach-ready days) rows gain this field, so earlier publications keep their digest shape.
      ...(row.packet.lead_verification_result_version ? { resultVersion: row.packet.lead_verification_result_version } : {}) } } : {}),
    sheetsId: row.packet.destinations.sheet_id,
    sheetsProspectId: verifiedIds[selected.findIndex((item: any) => item.candidate_key === origin.candidateKey)],
    sheetsReceipt, notionReceipt, sheetsPlanDigest: researchDigest(plan),
    // Preserve the byte/digest shape of previously admitted API publications.
    ...(notionReceipt === null ? { sourceRecordUrl: `https://docs.google.com/spreadsheets/d/${row.packet.destinations.sheet_id}/edit` } : {}),
  };
}

export type PublishedHypothesis = { candidateKey: string; sheetsProspectId: string; candidateDigest: string;
  openChecks: string[]; openQuestions: string[]; validUntil: string | null };
export type PublishedHypotheses = { state: "absent" } | { state: "recorded"; entries: PublishedHypothesis[] }
  | { state: "invalid"; reason: string };

/** Outreach-ready hypotheses published beside the verified rows. Day-level publication
 * integrity throws exactly as it does for a verified row. The block itself is checked
 * strictly; a malformed block comes back `invalid` and never changes, rejects or
 * promotes a verified row. Nothing here recomputes the tier, so an entry is a record
 * of the publication, never an admission, eligibility or send authority. */
export function researchPublicationHypotheses(snapshot: any): PublishedHypotheses {
  const row = snapshot?.row;
  if (snapshot?.schema_version !== "blueprint.research-snapshot.v1" || !publishedHypothesesDeclared(row)) return { state: "absent" };
  const origin = { date: row.date, packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest };
  const { selected } = publishedResearchDay(snapshot, origin, null);
  const qaResult = publishedQaResult(snapshot, row, origin, null);
  const sheet = publishedSheetRows(row, selected, row.delivery.sheets.receipt.reference);
  try { return { state: "recorded", entries: hypothesisEntries(row, qaResult, selected, sheet) }; }
  catch (error) {
    return { state: "invalid", reason: error instanceof Error && error.message.startsWith(`${HYPOTHESIS_INVALID}:`)
      ? error.message : `${HYPOTHESIS_INVALID}:unreadable` };
  }
}

/** Pipeline phase-1 shape: `review.outreach_ready_keys` (QA listed, disjoint from the
 * accepted keys), the same `hypotheses[{candidate, open_checks, open_questions}]` in
 * every acknowledged payload, one QA check and one retained v3 result with tier
 * `outreach_ready` per hypothesis, and one Sheets row per hypothesis in the existing 19
 * columns, after every verified row. */
function hypothesisEntries(row: any, qaResult: any, selected: any[], sheet: ReturnType<typeof publishedSheetRows>): PublishedHypothesis[] {
  const fail = (detail: string): never => { throw new Error(`${HYPOTHESIS_INVALID}:${detail}`); };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const review = row.review, keys = review.outreach_ready_keys;
  if (!Array.isArray(keys) || !keys.length || keys.length > 100 || keys.some((key: unknown) => typeof key !== "string" || !key)
    || new Set(keys).size !== keys.length) fail("outreach_ready_keys");
  if (keys.some((key: string) => review.accepted_keys.includes(key))) fail("outreach_ready_keys_overlap_accepted_keys");
  if (!Array.isArray(qaResult.outreach_ready_keys) || keys.some((key: string) => !qaResult.outreach_ready_keys.includes(key))) fail("outreach_ready_keys_not_listed_by_qa");
  if (row.packet.lead_verification_result_version !== LEAD_OUTREACH_RESULT_VERSION) fail("lead_verification_result_version");
  const published = row.delivery.sheets.payload.hypotheses;
  if (!Array.isArray(published) || published.length !== keys.length) fail("sheets_payload");
  const notion = row.delivery.notion;
  if (notion?.state === "acknowledged" && researchDigest(notion.payload?.hypotheses ?? null) !== researchDigest(published)) fail("notion_payload");
  if (sheet.hypothesisPositions.length !== published.length) fail("sheet_rows");
  if (sheet.hypothesisPositions.some(position => position < (sheet.verifiedPositions.at(-1) ?? -1))) fail("sheet_rows_order");
  const results: any[] = Array.isArray(review.lead_verification?.results) ? review.lead_verification.results : [];
  // The rule the cohort was published under chooses the question's wording; a row is never re-worded.
  const ruleVersion = review.lead_verification?.outreach_rule_version;
  if (!isOutreachRuleVersion(ruleVersion)) fail("outreach_rule_version");
  const seen = new Set<string>(), seenIds = new Set<unknown>();
  return published.map((entry: any, index: number) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || !same(Object.keys(entry).sort(), ["candidate", "open_checks", "open_questions"])) fail(`entry_${index}`);
    const key = entry.candidate?.candidate_key;
    const candidate = row.packet.candidates.find((item: any) => item.candidate_key === key);
    if (typeof key !== "string" || !keys.includes(key) || seen.has(key) || !candidate
      || researchDigest(entry.candidate) !== researchDigest(candidate)) fail(`candidate_${index}`);
    seen.add(key);
    // Exactly one QA check: source support verified and not a duplicate.
    const checks = qaResult.checks.filter((check: any) => check?.candidate_key === key);
    if (checks.length !== 1 || checks[0].source_support_verified !== true || checks[0].duplicate !== false) fail(`qa_check_${index}`);
    const assessment = checks[0].lead_verification;
    const retained = results.filter(result => result?.candidate_key === key);
    if (!assessment || typeof assessment !== "object" || retained.length !== 1 || retained[0].version !== LEAD_OUTREACH_RESULT_VERSION
      || retained[0].tier !== "outreach_ready" || retained[0].eligible_for_outreach_ready !== true
      || retained[0].eligible_for_qualified_promotion !== false || retained[0].candidate_digest !== verificationDigest(candidate)
      || retained[0].assessment_digest !== verificationDigest(assessment)
      || verificationDigest(retained[0].assessment ?? null) !== verificationDigest(assessment)) fail(`lead_verification_${index}`);
    // Open checks in rule order, then exactly one question, from the template the open checks choose
    // (S, then M, then A; v1.2 asks U instead of A unless automation evidence is recorded), in the
    // wording of the row's own rule version.
    const openChecks = [...(assessment.claims?.site_task?.status !== "verified_fact" ? ["site_link"] : []),
      ...(assessment.claims?.human_workflow?.status !== "verified_fact" ? ["manual_workflow"] : []),
      ...(assessment.valid_until === null ? ["freshness"] : []), "existing_automation", "fit", "interest"];
    if (!same(entry.open_checks, openChecks)) fail(`open_checks_${index}`);
    const question = outreachReadyQuestion(openChecks, candidate.task, candidate.site, { location: candidate.location,
      // Counterevidence alone may be about another task/site; it cannot justify "the rest of".
      partialAutomation: false, ruleVersion: ruleVersion as OutreachRuleVersion });
    if (!same(entry.open_questions, [question])) fail(`open_questions_${index}`);
    // Recorded as published. Expiry is phase-2 admission's to judge, so replays stay stable.
    const validUntil = assessment.valid_until;
    if (validUntil !== null && !(typeof validUntil === "string" && ISO_TIMESTAMP.test(validUntil)
      && Number.isFinite(Date.parse(validUntil)))) fail(`valid_until_${index}`);
    const task = candidate.evidence?.find((item: any) => item.role === "task");
    const capability = candidate.evidence?.find((item: any) => item.role === "capability");
    if (!task || !capability && candidate.potential_robot_match !== "unknown"
      || !["unqualified", "needs_review"].includes(candidate.qualification_status)) fail(`candidate_scope_${index}`);
    const position = sheet.hypothesisPositions[index], id = sheet.ids[position];
    if (!isSheetsProspectId(id) || seenIds.has(id)) fail(`sheet_row_id_${index}`);
    seenIds.add(id);
    const expected = [id, candidate.organization, "Facility / site", candidate.site, "", "", "Hypothesis", "",
      candidate.potential_robot_match, task.url, "Research", "", `First email asks: ${question}\n${sheet.plan.marker}`, "",
      candidate.task, capability?.url || "", "Outreach-ready: operator, site, task proven", candidate.location, row.date];
    if (researchDigest(sheet.rows[position]) !== researchDigest(expected)) fail(`sheet_row_${index}`);
    return { candidateKey: key, sheetsProspectId: id as string, candidateDigest: verificationDigest(candidate),
      openChecks, openQuestions: [question], validUntil };
  });
}

// ---------------------------------------------------------------------------------------------
// Phase 2: outreach-ready hypotheses admitted for drafting. Draft only: verifyPublishedResearch above
// stays the strict send-path check and refuses every hypothesis brief.

const DIRECTION_URI = /^gs:\/\/blueprint-8c1ca\.appspot\.com\/operations\/research\/outreach-ready\/([a-f0-9]{64})\/direction\.json$/;
/** The owner direction this run froze (Pipeline outreach_ready.freeze). Drafting needs it enabled for
 * daily QA, labelled hypothesis, draft only, under this rule and unexpired; the brief binds its pin. */
function frozenOutreachDirection(row: any, now: number) {
  const frozen = row?.outreach_ready;
  const match = typeof frozen?.uri === "string" ? DIRECTION_URI.exec(frozen.uri) : null;
  if (!frozen || typeof frozen !== "object" || Array.isArray(frozen) || frozen.schema_version !== "blueprint.outreach-ready-admission.v1"
    || frozen.state !== "enabled" || frozen.run_key !== row.run_key || frozen.sends_authorized !== false || frozen.label !== "hypothesis"
    || !isOutreachRuleVersion(frozen.rule_version) || !Array.isArray(frozen.paths) || !frozen.paths.includes("daily_qa")
    || !match || match[1] !== frozen.direction_sha256 || typeof frozen.generation !== "string" || !/^[1-9][0-9]{0,18}$/.test(frozen.generation)
    || typeof frozen.valid_until !== "string" || !Number.isFinite(Date.parse(frozen.valid_until))) throw new Error("outreach_ready_direction_unusable");
  if (Date.parse(frozen.valid_until) <= now) throw new Error("outreach_ready_direction_expired");
  return { uri: frozen.uri as string, generation: frozen.generation as string, sha256: frozen.direction_sha256 as string,
    approvalReference: typeof frozen.approval_reference === "string" ? frozen.approval_reference : null, validUntil: frozen.valid_until as string };
}

/** A file the research Store exported into the snapshot: `<date>-<name>.json` is `files[<name>]`. */
function snapshotFile(snapshot: any, date: string, name: string): Buffer | null {
  if (typeof name !== "string" || !name.startsWith(`${date}-`) || !name.endsWith(".json")) return null;
  const key = name.slice(date.length + 1, -5), files = snapshot?.files;
  return files && typeof files === "object" && Object.hasOwn(files, key) && typeof files[key] === "string" ? Buffer.from(files[key], "base64") : null;
}

/** A published outreach-ready hypothesis, re-verified for drafting from a fresh snapshot: the phase-1
 * publication checks, the run's frozen owner direction, the retained tool evidence the review recorded,
 * and the tier recomputed by the TypeScript mirror at `now`, which must equal the published tier block
 * exactly. Any difference refuses, so this never admits what Pipeline did not publish. */
export function hypothesisPublicationSource(snapshot: any, candidateKey: string, now: number) {
  const published = researchPublicationHypotheses(snapshot);
  if (published.state === "invalid") throw new Error(published.reason);
  const entry = published.state === "recorded" ? published.entries.find(item => item.candidateKey === candidateKey) : undefined;
  if (!entry) throw new Error("research_hypothesis_not_published");
  const row = snapshot.row, direction = frozenOutreachDirection(row, now), lead = row.review.lead_verification;
  // One rule throughout: the frozen direction's, the cohort's and (via the recomputed block) each result's.
  if (lead?.result_version !== LEAD_OUTREACH_RESULT_VERSION || !isOutreachRuleVersion(lead.outreach_rule_version)
    || lead.outreach_rule_version !== row.outreach_ready.rule_version) throw new Error("outreach_ready_rule_version_mismatch");
  const ruleVersion = lead.outreach_rule_version;
  const results: any[] = lead.results, candidates = leadPacketCandidates(row.packet);
  // The tier is recomputed from these retained results and duplicate checks, so each must be QA's own, as
  // for a verified row (researchPublicationSource): every member's result binds its candidate and QA's
  // assessment, and the duplicate checks are exactly QA's.
  const qaResult = publishedQaResult(snapshot, row, { date: row.date, packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest }, null);
  for (const member of candidates) {
    const result = results.filter(item => item?.candidate_key === member.candidate_key);
    const raw = qaResult.checks.find((check: any) => check.candidate_key === member.candidate_key)?.lead_verification ?? null;
    if (result.length !== 1 || result[0].candidate_digest !== verificationDigest(member) || result[0].assessment_digest !== verificationDigest(raw)
      || verificationDigest(result[0].assessment ?? null) !== verificationDigest(raw)) throw new Error("research_adapter_lead_verification_binding_missing");
  }
  const duplicateChecks = Object.fromEntries(qaResult.checks.map((check: any) => [check.candidate_key,
    { duplicate: check.duplicate, duplicate_of: check.duplicate_of ?? null, reason: check.reason }]));
  if (communicationsDigest(duplicateChecks) !== communicationsDigest(lead.duplicate_checks ?? null)) throw new Error("research_adapter_lead_verification_binding_missing");
  let evidence: ReturnType<typeof retainedOutreachEvidence>;
  try { evidence = retainedOutreachEvidence(row, name => snapshotFile(snapshot, row.date, name)); }
  catch { throw new Error("outreach_ready_evidence_unavailable"); }
  if (communicationsDigest(outreachEvidenceSummary(evidence)) !== communicationsDigest(lead.tier_evidence ?? null)) throw new Error("outreach_ready_evidence_changed");
  const recomputed = evaluateOutreachTier(candidates, Object.fromEntries(results.map(item => [item.candidate_key, item.assessment ?? null])),
    now, lead.duplicate_checks ?? {}, evidence, ruleVersion).results.find(item => item.candidate_key === candidateKey);
  const publishedResult = results.find(item => item.candidate_key === candidateKey);
  const tierOf = (value: any) => ({ tier: value?.tier ?? null, eligible: value?.eligible_for_outreach_ready ?? null, block: value?.outreach_ready ?? null });
  if (recomputed?.tier !== "outreach_ready") {
    throw new Error(recomputed?.outreach_ready.blockers.includes("assessment_expired") ? "outreach_ready_assessment_expired" : "outreach_ready_tier_mismatch");
  }
  if (communicationsDigest(tierOf(recomputed)) !== communicationsDigest(tierOf(publishedResult))
    || communicationsDigest(recomputed.outreach_ready.open_checks) !== communicationsDigest(entry.openChecks)
    || communicationsDigest(recomputed.outreach_ready.open_questions) !== communicationsDigest(entry.openQuestions)) throw new Error("outreach_ready_tier_mismatch");
  const candidate = row.packet.candidates.find((item: any) => item.candidate_key === candidateKey), assessment = publishedResult.assessment;
  // Never under a verified row: no candidate QA accepted shares this operator, site and task.
  const identity = leadIdentityKey(candidate);
  if (!identity || row.packet.candidates.some((item: any) => row.review.accepted_keys.includes(item.candidate_key) && leadIdentityKey(item) === identity)) {
    throw new Error("outreach_ready_candidate_under_verified_row");
  }
  // People a research quote names, at the level the same retained evidence proves the quote.
  const prove = outreachQuoteProver(evidence), personEvidence: HypothesisPersonEvidence[] = [], seen = new Set<string>();
  for (const item of [...(Array.isArray(candidate.evidence) ? candidate.evidence : []).map((value: any) => ({ url: value?.url, quote: value?.quote,
    checkedAt: value?.source_checked_at ?? value?.checked_date })), ...(Array.isArray(assessment.sources) ? assessment.sources : [])
    .map((value: any) => ({ url: value?.url, quote: value?.quote, checkedAt: value?.checked_at }))]) {
    if (typeof item.url !== "string" || typeof item.quote !== "string" || typeof item.checkedAt !== "string" || !publishedPeople(item.quote).length) continue;
    const level = prove(item.quote, item.url), key = communicationsDigest([item.url, item.quote]);
    if (!level || seen.has(key)) continue;
    seen.add(key); personEvidence.push({ url: item.url, quote: item.quote, checkedAt: item.checkedAt, ...level });
  }
  const notionReceipt = row.delivery?.notion?.state === "acknowledged" ? row.delivery.notion.receipt.reference : null;
  const source = {
    version: "blueprint.communications-hypothesis-source.v1" as const,
    runKey: row.run_key, date: row.date, candidateKey, packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest,
    candidate, researchReview: row.review, qaArtifactDigest: row.qa.artifact_digest, leadVerification: assessment,
    hypothesis: { tier: "outreach_ready" as const, label: "hypothesis" as const, ruleVersion,
      openChecks: entry.openChecks, openQuestions: entry.openQuestions, validUntil: entry.validUntil,
      provingSources: recomputed.outreach_ready.proving_sources, tierEvidence: lead.tier_evidence, direction },
    sheetsId: row.packet.destinations.sheet_id, sheetsProspectId: entry.sheetsProspectId,
    sheetsReceipt: row.delivery.sheets.receipt.reference as string, notionReceipt: notionReceipt as string | null,
    sheetsPlanDigest: researchDigest(row.delivery.sheets.plan),
    ...(notionReceipt === null ? { sourceRecordUrl: `https://docs.google.com/spreadsheets/d/${row.packet.destinations.sheet_id}/edit` } : {}),
  };
  return { source, entry, personEvidence };
}
export type HypothesisSource = ReturnType<typeof hypothesisPublicationSource>["source"];

/** The draft's proven facts: each quote the tier proved, at its source, as dated background. */
export function hypothesisFacts(source: HypothesisSource): CommunicationsBrief["facts"] {
  const sources = new Map<string, any>((Array.isArray(source.leadVerification.sources) ? source.leadVerification.sources : [])
    .map((item: any) => [item?.id, item]));
  const facts: CommunicationsBrief["facts"] = [], seen = new Set<string>();
  for (const proof of source.hypothesis.provingSources) {
    const item = sources.get(proof.source_id);
    if (!item || typeof item.quote !== "string" || item.url !== proof.url) throw new Error("outreach_ready_proving_source_missing");
    const claim = item.quote.trim(), key = communicationsDigest([claim, item.url]);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ id: `hypothesis-fact-${communicationsDigest({ candidateKey: source.candidateKey, sourceId: proof.source_id, url: item.url, quote: item.quote })}`,
      claim, sourceUrl: item.url, evidenceClass: item.classification === "operator" ? "operator_stated" : "primary",
      sourceCheckedAt: item.checked_at, publishedAt: item.source_date ?? null, eventAt: null, assertionScope: "as_of_background", consequential: true });
  }
  return facts;
}
/** The brief's qualification block: the published tier, label, open checks, one question and owner direction. */
export function hypothesisQualification(source: HypothesisSource): NonNullable<CommunicationsBrief["qualification"]> {
  const direction = source.hypothesis.direction;
  return { tier: "outreach_ready", label: "hypothesis", openChecks: source.hypothesis.openChecks as any, openQuestions: source.hypothesis.openQuestions,
    ownerDecision: { reference: OUTREACH_READY_OWNER_DECISION_REFERENCE, direction: { uri: direction.uri, generation: direction.generation, sha256: direction.sha256 } },
    sendsAuthorized: false };
}

/** The draft worker's check for a hypothesis brief, rerun before and during every draft. It re-verifies
 * the published day, direction and tier at `now`, then binds the brief's source, facts, qualification
 * and contact proof to it. It grants no send authority: verifyPublishedResearch still refuses the brief. */
export function verifyPublishedHypothesisForDraft(snapshot: any, brief: CommunicationsBrief, approval: unknown, contactProof: unknown, now = Date.now()) {
  if (!brief?.qualification) throw new Error("research_hypothesis_brief_required");
  const handoff = verifyCommunicationsHandoff(approval, brief), origin = brief.researchOrigin, row = snapshot?.row;
  if (origin.admissionId || Object.hasOwn(origin, "screenAdmissionId") || origin.contactEvidenceKind !== "public_source_resolution"
    || !origin.sourceDigest || !origin.contactEvidenceDigest) throw new Error("research_hypothesis_origin_invalid");
  if (row?.date !== origin.date || row?.packet_digest !== origin.packetDigest || row?.raw_output_digest !== origin.rawArtifactDigest) {
    throw new Error("research_publication_context_missing");
  }
  const { source, entry, personEvidence } = hypothesisPublicationSource(snapshot, origin.candidateKey, now);
  if (communicationsDigest(source) !== origin.sourceDigest) throw new Error("research_adapter_source_changed");
  if (handoff.sheetsReceipt !== source.sheetsReceipt || handoff.notionReceipt !== source.notionReceipt) throw new Error("research_publication_receipt_changed");
  if (communicationsDigest(brief.qualification) !== communicationsDigest(hypothesisQualification(source))
    || brief.contact.learningQuestion !== entry.openQuestions[0]) throw new Error("research_hypothesis_qualification_changed");
  const contact = verifyHypothesisContactResolution(contactProof, source, brief.prospectId, personEvidence);
  if (contact.evidenceDigest !== origin.contactEvidenceDigest || contact.email !== brief.contact.email.toLowerCase()
    || contact.sourceUrl !== brief.contact.sourceUrl || contact.sourceCheckedAt !== brief.contact.sourceCheckedAt
    || brief.contact.scope !== contact.scope || brief.consent.status !== "public_business_contact"
    || communicationsDigest(brief.contact.recipient ?? null) !== communicationsDigest(contact.recipient)
    || communicationsDigest(brief.contact.resolvedMissingContactGaps ?? []) !== communicationsDigest(contact.resolvedGaps)) {
    throw new Error("research_contact_evidence_changed");
  }
  if (communicationsDigest(brief.facts) !== communicationsDigest(hypothesisFacts(source)) || brief.facilityName !== source.candidate.organization
    || brief.boundedJob !== source.candidate.task) throw new Error("brief_fact_not_in_published_research");
  return { runKey: row.run_key, packetDigest: row.packet_digest, sheetsReceipt: source.sheetsReceipt, notionReceipt: source.notionReceipt,
    briefDigest: communicationsDigest(brief) };
}
