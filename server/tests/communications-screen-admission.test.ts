// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { memoryFirestore } from "./fixtures/communications";
import { COMMUNICATIONS_ROOT, CommunicationsStore } from "../agents/communications-store";
import { communicationsDigest, outreachReadySendRefusal } from "../agents/communications-contract";
import { screenAdmission, screenPublicationSource, verifyScreenHypothesisForDraft } from "../agents/communications-screen-research";
import { admitScreenContact, verifyScreenContactResolution, screenHoldsTitle, screenRecipientProblem } from "../agents/communications-screen-contact";
import { admitScreenHypothesis, recordScreenHypotheses, runScreenAdmissionIntake, runScreenContactRefresh } from "../agents/communications-screen-intake";
import { HYPOTHESIS_DRAFTS_FLAG } from "../agents/communications-intake";
import { launchHypothesisDraft as hypothesisDraft } from "./fixtures/hypothesis";
import { processCommunicationsJob } from "../agents/communications-worker";
const golden = JSON.parse(readFileSync(new URL("./fixtures/screen-admission-snapshot.json", import.meta.url), "utf8"));
const now = Date.parse(golden.snapshot.work_item.completed_at);
function setup(index = 0) {
  const snapshot = structuredClone(golden.snapshot), admission = screenAdmission(snapshot), siteKey = [...admission.sites.keys()][index];
  const db = memoryFirestore();
  const readContactPage = vi.fn(async (url: string) => {
    const recipient = admission.sites.get(siteKey)!.result.recipient;
    const bodyBase64 = Buffer.from(`<html><body><p>${admission.sites.get(siteKey)!.result.candidate.organization}. Business inquiries: ${recipient.person?.name ?? "Operations team"}: ${recipient.address}</p></body></html>`).toString("base64");
    return { requestedUrl: url, finalUrl: url, redirects: [], checkedAt: new Date(now).toISOString(), status: 200 as const,
      contentType: "text/html", bodyBase64 };
  });
  const deps = { db, readResearch: vi.fn(async () => { throw new Error("daily_reader_must_not_read_screen"); }),
    readScreenAdmission: vi.fn(async () => snapshot), readContactPage, isSuppressed: vi.fn(async () => false), now: () => now };
  const records = (name: string) => [...db.records.entries()].filter(([key]) => key.startsWith(`${COMMUNICATIONS_ROOT}/${name}/`)).map(([, value]) => value);
  return { snapshot, admission, siteKey, db, deps, records };
}
afterEach(() => vi.unstubAllEnvs());
describe("site-screen admission (synthetic, offline)", () => {
  it("keeps provider/public title evidence with reordered words and fillers", () => {
    expect(screenHoldsTitle("Jordan Fixture is the Director of Operations", "Operations Director")).toBe(true);
    expect(screenHoldsTitle("Jordan Fixture handles operations", "Operations Director")).toBe(false);
  });
  it("reads all six producer routes and the no-contact site from the exact Pipeline golden", () => {
    const f = setup();
    expect([...f.admission.sites.values()].map(site => site.result.recipient?.route ?? null)).toEqual([
      "published_person_email", "published_team_inbox", "published_general_inbox", null,
      "quoted_person_looked_up_email", "provider_sourced_corroborated", "provider_sourced_uncorroborated"]);
    const changed = structuredClone(f.snapshot); changed.state.plan.sheet_rows[0][6] = "Verified";
    expect(() => screenAdmission(changed)).toThrow("screen_admission_plan_invalid");
  });
  it("records once with flag off and does no contact, draft, provider or daily reader work", async () => {
    const f = setup();
    await recordScreenHypotheses(f.snapshot, f.deps); await recordScreenHypotheses(f.snapshot, f.deps);
    expect(f.records("intake")).toHaveLength(7);
    expect(await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps)).toMatchObject({ state: "not_admitted", sendsAuthorized: false });
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("refreshRequests")).toHaveLength(0);
    expect(f.deps.readContactPage).not.toHaveBeenCalled(); expect(f.deps.readResearch).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2, 4, 5, 6])("admits route %i once, verifies its immutable source, and grants no send", async index => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); const f = setup(index);
    await recordScreenHypotheses(f.snapshot, f.deps);
    expect(await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps)).toMatchObject({ state: "needs_research" });
    await runScreenContactRefresh(f.deps);
    const brief = f.records("briefs")[0], handoff = f.records("handoffs")[0], proof = f.records("contactProofs")[0];
    expect(brief).toBeDefined(); expect(f.records("jobs")).toHaveLength(1);
    expect(verifyScreenHypothesisForDraft(f.snapshot, brief, handoff, proof, now).briefDigest).toBe(communicationsDigest(brief));
    expect(outreachReadySendRefusal(brief)).toBe("outreach_ready_hypothesis_draft_only");
    expect(brief.contact.recipient.kind).toBe([1, 2].includes(index) ? "inbox" : "named_person");
    const recipient = f.admission.sites.get(f.siteKey)!.result.recipient;
    expect(f.deps.readContactPage).toHaveBeenCalledTimes(new Set([recipient.operator_domain.url, ...(recipient.published ? [recipient.published.url] : [])]).size);
    await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps); await runScreenContactRefresh(f.deps);
    expect(f.records("jobs")).toHaveLength(1); expect(f.records("briefs")).toHaveLength(1);
    expect(f.deps.readResearch).not.toHaveBeenCalled();
  });
  it.each([1, 6])("drafts a screen hypothesis on route %i through the screen reader only", async index => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); const f = setup(index);
    await recordScreenHypotheses(f.snapshot, f.deps); await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps); await runScreenContactRefresh(f.deps);
    const brief = f.records("briefs")[0], job = f.records("jobs")[0];
    const output = hypothesisDraft(brief);
    (output.outreachContract as any).version = "blueprint.outreach.v5";
    const api = { run: vi.fn(async () => ({ output, checkpoint: job.checkpoint, usage: {} })), cancel: vi.fn(), reconcileSaved: vi.fn() };
    const verifyMailbox = vi.fn(), sendAutomatic = vi.fn();
    const result: any = await processCommunicationsJob(job.jobId, { ...f.deps, store: new CommunicationsStore(f.db, f.deps.now), api,
      verifyMailbox, readThread: vi.fn(), suppress: vi.fn(), sendAutomatic });
    expect(result).toMatchObject({ state: "pending_approval", gmailDraftCreated: false, sent: false });
    expect(api.run).toHaveBeenCalledOnce(); expect(verifyMailbox).not.toHaveBeenCalled(); expect(sendAutomatic).not.toHaveBeenCalled();
    expect(f.deps.readResearch).not.toHaveBeenCalled();
    expect(f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ qualification_tier: "outreach_ready", send_authority: "none", approved_by: null });
  });
  it("independently verifies a website operator proof and rejects changed retained bytes", async () => {
    const f = setup(6), source = screenPublicationSource(f.snapshot, f.siteKey, now).source;
    source.recipient.operator_domain.basis = "website"; source.answers.website = `https://${source.recipient.operator_domain.domain}`;
    f.deps.readContactPage.mockImplementationOnce(async (url: string) => ({ requestedUrl: url, finalUrl: url, redirects: [], checkedAt: new Date(now).toISOString(),
      status: 200 as const, contentType: "text/html", bodyBase64: Buffer.from("<p>Another operator</p>").toString("base64") }));
    await expect(admitScreenContact(source, "synthetic-prospect", f.deps.readContactPage, f.deps.now)).rejects.toThrow("screen_contact_operator_domain_unproven");
    const proof = await admitScreenContact(source, "synthetic-prospect", f.deps.readContactPage, f.deps.now);
    expect(verifyScreenContactResolution(proof, source, "synthetic-prospect").route).toBe("provider_sourced_uncorroborated");
    proof.pages[0].bodyBase64 = Buffer.from("<p>Changed</p>").toString("base64");
    expect(() => verifyScreenContactResolution(proof, source, "synthetic-prospect")).toThrow("contact_resolution_retrieval_changed");
  });
  it("honors explicit no-contact text on a looked-up recipient's independently checked operator page", async () => {
    const f = setup(6), source = screenPublicationSource(f.snapshot, f.siteKey, now).source;
    f.deps.readContactPage.mockImplementation(async (url: string) => ({ requestedUrl: url, finalUrl: url, redirects: [], checkedAt: new Date(now).toISOString(),
      status: 200 as const, contentType: "text/html", bodyBase64: Buffer.from(`<p>${source.candidate.organization}. No unsolicited contact.</p>`).toString("base64") }));
    await expect(admitScreenContact(source, "synthetic-prospect", f.deps.readContactPage, f.deps.now)).rejects.toThrow("contact_resolution_recipient_restricted");
    expect(f.records("jobs")).toHaveLength(0);
  });
  it("rejects impossible source dates and role inboxes mislabeled as a published person", () => {
    const quoted = setup(4), source = screenPublicationSource(quoted.snapshot, quoted.siteKey, now).source;
    source.recipient.person.date = "2025-13";
    expect(screenRecipientProblem({ recipient: source.recipient, proofs: source.hypothesis.provingSources, answers: source.answers })).toBe("screen_contact_recipient_invalid");
    const f = setup(), published = screenPublicationSource(f.snapshot, f.siteKey, now).source;
    published.recipient.address = `plant.team@${published.recipient.operator_domain.domain}`;
    published.recipient.published.quote = `Business inquiries: ${published.recipient.address}`;
    expect(screenRecipientProblem({ recipient: published.recipient, proofs: published.hypothesis.provingSources, answers: published.answers })).toBe("screen_contact_recipient_invalid");
  });
  it("uses an inbox greeting when the fresh email segment does not name the published person", async () => {
    const f = setup(), source = screenPublicationSource(f.snapshot, f.siteKey, now).source;
    f.deps.readContactPage.mockImplementation(async (url: string) => ({ requestedUrl: url, finalUrl: url, redirects: [], checkedAt: new Date(now).toISOString(),
      status: 200 as const, contentType: "text/html", bodyBase64: Buffer.from(`<p>${source.candidate.organization}</p><p>Business inquiries: ${source.recipient.address}</p>`).toString("base64") }));
    const proof = await admitScreenContact(source, "synthetic-prospect", f.deps.readContactPage, f.deps.now);
    expect(verifyScreenContactResolution(proof, source, "synthetic-prospect").recipient.kind).toBe("inbox");
  });
  it("rechecks the current CRM under the contact claim and avoids a duplicate", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); const f = setup(4);
    await recordScreenHypotheses(f.snapshot, f.deps); await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps);
    await f.db.doc("outboundProspects/current-owner").set({ researchPublicationId: f.admission.sites.get(f.siteKey)!.sheetsProspectId });
    await runScreenContactRefresh(f.deps);
    expect(f.records("jobs")).toHaveLength(0); expect(f.records("refreshRequests")[0].state).toBe("terminal");
    expect(f.deps.readContactPage).not.toHaveBeenCalled();
  });
  it("notifies the research owner when deterministic contact verification fails", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); const f = setup();
    f.deps.readContactPage.mockRejectedValue(new Error("screen_contact_address_not_on_fresh_page"));
    await recordScreenHypotheses(f.snapshot, f.deps); await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps);
    await runScreenContactRefresh(f.deps);
    expect(f.records("refreshRequests").some(x => x.owner === "blueprint-research-agent" && x.kind === "research_owner_refresh")).toBe(true);
    expect(f.records("jobs")).toHaveLength(0);
  });
  it("restores contact attempts when a failed fetch observes the flag off", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); const f = setup();
    await recordScreenHypotheses(f.snapshot, f.deps); await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps);
    f.deps.readContactPage.mockImplementation(async () => {
      vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
      throw new Error("screen_contact_address_not_on_fresh_page");
    });
    await runScreenContactRefresh(f.deps);
    expect(f.records("refreshRequests")).toHaveLength(1);
    expect(f.records("refreshRequests")[0]).toMatchObject({ state: "pending", attempts: 0 });
    expect(f.records("refreshRequests")[0].lease.until).toBe(0);
    expect(f.records("jobs")).toHaveLength(0);
    expect(f.records("refreshRequests").some(x => x.kind === "research_owner_refresh")).toBe(false);
  });
  it("does not spend on a queued screen draft after the flag is turned off", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); const f = setup(4);
    await recordScreenHypotheses(f.snapshot, f.deps); await admitScreenHypothesis(f.snapshot, f.siteKey, f.deps); await runScreenContactRefresh(f.deps);
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
    const api = { run: vi.fn(), cancel: vi.fn(), reconcileSaved: vi.fn() };
    const result = await processCommunicationsJob(f.records("jobs")[0].jobId, { ...f.deps, store: new CommunicationsStore(f.db, f.deps.now), api,
      verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn() });
    expect(result).toMatchObject({ state: "queued" }); expect(api.run).not.toHaveBeenCalled();
  });
});
