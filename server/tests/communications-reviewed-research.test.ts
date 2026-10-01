// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { memoryFirestore } from "./fixtures/communications";
import { officialContactCases, officialResearchInput } from "./fixtures/official-contact-research";
import { stageReviewedResearch, validateReviewedResearch, REVIEWED_RESEARCH_ROOT } from "../agents/communications-reviewed-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { readExistingResearchSnapshot, researchPublicationSource, verifyPublishedResearch } from "../agents/communications-research";
import { compileAutomaticFirstContact, firstContactGeography, verifyFirstContactSource } from "../agents/communications-first-contact";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsDigest } from "../agents/communications-contract";
import { contactPageText } from "../agents/communications-contact-resolution";

const now = Date.parse("2026-10-01T21:05:00Z");
async function admit(input = officialResearchInput(), db = memoryFirestore()) {
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
  it.each(officialContactCases)("qualifies $organization's exact official route and full US postal address without magic words", async c => {
    const f = await admit(officialResearchInput(c.key));
    expect(f.outcome).toMatchObject({ state: "admitted", sent: false, sessionCreated: false });
    const brief = f.brief!;
    expect(brief.contact.email).toBe(c.email);
    expect(brief.contact.sourceCheckedAt).toBe("2026-10-01");
    expect(brief.facts.every(fact => fact.publishedAt === null)).toBe(true);
    expect(brief.qualityReview.reviewedAt).toBe("2026-10-01T21:05:00.000Z");
    expect(brief.stage.interest).toBe("unknown");
    expect(brief.unknowns).toContain("Interest, current automation and permission to share site data remain unknown.");
    const handoff = await f.store.handoff(brief);
    expect(handoff).toMatchObject({ sheetsReceipt: null, notionReceipt: null, recordReceipt: expect.stringContaining("firestore:") });
    expect(f.snapshot.row).not.toHaveProperty("session_id");
    expect(f.snapshot.row).not.toHaveProperty("turn_id");
    expect(verifyPublishedResearch(await f.deps.readResearch(brief.researchOrigin.date, brief.researchOrigin.admissionId), brief, handoff).briefDigest).toBe(f.outcome.briefDigest);
    const provenance = (await f.db.doc(`${COMMUNICATIONS_ROOT}/researchSources/${communicationsDigest(brief)}`).get()).data();
    const geography = firstContactGeography(provenance, brief, now);
    expect(geography?.countryCode).toBe("US");
    expect(() => verifyFirstContactSource(provenance, brief, undefined, geography, now)).not.toThrow();
    const output = compileAutomaticFirstContact(brief, now);
    expect(output).not.toBeNull();
    expect(output!.body).toContain("I'm building Blueprint.");
    expect((output!.body.match(/\?/g) ?? []).length).toBe(1);
    expect(output!.body).not.toMatch(/ROI|guarantee|confidential/i);
  });
  it("preserves honest rendered retrieval when raw Wix HTML cannot be statically verified", async () => {
    const body = "<html><style>p{display:none}</style><body><p>Contact info@debourgh.com</p></body></html>";
    expect(contactPageText({ requestedUrl: "https://www.debourgh.com/", finalUrl: "https://www.debourgh.com/", redirects: [],
      status: 200, checkedAt: new Date(now).toISOString(), contentType: "text/html", bodyBase64: Buffer.from(body).toString("base64") }).visibilityUnverified).toBe(true);
    const f = await admit(officialResearchInput("debourgh"));
    expect(f.outcome.state).toBe("admitted");
    expect(f.snapshot.row.packet.candidate.evidence[1].retrieval).toBe("rendered");
    expect([...f.db.records.keys()].some(key => key.includes("/contactProofs/"))).toBe(false);
  });
  it.each(["hidden", "private", "wrong_owner", "not_contact", "no_outreach", "support_only", "privacy_route", "stale", "future", "conflict", "unresolved_permission", "wrong_hq"])("refuses %s evidence before staging", async kind => {
    const input: any = officialResearchInput();
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
    const input = officialResearchInput();
    input.assessment.contact.email = "operator@gmail.com";
    input.assessment.contact.selection.kind = "professional_person";
    input.assessment.contact.selection.role = "Public professional operations contact";
    input.candidate.evidence[1].quote = "Laundry operations professional contact: Jane Operator, operator@gmail.com. For careers see our jobs page; for privacy see our policy.";
    input.assessment.contact.selection.relevance = "The operator identifies this contact's laundry operations remit, relevant to the towel-folding workflow question. Purchasing authority remains unknown.";
    input.assessment.contact.selection.authorityBasis = "operator_stated_remit";
    input.candidate.evidence[2].quote = `Factory and headquarters: ${input.candidate.location}`;
    expect((await admit(input)).outcome.state).toBe("admitted");
  });
  it("atomically reserves recipient and address identities across aliases and concurrent packets", async () => {
    const a = officialResearchInput(), b = structuredClone(a), db = memoryFirestore();
    b.candidate.organization = "Different alias"; b.candidate.site = "Different site label";
    const outcomes = await Promise.allSettled([stageReviewedResearch(db, a, "a", now), stageReviewedResearch(db, b, "b", now)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect([...db.records.keys()].filter(key => key.startsWith(REVIEWED_RESEARCH_ROOT + "/"))).toHaveLength(1);
  });
  it("blocks CRM and canonical duplicates, suppressed recipients and fabricated client approval", async () => {
    const input = officialResearchInput();
    input.crm.rows = [["BP-000012", input.candidate.organization]];
    expect(() => validateReviewedResearch(input, now)).toThrow("crm_duplicate");
    expect(() => validateReviewedResearch({ ...officialResearchInput(), approved: true }, now)).toThrow();
    const db = memoryFirestore(); await db.doc("outboundProspects/old").set({ contactEmail: officialResearchInput().assessment.contact.email });
    await expect(stageReviewedResearch(db, officialResearchInput(), "a", now)).rejects.toThrow("canonical_duplicate");
    const f = await admit();
    const suppressed = await admitPublishedResearch(f.snapshot, "suds-city-la", { ...f.deps, db: memoryFirestore(), isSuppressed: async () => true });
    expect(suppressed.state).toBe("blocked");
  });
  it("replays exactly and permits a fresh immutable revision through the existing pre-inference refresh fence", async () => {
    const f = await admit();
    expect((await stageReviewedResearch(f.db, officialResearchInput(), "different-admin", now)).row).toEqual(f.snapshot.row);
    const update = officialResearchInput(); update.crm.checkedAt = new Date(now).toISOString();
    update.assessment.contact.rationale += " Rechecked the same public route.";
    const revision = await stageReviewedResearch(f.db, update, "a", now);
    expect(revision.row.source_record_id).toBe(f.snapshot.row.source_record_id);
    expect(revision.row.admission_id).not.toBe(f.snapshot.row.admission_id);
    expect((await admitPublishedResearch(revision, "suds-city-la", f.deps)).state).toBe("already_requested");
    await f.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${f.outcome.jobId}`).set({ state: "awaiting_research" }, { merge: true });
    const replaced: any = await admitPublishedResearch(revision, "suds-city-la", f.deps);
    expect(replaced.state).toBe("admitted"); expect(replaced.prospectId).toBe(f.outcome.prospectId);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.outcome.jobId}`).state).toBe("superseded");
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
});
