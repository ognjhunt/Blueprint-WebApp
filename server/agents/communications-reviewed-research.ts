import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationsDigest, type CommunicationsBrief } from "./communications-contract";
import { assessedPublicContact, assessedSiteGeography, sourceAssessmentSchema } from "./communications-source-assessment";
import { sameOperatorUrl } from "./communications-contact-evidence";

export const REVIEWED_RESEARCH_ROOT = "blueprintCommunications/default/reviewedResearch";
export const COMMUNICATIONS_CRM_ID = "1n95Ih0Swc-q-kZyUaDHoZh6SVzxvf_zt-CRR7i39bWY";
const text = z.string().trim().min(1).max(1200);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.union([z.string().datetime(), z.string().date()]);
const url = z.string().url().max(1000).refine(x => {
  const u = new URL(x); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password;
});
const evidence = z.object({ claim: text, quote: text, url, publisher: text,
  source_date: date.nullable(), source_checked_at: date, checked_date: z.string().date(),
  classification: z.enum(["operator", "independent", "vendor"]), claim_kind: z.enum(["fact", "vendor_claim", "hypothesis"]),
  role: z.enum(["task", "geography", "contact", "capability", "background"]),
  origin: z.literal("live"), assertion_scope: z.enum(["current_operational", "as_of_background"]),
  retrieval: z.enum(["rendered", "static", "operator_document"]), visibility: z.literal("public"),
}).strict();
/** A truthful report and selected evidence. No fabricated API run or projection
 * receipt is accepted; server identity and review time are not request fields. */
export const reviewedResearchInputSchema = z.object({
  date: z.string().date(),
  artifact: z.object({ kind: z.enum(["codex_report", "hosted_research"]), reference: text,
    sourceRecordUrl: url, rawBase64: z.string().min(1).max(1000000), sha256: digest }).strict(),
  candidate: z.object({ candidate_key: text, organization: z.string().trim().min(1).max(200), organization_url: url,
    site: z.string().trim().min(1).max(300), location: z.string().trim().min(1).max(300), task: z.string().trim().min(1).max(120),
    unknowns: z.array(text).max(16), evidence: z.array(evidence).min(3).max(16),
  }).strict(),
  assessment: sourceAssessmentSchema,
  crm: z.object({ spreadsheetId: z.literal(COMMUNICATIONS_CRM_ID), range: z.literal("Prospects!A1:Z1000"),
    checkedAt: z.string().datetime(), rows: z.array(z.array(z.string().max(4000)).max(26)).max(1000),
    rationale: text }).strict(),
}).strict();
export type ReviewedResearchInput = z.infer<typeof reviewedResearchInputSchema>;
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export const researchIdentityText = (x: string) => x.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const fresh = (x: string, now: number) => Number.isFinite(Date.parse(x)) && Date.parse(x) <= now && now - Date.parse(x) <= 7 * 86400000;

export function validateReviewedResearch(inputValue: unknown, now: number) {
  const input = reviewedResearchInputSchema.parse(inputValue), bytes = Buffer.from(input.artifact.rawBase64, "base64");
  if (bytes.toString("base64") !== input.artifact.rawBase64 || sha256(bytes) !== input.artifact.sha256) throw new Error("reviewed_research_artifact_changed");
  if (!fresh(input.crm.checkedAt, now)) throw new Error("reviewed_research_crm_stale");
  if (input.crm.rows.length >= 1000) throw new Error("reviewed_research_crm_overflow");
  const organization = researchIdentityText(input.candidate.organization), address = researchIdentityText(input.candidate.location);
  if (input.crm.rows.some(row => /^BP-\d{6}$/.test(row[0] ?? "")
    && (researchIdentityText(row[1] ?? "") === organization || researchIdentityText(row[17] ?? "") === address
      || researchIdentityText(row[3] ?? "").includes(address)
      || (row[5] ?? "").toLowerCase().includes(input.assessment.contact.email.toLowerCase())))) {
    throw new Error("reviewed_research_crm_duplicate_requires_refresh");
  }
  const contact = assessedPublicContact(input.candidate, input.assessment), geography = assessedSiteGeography(input.candidate, input.assessment);
  const task = input.candidate.evidence.find(entry => entry.role === "task" && entry.classification === "operator" && entry.claim_kind === "fact"
    && entry.visibility === "public" && entry.assertion_scope === "current_operational" && sameOperatorUrl(entry.url, input.candidate.organization_url));
  if (!task || !fresh(task.source_checked_at, now) || !fresh(contact.sourceCheckedAt, now) || !fresh(geography.sourceCheckedAt, now)) {
    throw new Error("reviewed_research_current_source_missing");
  }
  return input;
}

