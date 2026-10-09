// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { memoryFirestore } from "./fixtures/communications";
import { officialContactCases, officialResearchInput } from "./fixtures/official-contact-research";
import { syntheticReviewedResearchInput, syntheticLeadVerification } from "./fixtures/lead-verification";
import { stageReviewedResearch, validateReviewedResearch, reviewedResearchPublication, researchIdentityText, REVIEWED_RESEARCH_ROOT } from "../agents/communications-reviewed-research";
import { admitPublishedResearch, admitReviewedReportHypothesis } from "../agents/communications-intake";
import { readExistingResearchSnapshot, researchPublicationSource, verifyPublishedResearch, verifyPublishedHypothesisForDraft } from "../agents/communications-research";
import { compileAutomaticFirstContact, firstContactGeography, verifyFirstContactSource } from "../agents/communications-first-contact";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsDigest } from "../agents/communications-contract";
import { contactPageText } from "../agents/communications-contact-resolution";
import { requireVerifiedLead, verificationDigest } from "../agents/lead-verification";

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
// Keep source-expiry checks at the synthetic fixture time rather than the CI wall clock.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("truthful authenticated report admission (offline, no paid calls or sends)", () => {
  it("stages an exactly bound contact-free stable CRM refresh and queues research without briefs/jobs",async()=>{
    const input=syntheticReviewedResearchInput(),row=Array(19).fill("");
    Object.assign(row,{0:"BP-000015",1:input.candidate.organization,3:input.candidate.site,14:input.candidate.task,17:input.candidate.location});
    const value={...input,assessment:{...input.assessment,contact:null,resolvedGaps:[]},crm:{...input.crm,rows:[row]},
      refresh:{sheetsProspectId:"BP-000015",previousRowDigest:communicationsDigest(row)}};
    const db=memoryFirestore(),snapshot=await stageReviewedResearch(db,value,"authenticated-fixture",now);
    expect(snapshot.row.source_record_id).toBe("BP-000015");
    const outcome=await admitPublishedResearch(snapshot,input.candidate.candidate_key,{db,now:()=>now,
      readResearch:(date,id)=>readExistingResearchSnapshot(db,date,id),isSuppressed:async()=>false});
    expect(outcome).toMatchObject({state:"needs_research",reasons:["verified_public_business_contact_missing"],sent:false,sessionCreated:false});
    expect([...db.records.keys()].filter(key=>/\/(?:briefs|jobs)\//.test(key))).toEqual([]);
    const request=[...db.records.values()].find(value=>value.kind==="public_contact_resolution");
    expect(request).toMatchObject({admissionId:snapshot.row.admission_id,owner:"blueprint-communications-agent",state:"pending"});
    const source=researchPublicationSource(snapshot,{date:snapshot.row.date,candidateKey:input.candidate.candidate_key,
      admissionId:snapshot.row.admission_id,packetDigest:snapshot.row.packet_digest,rawArtifactDigest:snapshot.row.raw_output_digest});
    expect(source).toMatchObject({sheetsProspectId:"BP-000015",assessment:{contact:null},sheetsReceipt:null,notionReceipt:null});
  });
  it.each(["digest","site","task","duplicate"])("rejects an incorrect stable CRM refresh %s",kind=>{
    const input=syntheticReviewedResearchInput(),row=Array(19).fill("");
    Object.assign(row,{0:"BP-000015",1:input.candidate.organization,3:input.candidate.site,14:input.candidate.task,17:input.candidate.location});
    const value={...input,crm:{...input.crm,rows:[row]},refresh:{sheetsProspectId:"BP-000015",previousRowDigest:communicationsDigest(row)}};
    if(kind==="digest") value.refresh.previousRowDigest="a".repeat(64);
    if(kind==="site") row[3]="other facility";if(kind==="task") row[14]="other task";
    if(kind==="duplicate") value.crm.rows.push([...row]);
    expect(()=>validateReviewedResearch(value,now)).toThrow("reviewed_research_refresh_identity_changed");
  });
  it.each(["resolved","conflict","restriction","unqualified"])("rejects a contact-free stage with unsupported %s",async kind=>{
    const input=syntheticReviewedResearchInput(),value:any={...input,assessment:{...input.assessment,contact:null,resolvedGaps:[]}};
    if(kind==="resolved") value.assessment.resolvedGaps=input.assessment.resolvedGaps;
    if(kind==="conflict") value.assessment.conflicts=["Recipient route is disputed"];
    if(kind==="restriction") value.candidate.unknowns=["No unsolicited outreach."];
    if(kind==="unqualified") value.leadVerification=null;
    const db=memoryFirestore();await expect(stageReviewedResearch(db,value,"authenticated-fixture",now)).rejects.toThrow();
    expect(db.records.size).toBe(0);
  });
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
      status: 200, checkedAt: new Date(now).toISOString(), contentType: "text/html", bodyBase64: Buffer.from(body).toString("base64") }).segments.join(" ")).not.toContain("info@debourgh.com");
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
  it("binds normalized spelling of the same site to one source identity", async () => {
    const a = syntheticReviewedResearchInput(), b = structuredClone(a), db = memoryFirestore();
    b.candidate.site = a.candidate.site.toUpperCase();
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
  it("retains two named physical facilities with the same operator, city, task and shared contact", async () => {
    const a = syntheticReviewedResearchInput(), b = structuredClone(a), db = memoryFirestore();
    b.candidate.site = "South synthetic plant, 20 Test Road"; b.candidate.candidate_key = "synthetic-same-city-other-site";
    b.leadVerification = syntheticLeadVerification(b.candidate, "2026-10-01T21:00:00Z");
    const existing = Array(19).fill(""); Object.assign(existing, { 0: "BP-000099", 1: a.candidate.organization, 3: a.candidate.site,
      5: a.assessment.contact.email, 9: a.candidate.evidence[0].url, 14: a.candidate.task, 17: a.candidate.location }); b.crm.rows = [existing];
    const first = await stageReviewedResearch(db, a, "synthetic-admin", now);
    await db.doc("outboundProspects/north").set({ facilityName: a.candidate.organization, facilitySite: a.candidate.site,
      facilityAddress: a.candidate.location, hypothesisedTask: a.candidate.task, contactEmail: a.assessment.contact.email });
    const rows = [first, await stageReviewedResearch(db, b, "synthetic-admin", now)];
    expect(new Set(rows.map(row => row.row.source_record_id)).size).toBe(2);
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

function syntheticReviewedHypothesis() {
  const input = syntheticReviewedResearchInput(), assessment: any = input.leadVerification;
  assessment.claims.human_workflow = { status: "unresolved", reason: "This offline fixture does not establish a human workflow.", source_refs: [] };
  const sources = [...input.candidate.evidence.map(entry => ({ url: entry.url, text: entry.quote })),
    ...assessment.sources.map((source: any) => ({ url: source.url, text: source.quote }))];
  return { ...input, hypothesis: { authorizationReference: "synthetic:authenticated-draft-only-request",
    authorizationExpiresAt: "2026-10-03T00:00:00Z", retainedSources: sources.map(source => {
      const bytes = Buffer.from(source.text);
      return { url: source.url, rawBase64: bytes.toString("base64"), sha256: createHash("sha256").update(bytes).digest("hex"), format: "page_text" as const };
    }) } };
}
describe("reviewed report hypotheses (existing offline fixture, no provider/Gmail)", () => {
  it("admits unknown human workflow only as a draft-only hypothesis and rechecks immutable evidence", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED", "true");
    const input = syntheticReviewedHypothesis(), db = memoryFirestore();
    const snapshot = await stageReviewedResearch(db, input, "server-authenticated-admin", now);
    const deps = { db, now: () => now, readResearch: async () => snapshot, isSuppressed: async () => false };
    const outcome: any = await admitReviewedReportHypothesis(snapshot, input.candidate.candidate_key, deps);
    const store = new CommunicationsStore(db, () => now), brief = await store.brief(outcome.briefId), handoff = await store.handoff(brief);
    expect(outcome).toMatchObject({ state: "admitted", label: "hypothesis", sendsAuthorized: false, sessionCreated: false });
    expect(brief.qualification?.openChecks).toContain("manual_workflow");
    expect(handoff).toMatchObject({ sheetsReceipt: null, notionReceipt: null, recordReceipt: expect.stringContaining("firestore:") });
    expect(verifyPublishedHypothesisForDraft(snapshot, brief, handoff, null, now).briefDigest).toBe(outcome.briefDigest);
    expect(() => verifyPublishedResearch(snapshot, brief, handoff, undefined, now)).toThrow("outreach_ready_hypothesis_draft_only");
    expect(await admitReviewedReportHypothesis(snapshot, input.candidate.candidate_key, deps)).toEqual(outcome);
    const changed = structuredClone(snapshot); changed.row.packet.hypothesis.retainedSources[0].rawBase64 = Buffer.from("changed").toString("base64");
    expect(() => verifyPublishedHypothesisForDraft(changed, brief, handoff, null, now)).toThrow();
    expect(() => verifyPublishedHypothesisForDraft(snapshot, brief, handoff, null, Date.parse("2026-10-03T00:00:01Z"))).toThrow();
  });
  it.each(["quote", "digest", "authorization", "assessment"])("refuses unsupported reviewed hypothesis %s before persistence", async kind => {
    const input: any = syntheticReviewedHypothesis();
    if (kind === "quote") input.hypothesis.retainedSources = input.hypothesis.retainedSources.slice(1);
    if (kind === "digest") input.hypothesis.retainedSources[0].sha256 = "a".repeat(64);
    if (kind === "authorization") input.hypothesis.authorizationExpiresAt = "2026-10-01T20:00:00Z";
    if (kind === "assessment") input.leadVerification.claims.operator.status = "unresolved";
    const db = memoryFirestore(); await expect(stageReviewedResearch(db, input, "server-authenticated-admin", now)).rejects.toThrow();
    expect(db.records.size).toBe(0);
  });
  it("binds an authority-hosted operator document and preserves its historical publication date", async () => {
    const input: any = syntheticReviewedHypothesis(), candidate = input.candidate;
    const quote = "Synthetic fixture operator names Jane Example as its Plant Manager and lists operations@facility.example for business inquiries.";
    candidate.evidence[1] = { ...candidate.evidence[1], url: "https://authority.example/operator-application.pdf", quote,
      source_date: "2024-10-16", assertion_scope: "as_of_background", retrieval: "operator_document" };
    candidate.evidence.push({ ...candidate.evidence[0], role: "background", classification: "independent", url: "https://directory.example/operator",
      quote: "Synthetic fixture operator lists Jane Example as the Plant Manager for its packing facility." });
    input.assessment.contact.selection.role = "Plant Manager";
    input.assessment.contact.selection.kind = "professional_person";
    input.hypothesis.recipient = { name: "Jane Example", role: "Plant Manager" };
    input.leadVerification.candidate_digest = verificationDigest(candidate);
    const document = Buffer.from("Explicitly invented operator application bytes; offline document proof fixture only.");
    const documentDigest = createHash("sha256").update(document).digest("hex");
    input.hypothesis.retainedSources = [...candidate.evidence.map((entry: any) => ({ url: entry.url, text: entry.quote })),
      ...input.leadVerification.sources.map((entry: any) => ({ url: entry.url, text: entry.quote }))].map((entry: any, index: number) => {
        const bytes = Buffer.from(entry.text);
        return { url: entry.url, rawBase64: bytes.toString("base64"), sha256: createHash("sha256").update(bytes).digest("hex"),
          format: index === 1 ? "document_text" : "page_text", ...(index === 1 ? { document: { sha256: documentDigest,
            page: 1, operator: candidate.organization, authorshipQuote: quote, corroborationEvidenceIndex: 3,
            extractionReview: { method: "visual_page_review", rationale: "Synthetic offline authenticated visual review; no actual document or operator." } } } : {}) };
      });
    await expect(stageReviewedResearch(memoryFirestore(), input, "authenticated-fixture", now)).rejects.toThrow("document_reader_missing");
    await expect(stageReviewedResearch(memoryFirestore(), input, "authenticated-fixture", now, async () => Buffer.from("different bytes"))).rejects.toThrow("document_changed");
    const db = memoryFirestore(), snapshot = await stageReviewedResearch(db, input, "authenticated-fixture", now, async digest => {
      expect(digest).toBe(documentDigest); return document;
    });
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED", "true");
    const outcome: any = await admitReviewedReportHypothesis(snapshot, candidate.candidate_key, { db, now: () => now,
      readResearch: async () => snapshot, isSuppressed: async () => false });
    const store = new CommunicationsStore(db), brief = await store.brief(outcome.briefId);
    expect(brief.contact).toMatchObject({ sourceUrl: candidate.evidence[1].url, recipient: { name: "Jane Example", role: "Plant Manager" } });
    expect(snapshot.row.packet.candidate.evidence[1]).toMatchObject({ source_date: "2024-10-16", assertion_scope: "as_of_background" });
    expect(verifyPublishedHypothesisForDraft(snapshot, brief, await store.handoff(brief), null, now).briefDigest).toBe(outcome.briefDigest);
    const historicalOnly: any = structuredClone(input); historicalOnly.candidate.evidence[3].assertion_scope = "as_of_background";
    historicalOnly.leadVerification.candidate_digest = verificationDigest(historicalOnly.candidate);
    await expect(stageReviewedResearch(memoryFirestore(), historicalOnly, "authenticated-fixture", now, async () => document)).rejects.toThrow("recipient_unproven");
    const wrongRole: any = structuredClone(input); wrongRole.hypothesis.recipient.role = "Purchasing Director";
    await expect(stageReviewedResearch(memoryFirestore(), wrongRole, "authenticated-fixture", now, async () => document)).rejects.toThrow("recipient_unproven");
    const tampered = structuredClone(snapshot); tampered.row.review.document_verification[0].page = 2;
    expect(() => verifyPublishedHypothesisForDraft(tampered, brief, { ...brief.qualityReview, version: "blueprint.communications-handoff.v1",
      briefDigest: outcome.briefDigest, recordReceipt: `firestore:${REVIEWED_RESEARCH_ROOT}/${snapshot.row.admission_id}`, sheetsReceipt: null, notionReceipt: null }, null, now)).toThrow();
    const changed: any = structuredClone(input); changed.hypothesis.recipient.name = "Other Person";
    await expect(stageReviewedResearch(memoryFirestore(), changed, "authenticated-fixture", now, async () => document)).rejects.toThrow();
  });
  it("keeps the existing flag and suppression brakes without promoting an unverified lead", async () => {
    const input = syntheticReviewedHypothesis(), db = memoryFirestore(), snapshot = await stageReviewedResearch(db, input, "server-authenticated-admin", now);
    const deps = { db, now: () => now, readResearch: async () => snapshot, isSuppressed: async () => true };
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED", "false");
    expect(await admitReviewedReportHypothesis(snapshot, input.candidate.candidate_key, deps)).toMatchObject({ state: "not_admitted", reasons: ["hypothesis_drafts_disabled"] });
    expect([...db.records.keys()].some(key => /\/(?:briefs|jobs)\//.test(key))).toBe(false);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED", "true");
    await expect(admitReviewedReportHypothesis(snapshot, input.candidate.candidate_key, deps)).rejects.toThrow("recipient_suppressed");
    expect((await admitPublishedResearch(snapshot, input.candidate.candidate_key, deps)).state).toBe("needs_research");
    expect([...db.records.keys()].some(key => /\/(?:briefs|jobs)\//.test(key))).toBe(false);
  });
});
