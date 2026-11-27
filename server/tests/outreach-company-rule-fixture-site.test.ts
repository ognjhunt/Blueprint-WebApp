// @vitest-environment node
/**
 * Outreach gap 1 (2026-11-27): every branch of the automatic rule (`server/utils/companyCheck.ts`) driven through its
 * PRODUCTION dependencies, not the injected stubs of `company-check.test.ts`:
 *  - the home page is read by the real `defaultDeps.fetchPage` -> `fetchPinnedPublicText` (redirects followed by hand,
 *    content type, size, final URL). Only the network edge is local: DNS answers one public address for the fixture
 *    hosts, and the https request is carried to a local fixture web server that routes by Host. Nothing leaves the machine.
 *  - the model: the real `defaultDeps.askModel`, including the real provider configuration (`getStructuredProviderOrder`).
 *    Only `runAgentTask` is stubbed, so no provider is ever called.
 * The store is the repo's fake Firestore. The bell is spied (its no-webhook behaviour is `outreach-company-owner-notice.test.ts`).
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const fixture = vi.hoisted(() => ({ port: 0, requests: [] as string[] }));

vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>();
  const lookup = async (hostname: string) => {
    if (/^(?:www\.)?[a-z0-9-]+\.(?:com|io|net)$/.test(hostname) && hostname.includes("outreach-fixture"))
      return [{ address: "93.184.216.34", family: 4 }];
    throw Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
  };
  return { ...actual, lookup, default: { ...actual, lookup } };
});
vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:https")>();
  const httpModule = await import("node:http");
  // The pinned request, carried to the local fixture server. The guard's own pinned lookup is dropped with it.
  const request = (url: URL, options: Record<string, any>, callback: (response: import("node:http").IncomingMessage) => void) => {
    fixture.requests.push(url.href);
    return httpModule.request({ host: "127.0.0.1", port: fixture.port, method: options.method, path: `${url.pathname}${url.search}`,
      headers: { ...options.headers, host: url.host }, agent: false }, callback);
  };
  return { ...actual, request, default: { ...actual, request } };
});
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  authAdmin: null, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } } }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const slack = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", () => ({ notifySlackRobotTeamAccessApplication: slack, notifySlackCompanyRecheck: vi.fn() }));
// The one stub: the model run. Nothing reaches a provider.
const model = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../agents/runtime", () => ({ runAgentTask: model.run }));
// The admin role, for the trial route below: an `x-test-role: admin` header stands for a signed-in admin.
vi.mock("../middleware/requireAdminRole", () => ({ requireAdminRole: (req: any, res: any, next: () => void) =>
  req.headers["x-test-role"] === "admin" ? next() : res.status(403).json({ error: "Admin access required" }) }));

const check = await import("../utils/companyCheck");
const early = await import("../utils/robotTeamEarlyAccess");

const ROBOT_SENTENCE = "We design, install and support robotic palletizing cells for food and beverage plants.";
const page = (body: string) => `<!doctype html><html><head><title>Fixture</title></head><body>${body}</body></html>`;
/** host -> path -> response */
const SITES: Record<string, Record<string, { status: number; type?: string; location?: string; body?: string }>> = {
  "outreach-fixture-arm.com": { "/": { status: 200, body: page(`<h1>Arm Fixture</h1><p>${ROBOT_SENTENCE}</p>`) } },
  "outreach-fixture-parent.com": { "/": { status: 200, body: page(`<h1>Parent</h1><p>${ROBOT_SENTENCE}</p>`) },
    "/brands/arm": { status: 200, body: page(`<h1>Our brands</h1><p>${ROBOT_SENTENCE}</p>`) } },
  // A brand that sends visitors to its parent's site.
  "outreach-fixture-brand.com": { "/": { status: 301, location: "https://outreach-fixture-parent.com/brands/arm" } },
  // An apex that sends visitors to its own www.
  "outreach-fixture-apex.com": { "/": { status: 301, location: "https://www.outreach-fixture-apex.com/" } },
  "www.outreach-fixture-apex.com": { "/": { status: 200, body: page(`<p>${ROBOT_SENTENCE}</p>`) } },
  // A page built by scripts: the HTML has almost no text.
  "outreach-fixture-spa.com": { "/": { status: 200, body: `<!doctype html><html><head><title>Robots</title><script src="/app.js"></script>`
    + `<script>window.__DATA__={"about":"We deploy robots in warehouses across the country"}</script></head><body><div id="root"></div>`
    + `<noscript>You need to enable JavaScript to run this app.</noscript></body></html>` } },
  "outreach-fixture-bakery.com": { "/": { status: 200, body: page("<h1>Bakery Fixture</h1><p>Fresh bread and pastries baked every morning since 1950.</p>") } },
  "outreach-fixture-json.com": { "/": { status: 200, type: "application/json", body: "{\"robots\":true}" } },
  "outreach-fixture-down.com": { "/": { status: 503, body: "" } },
  // https -> http: the guard refuses to follow it.
  "outreach-fixture-plain.com": { "/": { status: 301, location: "http://outreach-fixture-plain.com/" } },
};

