// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { admitPublishedResearch, runCommunicationsIntake, runCommunicationsContactRefresh, RESEARCH_WORK_ITEMS } from "../agents/communications-intake";
import { sameOperatorUrl, contactUnknowns, publishedPublicContact } from "../agents/communications-contact-evidence";
import { verifyContactResolution, contactPageText } from "../agents/communications-contact-resolution";
import { verifyPublishedResearch, researchPublicationSource } from "../agents/communications-research";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { processCommunicationsJob } from "../agents/communications-worker";
import { communicationsDigest } from "../agents/communications-contract";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";
import type { ContactPage } from "../agents/communications-contact-fetch";

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
  it.each(["<style>.secret {display:none}</style>", '<link rel="stylesheet" href="/site.css">',
    '<link rel=stylesheet href="/site.css">', '<link rel="style&#115;heet" href="/site.css">',
    '<link rel=style&#115;heet href="/site.css">', '<link rel="style&#115heet" href="/site.css">',
    '<link href="/site>css" rel="stylesheet">', '<link rel="&Tab;stylesheet" href="/site.css">',
    '<link title=" rel=icon " rel=stylesheet href=/site.css>'])("refuses stylesheet-dependent contact visibility: %s", async stylesheet => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, stylesheet + `<h1>${f.candidate.organization}</h1><p class="secret">Business inquiries: hidden@facility.example</p>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "terminal", reason: "contact_resolution_visibility_unverified" });
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
  it.each(["dialog", "details", "canvas", "object", "iframe", "select", "form", "title", "datalist", "audio", "video", "font", "code", "pre"])("refuses contact inference from unsupported %s containers", async tag => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><${tag}><p>Business inquiries: hidden@facility.example</p></${tag}>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it.each(['<script>document.querySelector(".secret").hidden=true;</script>', '<body onload="hideContact()">',
    '<meta http-equiv="refresh" content="0;url=/other">'])("refuses script/event/navigation-dependent positive evidence: %s", async active => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, active + f.business + (active.startsWith("<body") ? "</body>" : "")));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_visibility_unverified");
  });
  it("rejects unresolved legacy presentation without implementing browser rendering", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<body text="white"><h1>${f.candidate.organization}</h1>${f.business}</body>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_visibility_unverified");
  });
  it("does not approve outside text on a page with an active embedded document", async () => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<iframe src="/active.html"></iframe>${f.business}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_visibility_unverified");
  });
  it.each(['<div hidden></body>Business inquiries: hidden@facility.example</div>',
    '<div hidden>Business inquiries: hidden@facility.example', '<div hidden></p>Business inquiries: hidden@facility.example</div>'])("refuses malformed or unfinished hidden nesting: %s", async markup => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1>${markup}`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_markup_unsupported");
  });
  it.each(["popover", "inert", 'aria-hidden="tru&#101;"'])("excludes hidden/ineligible contact attributes %s", async attr => {
    const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1><div ${attr}>${f.business}</div>`));
    await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
  });
  it("refuses malformed/self-closing non-void and duplicate attributes, and does not read hrefs from quoted values", async () => {
    for (const body of ['<div hidden />Business inquiries: hidden@facility.example</div>', '<link rel=icon rel=stylesheet href=/site.css>']) {
      const f = setup(); f.deps.readContactPage.mockImplementation(async url => htmlPage(url, `<h1>${f.candidate.organization}</h1>${body}`));
      await f.request(); await f.refresh(); expect(f.records("jobs")).toHaveLength(0);
      expect(f.records("refreshRequests")[0].reason).toBe("contact_resolution_markup_unsupported");
    }
    const parsed = contactPageText(htmlPage("https://facility.example/", '<a title=" href=/contact " href="https://attacker.example/contact">Contact</a>'));
    expect(parsed.links).toEqual(["https://attacker.example/contact"]);
  });
});