/** Called only after server-verified admin authentication (or existing Admin
 * service authority). The actor/time are derived there, never approved=true. */
export async function stageReviewedResearch(db: FirebaseFirestore.Firestore, inputValue: unknown,
  actor: string, now: number) {
  if (!actor.trim()) throw new Error("reviewed_research_authenticated_actor_missing");
  const input = validateReviewedResearch(inputValue, now);
  const packet = { candidate: input.candidate, assessment: input.assessment, artifact: {
    kind: input.artifact.kind, reference: input.artifact.reference, sourceRecordUrl: input.artifact.sourceRecordUrl,
  }, crm: input.crm };
  const packetDigest = communicationsDigest(packet), admissionId = communicationsDigest({ packetDigest, rawArtifactDigest: input.artifact.sha256 });
  const identityKey = communicationsDigest({ organization: researchIdentityText(input.candidate.organization),
    site: researchIdentityText(input.candidate.site), address: researchIdentityText(input.candidate.location) });
  const sourceRecordId = `reviewed:${identityKey}`;
  const row = { date: input.date, run_key: `reviewed-report:${admissionId}`, state: "completed",
    packet_digest: packetDigest, raw_output_digest: input.artifact.sha256, packet,
    review: { reviewer_reference: `authenticated:${actor}`, reviewed_at: new Date(now).toISOString(),
      packet_digest: packetDigest, accepted_keys: [input.candidate.candidate_key],
      source_support_verified: true, crm_rechecked: true, summary: input.assessment.rationale },
    admission_id: admissionId, source_record_id: sourceRecordId };
  const snapshot = { schema_version: "blueprint.reviewed-research-snapshot.v1", row,
    files: { artifact: input.artifact.rawBase64 } };
  const ref = db.collection(REVIEWED_RESEARCH_ROOT).doc(admissionId);
  const identityRef = db.doc("blueprintCommunications/default").collection("reviewedResearchIdentities").doc(identityKey);
  const recipientRef = db.doc("blueprintCommunications/default").collection("reviewedResearchRecipients")
    .doc(communicationsDigest(input.assessment.contact.email.toLowerCase()));
  const addressRef = db.doc("blueprintCommunications/default").collection("reviewedResearchAddresses")
    .doc(communicationsDigest(researchIdentityText(input.candidate.location)));
  return db.runTransaction(async tx => {
    const [existing, identity, recipient, address, prospects] = await Promise.all([tx.get(ref), tx.get(identityRef),
      tx.get(recipientRef), tx.get(addressRef), tx.get(db.collection("outboundProspects").limit(1001))]);
    for (const binding of [identity, recipient, address]) {
      if (binding.exists && binding.data()?.sourceRecordId !== sourceRecordId) throw new Error("reviewed_research_identity_already_staged");
    }
    if (existing.exists) {
      const saved = existing.data()!;
      reviewedResearchPublication(saved, { date: input.date, candidateKey: input.candidate.candidate_key,
        packetDigest, rawArtifactDigest: input.artifact.sha256, admissionId });
      return saved;
    }
    if (prospects.size > 1000 || prospects.docs.some(doc => {
      const p = doc.data();
      if (p.researchPublicationId === sourceRecordId && p.entityAdmission === "research_provisional") return false;
      return p.contactEmail?.toLowerCase() === input.assessment.contact.email.toLowerCase()
        || researchIdentityText(p.facilityName ?? "") === researchIdentityText(input.candidate.organization)
        || researchIdentityText(p.facilityAddress ?? "") === researchIdentityText(input.candidate.location);
    })) throw new Error("reviewed_research_canonical_duplicate_requires_refresh");
    tx.create(ref, snapshot);
    for (const binding of [identityRef, recipientRef, addressRef]) {
      tx.set(binding, { admissionId, sourceRecordId, reviewedAt: new Date(now).toISOString() });
    }
    return snapshot;
  });
}