let server: http.Server;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const site = SITES[String(req.headers.host)]?.[String(req.url).split("?")[0]];
    if (!site) { res.writeHead(404, { "content-type": "text/html" }); return res.end("not found"); }
    res.writeHead(site.status, { "content-type": site.type ?? "text/html; charset=utf-8", ...(site.location ? { location: site.location } : {}) });
    res.end(site.body ?? "");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  fixture.port = (server.address() as AddressInfo).port;
});
afterAll(async () => { vi.useRealTimers(); await new Promise(resolve => server.close(resolve)); });

const savedKey = process.env.OPENAI_API_KEY, savedBase = process.env.OPENAI_BASE_URL;
const withModelKey = () => { process.env.OPENAI_API_KEY = "sk-test-local-not-a-key"; delete process.env.OPENAI_BASE_URL; };
const withoutModelKey = () => { delete process.env.OPENAI_API_KEY; };
afterAll(() => {
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey;
  if (savedBase !== undefined) process.env.OPENAI_BASE_URL = savedBase;
});

const modelSays = (answer: { deploys_robots: "yes" | "no" | "unclear"; evidence_quote: string; reason: string }) =>
  model.run.mockImplementation(async () => ({ status: "completed", output: answer }));
const YES = { deploys_robots: "yes" as const, evidence_quote: "We design, install and support robotic palletizing cells", reason: "Installs robot cells." };

let now = new Date("2026-11-27T02:00:00.000Z");

async function apply(email: string, website: string, partnerRole: "deployment" | "technology" = "deployment") {
  const { record } = await early.recordAccessApplication({ name: "Fixture Applicant", email, company: "Fixture Co", website, partnerRole });
  return early.accessRecordId(record.email);
}

