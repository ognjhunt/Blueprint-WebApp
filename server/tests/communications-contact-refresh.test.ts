// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { admitPublishedResearch, runCommunicationsIntake, runCommunicationsContactRefresh, RESEARCH_WORK_ITEMS } from "../agents/communications-intake";
import { sameOperatorUrl, contactUnknowns, publishedPublicContact, extractBusinessContact } from "../agents/communications-contact-evidence";
import { verifyContactResolution, contactPageText } from "../agents/communications-contact-resolution";
import { verifyPublishedResearch, researchPublicationSource } from "../agents/communications-research";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { processCommunicationsJob } from "../agents/communications-worker";
import { communicationsDigest } from "../agents/communications-contract";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";
import type { ContactPage } from "../agents/communications-contact-fetch";
import { requestNativeContactResearch, readNativeContactDiscovery } from "../agents/communications-contact-research";

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
    '<div hidden>Business inquiries: hidden@facility.example', '<div hidden></p>Business inquiries: hidden@facility.example</div>'])("refuses malformed or unfinished hidden nesting: %s", async markup => {
    // Tolerant parsing (owner decision 2026-10-04): stray or missing closing tags never
    // release hidden content; the page simply has no visible contact.
    const page = htmlPage("https://facility.example/contact", `<h1>Org</h1>${markup}`);
    expect(contactPageText(page).segments.join(" ")).not.toContain("hidden@facility.example");
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1>${markup}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_missing_or_ambiguous");
  });
  it.each(["popover", "inert", 'aria-hidden="tru&#101;"'])("excludes hidden/ineligible contact attributes %s", async attr => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><div ${attr}>${f.business}</div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it("refuses malformed/self-closing non-void and duplicate attributes, and does not read hrefs from quoted values", async () => {
    // A self-closing slash on an HTML element is ignored, as browsers do, so the hidden div still contains the text.
    const selfClosing = setup(); selfClosing.deps.readContactPage.mockImplementation(async url => htmlPage(url,
      `<h1>${selfClosing.candidate.organization}</h1><div hidden />Business inquiries: hidden@facility.example</div>`));
    await selfClosing.request(); await selfClosing.refresh(); expect(selfClosing.records("jobs")).toHaveLength(0);
    expect(selfClosing.records("refreshRequests")[0].reason).toBe("contact_resolution_missing_or_ambiguous");
    // Duplicate attributes remain refused (unchanged by the 2026-10-04 decision).
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><link rel=icon rel=stylesheet href=/site.css>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_markup_unsupported");
    const parsed = contactPageText(htmlPage("https://facility.example/", '<a title=" href=/contact " href="https://attacker.example/contact">Contact</a>'));
    expect(parsed.links).toEqual(["https://attacker.example/contact"]);
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
