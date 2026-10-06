// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { admitPublishedResearch, runCommunicationsIntake, runCommunicationsContactRefresh, RESEARCH_WORK_ITEMS } from "../agents/communications-intake";
import { sameOperatorUrl, contactUnknowns, publishedPublicContact, extractBusinessContact } from "../agents/communications-contact-evidence";
import { verifyContactResolution, contactPageText, literalAddressUnsafe } from "../agents/communications-contact-resolution";
import { verifyPublishedResearch, researchPublicationSource } from "../agents/communications-research";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { processCommunicationsJob } from "../agents/communications-worker";
import { communicationsDigest } from "../agents/communications-contract";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";
import type { ContactPage } from "../agents/communications-contact-fetch";
import { CONTACT_RESEARCH_PAGE_LIMIT } from "../agents/communications-contact-fetch";
import { hidingStyle } from "../agents/communications-contact-visibility";
import { readFileSync } from "node:fs";
import { requestNativeContactResearch, readNativeContactDiscovery } from "../agents/communications-contact-research";
import { runCommunicationsFactRefresh } from "../agents/communications-fact-refresh";

const htmlPage = (url: string, body: string, checkedAt = new Date(communicationsNow).toISOString()): ContactPage => ({
  requestedUrl: url, finalUrl: url, redirects: [], checkedAt, status: 200, contentType: "text/html; charset=utf-8", bodyBase64: Buffer.from(body).toString("base64"),
});
function setup(options: Parameters<typeof publishedResearchFixture>[0] = {}) {
  const f = publishedResearchFixture(options), db = memoryFirestore(); let time = communicationsNow;
  const business = `<p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: ${f.prospect.contactEmail}</p>`;
  const readContactPage = vi.fn(async (url: string) => htmlPage(url, new URL(url).pathname === "/contact" ? business
    : `<p>Published recurring packing task.</p><a href="https://facility.example/contact">Contact</a>`, new Date(time).toISOString()));
  const deps = { db, readResearch: vi.fn(async (_date: string) => f.snapshot), isSuppressed: vi.fn(async (_email: string) => false),
    readContactPage, now: () => time };
  const records = (name: string) => [...db.records.entries()].filter(([key]) => key.startsWith(`${COMMUNICATIONS_ROOT}/${name}/`)).map(([, value]) => value);
  const request = async () => admitPublishedResearch(f.snapshot, f.candidate.candidate_key, deps);
  const workItem = async () => db.doc(`${RESEARCH_WORK_ITEMS}/${f.snapshot.row.date}`).set({ date: f.snapshot.row.date,
    run_key: f.snapshot.row.run_key, packet_digest: f.snapshot.row.packet_digest, stage: "completed" });
  const refresh = () => runCommunicationsContactRefresh(deps);
  return { ...f, db, deps, business, records, request, refresh, workItem, advance: (ms: number) => { time += ms; } };
}