const stored = (id: string) => state.docs.get(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${id}`) as Record<string, any>;
const approvalEmails = (id: string) => [...state.docs.keys()].filter(key => key.startsWith(`captureOutbox/robot_team_access_approved:${id}`));

beforeEach(() => {
  state.docs.clear(); slack.mockClear(); model.run.mockReset(); fixture.requests.length = 0;
  now = new Date("2026-11-27T02:00:00.000Z");
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ["Date"], now });
  vi.setSystemTime(now);
  withModelKey();
});

/** The production path end to end: the application, then the check exactly as the apply route starts it. */
async function applyAndCheck(email: string, website: string, partnerRole: "deployment" | "technology" = "deployment") {
  const id = await apply(email, website, partnerRole);
  const record = stored(id);
  await check.checkNewCompanyApplication({ email: record.email, companyCheck: record.companyCheck ?? null });
  return { id, record: stored(id), bell: slack.mock.calls.at(-1)?.[0] as any };
}

describe("the rule on its production fetch and model (fixture website, stubbed model run)", () => {
  it("approves when the email domain equals the website's and the model's quote is on the page; the approval email is queued", async () => {
    modelSays(YES);
    const { id, record, bell } = await applyAndCheck("ops@outreach-fixture-arm.com", "https://outreach-fixture-arm.com");
    expect(record.status).toBe("approved");
    expect(record.companyCheck).toMatchObject({ outcome: "approved", reasons: [], evidenceQuote: YES.evidence_quote });
    expect(approvalEmails(id)).toHaveLength(1);
    expect(bell).toMatchObject({ autoApproved: true, check: { outcome: "approved" } });
    expect(fixture.requests).toEqual(["https://outreach-fixture-arm.com/"]);
    // The model saw the page's host and text only.
    expect(model.run.mock.calls[0][0]).toMatchObject({ kind: "company_website_check",
      input: { websiteHost: "outreach-fixture-arm.com", pageText: expect.stringContaining(ROBOT_SENTENCE) } });
    expect(JSON.stringify(model.run.mock.calls[0][0])).not.toMatch(/ops@|Fixture Applicant/);
  });

  it("approves an apex that redirects to its own www (same organization after the redirect)", async () => {
    modelSays(YES);
    const { record } = await applyAndCheck("ops@outreach-fixture-apex.com", "https://outreach-fixture-apex.com");
    expect(record.status).toBe("approved");
    expect(fixture.requests).toEqual(["https://outreach-fixture-apex.com/", "https://www.outreach-fixture-apex.com/"]);
  });

  it("sends a brand-domain email with its parent's website to the owner (domain_mismatch), without reading the site", async () => {
    modelSays(YES);
    const { record, bell } = await applyAndCheck("ops@outreach-fixture-brand.com", "https://outreach-fixture-parent.com");
    expect(record.status).toBe("applied");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["domain_mismatch"] });
    expect(fixture.requests).toEqual([]);
    expect(model.run).not.toHaveBeenCalled();
    expect(bell).toMatchObject({ autoApproved: false, check: { outcome: "needs_owner", reasons: ["domain_mismatch"] } });
  });

  it("sends a brand site that redirects to its parent's domain to the owner (redirected_off_domain), before the model", async () => {
    modelSays(YES);
    const { record } = await applyAndCheck("ops@outreach-fixture-brand.com", "https://outreach-fixture-brand.com");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["redirected_off_domain"] });
    expect(fixture.requests).toEqual(["https://outreach-fixture-brand.com/", "https://outreach-fixture-parent.com/brands/arm"]);
    expect(model.run).not.toHaveBeenCalled();
  });

  it("sends a free-mail address to the owner (webmail) without reading the site", async () => {
    const { record } = await applyAndCheck("someone@gmail.com", "https://outreach-fixture-arm.com");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["webmail"] });
    expect(fixture.requests).toEqual([]);
  });

  it("sends a page built by scripts, under 40 characters of visible text, to the owner (website_no_text), before the model", async () => {
    modelSays(YES);
    const { record } = await applyAndCheck("ops@outreach-fixture-spa.com", "https://outreach-fixture-spa.com");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["website_no_text"] });
    expect(model.run).not.toHaveBeenCalled();
    expect(check.pageText(SITES["outreach-fixture-spa.com"]["/"].body!).length).toBeLessThan(40);
  });

  it.each([
    ["a 503", "outreach-fixture-down.com"],
    ["JSON instead of a page", "outreach-fixture-json.com"],
    ["a redirect from https to http", "outreach-fixture-plain.com"],
    ["a host that does not resolve", "outreach-fixture-nxdomain.org"],
  ])("sends %s to the owner as website_unreadable (momentary: tried again the next day)", async (_what, host) => {
    modelSays(YES);
    const { record } = await applyAndCheck(`ops@${host}`, `https://${host}`);
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["website_unreadable"] });
    expect(check.applicationCheckDue(record.companyCheck, now.getTime() + check.COMPANY_RECHECK_RETRY_MS)).toBe(true);
  });

  it("sends a yes whose quote is NOT on the page to the owner (quote_not_found)", async () => {
    modelSays({ ...YES, evidence_quote: "We are the leading robot deployment company in the world" });
    const { record } = await applyAndCheck("ops@outreach-fixture-arm.com", "https://outreach-fixture-arm.com");
    expect(record.status).toBe("applied");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["quote_not_found"], modelAnswer: "yes" });
    // Not momentary: never checked again by the sweep.
    expect(check.applicationCheckDue(record.companyCheck, now.getTime() + 30 * check.COMPANY_RECHECK_RETRY_MS)).toBe(false);
  });

  it("sends a no to the owner (not_a_robot_company), with the model's reason", async () => {
    modelSays({ deploys_robots: "no", evidence_quote: "", reason: "A bakery." });
    const { record, bell } = await applyAndCheck("ops@outreach-fixture-bakery.com", "https://outreach-fixture-bakery.com");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["not_a_robot_company"], modelReason: "A bakery." });
    expect(bell).toMatchObject({ check: { reasons: ["not_a_robot_company"] } });
  });

  it("with no model key: stores no_model, the applicant waits for the owner, the bell says needs you, the day's check is still counted", async () => {
    withoutModelKey();
    const { id, record, bell } = await applyAndCheck("ops@outreach-fixture-arm.com", "https://outreach-fixture-arm.com");
    expect(model.run).not.toHaveBeenCalled();
    expect(record.status).toBe("applied");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["no_model"] });
    expect(bell).toMatchObject({ autoApproved: false, check: { outcome: "needs_owner", reasons: ["no_model"] } });
    expect(approvalEmails(id)).toHaveLength(0);
    // Counted against the day's cap although no model was asked (the counter is taken before the model call).
    expect(state.docs.get(`${check.COMPANY_CHECK_COUNTER_COLLECTION}/day-2026-11-27`)).toMatchObject({ count: 1 });
  });

  it("when the model run fails: stores model_unavailable; the sweep tries again only after a day; the retry rings only if it settles", async () => {
    model.run.mockImplementation(async () => ({ status: "failed", output: null }));
    const { id, record } = await applyAndCheck("ops@outreach-fixture-arm.com", "https://outreach-fixture-arm.com");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["model_unavailable"] });
    expect(slack).toHaveBeenCalledTimes(1);
    // Ten minutes later the sweep does not re-check it (it has a check that is less than a day old).
    expect(await check.sweepUncheckedCompanyApplications(now.getTime() + 11 * 60_000))
      .toBe(0);
    // A day later, the model still failing: checked again, nothing rung.
    now = new Date(now.getTime() + check.COMPANY_RECHECK_RETRY_MS + 1000);
    vi.setSystemTime(now);
    await check.checkNewCompanyApplication({ email: stored(id).email, companyCheck: stored(id).companyCheck });
    expect(model.run).toHaveBeenCalledTimes(2);
    expect(slack).toHaveBeenCalledTimes(1);
    // Next day the model answers yes: approved, and the bell rings once more.
    now = new Date(now.getTime() + check.COMPANY_RECHECK_RETRY_MS + 1000);
    vi.setSystemTime(now);
    modelSays(YES);
    await check.checkNewCompanyApplication({ email: stored(id).email, companyCheck: stored(id).companyCheck });
    expect(stored(id).status).toBe("approved");
    expect(slack).toHaveBeenCalledTimes(2);
    expect(slack.mock.calls[1][0]).toMatchObject({ autoApproved: true });
  });

  it("stops at the per-domain cap (5 a day) before reading the site, and at the daily cap (100) before the model", async () => {
    modelSays({ deploys_robots: "no", evidence_quote: "", reason: "test" });
    for (let index = 0; index < check.COMPANY_CHECK_DOMAIN_DAILY_CAP; index += 1)
      await applyAndCheck(`ops${index}@outreach-fixture-bakery.com`, "https://outreach-fixture-bakery.com");
    fixture.requests.length = 0;
    const over = await applyAndCheck("ops9@outreach-fixture-bakery.com", "https://outreach-fixture-bakery.com");
    expect(over.record.companyCheck).toMatchObject({ reasons: ["domain_daily_check_cap"] });
    expect(fixture.requests).toEqual([]);
    state.docs.set(`${check.COMPANY_CHECK_COUNTER_COLLECTION}/day-2026-11-27`, { count: check.COMPANY_CHECK_DAILY_CAP });
    const capped = await applyAndCheck("ops@outreach-fixture-arm.com", "https://outreach-fixture-arm.com");
    expect(capped.record.companyCheck).toMatchObject({ reasons: ["daily_check_cap"] });
    expect(model.run).toHaveBeenCalledTimes(check.COMPANY_CHECK_DOMAIN_DAILY_CAP);
  });

  it("never checks a technology partner: it waits for the owner with no check stored", async () => {
    modelSays(YES);
    const id = await apply("ops@outreach-fixture-arm.com", "https://outreach-fixture-arm.com", "technology");
    expect(await check.checkCompanyApplication(id)).toBeNull();
    expect(stored(id).status).toBe("applied");
    expect(stored(id).companyCheck ?? null).toBeNull();
    expect(fixture.requests).toEqual([]);
  });
});

