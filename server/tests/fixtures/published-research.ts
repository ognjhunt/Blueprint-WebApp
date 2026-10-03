import { createHash } from "node:crypto";
import { researchDigest } from "../../agents/communications-research";
import type { CommunicationsResearchInput } from "../../agents/communications-producer";
import { communicationsFixture } from "./communications";
import { syntheticLeadVerification, syntheticVerificationCohort } from "./lead-verification";
import { PUBLIC_CONTACT_PREFIX } from "../../agents/communications-contact-evidence";

/** Synthetic records shaped like the pinned v3 runner/consumer/publisher output.
 * Unlike the original consumer fixture, this includes full QA and publication plans. */
export function publishedResearchFixture(options: { unknowns?: string[]; taskClaim?: string;
  verificationAssessedAt?: string; leadVerification?: boolean; publicContact?: boolean; naturalContact?: boolean; actualProducer?: boolean; date?: string; mutateCandidate?: (candidate: any) => void } = {}) {
  const { snapshot, brief, output } = communicationsFixture();
  const candidate = {
    candidate_key: "candidate-1", identity_keys: ["candidate-1"],
    organization: brief.facilityName, organization_url: "https://facility.example",
    site: "Synthetic packing site", location: "Synthetic location", task: brief.boundedJob,
    potential_robot_match: "Public packing robot research; no qualified match",
    qualification_status: "needs_review", confidence: "low",
    unknowns: options.unknowns ?? [...brief.unknowns], proposed_next_action: "Verify the public business contact route",
    evidence: [
      { claim: options.taskClaim ?? brief.facts[0].claim, url: brief.facts[0].sourceUrl, publisher: "Synthetic facility operator",
        source_date: "2026-09-29", checked_date: "2026-09-30", classification: "operator", claim_kind: "fact", role: "task",
        quote: "Synthetic packing job excerpt", origin: "live", evidence_level: null,
        source_checked_at: brief.facts[0].sourceCheckedAt, snapshot_loaded_at: null, revalidated_at: null,
        snapshot_record_id: null, snapshot_fact_id: null, assertion_scope: "current_operational" },
      { claim: "The vendor reports a packing application", url: "https://robot.example/packing", publisher: "Synthetic robot vendor",
        source_date: "2026-09-28", checked_date: "2026-09-30", classification: "vendor", claim_kind: "vendor_claim", role: "capability",
        quote: "Vendor statement; no independent test", origin: "live", evidence_level: "vendor_claim",
        source_checked_at: "2026-09-30T20:00:00Z", snapshot_loaded_at: null, revalidated_at: null,
        snapshot_record_id: null, snapshot_fact_id: null, assertion_scope: "as_of_background" },
      { claim: "The site is listed in the synthetic location", url: "https://facility.example/location", publisher: "Synthetic operator",
        source_date: null, checked_date: "2026-09-30", classification: "operator", claim_kind: "fact", role: "geography",
        quote: "Synthetic address", origin: "live", evidence_level: null,
        source_checked_at: "2026-09-30T20:00:00Z", snapshot_loaded_at: null, revalidated_at: null,
        snapshot_record_id: null, snapshot_fact_id: null, assertion_scope: "current_operational" },
      { claim: "An older vendor report describes a packing application", url: "https://robot.example/background", publisher: "Synthetic vendor",
        source_date: "2026-09-28", checked_date: "2026-09-29", classification: "vendor", claim_kind: "vendor_claim", role: "background",
        quote: "Dated vendor statement", origin: "snapshot", evidence_level: "vendor_claim",
        source_checked_at: "2026-09-29T20:00:00Z", snapshot_loaded_at: "2026-09-30T19:00:00Z", revalidated_at: null,
        snapshot_record_id: "snapshot-record-7", snapshot_fact_id: "snapshot-fact-9", assertion_scope: "as_of_background" },
    ],
  };
  if (options.publicContact) candidate.evidence.push({ ...candidate.evidence[0],
    claim: PUBLIC_CONTACT_PREFIX + JSON.stringify({ organization: candidate.organization, site: candidate.site,
      email: brief.contact.email, purpose: "business_inquiries", status: "public_business_contact" }),
    url: brief.contact.sourceUrl, quote: `Public business contact for business inquiries: ${brief.contact.email}` });
  if (options.naturalContact) candidate.evidence.push({ ...candidate.evidence[0],
    claim: "The operator publishes a route for business inquiries", url: brief.contact.sourceUrl,
    quote: `${candidate.organization}, ${candidate.site}: business inquiries: ${brief.contact.email}` });
  options.mutateCandidate?.(candidate);
  const row: any = snapshot.row;
  if (options.date) { row.date = options.date; row.run_key = `blueprint-researcher:${options.date}`; }
  const producerContext: any = { content_hash: "a".repeat(64), snapshot_loaded_at: "2026-09-30T19:00:00Z", records: [] };
  const producerPolicy: any = { schema_version: "blueprint.knowledge-refresh-policy.v1", snapshot_content_hash: producerContext.content_hash,
    approval_reference: "OFFLINE_FIXTURE_NOT_LIVE_POLICY", classes: { stable_versioned_embodiment_or_specification: 90, vendor_capability_or_limit: 30,
      dated_historical_report: 90, operational_status_or_requirements: 7, unresolved_conflict: null, explicit_unknown: null }, assignments: [] };
  producerPolicy.policy_hash = researchDigest(producerPolicy);
  producerContext.refresh_policy = Object.fromEntries(["schema_version", "policy_hash", "approval_reference", "classes"].map(key => [key, producerPolicy[key]]));
  if (options.actualProducer) {
    for (const entry of candidate.evidence) Object.assign(entry, { origin: "live", source_checked_at: "2026-09-30T20:00:00Z", checked_date: "2026-09-30",
      snapshot_loaded_at: null, snapshot_record_id: null, snapshot_fact_id: null });
    const normalized = (text: string) => (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).join(" ");
    const suffix = [normalized(candidate.site), normalized(candidate.task)];
    candidate.identity_keys = [researchDigest([new URL(candidate.organization_url).hostname.replace(/^www\./, ""), ...suffix]),
      researchDigest([normalized(candidate.organization), ...suffix])].sort();
    candidate.candidate_key = candidate.identity_keys[0];
  }
  row.packet = { ...row.packet, candidates: [candidate],
    run_key: row.run_key, session_id: row.session_id, turn_id: row.turn_id, checked_date: row.date,
    schema_version: "blueprint.daily-research.v3", snapshot_content_hash: "a".repeat(64),
    snapshot_loaded_at: "2026-09-30T19:00:00Z", refresh_policy_hash: options.actualProducer ? producerPolicy.policy_hash : "b".repeat(64),
    proposed_knowledge_deltas: [], findings: ["Synthetic reviewed sources"], blockers: [], proposed_next_actions: [],
    duplicates: [], scope: "proposals_only_no_outreach", budget_is_hard_cap: false,
    destinations: { sheet_id: "1n95Ih0Swc-q-kZyUaDHoZh6SVzxvf_zt-CRR7i39bWY", sheet_tab: "Prospects",
      notion_parent: "3eb80154161d8116858ed5f376b4b7a9" } };
  row.packet_digest = researchDigest(row.packet);
  // Representative actual runner output, before collect adds candidate/run identity.
  // The producer deliberately has no contact field or magic contact claim.
  const raw = { schema_version: row.packet.schema_version, checked_date: row.date,
    snapshot_content_hash: row.packet.snapshot_content_hash, refresh_policy_hash: row.packet.refresh_policy_hash,
    findings: row.packet.findings, blockers: row.packet.blockers, proposed_next_actions: row.packet.proposed_next_actions,
    proposed_knowledge_deltas: [], candidates: row.packet.candidates.map((item: any) => {
      const { candidate_key: _key, identity_keys: _identities, ...candidate } = item; return candidate;
    }) };
  const artifact = Buffer.from(JSON.stringify(raw));
  row.raw_output_digest = createHash("sha256").update(artifact).digest("hex");
  snapshot.files.artifact = artifact.toString("base64");
  const leadVerification = options.leadVerification === false ? undefined : syntheticLeadVerification(candidate, options.verificationAssessedAt);
  const qaResult = { schema_version: "blueprint.research-qa.v1", packet_digest: row.packet_digest,
    crm_digest: researchDigest([]), source_support_verified: true, accepted_keys: [candidate.candidate_key],
    summary: "Reviewed synthetic site/job/team evidence; contact requires separate verification",
    checks: [{ candidate_key: candidate.candidate_key, source_support_verified: true, duplicate: false, reason: "Synthetic reviewed sources",
      ...(leadVerification ? { lead_verification: leadVerification } : {}) }] };
  const qaBytes = Buffer.from(JSON.stringify(qaResult));
  const artifact_digest = createHash("sha256").update(qaBytes).digest("hex");
  row.review = { packet_digest: row.packet_digest, reviewer_reference: `agent-turn:${row.session_id}:qa-turn-1`,
    source_support_verified: true, crm_rechecked: true, accepted_keys: [candidate.candidate_key],
    summary: qaResult.summary, qa_artifact_digest: artifact_digest,
    ...(leadVerification ? { lead_verification: syntheticVerificationCohort(candidate, leadVerification, Date.parse("2026-09-30T23:00:00Z")) } : {}) };
  row.qa = { state: "validated", turn_status: "completed", turn_id: "qa-turn-1", artifact_digest,
    crm_digest: qaResult.crm_digest, decision: row.review };
  for (const destination of ["sheets", "notion"]) {
    const payload = destination === "sheets" ? { sheet_id: row.packet.destinations.sheet_id, tab: "Prospects", candidates: [candidate] }
      : { parent_id: row.packet.destinations.notion_parent, summary: row.review.summary, candidates: [candidate] };
    const key = `${row.run_key}:${destination}`, payload_digest = researchDigest(payload);
    const sorted = (value: any): any => Array.isArray(value) ? value.map(sorted) : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
    row.delivery[destination] = { state: "acknowledged", key, payload, payload_digest, payload_json: JSON.stringify(sorted(payload)), receipt: {
      destination, key, payload_digest, readback_verified: true,
      reference: destination === "sheets" ? `sheets:${row.packet.destinations.sheet_id}:Prospects:BP-000042`
        : "notion:11111111-2222-3333-4444-555555555555",
    } };
  }
  const delivery = row.delivery.sheets;
  const marker = `[${delivery.key};${delivery.payload_digest}]`;
  const sheet_rows = [["BP-000042", candidate.organization, "Facility / site", candidate.site, "", "", "Needs recheck", "",
    candidate.potential_robot_match, candidate.evidence[0].url, "Research", "", `${candidate.proposed_next_action}\n${marker}`, "",
    candidate.task, candidate.evidence[1].url, "Unverified", candidate.location, row.date]];
  const body_json = JSON.stringify({ majorDimension: "ROWS", values: sheet_rows });
  delivery.plan = { destination: "sheets", key: delivery.key, payload_digest: delivery.payload_digest, marker, sheet_rows,
    body_json, request_digest: createHash("sha256").update(body_json).digest("hex"), crm_values: [[], [], [], [],
      ["Prospect ID", "Organization", "Prospect type", "Site / team", "Contact name", "Contact details", "Verification",
        "Contact source URL", "Robot-team fit", "Task evidence URL", "Stage", "Owner", "Next action", "Next action date", "Task / job",
        "Robot capability evidence URL", "Evidence maturity", "Geography", "Evidence checked date"],
      ["BP-000041", "Previous synthetic organization", "Facility / site", "Previous site", "", "", "Needs recheck", "", "",
        "https://previous.example/task", "Research", "", "", "", "Previous job"]] };
  Object.assign(snapshot.files, { qa: qaBytes.toString("base64"), "qa-evidence": Buffer.from("[]").toString("base64"),
    review: Buffer.from(JSON.stringify({ ...row.packet, packet_digest: row.packet_digest })).toString("base64") });
  const prospect = { facilityName: brief.facilityName, hypothesisedTask: brief.boundedJob,
    contactEmail: brief.contact.email, stage: "drafted", connectionEvidence: null, verifiedCapabilities: [] };
  const input: CommunicationsResearchInput = { date: row.date, candidateKey: candidate.candidate_key, context: {
    siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, decision: brief.decision, decisionOwner: null,
    purpose: brief.contact.purpose, learningQuestion: brief.contact.learningQuestion,
    contactSourceEmail: brief.contact.email, contactSourceUrl: brief.contact.sourceUrl,
    contactSourceCheckedAt: brief.contact.sourceCheckedAt, contactSourceIdentifiesRecipient: true,
    consent: { ...brief.consent, status: "public_business_contact" }, conflicts: [],
  } };
  return { snapshot, prospect, input, output, candidate, producerContext, producerPolicy };
}