describe("contact-free pinned producer → communications contact fulfillment (offline)", () => {
  it("terminates a quarantined native research proof without retrying a provider or losing attempt history",async()=>{
    const f=setup({actualProducer:true,unknowns:["No public business contact has been identified."]});
    f.deps.readContactPage.mockImplementation(async url=>htmlPage(url,"<p>Synthetic operator site, no public address identified.</p>"));
    const deps={...f.deps,requestContactResearch:(source:any,id:string,reason:string)=>requestNativeContactResearch(f.db,source,id,reason,f.deps.now()),
      readContactDiscovery:(source:any,id:string)=>readNativeContactDiscovery(f.db,source,id)};
    await f.request();await runCommunicationsContactRefresh(deps);
    expect(f.records("refreshRequests")[0]).toMatchObject({state:"agent_research_wait",attempts:1});
    const [path]=[...f.db.records.keys()].filter(key=>key.includes("/contactResearchRequests/"));
    expect(path).toBeTruthy();await f.db.doc(path).set({state:"blocked",attempts:1,reason:"contact_research_receipt_changed"},{merge:true});
    const pageCalls=f.deps.readContactPage.mock.calls.length;f.advance(300001);
    await runCommunicationsContactRefresh(deps);await runCommunicationsContactRefresh(deps);
    expect(f.records("refreshRequests")[0]).toMatchObject({state:"terminal",reason:"contact_agent_research_proof_invalid",attempts:1,sessionCreated:false});
    expect(f.db.records.get(path)).toMatchObject({state:"blocked",attempts:1});
    expect(f.records("jobs")).toHaveLength(0);expect(f.records("briefs")).toHaveLength(0);
    expect(f.deps.readContactPage.mock.calls).toHaveLength(pageCalls);
  });
  it("fulfills an actual-format contact-free publication into a draft-ready job, retaining source and terminal contact QA", async () => {
    const f = setup({ actualProducer: true, unknowns: ["No public business contact has been identified.", "Site data-sharing permission is unknown."] });
    const artifact = JSON.parse(Buffer.from(f.snapshot.files.artifact, "base64").toString());
    expect(artifact).toMatchObject({ schema_version: "blueprint.daily-research.v3", checked_date: "2026-09-30" });
    expect(artifact.candidates[0]).not.toHaveProperty("contact");
    expect(artifact.candidates[0].evidence.every((x: any) => !x.claim.includes("blueprint.public-business-contact"))).toBe(true);
    expect(f.snapshot.row.delivery.sheets.plan.sheet_rows[0].slice(4, 8)).toEqual(["", "", "Needs recheck", ""]);
    const original = structuredClone(f.snapshot); await f.workItem(); await runCommunicationsIntake(f.deps);
    expect(f.snapshot).toEqual(original);
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("contactProofs")).toHaveLength(1);
    const outcome = f.records("intake")[0], brief = f.records("briefs")[0], proof = f.records("contactProofs")[0], handoff = f.records("handoffs")[0];
    expect(outcome).toMatchObject({ state: "admitted", sent: false, sessionCreated: false, humanContextApprovalRequired: false });
    expect(proof.qa).toMatchObject({ state: "approved", reviewedBy: "blueprint-communications-contact-verifier" });
    expect(proof.publication).toMatchObject({ rawArtifactDigest: f.snapshot.row.raw_output_digest, packetDigest: f.snapshot.row.packet_digest,
      sheetsProspectId: "BP-000042", prospectId: outcome.prospectId });
    expect(brief).toMatchObject({ researchOrigin: { contactEvidenceKind: "public_operator_resolution", contactEvidenceDigest: communicationsDigest(proof) },
      contact: { scope: "site", resolvedMissingContactGaps: [f.candidate.unknowns[0]] }, unknowns: f.candidate.unknowns,
      stage: { interest: "unknown" }, consent: { sharingBoundary: "Public sources only; site permission required before any team disclosure" } });
    expect(brief.facts.map((x: any) => x.claim)).toEqual(f.candidate.evidence.map(x => x.claim));
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "resolved", jobId: outcome.jobId, contactProofDigest: communicationsDigest(proof) });
    expect(() => verifyPublishedResearch(f.snapshot, brief, handoff, proof)).not.toThrow();
    expect(() => verifyPublishedResearch(f.snapshot, brief, handoff)).toThrow();
    const store = new CommunicationsStore(f.db, f.deps.now), api = { run: vi.fn().mockResolvedValue({
      output: { ...f.output, body: f.output.body.replace(f.output.outreachContract!.question, brief.contact.learningQuestion),
        outreachContract: { ...f.output.outreachContract!, question: brief.contact.learningQuestion }, usedFactIds: [brief.facts[0].id] },
      checkpoint: { createClaimedAt: null, sessionId: "offline-session", turnId: "offline-turn" }, usage: { offline: true } }),
      cancel: vi.fn(), reconcileSaved: vi.fn() }, verifyMailbox = vi.fn(), readThread = vi.fn();
    const response = await processCommunicationsJob(outcome.jobId, { ...f.deps, store, api, verifyMailbox, readThread, suppress: vi.fn() });
    expect(response, JSON.stringify(response)).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(f.db.records.get(`action_ledger/communications_${outcome.jobId}`)).toMatchObject({ action_tier: 3, status: "pending_approval", approved_by: null });
    expect(verifyMailbox).not.toHaveBeenCalled(); expect(readThread).not.toHaveBeenCalled();
  });

  it("accepts ordinary published operator prose and preserves permission unknowns without refresh or magic assertion", async () => {
    const f = setup({ naturalContact: true, unknowns: ["Site capture permission is unknown.", "Data-sharing consent has not been established."] });
    expect(await f.request()).toMatchObject({ state: "admitted" });
    expect(f.records("briefs")[0].contact.scope).toBe("site"); expect(f.deps.readContactPage).not.toHaveBeenCalled();
    expect(f.records("contactProofs")).toHaveLength(0);
  });

  it("retains the Oct3 prior-contact unknown and still requires independent public contact proof", async () => {
    // Retained candidate wording; the contact/publication fixture below is
    // synthetic and never joins this text to a real recipient or authority.
    const unknown = "Current decision, interest, decision owner, timing, budget, willingness to pay, pilot intent and previous contact unknown. Recent dryers alone do not establish demand.";
    const f = setup({ actualProducer: true, unknowns: [unknown, "Site data-sharing permission is unknown."] });
    const original = structuredClone(f.snapshot);
    expect(contactUnknowns(f.candidate)).toEqual({ gaps: [], blocked: [] });
    expect(await f.request()).toMatchObject({ state: "needs_research", reasons: ["verified_public_business_contact_missing"] });
    expect(f.records("jobs")).toHaveLength(0); expect(f.deps.readContactPage).not.toHaveBeenCalled();
    await f.refresh();
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("contactProofs")).toHaveLength(1);
    expect(f.records("briefs")[0]).toMatchObject({ unknowns: f.candidate.unknowns, stage: { interest: "unknown" } });
    expect(f.snapshot).toEqual(original);
    expect(() => extractBusinessContact("commercial@laundryrepublic.com", { organization: "Laundry Republic", site: "Balham" }, false, true))
      .toThrow("verified_contact_source_binding_invalid");
  });

  it.each(["Previous contact is unknown.", "Prior-contact history remains unknown.", "Unknown prior contact history."])
    ("does not turn history uncertainty into a recipient restriction: %s", unknown => {
      expect(contactUnknowns({ unknowns: [unknown] })).toEqual({ gaps: [], blocked: [] });
    });

  it.each(["Permission to email this site is unknown.", "The recipient has opted out.", "Contact identity is ambiguous.",
    "Already contacted this operator.", "No unsolicited outreach.", "The contact is not available.", "Restrictions remain unknown.", "Please don’t follow up.", "No further follow-ups."])
    ("preserves consequential limits beside history uncertainty: %s", restriction => {
      const unknown = `Prior contact unverified. ${restriction}`;
      expect(contactUnknowns({ unknowns: [unknown] }).blocked).toEqual([unknown]);
    });

  it.each([["https://www.facility.example", "https://facility.example/contact"],
    ["https://facility.example", "https://www.facility.example/contact"],
    ["https://www.facility.example", "https://contact.facility.example/contact"]])("normalizes www symmetrically: %s → %s", (organizationUrl, contactUrl) => {
    const f = publishedResearchFixture({ naturalContact: true, mutateCandidate: c => { c.organization_url = organizationUrl; c.evidence.at(-1).url = contactUrl; } });
    expect(publishedPublicContact(f.candidate).email).toBe(f.prospect.contactEmail);
  });
  it.each(["https://facility.example.attacker.example/contact", "https://otherfacility.example/contact", "https://example/contact", "https://u:p@facility.example/contact"])("rejects scope widening: %s", url => {
    expect(sameOperatorUrl(url, "https://www.facility.example")).toBe(false);
  });

  it("records an organization route without inferring site employment or authority", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<p>${f.candidate.organization}: commercial inquiries: ${f.prospect.contactEmail}</p>`));
    await f.request(); await f.refresh();
    expect(f.records("briefs")[0].contact.scope).toBe("organization_business_route");
    expect(f.records("contactProofs")[0].contact.site).toBeNull();
    expect(f.records("briefs")[0].outreachContext.connectionEvidence).toBeNull();
  });

  it("accepts the retained official general-contact wording only as an organization route", () => {
    // Visible public text checked 2026-10-02 at https://www.cleanservices.co.uk/contact.
    // This excerpt is not a retained HTML/visibility proof or a production contact admission.
    const quote = "For more information, contact us on: 0330 818 7008 info@cleanservices.co.uk";
    const candidate = { organization: "CLEAN Linen & Workwear", organization_url: "https://www.cleanservices.co.uk", site: "Yeovil",
      unknowns: ["Site data-sharing permission is unknown."], evidence: [{
        claim: "CLEAN Linen & Workwear publishes a general contact route", quote,
        url: "https://www.cleanservices.co.uk/contact", classification: "operator", claim_kind: "fact", origin: "live",
        assertion_scope: "current_operational", checked_date: "2026-10-02",
      }] };
    expect(publishedPublicContact(candidate)).toMatchObject({ email: "info@cleanservices.co.uk", scope: "organization_business_route",
      sourceUrl: "https://www.cleanservices.co.uk/contact" });
    expect(extractBusinessContact(`Yeovil: ${quote}`, candidate, false, true).scope).toBe("organization_business_route");
    expect(extractBusinessContact(`Yeovil business inquiries: ${quote}`, candidate, false, true).scope).toBe("site");
    expect(() => publishedPublicContact({ ...candidate, evidence: [{ ...candidate.evidence[0], url: "https://other.example/contact" }] })).toThrow();
    expect(() => extractBusinessContact(quote, candidate)).toThrow();
  });

  it("retains a general-route sidecar without changing research or inferring a site owner", async () => {
    const f = setup({ actualProducer: true, unknowns: ["No public business contact has been identified.", "Site permission is unknown."] });
    const original = structuredClone(f.snapshot);
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>For more information, contact us on: ${f.prospect.contactEmail}</p>`));
    await f.request(); await f.refresh(); await f.request(); await f.refresh();
    expect(f.snapshot).toEqual(original);
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("contactProofs")).toHaveLength(1);
    expect(f.records("contactProofs")[0]).toMatchObject({ contact: { scope: "organization_business_route", site: null }, qa: { state: "approved" } });
    expect(f.records("briefs")[0]).toMatchObject({ unknowns: f.candidate.unknowns,
      outreachContext: { connectionEvidence: null }, contact: { scope: "organization_business_route" } });
  });

  it.each(["Newsletter subscriptions", "Login assistance", "Personal email", "Technical support only", "Media enquiries", "No unsolicited contact"])
    ("does not convert %s into a general business route", label => {
      expect(() => extractBusinessContact(`${label}: For more information, contact us on: person@facility.example`,
        { organization: "Synthetic operator", site: "Synthetic site" }, false, true)).toThrow();
    });

  it("rejects an ambiguous general-contact segment beside another valid route", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, f.business
      + `<p>${f.candidate.organization}: For more information, contact us on: first@facility.example or second@facility.example</p>`));
    await f.request(); await f.refresh();
    expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "terminal", reason: "contact_resolution_ambiguous_segment" });
  });

  it("survives concurrent consumption and restart/replay with one proof, job and first-touch claim", async () => {
    const f = setup(); await f.request();
    await Promise.all([f.refresh(), f.refresh()]); const calls = f.deps.readContactPage.mock.calls.length;
    await f.request(); await f.refresh(); await f.refresh();
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("contactProofs")).toHaveLength(1); expect(f.records("firstTouches")).toHaveLength(1);
    expect(f.deps.readContactPage).toHaveBeenCalledTimes(calls);
  });

  it("reclaims an expired request after restart and refuses source mismatch before retrieval", async () => {
    const f = setup(); await f.request(); const key = [...f.db.records.keys()].find(k => k.includes("/refreshRequests/"))!;
    await f.db.doc(key).update({ state: "running", attempts: 1, lease: { owner: "crashed", until: communicationsNow - 1 } });
    await f.refresh(); expect(f.records("refreshRequests")[0]).toMatchObject({ state: "resolved", attempts: 2 });
    const g = setup(); await g.request(); g.snapshot.row.raw_output_digest = "a".repeat(64); await g.refresh();
    expect(g.records("refreshRequests")[0]).toMatchObject({ state: "terminal", reason: "contact_refresh_source_changed" }); expect(g.deps.readContactPage).not.toHaveBeenCalled();
  });

  it("rechecks publication after retrieval and refuses a lost lease atomically", async () => {
    for (const changed of ["source", "lease"]) {
      const f = setup(); await f.request();
      const read = f.deps.readContactPage.getMockImplementation()!;
      f.deps.readContactPage.mockImplementation(async url => {
        const page = await read(url);
        if (changed === "source") f.snapshot.files.qa = Buffer.from("{}").toString("base64");
        else { const key = [...f.db.records.keys()].find(k => k.includes("/refreshRequests/"))!;
          await f.db.doc(key).update({ lease: { owner: "another-consumer", until: communicationsNow + 180000 } }); }
        return page;
      });
      await f.refresh(); expect(f.records("jobs")).toHaveLength(0); expect(f.records("contactProofs")).toHaveLength(0);
    }
  });

  it.each(["Permission to email this site is unknown.", "Recipient consent is not established.", "Consent is unknown.",
    "Do not contact this operator.", "The contact is not available.", "Contact identity is ambiguous."])("never clears recipient uncertainty: %s", async unknown => {
    const f = setup({ unknowns: [unknown] }); await f.request(); await f.refresh();
    expect(f.records("jobs")).toHaveLength(0); expect(f.deps.readContactPage).not.toHaveBeenCalled();
    expect(contactUnknowns(f.candidate).blocked).toContain(unknown);
  });

  it.each(["support", "hidden", "script", "split", "ambiguous", "prohibited", "wrong_org"])("does not invent a route from %s evidence; bounded attempt terminates", async kind => {
    const f = setup(); let body = f.business;
    if (kind === "support") body = body.replace("Business inquiries", "Technical support only");
    if (kind === "hidden") body = `<div hidden>${body}</div>`;
    if (kind === "script") body = `<script>${body}</script><!--${body}-->`;
    if (kind === "split") body = `<p>${f.candidate.organization}: Business inquiries</p><p>${f.prospect.contactEmail}</p>`;
    if (kind === "ambiguous") body += `<p>${f.candidate.organization}: Business inquiries: other@facility.example</p>`;
    if (kind === "prohibited") body += "<p>No unsolicited contact</p>";
    if (kind === "wrong_org") body = body.replace(f.candidate.organization, "Another operator");
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, body));
    await f.request(); await f.refresh();
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("refreshRequests")[0].state).toBe("terminal");
    const calls = f.deps.readContactPage.mock.calls.length; await f.request(); await f.refresh(); await f.refresh();
    expect(f.deps.readContactPage).toHaveBeenCalledTimes(calls);
  });

  it("retries a transient fetch with persisted backoff and a finite attempt count", async () => {
    const f = setup(); f.deps.readContactPage.mockRejectedValue(new Error("contact_fetch_timeout"));
    await f.request(); await f.refresh(); expect(f.records("refreshRequests")[0]).toMatchObject({ state: "retry_wait", attempts: 1 });
    await f.refresh(); await f.refresh(); expect(f.deps.readContactPage).toHaveBeenCalledTimes(1);
    f.advance(300001); await f.refresh(); await f.refresh();
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "terminal", attempts: 2 }); expect(f.deps.readContactPage).toHaveBeenCalledTimes(2);
  });

  it.each(["session", "ledger", "send", "active"])("preserves pre-existing first-touch %s fence during contact fulfillment", async kind => {
    const f = setup(); await f.request();
    const key = communicationsDigest({ sheetsId: f.snapshot.row.packet.destinations.sheet_id, sheetsProspectId: "BP-000042" }), prospectId = `research-${key}`;
    await f.db.doc(`outboundProspects/${prospectId}`).set({ ...f.prospect, contactEmail: "", researchPublicationId: "BP-000042" });
    const store = new CommunicationsStore(f.db, f.deps.now), job = await store.enqueue({ prospectId, briefId: "old", briefDigest: "a".repeat(64), intent: "outreach", inboundMessageId: null });
    await f.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${job.jobId}`).update({ state: "awaiting_research",
      ...(kind === "session" ? { checkpoint: { createClaimedAt: new Date(communicationsNow).toISOString(), sessionId: null, turnId: null } } : {}),
      ...(kind === "active" ? { lease: { owner: "active", until: communicationsNow + 1000 } } : {}) });
    if (kind === "ledger") await f.db.doc(`action_ledger/communications_${job.jobId}`).set({ status: "pending_approval" });
    if (kind === "send") { const claimKey = [...f.db.records.keys()].find(k => k.includes("/firstTouches/"))!.split("/").at(-1);
      await f.db.doc(`${COMMUNICATIONS_ROOT}/sendReceipts/${claimKey}`).set({ state: "claimed" }); }
    await f.refresh(); expect(f.records("jobs")).toHaveLength(1); expect(f.records("contactProofs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "terminal", reason: "communications_first_touch_already_requested" });
  });

  it.each(["body", "quote", "qa", "recipient", "prospect", "source"])("rejects changed immutable proof %s before paid drafting", async kind => {
    const f = setup(); await f.request(); await f.refresh(); const proof = f.records("contactProofs")[0], brief = f.records("briefs")[0];
    const source = researchPublicationSource(f.snapshot, brief.researchOrigin);
    if (kind === "body") proof.pages[0].bodyBase64 = Buffer.from("changed").toString("base64");
    if (kind === "quote") proof.extraction.quote = "Invented quote";
    if (kind === "qa") proof.qa.inputDigest = "a".repeat(64);
    if (kind === "recipient") proof.contact.email = "other@facility.example";
    if (kind === "prospect") proof.publication.prospectId = "other";
    if (kind === "source") proof.publication.rawArtifactDigest = "a".repeat(64);
    expect(() => verifyContactResolution(proof, source, brief.prospectId)).toThrow();
    const proofKey = [...f.db.records.keys()].find(k => k.includes("/contactProofs/"))!; await f.db.doc(proofKey).set(proof);
    const api = { run: vi.fn(), cancel: vi.fn(), reconcileSaved: vi.fn() };
    await processCommunicationsJob(f.records("jobs")[0].jobId, { ...f.deps, store: new CommunicationsStore(f.db, f.deps.now), api,
      verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn() }); expect(api.run).not.toHaveBeenCalled();
  });

  it("extracts literal entities and excludes hidden/administrative/footer personal routes", () => {
    const page = htmlPage("https://facility.example/contact", '<!--secret--><p>Org: business inquiries: business&#64;facility.example</p>'
      + '<div style="display:none"><p>Hidden: business inquiries: hidden@facility.example</p></div><footer>Personal: personal@facility.example</footer><script>admin@facility.example</script>');
    expect(contactPageText(page).segments).toEqual(["Org: business inquiries: business@facility.example"]);
  });
  it("finds navigation contact links from the root before task pages spend the page budget", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, new URL(url).pathname === "/contact"
      ? `<h1>${f.candidate.organization}</h1><p>Business inquiries: ${f.prospect.contactEmail}</p>`
      : `<nav><a href="/contact">Contact</a></nav><p>Operator tasks.</p>`));
    await f.request(); await f.refresh();
    expect(f.deps.readContactPage.mock.calls.slice(0, 2).map(x => x[0])).toEqual(["https://facility.example/", "https://facility.example/contact"]);
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("briefs")[0].contact.scope).toBe("organization_business_route");
  });
  it.each(["<footer>No unsolicited contact</footer>", "<nav>Do not contact us</nav>", "<p>Please do not email us</p>",
    "<footer>We have opted out</footer>"])("preserves visible restriction text: %s", async restriction => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, f.business + restriction));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "terminal", reason: "contact_resolution_recipient_restricted" });
  });
  it("does not treat newsletter/cookie opt-out instructions as an existing recipient prohibition", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, f.business
      + "<footer>Subscribe to our newsletter; you may unsubscribe any time. You can opt out of cookies.</footer>"));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(1);
  });
  it("uses bounded names for organization and site scope", async () => {
    const f = setup({ mutateCandidate: c => { c.site = "Site 1"; } });
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<p>${f.candidate.organization}, Site 10: business inquiries: ${f.prospect.contactEmail}</p>`));
    await f.request(); await f.refresh(); expect(f.records("briefs")[0].contact.scope).toBe("organization_business_route");
    const g = setup({ mutateCandidate: c => { c.organization = "Acme"; } });
    g.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<p>NotAcme: business inquiries: ${g.prospect.contactEmail}</p>`));
    await g.request(); await g.refresh(); expect(g.records("jobs")).toHaveLength(0);
  });
  // Owner decision 2026-10-04: page-level presentation no longer disqualifies a page; only
  // detectably hidden content is excluded, and every proof records that CSS was not rendered.
  it.each(['<link rel="stylesheet" href="/site.css">', '<link rel=stylesheet href="/site.css">',
    '<link title=" rel=icon " rel=stylesheet href=/site.css>', "<style>p { color: #222 }</style>",
    "<script>if (a < b && c > d) { load(); }</script>", '<body onload="init()">', '<body text="white">'])(
    "accepts a literal business email on a page with %s and records that CSS was not rendered", async presentation => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, presentation + `<h1>${f.candidate.organization}</h1>` + f.business
      + (presentation.startsWith("<body") ? "</body>" : "")));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(1);
    expect(f.records("contactProofs")[0].extraction).toMatchObject({ version: "blueprint.public-contact-text.v2",
      visibilityBasis: "static_text_css_not_rendered" });
  });
  it("excludes an email hidden by a detectable embedded style rule", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<style>.secret { display: none }</style><h1>${f.candidate.organization}</h1><p class="secret">Business inquiries: hidden@facility.example</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it.each(["hidden", 'aria-hidden="true"', "inert", "popover"])("excludes an email inside an element marked %s", async marker => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><div ${marker}><p>Business inquiries: hidden@facility.example</p></div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it.each(["display:none", "visibility: hidden", "opacity:0", "font-size:0", "width:0;height:0", "height:0;overflow:hidden",
    "position:absolute;left:-9999px", "text-indent:-9999px", "clip: rect(0, 0, 0, 0)", "clip-path: inset(50%)", "transform: scale(0)"])(
    "excludes an email inside a hiding inline style: %s", async style => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><div style="${style}"><p>Business inquiries: hidden@facility.example</p></div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it.each(["script", "style", "template", "noscript", "svg"])("never reads an email from inside %s", tag => {
    const page = htmlPage("https://facility.example/contact", `<p>Org.</p><${tag}>Business inquiries: hidden@facility.example</${tag}>`);
    expect(contactPageText(page).segments.join(" ")).not.toContain("hidden@facility.example");
  });
  it("allows a styled discovery page to lead to independently verifiable static/plain-text contact evidence", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, new URL(url).pathname === "/contact" ? f.business
      : '<link rel="stylesheet" href="/site.css"><nav><a href="/contact">Contact</a></nav>'));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(1);
    expect(f.records("contactProofs")[0].pages[0].bodyBase64).toContain(Buffer.from('<link').toString('base64').slice(0, 4));
  });
  it("refuses inline-styled positive evidence whose visibility is unresolved", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><div style="height:0;overflow:hidden"><p>Business inquiries: hidden@facility.example</p></div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it("never assembles a new address by removing unresolved styled inline text", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><p>Business inquiries: business<span style="color:red">-support</span>@facility.example</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it.each(['<span style="display:none">-support</span>', "<span hidden>-support</span>", '<span class="x">-support</span>'])(
    "never splices an address across an element boundary: %s", async fragment => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<style>.x{display:none}</style><h1>${f.candidate.organization}</h1><p>Business inquiries: business${fragment}@facility.example</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it("replays real-shape pages with stylesheets, scripts, inline SVG and mis-nesting without markup errors", async () => {
    const f = setup();
    const shell = (main: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Contact</title>
<link rel="stylesheet" href="/assets/site.css"><link rel="preload" href="/f.woff2" as="font">
<style>.sr-only{position:absolute;left:-10000px}.icon{width:1em}</style>
<script>window.dataLayer=[];if (a < b && b > c) { track('<x>'); }</script></head>
<body onload="init()"><header><nav><a href="/"><svg class="icon" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/><circle cx="12" cy="12" r="4"/></svg>Home</a>
<a href="/contact">Contact</a></nav></header><main><section><h1>${f.candidate.organization}</h1>
<p>We run <b>recurring packing</i> work at ${f.candidate.site}.</p><ul><li>Item one<li>Item two</ul>
${main}</section></main><footer>Careers: careers@facility.example</footer>
<script src="/app.js"></script></body></html>`;
    const visible = shell(`<p>Business inquiries: <a href="mailto:${f.prospect.contactEmail}">${f.prospect.contactEmail}</a></p>`);
    expect(() => contactPageText(htmlPage("https://facility.example/contact", visible))).not.toThrow();
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, new URL(url).pathname === "/contact" ? visible : shell("<p>Operator tasks.</p>")));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(1);
    expect(f.records("contactProofs")[0].extraction.visibilityBasis).toBe("static_text_css_not_rendered");
    const g = setup(); g.deps.readContactPage.mockImplementation(async url => htmlPage(url, shell(`<p class="sr-only">Business inquiries: hidden@facility.example</p>`)));
    await g.request(); await g.refresh(); expect(g.records("jobs")).toHaveLength(0);
  });
  it.each(["dialog", "details", "canvas", "object", "iframe", "select", "form", "title", "datalist", "audio", "video", "font", "code", "pre"])("refuses contact inference from unsupported %s containers", async tag => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><${tag}><p>Business inquiries: hidden@facility.example</p></${tag}>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it("refuses a page that navigates away before it is seen", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, '<meta http-equiv="refresh" content="0;url=/other">' + f.business));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_visibility_unverified");
  });
  it("reads only outside static text on a page with an embedded document, recording that CSS was not rendered", async () => {
    // Owner decision 2026-10-04: an embedded document no longer disqualifies the page; its own content is never read.
    const inside = contactPageText(htmlPage("https://facility.example/contact", '<iframe src="/active.html"><p>Business inquiries: hidden@facility.example</p></iframe><p>Org.</p>'));
    expect(inside.segments.join(" ")).not.toContain("hidden@facility.example");
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<iframe src="/active.html"></iframe>${f.business}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(1);
    expect(f.records("contactProofs")[0].extraction.visibilityBasis).toBe("static_text_css_not_rendered");
  });
  it.each(['<div hidden></body>Business inquiries: hidden@facility.example</div>',
    '<div hidden>Business inquiries: hidden@facility.example', '<div hidden></p>Business inquiries: hidden@facility.example</div>',
    '<div hidden></body></html><p>Business inquiries: hidden@facility.example</p></div>'])("refuses malformed or unfinished hidden nesting: %s", async markup => {
    // Tolerant, browser-equivalent parsing (owner decision 2026-10-04): stray or missing closing
    // tags never release hidden content, including inside an explicit <html><body> document.
    for (const wrap of [(m: string) => `<h1>Org</h1>${m}`, (m: string) => `<!DOCTYPE html><html><head></head><body><h1>Org</h1>${m}`]) {
      expect(contactPageText(htmlPage("https://facility.example/contact", wrap(markup))).segments.join(" ")).not.toContain("hidden@facility.example");
    }
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<!DOCTYPE html><html><body><h1>${f.candidate.organization}</h1>${markup}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_missing_or_ambiguous");
  });
  it.each(["popover", "inert", 'aria-hidden="tru&#101;"'])("excludes hidden/ineligible contact attributes %s", async attr => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><div ${attr}>${f.business}</div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it("resolves self-closing non-void elements and duplicate attributes as browsers do, and does not read hrefs from quoted values", async () => {
    // A self-closing slash on an HTML element is ignored, as browsers do, so the hidden div still contains the text.
    const selfClosing = setup(); selfClosing.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${selfClosing.candidate.organization}</h1><div hidden />Business inquiries: hidden@facility.example</div>`));
    await selfClosing.request(); await selfClosing.refresh(); expect(selfClosing.records("jobs")).toHaveLength(0);
    expect(selfClosing.records("refreshRequests")[0].reason).toBe("contact_resolution_missing_or_ambiguous");
    // Duplicate attributes resolve exactly as browsers do (the first one wins), so a later
    // duplicate can neither release hidden text nor redirect a contact link.
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><div style="display:none" style="color:red">${f.business}</div><div hidden hidden="">${f.business}</div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_missing_or_ambiguous");
    expect(contactPageText(htmlPage("https://facility.example/", '<a href="/contact" href="https://attacker.example/contact">Contact</a>')).links)
      .toEqual(["https://facility.example/contact"]);
    const parsed = contactPageText(htmlPage("https://facility.example/", '<a title=" href=/contact " href="https://attacker.example/contact">Contact</a>'));
    expect(parsed.links).toEqual(["https://attacker.example/contact"]);
  });
});

// Behaviour change in this PR (commit 3fa1a909): the stale-fact worker runs first in every tick and used to
// claim every pending or running refresh request. Intake requests carry no job, so it marked them
// unresolved (source_refresh_unavailable) before their owners saw them. It now leaves them to their owners.
describe("verified intake refresh requests are left to their owners by the stale-fact worker (offline)", () => {
  it("keeps a verified row's contact gap pending, or running, through a stale-fact pass until contact research fulfils it", async () => {
    const f = setup({ actualProducer: true, unknowns: ["Site data-sharing permission is unknown."] });
    expect(await f.request()).toMatchObject({ state: "needs_research", reasons: ["verified_public_business_contact_missing"] });
    const path = `${COMMUNICATIONS_ROOT}/refreshRequests/${[...f.db.records.keys()].find(key => key.includes("/refreshRequests/"))!.split("/").at(-1)}`;
    expect(path).toMatch(/\/refreshRequests\/intake_[a-f0-9]{64}$/);
    const pending = structuredClone(f.db.records.get(path));
    expect(pending).toMatchObject({ kind: "public_contact_resolution", owner: "blueprint-communications-agent", state: "pending" });
    await runCommunicationsFactRefresh(f.db, f.deps.readContactPage, f.deps.now);
    expect(f.db.records.get(path)).toEqual(pending);
    // A contact worker on another instance holds it: the stale-fact worker leaves that claim alone too.
    const held = { ...pending, state: "running", attempts: 1, lease: { owner: "another-contact-worker", until: communicationsNow + 180000 } };
    await f.db.doc(path).set(held);
    await runCommunicationsFactRefresh(f.db, f.deps.readContactPage, f.deps.now);
    expect(f.db.records.get(path)).toEqual(held);
    expect(f.deps.readContactPage).not.toHaveBeenCalled();
    // Once that claim lapses, contact research fulfils the gap.
    f.advance(180001);
    await f.refresh();
    const outcome = f.records("intake")[0];
    expect(outcome).toMatchObject({ state: "admitted", sent: false, sessionCreated: false });
    expect(f.db.records.get(path)).toMatchObject({ state: "resolved", jobId: outcome.jobId });
    expect(f.records("jobs")).toHaveLength(1);
  });

  it("keeps a verified row's research-owner request pending for the research owner", async () => {
    const f = setup({ publicContact: true });
    f.advance(9 * 86400000);
    const outcome = await f.request();
    expect(outcome).toMatchObject({ state: "needs_research" });
    expect(outcome.reasons[0]).not.toMatch(/contact/);
    const [request] = f.records("refreshRequests");
    expect(request).toMatchObject({ kind: "research_owner_refresh", owner: "blueprint-research-agent", state: "pending", reasons: outcome.reasons });
    const before = structuredClone(request);
    await runCommunicationsFactRefresh(f.db, f.deps.readContactPage, f.deps.now);
    await f.refresh();
    expect(f.records("refreshRequests")).toEqual([before]);
    expect(f.deps.readContactPage).not.toHaveBeenCalled();
    expect(f.records("jobs")).toHaveLength(0);
  });
});

describe("element-level contact visibility (owner decision 2026-10-04)", () => {
  const page = (body: string) => htmlPage("https://facility.example/contact", body);
  it.each(["p { display: none }", "* { visibility: hidden }", "div#c { opacity: 0 }", "p.x, .c { display:none }"])(
    "detectable embedded rule %s excludes the matching element", rule => {
    const parsed = contactPageText(page(`<style>${rule}</style><div id="c" class="c"><p class="x">Business inquiries: hidden@facility.example</p></div>`));
    expect(parsed.segments.join(" ")).not.toContain("hidden@facility.example");
  });
  it("records element boundaries so an address cannot be stitched from separate runs", () => {
    const parsed = contactPageText(page('<p>Business inquiries: <a href="mailto:a@facility.example">a@facility.example</a>.</p><p>x<b>y</b>@facility.example</p>'));
    expect(parsed.segments).toEqual(["Business inquiries: a@facility.example.", "xy@facility.example"]);
    expect(parsed.joins[1]).toEqual([1, 2]);
  });
});

// Independent review of the first element-level implementation: every input below became an
// approved contact proof through a hand-written tolerant tree builder. Markup is now parsed with
// browser-equivalent (WHATWG) tree construction, so text a browser does not render is never proof.
describe("browser-equivalent markup parsing for contact proof", () => {
  const H = "hidden@facility.example", DOC = "<!DOCTYPE html>";
  const page = (body: string) => htmlPage("https://facility.example/contact", body);
  const visibleText = (body: string) => contactPageText(page(body)).segments.join(" ");
  const hiddenProbes: [string, string][] = [
    ["A1 </body> inside a hidden element", `${DOC}<html><body><h1>Org</h1><div hidden></body><p>Business inquiries: ${H}</p></div></html>`],
    ["A2 </html> inside a hidden element", `${DOC}<html><body><h1>Org</h1><div hidden></html><p>Business inquiries: ${H}</p></div>`],
    ["A3 </b> over a hidden block", `${DOC}<h1>Org</h1><b><div hidden></b><p>Business inquiries: ${H}</p></div>`],
    ["A3a </a> over a hidden block", `${DOC}<h1>Org</h1><a href="/about"><div hidden></a><p>Business inquiries: ${H}</p></div>`],
    ["A3b </span> across a display:none block", `${DOC}<h1>Org</h1><span><div style="display:none"></span><p>Business inquiries: ${H}</p></div>`],
    ["A4 </div> across a table cell", `${DOC}<h1>Org</h1><div><table><tr><td><span hidden></div>Business inquiries: ${H}</span></td></tr></table></div>`],
    ["A5 quirks-mode table inside a hidden paragraph", `<h1>Org</h1><p hidden><table><tr><td>Business inquiries: ${H}</td></tr></table>`],
    ["A6 unclosed script", `${DOC}<html><body><h1>Org</h1><div><script>var a = 1;</div><p>Business inquiries: ${H}</p>`],
    ["A7 noembed raw text", `${DOC}<h1>Org</h1><div><noembed></div><p>Business inquiries: ${H}</p></noembed></div>`],
    ["A8 unclosed style", `${DOC}<html><body><h1>Org</h1><div><style>.a{}</div><p>Business inquiries: ${H}</p>`],
    ["B1 nested template", `${DOC}<h1>Org</h1><template><template></template><p>Business inquiries: ${H}</p></template>`],
    ["B2 nested svg", `${DOC}<h1>Org</h1><svg><svg></svg>Business inquiries: ${H}</svg>`],
    ["B3 custom element named like a container", `${DOC}<h1>Org</h1><svg-icon name="x"></svg-icon><div hidden><svg viewBox="0 0 1 1"></svg><p>Business inquiries: ${H}</p></div>`],
    ["B3b video-like custom element", `${DOC}<h1>Org</h1><video-player src="a"></video-player><div hidden><video></video><p>Business inquiries: ${H}</p></div>`],
    ["B4 container start inside an attribute value", `${DOC}<h1>Org</h1><p title="Use a <script> tag">Tip</p><div hidden><script>init()</script><p>Business inquiries: ${H}</p></div>`],
    ["B5 container start inside a comment", `${DOC}<h1>Org</h1><!-- legacy: <script> --><div hidden><script>init()</script><p>Business inquiries: ${H}</p></div>`],
    ["B6 uppercase svg", `${DOC}<h1>Org</h1><SVG>Business inquiries: ${H}</svg>`],
    ["B7 legacy escaped script", `${DOC}<h1>Org</h1><script><!-- document.write("<script>a()</script>"); var c = "Business inquiries: ${H}"; --></script><p>after</p>`],
    ["C1 unterminated comment", `${DOC}<h1>Org</h1><!-- old contact <p>Business inquiries: ${H}</p>`],
    ["C2 unterminated comment containing >", `${DOC}<h1>Org</h1><!-- a > b <p>Business inquiries: ${H}</p>`],
    ["C3 unterminated attribute quote", `${DOC}<h1>Org</h1><p>Business inquiries: <span title='x>${H}</span></p>`],
    ["C4 attribute value after an unquoted apostrophe", `${DOC}<h1>Org</h1><p><img alt=O'Brien src="/a.png" title="Business inquiries: ${H}"></p>`],
    ["C5 bogus comment", `${DOC}<h1>Org</h1><p></3 Business inquiries: ${H}></p>`],
  ];
  it.each(hiddenProbes)("never reads text a browser does not render: %s", (_name, body) => {
    expect(visibleText(body)).not.toContain(H);
  });
  it.each([
    ["A9 </div> closes a hidden inline child", `${DOC}<h1>Org</h1><div><span hidden></div><p>Business inquiries: ${H}</p>`],
    ["A10 a new paragraph closes a hidden one", `${DOC}<h1>Org</h1><p hidden>x<p>Business inquiries: ${H}`],
  ])("releases text exactly where a browser renders it: %s", (_name, body) => {
    expect(visibleText(body)).toContain(`Business inquiries: ${H}`);
  });
  it.each(["A1", "A3a", "A3b", "A6", "B1", "B3", "B5", "C3", "C4"])("creates no proof end to end for %s", async id => {
    const f = setup(), body = hiddenProbes.find(([name]) => name.startsWith(`${id} `))![1].replace("<h1>Org</h1>", `<h1>${f.candidate.organization}</h1>`);
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, body));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0); expect(f.records("contactProofs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_missing_or_ambiguous");
  });
  const hidingStyles = ["display:none", "display: none !important", "visibility :hidden", "opacity:0.0 !important", "opacity:0%", "opacity:0e0",
    "font-size:0.0px", "font-size:0.4px", "font:0/0 a", "clip-path:inset(100%)", "max-height:0;overflow:hidden", "position:fixed;top:-100vh",
    "color:transparent", "color:rgba(0,0,0,0)", "color:rgb(0 0 0 / 0%)", "color:#0000", "-webkit-text-fill-color:transparent",
    "content-visibility:hidden", "position:absolute;clip:rect(1px,1px,1px,1px);width:1px;height:1px;overflow:hidden",
    "transform:scaleX(0)", "transform:scale(1,0)", "transform:translateX(-9999px)", "transform:translateX(-100%)", "transform:matrix(0,0,0,0,0,0)",
    "transform:rotateY(90deg)", "scale:0", "translate:-9999px", "position:absolute;left:9999px", "margin:0 0 0 -10000px", "inset:-9999px auto auto -9999px",
    "width:0ex", "filter:opacity(0)", "display&colon;none", "displ\\61 y:none", "display:var(--hide)", "display:/* x */none", "zoom:0.01"];
  it.each(hidingStyles)("excludes text under a hiding inline style: %s", style => {
    expect(visibleText(`${DOC}<h1>Org</h1><div style="${style}"><p>Business inquiries: ${H}</p></div>`)).not.toContain(H);
  });
  it.each(["color:red", "display:block", "opacity:1", "width:100%", "margin:0 auto", "transform:translateX(10px)", "font-size:16px",
    "position:relative;left:-20px", "clip-path:inset(0)", "background:url(data:image/png;base64,AAAA)"])("keeps text under an ordinary inline style: %s", style => {
    expect(hidingStyle(style)).toBe(false);
    expect(visibleText(`${DOC}<h1>Org</h1><div style="${style}"><p>Business inquiries: ok@facility.example</p></div>`)).toContain("ok@facility.example");
  });
  it.each([["@media nesting", "@media (min-width:0){ .c { display:none } }"], ["comment between", ".c /* x */ { display /* y */ : none }"],
    ["selector list with a complex selector", "div > p, .c { visibility:hidden }"], ["universal", "*{opacity:0}"], ["uppercase tag", "P{display:none}"],
    ["important and newline", ".c{\n  display : none !important;\n}"], ["compound", ".a.c{display:none}"], ["descendant", "div .c{display:none}"],
    ["attribute", "[data-x]{display:none}"], ["attribute value", '[data-x="Y"]{display:none}'], ["conditional pseudo-class", ".c:not(:focus){clip:rect(0 0 0 0)}"],
    ["nested CSS", "div { color: red; .c { display: none } }"], ["case-insensitive class", ".A{display:none}"], ["legacy comment markers", "<!-- .c{display:none} -->"]])(
    "excludes text matched by an embedded hiding rule: %s", (_name, rule) => {
    expect(visibleText(`${DOC}<style>${rule}</style><h1>Org</h1><div><p class="a c" data-x="y">Business inquiries: ${H}</p></div>`)).not.toContain(H);
  });
  it("collapses repeated subject compounds so ordinary large style sheets stay within the rule caps", () => {
    const sheet = Array.from({ length: 2000 }, (_, i) => `.menu-${i} .sub-menu{display:none}`).join("");
    expect(visibleText(`${DOC}<style>${sheet}</style><h1>Org</h1><p class="sub-menu">Business inquiries: ${H}</p><p>Business inquiries: ok@facility.example</p>`))
      .toBe("Org Business inquiries: ok@facility.example");
  });
  it("applies a style sheet inside inline SVG, as browsers do, but never one inside an inert template", () => {
    expect(visibleText(`${DOC}<svg><style>.c{display:none}</style></svg><h1>Org</h1><p class="c">Business inquiries: ${H}</p>`)).not.toContain(H);
    expect(visibleText(`${DOC}<template><style>.c{display:none}</style></template><h1>Org</h1><p class="c">Business inquiries: ok@facility.example</p>`))
      .toContain("ok@facility.example");
  });
  it("does not treat a rule that hides only generated content as hiding the element's own text", () => {
    expect(visibleText(`${DOC}<style>.c::before{display:none}.c:after{display:none}</style><h1>Org</h1><p class="c">Business inquiries: ok@facility.example</p>`))
      .toContain("ok@facility.example");
  });
  it("treats an address that exists only across element boundaries as ambiguous, even beside a literal one", async () => {
    const f = setup(), lead = `<p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: `;
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `${DOC}<h1>${f.candidate.organization}</h1>${lead}${f.prospect.contactEmail}</p>${lead}sales<span>@</span>facility.example</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_ambiguous_segment");
  });
  it("accepts valid HTML that omits optional end tags", () => {
    const table = `${DOC}<h1>Org</h1><table>${Array.from({ length: 70 }, (_, i) => `<tr><td>r${i}<td>v`).join("")}</table><p>Business inquiries: ok@facility.example</p>`;
    const list = `${DOC}<h1>Org</h1><dl>${Array.from({ length: 130 }, (_, i) => `<dt>t${i}<dd>d`).join("")}</dl><p>Business inquiries: ok@facility.example</p>`;
    expect(visibleText(table)).toContain("Business inquiries: ok@facility.example");
    expect(visibleText(list)).toContain("Business inquiries: ok@facility.example");
  });
  it("preserves page-origin controls as address barriers and keeps join offsets on code points", () => {
    const parsed = contactPageText(page("<p>Business \u{1F600}\u{1F600} inquiries: in<b>fo</b>@facility.example and in\u0001fo@facility.example and x&#1;y@facility.example</p>"));
    expect(parsed.segments.some(segment => segment.includes("\u0001"))).toBe(false);
    expect(parsed.segments[0]).toContain("info@facility.example and in\u2060fo@facility.example and x\u2060y@facility.example");
    expect(parsed.joins[0]).toHaveLength(2);
  });
  it.each(["sales@facility.co&#1;m", "sal\u0001es@facility.example"])("never creates a literal contact by deleting a page control: %s", async address => {
    const f = setup();
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `${DOC}<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: ${address}</p>`));
    await f.request(); await f.refresh();
    expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("contactProofs")).toHaveLength(0);
  });
  it("refuses nesting deeper than a browser's tree builder keeps, without quadratic parsing", () => {
    const started = performance.now();
    expect(() => contactPageText(page("<div>".repeat(Math.floor(CONTACT_RESEARCH_PAGE_LIMIT / 5))))).toThrow("contact_resolution_markup_limit");
    expect(performance.now() - started).toBeLessThan(3000);
  });
  it.each([
    ["unclosed formatting elements", "<b>"], ["distinct formatting elements", "<b id=x>"], ["formatting then blocks", "<b><i><u><s><p>x</p>"],
    ["misnested links", "<a><p>x</a>"], ["nested tables", "<table><tr><td>"], ["svg without >", "<svg"], ["unclosed svg", "<svg>"],
    ["comment starts", "<!--"], ["many attributes", "<p a=1 b=2 c=3 d=4>"], ["selects", "<select><option>"], ["entities", "&amp;&colon;&#x40;"],
    ["style without braces", "<style>aaaa"], ["style with many hiding rules", "<style>.a{display:none}"],
    ["attribute-only hiding rules", '<i q1 q2 q3>x</i>', `<style>${Array.from({ length: 9000 }, (_, i) => `[q${i}]{display:none}`).join("")}</style>`],
    ["hiding rules sharing a first class", '<i class="a">x</i>', `<style>${Array.from({ length: 9000 }, (_, i) => `.a.b${i}{display:none}`).join("")}</style>`],
    ["repeated descendant subjects", '<i class="sub">x</i>', `<style>${Array.from({ length: 9000 }, (_, i) => `.m${i} .sub{display:none}`).join("")}</style>`]])(
    "bounds parse time on adversarial %s pages", (_name, unit, head = "") => {
    const markup = head + unit.repeat(Math.floor((CONTACT_RESEARCH_PAGE_LIMIT - 64 - head.length) / unit.length));
    const started = performance.now();
    try { contactPageText(page(markup)); } catch (error) { expect((error as Error).message).toBe("contact_resolution_markup_limit"); }
    expect(performance.now() - started).toBeLessThan(3000);
  });
  // Second independent review (browser ground truth: headless Chromium, network blocked).
  it.each([
    ["document shadow host", `${DOC}<body><template shadowrootmode="open"><h1>Org</h1></template><p>Org. Business inquiries: ${H}</p></body>`],
    ["element shadow host", `${DOC}<h1>Org</h1><div><template shadowrootmode="closed"><p>Shadow</p></template><p>Business inquiries: ${H}</p></div>`],
    ["named slot only", `${DOC}<h1>Org</h1><section><template shadowrootmode="open"><slot name="x"></slot></template><p>Business inquiries: ${H}</p></section>`],
    ["legacy shadowroot attribute", `${DOC}<h1>Org</h1><div><template shadowroot="open"></template><p>Business inquiries: ${H}</p></div>`],
  ])("never reads the light DOM of a declarative shadow host: %s", (_name, body) => {
    expect(visibleText(body)).not.toContain(H);
  });
  it("creates no proof end to end from a declarative shadow host's light DOM", async () => {
    const f = setup();
    f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `${DOC}<body><template shadowrootmode="open"><h1>${f.candidate.organization}</h1></template>${f.business}</body>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0); expect(f.records("contactProofs")).toHaveLength(0);
  });
  it.each(["transform:rotate3d(1,0,0,90deg)", "rotate:x 90deg", "rotate:1 0 0 90deg", "transform:skewX(90deg)", "transform:scale(1%)", "scale:1%",
    "clip-path:polygon(0 0,1px 0,0 1px)", "mask-image:linear-gradient(transparent,transparent)", "-webkit-mask-image:linear-gradient(transparent,transparent)",
    "color:color-mix(in srgb, transparent 100%, red)", "content:url(/x.png)", "display:n\\6f ne"])("excludes text under a further hiding inline style: %s", style => {
    expect(visibleText(`${DOC}<h1>Org</h1><div style="${style}"><p>Business inquiries: ${H}</p></div>`)).not.toContain(H);
  });
  it.each(["position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)", "margin-top:-100px", "rotate:90deg", "transform:rotate(90deg)",
    "font-family:'Open Sans'", "content:normal"])("keeps text under an ordinary layout style: %s", style => {
    expect(hidingStyle(style)).toBe(false);
  });
  it.each([["nested rule", ".wrap { .c { display: none } }", true], ["keyed subject under any ancestor (over-excludes)", ".modal .c{display:none}", true, "c", "page"],
    ["escaped class", ".md\\:hidden{display:none}", true, "md:hidden"], ["escaped punctuation", ".\\!hidden{display:none}", true, "!hidden"],
    ["bare type behind a combinator (never every element of a type)", ".modal p{display:none}", false, "c", "page"],
    ["brace inside a string", '.a{content:"{"} .c{display:none}', true], ["block left open at the end of the sheet", ".c{display:none", true],
    ["keyframe selector", "@keyframes p { from { opacity: 0 } }", false], ["font face", "@font-face { font-family: x; src: url(x.woff) }", false],
    ["escaped font name", 'p { font-family: "\\5FAE\\8F6F" }', false]] as [string, string, boolean, string?, string?][])(
    "evaluates embedded rules at their subject: %s", (_name, rule, hidden, cls = "c", container = "") => {
    const text = visibleText(`${DOC}<style>${rule}</style><h1>Org</h1><div class="${container}"><p class="${cls}">Business inquiries: ${H}</p></div>`);
    if (hidden) expect(text).not.toContain(H); else expect(text).toContain(H);
  });
  it.each([
    ["formatting-element rebuilds", Array.from({ length: 300 }, (_, i) => `<b a=${i}>`).join(""), "<p> </p>"],
    ["formatting elements rebuilt in every block", Array.from({ length: 250 }, (_, i) => `<p><b a=${i}></p>`).join(""), "<p>x</p>"],
    ["long transform values", '<div style="transform:', "abcdefgh"],
    ["one tag with many attributes", "<p ", "a b c d "],
    ["class buckets inside the per-key cap", `<style>${Array.from({ length: 39 }, (_, k) => Array.from({ length: 256 }, (_, j) => `.c${k}.z${j}{display:none}`).join("")).join("")}</style>`,
      `<i class="${Array.from({ length: 39 }, (_, k) => `c${k}`).join(" ")}">x</i>`],
    ["many inline elements in one block", "<p>", "a@b.co<i>,</i>"],
    ["deep nesting with stray end tags", "<div>".repeat(250), "</h1>"],
  ])("bounds work on further adversarial pages: %s", (_name, head, unit) => {
    const markup = head + unit.repeat(Math.floor((CONTACT_RESEARCH_PAGE_LIMIT - 64 - head.length) / unit.length));
    const started = performance.now();
    try {
      const parsed = contactPageText(page(markup));
      parsed.segments.forEach((segment, index) => literalAddressUnsafe(segment, parsed.joins[index]));
    } catch (error) { expect((error as Error).message).toBe("contact_resolution_markup_limit"); }
    expect(performance.now() - started).toBeLessThan(3000);
  });
  it.each([["a non-ASCII letter", "m${UMLAUT}ller@facility.example", "ller@facility.example"],
    ["a soft hyphen", "business${SOFT}inquiries@facility.example", "inquiries@facility.example"],
    ["a zero-width space", "in${ZWSP}fo@facility.example", "fo@facility.example"]].map(([name, raw, cut]) => [name,
      raw.replace("${UMLAUT}", "\u00fc").replace("${SOFT}", "&shy;").replace("${ZWSP}", "&#8203;"), cut]))(
    "never cuts an address out of a longer visible word after %s", async (_name, address, cut) => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: ${address}</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(JSON.stringify(f.records("contactProofs"))).not.toContain(cut);
  });
  it("refuses an address displayed through a bidirectional override", async () => {
    // Directly before an address the override already blocks extraction (a format character at its edge).
    expect(literalAddressUnsafe("\u202eBusiness inquiries: ab@cd.efgh")).toBe(true);
    expect(literalAddressUnsafe("Business inquiries: ab@cd.efgh")).toBe(false);
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: &#x202E;${f.prospect.contactEmail}</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  // Third independent review: regressions in off-screen offsets, nesting expansion and address edges.
  it.each(["position:absolute;left:-999px", "position:absolute;left:-600px", "text-indent:-999px", "margin-left:-999px",
    "position:relative;top:-999px", "transform:translateX(-999px)", "position:absolute;left:-99%", "position:absolute;right:-999px",
    "inset:0 auto auto -999px", "margin:0 0 0 -999px", "unicode-bidi:bidi-override;direction:rtl"])("excludes text moved off screen or reordered: %s", style => {
    expect(visibleText(`${DOC}<h1>Org</h1><div style="${style}"><p>Business inquiries: ${H}</p></div>`)).not.toContain(H);
  });
  it.each(["margin-top:-100px", "position:absolute;left:-20px", "text-indent:-1em", "position:absolute;right:20px", "margin-right:-999px",
    "transform:translate(-50%,-50%)", "translate:-50% -50%", "position:relative;top:-120px"])("keeps text under an ordinary offset: %s", style => {
    expect(hidingStyle(style)).toBe(false);
  });
  it("refuses nesting that multiplies selector length instead of exhausting memory", () => {
    const started = performance.now();
    const css = `.a{${"&&&&&&&&&&{".repeat(8)}display:none${"}".repeat(9)}`;
    expect(() => contactPageText(page(`${DOC}<style>${css}</style><h1>Org</h1><p>Business inquiries: ok@facility.example</p>`))).toThrow("contact_resolution_markup_limit");
    expect(performance.now() - started).toBeLessThan(3000);
  });
  it("refuses a single nested selector before an invalid string allocation", () => {
    const css = `.${"a".repeat(3000)}{${"&".repeat(200000)}{display:none}}`;
    expect(() => contactPageText(page(`${DOC}<style>${css}</style><h1>Org</h1>`))).toThrow("contact_resolution_markup_limit");
  });
  it("refuses the projected nested selector count before constructing the product", () => {
    const selectors = Array.from({ length: 1024 }, (_, i) => `.c${i}`).join(",");
    const css = `${selectors}{${selectors}{display:none}}`;
    expect(() => contactPageText(page(`${DOC}<style>${css}</style><h1>Org</h1>`))).toThrow("contact_resolution_markup_limit");
  });
  it.each([["a soft hyphen", "info@facility.exa&shy;mple", "info@facility.exa\""], ["a zero-width space", "sales@facility.co&#8203;m", "sales@facility.co\""],
    ["a word joiner", "sales@facility.co&#8288;m", "sales@facility.co\""], ["a control character", "sales@facility.co&#8;m", "sales@facility.co\""]])(
    "never truncates an address at %s inside its domain", async (_name, address, cut) => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: ${address}</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(JSON.stringify(f.records("contactProofs"))).not.toContain(cut);
  });
  it("creates no proof from an address displayed through a CSS bidirectional override", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: <span style="unicode-bidi:bidi-override;direction:rtl">hg.fe@dc.ba</span></p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it.each([
    ["token attribute rules against a long value", `<style>${Array.from({ length: 250 }, (_, i) => `[data-x~="z${i}"]{display:none}`).join("")}</style>`,
      `<i data-x="${"q ".repeat(1000)}">x</i>`],
    ["tags with hundreds of distinct attributes", "", `<p ${Array.from({ length: 500 }, (_, i) => `a${i}`).join(" ")}>x</p>`],
  ])("bounds attribute work on adversarial pages: %s", (_name, head, unit) => {
    const markup = head + unit.repeat(Math.max(1, Math.floor((CONTACT_RESEARCH_PAGE_LIMIT - 64 - head.length) / unit.length)));
    const started = performance.now();
    try { contactPageText(page(markup)); } catch (error) { expect((error as Error).message).toBe("contact_resolution_markup_limit"); }
    expect(performance.now() - started).toBeLessThan(3000);
  });
  // Fourth independent review: blocks that CSS lays out inline can continue an address.
  it.each([
    ["inline blocks continuing the domain", (lead: string) => `<div style="display:inline">${lead}sales@facility.co</div><div style="display:inline">m</div>`, "sales@facility.co\""],
    ["a flex row continuing the domain", (lead: string) => `<div style="display:flex"><div>${lead}sales@facility.co</div><div>m</div></div>`, "sales@facility.co\""],
    ["an external layout continuing the domain", (lead: string) => `<link rel="stylesheet" href="/row.css"><div class="row"><p>${lead}sales@facility.co</p><p>m</p></div>`, "sales@facility.co\""],
  ])("never extracts an address that inline layout could continue: %s", async (_name, build, cut) => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1>${build(`${f.candidate.organization}, ${f.candidate.site}. Business inquiries: `)}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(JSON.stringify(f.records("contactProofs"))).not.toContain(cut);
  });
  it("refuses an address whose local part a preceding glued block could continue", () => {
    const parsed = contactPageText(page(`${DOC}<div>sa</div><div>les@facility.example (business inquiries)</div>`));
    const index = parsed.segments.findIndex(segment => segment.startsWith("les@"));
    expect(parsed.edges[index]).toEqual({ tail: "sa" });
    expect(literalAddressUnsafe(parsed.segments[index], parsed.joins[index], parsed.edges[index])).toBe(true);
  });
  it.each([["a new labelled block", "<p>Phone: 555-0100</p>"], ["a phone number block", "<p>555-0100</p>"], ["whitespace between blocks", "\n<p>more</p>"],
    ["a separate paragraph", "<p>Hours</p>"]])("keeps a minified address at a block edge followed by %s", async (_name, next) => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: ${f.prospect.contactEmail}</p>${next}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(1);
  });
  it.each([["a backspace control before the local part", "sa&#8;les@facility.example", "les@facility.example"],
    ["a next-line control before the local part", `sa${String.fromCharCode(0x85)}les@facility.example`, "les@facility.example"],
    ["a zero-width no-break space before the local part", "sa&#65279;les@facility.example", "les@facility.example"],
    ["a zero-width no-break space inside the domain", "sales@facility.co&#65279;m", "sales@facility.co\""]])(
    "never cuts an address at %s", async (_name, address, cut) => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${f.candidate.organization}</h1><p>${f.candidate.organization}, ${f.candidate.site}. Business inquiries: ${address}</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(JSON.stringify(f.records("contactProofs"))).not.toContain(cut);
  });
  it("evaluates a declaration block once, however many selectors share it", () => {
    const selectors = Array.from({ length: 1024 }, (_, i) => `.s${i}`).join(",");
    const declarations = `color:red;${"x".repeat(CONTACT_RESEARCH_PAGE_LIMIT - 20000)};display:none`;
    const started = performance.now();
    try { contactPageText(page(`<style>${selectors}{${declarations}}</style><h1>Org</h1><p class="s7">Business inquiries: ${H}</p>`)); }
    catch (error) { expect((error as Error).message).toBe("contact_resolution_markup_limit"); }
    expect(performance.now() - started).toBeLessThan(3000);
  });
  it("pins the HTML tree builder the v2 extractor and its stored digests were calibrated against", () => {
    // Upgrading parse5 can change visible text and therefore stored proof digests: bump EXTRACTOR first.
    expect(JSON.parse(readFileSync(new URL("../../node_modules/parse5/package.json", import.meta.url), "utf8")).version).toBe("7.3.0");
  });
});