/* The owner's trial run (outreach gap 1, 2026-11-27): the rule once on a domain and a website the owner types. */
describe("the owner's trial run of the rule", () => {
  const applicantDay = () => state.docs.get(`${check.COMPANY_CHECK_COUNTER_COLLECTION}/day-2026-11-27`);
  const recordsAndEmails = () => [...state.docs.keys()].filter(key => key.startsWith("robotTeamAccess/") || key.startsWith("captureOutbox/"));

  it("runs every step on the production fetch and model, shows each result, and records no application, approval or email", async () => {
    modelSays(YES);
    const result = await check.tryCompanyRule({ emailDomain: "outreach-fixture-arm.com", website: "https://outreach-fixture-arm.com" });
    expect(result.check).toMatchObject({ outcome: "approved", reasons: [], evidenceQuote: YES.evidence_quote });
    expect(result.steps.map(step => [step.step, step.ok])).toEqual([["domain", true], ["website", true], ["still_on_domain", true],
      ["page_text", true], ["day_share", true], ["model", true], ["quote", true]]);
    expect(result.steps.find(step => step.step === "website")?.detail).toBe("HTTP 200 at outreach-fixture-arm.com");
    // One model call, of the kind the readiness reading counts in agentRuns.
    expect(model.run).toHaveBeenCalledTimes(1);
    expect((model.run.mock.calls[0] as any)[0]).toMatchObject({ kind: "company_website_check",
      input: { websiteHost: "outreach-fixture-arm.com" } });
    expect(recordsAndEmails()).toEqual([]);
    // The applicants' day cap and the domain's share are untouched.
    expect(applicantDay()).toBeUndefined();
    expect([...state.docs.keys()].filter(key => key.includes("company_check_domain"))).toEqual([]);
  });

  it("stops where an application would stop, with the reason (a free-mail domain, a model's no)", async () => {
    const webmail = await check.tryCompanyRule({ emailDomain: "someone@gmail.com", website: "https://outreach-fixture-arm.com" });
    expect(webmail.check.reasons).toEqual(["webmail"]);
    expect(webmail.steps).toEqual([{ step: "domain", ok: false, detail: "webmail" }]);
    expect(fixture.requests).toEqual([]);
    modelSays({ deploys_robots: "no", evidence_quote: "", reason: "A bakery." });
    const bakery = await check.tryCompanyRule({ emailDomain: "outreach-fixture-bakery.com", website: "outreach-fixture-bakery.com" });
    expect(bakery.check).toMatchObject({ outcome: "needs_owner", reasons: ["not_a_robot_company"] });
    expect(bakery.steps.at(-1)).toEqual({ step: "model", ok: false, detail: "no: A bakery." });
  });

  it("counts against its own cap of ten a day, never the applicants'; an applicant is still checked after the trials run out", async () => {
    modelSays({ deploys_robots: "no", evidence_quote: "", reason: "test" });
    for (let index = 0; index < check.COMPANY_RULE_TRIAL_DAILY_CAP; index += 1)
      await check.tryCompanyRule({ emailDomain: "outreach-fixture-bakery.com", website: "https://outreach-fixture-bakery.com" });
    const over = await check.tryCompanyRule({ emailDomain: "outreach-fixture-bakery.com", website: "https://outreach-fixture-bakery.com" });
    expect(over.steps.at(-1)).toEqual({ step: "day_share", ok: false, detail: "cap" });
    expect(model.run).toHaveBeenCalledTimes(check.COMPANY_RULE_TRIAL_DAILY_CAP);
    expect(applicantDay()).toBeUndefined();
    // Eleven runs on one domain, past the applicants' share of five: an applicant at that domain is still checked.
    const applicant = await applyAndCheck("ops@outreach-fixture-bakery.com", "https://outreach-fixture-bakery.com");
    expect(applicant.record.companyCheck).toMatchObject({ reasons: ["not_a_robot_company"] });
    expect(applicantDay()).toMatchObject({ count: 1 });
  });

  it("is an admin action on the approvals route: 403 for anyone else, 400 for a bad form, the steps for an admin", async () => {
    const express = (await import("express")).default;
    const router = (await import("../routes/admin-robot-team-access")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/admin/robot-team-access", router);
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/robot-team-access/rule-trial`;
    vi.useRealTimers();
    try {
      const post = (body: unknown, admin = true) => fetch(base, { method: "POST", body: JSON.stringify(body),
        headers: { "content-type": "application/json", ...(admin ? { "x-test-role": "admin" } : {}) } });
      expect((await post({ emailDomain: "outreach-fixture-arm.com", website: "https://outreach-fixture-arm.com" }, false)).status).toBe(403);
      expect((await post({ emailDomain: "not a domain", website: "x" })).status).toBe(400);
      modelSays(YES);
      const response = await post({ emailDomain: "outreach-fixture-arm.com", website: "https://outreach-fixture-arm.com" });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json();
      expect(body.check).toMatchObject({ outcome: "approved" });
      expect(body.steps).toHaveLength(7);
      expect(recordsAndEmails()).toEqual([]);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