/** Readback rechecks the actual report, immutable assessment and CRM record.
 * Notion/Sheets projection receipts stay null until such writes really occur. */
export function reviewedResearchPublication(snapshot: any, origin: CommunicationsBrief["researchOrigin"]): any {
  const row = snapshot?.row;
  if (snapshot?.schema_version !== "blueprint.reviewed-research-snapshot.v1" || !origin.admissionId
    || row?.admission_id !== origin.admissionId || row.date !== origin.date || row.state !== "completed"
    || row.packet_digest !== origin.packetDigest || row.raw_output_digest !== origin.rawArtifactDigest
    || row.review?.packet_digest !== origin.packetDigest || !row.review.reviewer_reference?.startsWith("authenticated:")
    || !Number.isFinite(Date.parse(row.review.reviewed_at)) || row.review.source_support_verified !== true
    || row.review.crm_rechecked !== true || !row.review.accepted_keys?.includes(origin.candidateKey)
    || communicationsDigest(row.packet) !== origin.packetDigest
    || sha256(Buffer.from(snapshot.files?.artifact ?? "", "base64")) !== origin.rawArtifactDigest) throw new Error("reviewed_research_source_changed");
  const packet = row.packet;
  const input = validateReviewedResearch({ date: row.date, artifact: { ...packet.artifact, rawBase64: snapshot.files.artifact, sha256: row.raw_output_digest },
    candidate: packet.candidate, assessment: packet.assessment, crm: packet.crm }, Date.parse(row.review.reviewed_at));
  const admissionId = communicationsDigest({ packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest });
  const identityKey = communicationsDigest({ organization: researchIdentityText(input.candidate.organization),
    site: researchIdentityText(input.candidate.site), address: researchIdentityText(input.candidate.location) });
  if (admissionId !== origin.admissionId || row.source_record_id !== `reviewed:${identityKey}`
    || row.run_key !== `reviewed-report:${admissionId}` || packet.candidate.candidate_key !== origin.candidateKey) throw new Error("reviewed_research_identity_changed");
  const source = { version: "blueprint.communications-reviewed-source.v1", provenance: packet.artifact,
    admissionId, runKey: row.run_key, date: row.date, candidateKey: origin.candidateKey,
    packetDigest: origin.packetDigest, rawArtifactDigest: origin.rawArtifactDigest,
    candidate: input.candidate, assessment: input.assessment, researchReview: row.review, qaArtifactDigest: communicationsDigest(row.review),
    // Compatibility binding names; this is explicitly a staged record, not a Sheets row.
    sheetsId: COMMUNICATIONS_CRM_ID, sheetsProspectId: row.source_record_id,
    recordReceipt: `firestore:${REVIEWED_RESEARCH_ROOT}/${admissionId}`,
    sourceRecordUrl: packet.artifact.sourceRecordUrl, sheetsReceipt: null, notionReceipt: null };
  return { row, candidate: input.candidate, selected: [input.candidate], source,
    recordReceipt: source.recordReceipt, sheetsReceipt: null, notionReceipt: null };
}
