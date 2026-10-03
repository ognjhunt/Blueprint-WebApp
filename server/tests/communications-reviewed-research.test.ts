// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { memoryFirestore } from "./fixtures/communications";
import { officialContactCases, officialResearchInput } from "./fixtures/official-contact-research";
import { syntheticReviewedResearchInput, syntheticLeadVerification } from "./fixtures/lead-verification";
import { stageReviewedResearch, validateReviewedResearch, reviewedResearchPublication, researchIdentityText, REVIEWED_RESEARCH_ROOT } from "../agents/communications-reviewed-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { readExistingResearchSnapshot, researchPublicationSource, verifyPublishedResearch } from "../agents/communications-research";
import { compileAutomaticFirstContact, firstContactGeography, verifyFirstContactSource } from "../agents/communications-first-contact";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsDigest } from "../agents/communications-contract";
import { contactPageText } from "../agents/communications-contact-resolution";
import { requireVerifiedLead } from "../agents/lead-verification";

const now = Date.parse("2026-10-01T21:05:00Z");
async function admit(input = syntheticReviewedResearchInput(), db = memoryFirestore()) {
  const snapshot = await stageReviewedResearch(db, input, "server-authenticated-admin", now);
  const deps = { db, now: () => now, readResearch: (date: string, id?: string) => readExistingResearchSnapshot(db, date, id),
    isSuppressed: vi.fn(async (_email: string) => false) };
  const outcome: any = await admitPublishedResearch(snapshot, input.candidate.candidate_key, deps);
  const store = new CommunicationsStore(db, () => now);
  const brief = outcome.briefId ? await store.brief(outcome.briefId) : null;
  return { db, snapshot, outcome, store, brief, deps };
}
afterEach(() => vi.unstubAllEnvs());
describe("truthful authenticated report admission (offline, no paid calls or sends)", () => {
  it.each(officialContactCases)("keeps $organization's retained contact fixture readable without inventing human/site-task verification", async c => {
    const input = officialResearchInput(c.key);
    expect(() => validateReviewedResearch(input, now)).not.toThrow();
    const db = memoryFirestore();
    await expect(stageReviewedResearch(db, input, "server-authenticated-admin", now)).rejects.toThrow("lead_verification_required");
    expect(db.records.size).toBe(0);
  });
  it("admits an explicitly synthetic fully assessed site/task under existing draft and privacy controls", async () => {
    const f = await admit();
    expect(f.outcome).toMatchObject({ state: "admitted", sent: false, sessionCreated: false });
    const brief = f.brief!;
    expect(brief.contact.email).toBe("operations@facility.example");
    expect(brief.contact.sourceCheckedAt).toBe("2026-10-01");
    expect(brief.facts.every(fact => fact.publishedAt === null)).toBe(true);
    expect(brief.qualityReview.reviewedAt).toBe("2026-10-01T21:05:00.000Z");
    expect(brief.stage.interest).toBe("unknown");
    expect(brief.unknowns).toContain("Interest, current automation and permission to share site data remain unknown.");
    const handoff = await f.store.handoff(brief);
    expect(handoff).toMatchObject({ sheetsReceipt: null, notionReceipt: null, recordReceipt: expect.stringContaining("firestore:") });
    expect(f.snapshot.row).not.toHaveProperty("session_id");
    expect(f.snapshot.row).not.toHaveProperty("turn_id");
    expect(verifyPublishedResearch(await f.deps.readResearch(brief.researchOrigin.date, brief.researchOrigin.admissionId), brief, handoff, undefined, now).briefDigest).toBe(f.outcome.briefDigest);
    const provenance = (await f.db.doc(`${COMMUNICATIONS_ROOT}/researchSources/${communicationsDigest(brief)}`).get()).data();
    const geography = firstContactGeography(provenance, brief, now);
    expect(geography?.countryCode).toBe("US");
    expect(() => verifyFirstContactSource(provenance, brief, undefined, geography, now)).not.toThrow();
    const output = compileAutomaticFirstContact(brief, now);
    // Invented reserved-domain recipients retain the existing send protection.
    expect(output).toBeNull();
  });
  it.each(["2026-10-01", "2026-10-01T15:30:00-05:00", "2026-10-01T20:30:00.123456Z"])("preserves actual source date precision %s separately from the review time", async sourceDate => {
    const input = syntheticReviewedResearchInput();
    input.candidate.evidence.forEach(evidence => { evidence.source_checked_at = sourceDate; evidence.source_date = sourceDate; });
    input.leadVerification = syntheticLeadVerification(input.candidate, "2026-10-01T21:00:00Z");
    const f = await admit(input);
    expect(f.outcome.state).toBe("admitted");
    expect(f.brief!.contact.sourceCheckedAt).toBe(sourceDate);
    expect(f.brief!.facts.every(fact => fact.sourceCheckedAt === sourceDate && fact.publishedAt === sourceDate)).toBe(true);
    expect(f.brief!.qualityReview.reviewedAt).toBe("2026-10-01T21:05:00.000Z");
    expect(verifyPublishedResearch(f.snapshot, f.brief!, await f.store.handoff(f.brief!)).briefDigest).toBe(f.outcome.briefDigest);
  });
  it("preserves honest rendered retrieval when raw Wix HTML cannot be statically verified", async () => {
    const body = "<html><style>p{display:none}</style><body><p>Contact info@debourgh.com</p></body></html>";
    expect(contactPageText({ requestedUrl: "https://www.debourgh.com/", finalUrl: "https://www.debourgh.com/", redirects: [],
      status: 200, checkedAt: new Date(now).toISOString(), contentType: "text/html", bodyBase64: Buffer.from(body).toString("base64") }).visibilityUnverified).toBe(true);
    const f = await admit(syntheticReviewedResearchInput());
    expect(f.outcome.state).toBe("admitted");
    expect(f.snapshot.row.packet.candidate.evidence[1].retrieval).toBe("rendered");
    expect([...f.db.records.keys()].some(key => key.includes("/contactProofs/"))).toBe(false);
  });
  it("persists nonempty CRM rows without forbidden nested Firestore arrays and verifies their original values", async () => {
    const input = syntheticReviewedResearchInput();
    input.crm.rows = [["Blueprint CRM"], [], ["BP-000099", "Unrelated operator"]];
    const f = await admit(input);
    expect(f.outcome.state).toBe("admitted");
    const assertFirestoreArrays = (value: any): void => {
      if (Array.isArray(value)) {
        expect(value.some(Array.isArray)).toBe(false);
        value.forEach(assertFirestoreArrays);
      } else if (value && typeof value === "object") Object.values(value).forEach(assertFirestoreArrays);
    };
    assertFirestoreArrays(f.snapshot);
    const legacy = structuredClone(f.snapshot);
    legacy.row.packet.crm.rows = input.crm.rows as any;
    const origin = f.brief!.researchOrigin;
    expect(researchPublicationSource(legacy, origin)).toEqual(researchPublicationSource(f.snapshot, origin));
    const altered = structuredClone(f.snapshot);
    altered.row.packet.crm.rows[2].cells[1] = "Altered operator";
    expect(() => researchPublicationSource(altered, origin)).toThrow("source_changed");
  });
  it.each(["hidden", "private", "wrong_owner", "not_contact", "no_outreach", "support_only", "privacy_route", "stale", "future", "conflict", "unresolved_permission", "wrong_hq"])("refuses %s evidence before staging", async kind => {
    const input: any = syntheticReviewedResearchInput();
    const contact = input.candidate.evidence[1], geo = input.candidate.evidence[2];
    if (["hidden", "private"].includes(kind)) input.candidate.evidence[0].visibility = kind;
    if (kind === "wrong_owner") contact.url = "https://directory.example/contact";
    if (kind === "not_contact") contact.quote = "info@other.example";
    if (kind === "no_outreach") contact.quote += " No unsolicited contact.";
    if (kind === "support_only") contact.quote += " Support only.";
    if (kind === "privacy_route") contact.url = "https://sudscityla.com/privacy/";
    if (kind === "stale") contact.source_checked_at = "2026-09-01";
    if (kind === "future") contact.source_checked_at = "2026-10-02";
    if (kind === "conflict") input.assessment.conflicts = ["The current operator's contact contradicts a third-party listing."];
    if (kind === "unresolved_permission") input.candidate.unknowns.push("Permission to email this recipient remains unknown.");
    if (kind === "wrong_hq") geo.quote = "Headquarters: 50 Other Road, Boston, MA 02101";
    const db = memoryFirestore();
    await expect(stageReviewedResearch(db, input, "trusted-admin", now)).rejects.toThrow();
    expect(db.records.size).toBe(0);
  });
  it("accepts an explicitly published consumer-provider inbox and a site that is also headquarters", async () => {
    const input = syntheticReviewedResearchInput();
    input.assessment.contact.email = "operator@gmail.com";
    input.assessment.contact.selection.kind = "professional_person";
    input.assessment.contact.selection.role = "Public professional operations contact";
    input.candidate.evidence[1].quote = "Laundry operations professional contact: Jane Operator, operator@gmail.com. For careers see our jobs page; for privacy see our policy.";
    input.assessment.contact.selection.relevance = "The operator identifies this contact's laundry operations remit, relevant to the towel-folding workflow question. Purchasing authority remains unknown.";
    input.assessment.contact.selection.authorityBasis = "operator_stated_remit";
    input.candidate.evidence[2].quote = `Factory and headquarters: ${input.candidate.location}`;
    input.leadVerification = syntheticLeadVerification(input.candidate, "2026-10-01T21:00:00Z");
    expect((await admit(input)).outcome.state).toBe("admitted");
  });
  it("binds concurrent immutable revisions of a site-label alias to one source identity", async () => {
    const a = syntheticReviewedResearchInput(), b = structuredClone(a), db = memoryFirestore();
    b.candidate.site = "Different site label";
    b.leadVerification = syntheticLeadVerification(b.candidate, "2026-10-01T21:00:00Z");
    const outcomes = await Promise.allSettled([stageReviewedResearch(db, a, "a", now), stageReviewedResearch(db, b, "b", now)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(2);
    const records = [...db.records.entries()].filter(([key]) => key.startsWith(REVIEWED_RESEARCH_ROOT + "/"));
    expect(new Set(records.map(([, record]) => record.row.source_record_id)).size).toBe(1);
  });
  it("retains distinct tasks at one site and distinct sites rather than deduplicating an entire operator", async () => {
    const a = syntheticReviewedResearchInput(), b = structuredClone(a), c = structuredClone(a), d = structuredClone(a), db = memoryFirestore();
    b.candidate.task = "sorting"; b.candidate.candidate_key = "synthetic-sorting";
    c.candidate.location = "20 Synthetic Lane, Boston, MA 02101"; c.candidate.site = "Other synthetic site";
    c.candidate.evidence[2].quote = c.candidate.location; c.assessment.geography.address = c.candidate.location;
    c.candidate.candidate_key = "synthetic-other-site";
    d.candidate.organization = "Distinct synthetic co-located operator"; d.candidate.candidate_key = "synthetic-distinct-operator";
    for (const input of [b, c, d]) input.leadVerification = syntheticLeadVerification(input.candidate, "2026-10-01T21:00:00Z");
    const rows = await Promise.all([a, b, c, d].map(input => stageReviewedResearch(db, input, "synthetic-admin", now)));
    expect(new Set(rows.map(row => row.row.source_record_id)).size).toBe(4);
    expect([...db.records.keys()].filter(key => key.startsWith(REVIEWED_RESEARCH_ROOT + "/"))).toHaveLength(4);
  });
  it.each(["other_site", "other_operator"])("preserves %s with the same task and public mailbox in complete CRM/canonical records", async kind => {
    const input = syntheticReviewedResearchInput(), db = memoryFirestore();
    const organization = kind === "other_operator" ? "Distinct co-located synthetic operator" : input.candidate.organization;
    const address = kind === "other_site" ? "20 Synthetic Lane, Boston, MA 02101" : input.candidate.location;
    const row = Array(19).fill(""); Object.assign(row, { 0: "BP-000099", 1: organization, 3: "Other site label", 5: input.assessment.contact.email,
      14: input.candidate.task, 17: address }); input.crm.rows = [row];
    await db.doc("outboundProspects/other").set({ facilityName: organization, facilityAddress: address,
      hypothesisedTask: input.candidate.task, contactEmail: input.assessment.contact.email });
    await expect(stageReviewedResearch(db, input, "synthetic-admin", now)).resolves.toHaveProperty("row.admission_id");
  });
  it("accepts source-assessed official task delegation while preserving unresolved affiliation as a repair", async () => {
    const input = syntheticReviewedResearchInput();
    input.candidate.evidence[0].url = "https://employer-portal.example/site-task";
    const assessment = syntheticLeadVerification(input.candidate, "2026-10-01T21:00:00Z");
    assessment.sources.push({ ...assessment.sources[0], id: "synthetic-delegated", url: input.candidate.evidence[0].url,
      classification: "primary", publisher: "Synthetic official employer portal", quote: "Invented officially delegated employer portal describes staff packing at the exact synthetic site." });
    assessment.sources[0].quote = "Invented operator website links to this exact employer portal as its official job-board route.";
    assessment.claims.site_task.source_refs = ["synthetic-operator", "synthetic-delegated"];
    assessment.claims.human_workflow.source_refs = ["synthetic-operator", "synthetic-delegated"];
    input.leadVerification = assessment;
    expect((await admit(input)).outcome.state).toBe("admitted");
    assessment.claims.site_task.status = "unresolved"; assessment.claims.site_task.reason = "Operator affiliation with the portal could not be established.";
    const db = memoryFirestore();
    await expect(stageReviewedResearch(db, input, "synthetic-admin", now)).rejects.toThrow("lead_verification_required");
    expect(db.records.size).toBe(0);
  });
  it("blocks CRM and canonical duplicates, suppressed recipients and fabricated client approval", async () => {
    const input = syntheticReviewedResearchInput();
    input.crm.rows = [["BP-000012", input.candidate.organization]];
    expect(() => validateReviewedResearch(input, now)).toThrow("crm_duplicate");
    expect(() => validateReviewedResearch({ ...syntheticReviewedResearchInput(), approved: true }, now)).toThrow();
    const db = memoryFirestore(); await db.doc("outboundProspects/old").set({ contactEmail: syntheticReviewedResearchInput().assessment.contact.email });
    await expect(stageReviewedResearch(db, syntheticReviewedResearchInput(), "a", now)).rejects.toThrow("canonical_duplicate");
    const f = await admit();
    const suppressed = await admitPublishedResearch(f.snapshot, "synthetic-packing", { ...f.deps, db: memoryFirestore(), isSuppressed: async () => true });
    expect(suppressed.state).toBe("blocked");
  });
  it("replays exactly and permits a fresh immutable revision through the existing pre-inference refresh fence", async () => {
    const f = await admit();
    expect((await stageReviewedResearch(f.db, syntheticReviewedResearchInput(), "different-admin", now)).row).toEqual(f.snapshot.row);
    const update = syntheticReviewedResearchInput(); update.crm.checkedAt = new Date(now).toISOString();
    update.assessment.contact.rationale += " Rechecked the same public route.";
    const revision = await stageReviewedResearch(f.db, update, "a", now);
    expect(revision.row.source_record_id).toBe(f.snapshot.row.source_record_id);
    expect(revision.row.admission_id).not.toBe(f.snapshot.row.admission_id);
    expect((await admitPublishedResearch(revision, "synthetic-packing", f.deps)).state).toBe("already_requested");
    await f.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${f.outcome.jobId}`).set({ state: "awaiting_research" }, { merge: true });
    const replaced: any = await admitPublishedResearch(revision, "synthetic-packing", f.deps);
    expect(replaced.state).toBe("admitted"); expect(replaced.prospectId).toBe(f.outcome.prospectId);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.outcome.jobId}`).state).toBe("superseded");
    await f.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${replaced.jobId}`).set({ state: "awaiting_research" }, { merge: true });
    const before = structuredClone([...f.db.records.entries()].filter(([key]) => /\/(?:jobs|firstTouches)\//.test(key)));
    expect((await admitPublishedResearch(f.snapshot, "synthetic-packing", f.deps)).state).toBe("already_requested");
    expect([...f.db.records.entries()].filter(([key]) => /\/(?:jobs|firstTouches)\//.test(key))).toEqual(before);
  });
  it("detects artifact, candidate, assessment and handoff record receipt tampering on readback", async () => {
    const f = await admit(), brief = f.brief!, handoff = await f.store.handoff(brief);
    for (const part of ["artifact", "candidate", "assessment"]) {
      const copy = structuredClone(f.snapshot);
      if (part === "artifact") copy.files.artifact = Buffer.from("changed").toString("base64");
      if (part === "candidate") copy.row.packet.candidate.evidence[0].claim = "Changed task";
      if (part === "assessment") copy.row.packet.assessment.contact.rationale = "Changed rationale";
      expect(() => verifyPublishedResearch(copy, brief, handoff)).toThrow();
    }
    expect(() => verifyPublishedResearch(f.snapshot, brief, { ...handoff, recordReceipt: "invented" })).toThrow("receipt_changed");
    expect(researchPublicationSource(f.snapshot, brief.researchOrigin).provenance.kind).toBe("codex_report");
  });
  it("reads an intact legacy reviewed archive with its historical identity and without inventing verification", async () => {
    const input = syntheticReviewedResearchInput(), db = memoryFirestore();
    const archive = await stageReviewedResearch(db, input, "synthetic-admin", now);
    const row: any = archive.row;
    delete row.packet.leadVerification; delete row.review.lead_verification;
    row.packet_digest = communicationsDigest(row.packet); row.review.packet_digest = row.packet_digest;
    row.admission_id = communicationsDigest({ packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest });
    row.run_key = `reviewed-report:${row.admission_id}`;
    row.source_record_id = `reviewed:${communicationsDigest({ organization: researchIdentityText(input.candidate.organization),
      site: researchIdentityText(input.candidate.site), address: researchIdentityText(input.candidate.location) })}`;
    const origin = { date: row.date, admissionId: row.admission_id, candidateKey: input.candidate.candidate_key,
      packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest };
    const read = reviewedResearchPublication(archive, origin);
    expect(read.verification).toMatchObject({ status: "unresolved", assessment: null });
    expect(read.source).not.toHaveProperty("leadVerification");
    expect(() => requireVerifiedLead(read.source, now)).toThrow("lead_verification_required");
  });
});
