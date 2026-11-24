// @vitest-environment node
/**
 * The automatic check on a new deployment company application (owner direction 2026-11-23: approval in minutes, not
 * days). Plain code decides the domain, the fetch, the daily cap and the quote; the model only whether the page shows a
 * company that deploys robots. An approval is the same decision, and the same email, as a person's.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  authAdmin: null, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } } }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const slack = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
const recheckBell = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", () => ({ notifySlackRobotTeamAccessApplication: slack, notifySlackCompanyRecheck: recheckBell }));

const check = await import("../utils/companyCheck");
const early = await import("../utils/robotTeamEarlyAccess");
const { COMPANY_CHECK_DECIDED_BY } = await import("../../client/src/lib/companyCheck");

const HOME = "<html><head><title>Arm Co</title><script>var ignore = 'We deploy robots';</script><style>p{}</style></head>"
  + "<body><h1>Arm Co</h1><p>We design, install and support robotic palletizing cells for food and beverage plants.</p></body></html>";
const QUOTE = "We design, install and support robotic palletizing cells";
const YES = { deploys_robots: "yes" as const, evidence_quote: QUOTE, reason: "An integrator that installs robot cells." };

function deps(overrides: Partial<import("../utils/companyCheck").CompanyCheckDeps> = {}) {
  return {
    now: () => new Date("2026-11-23T12:00:00.000Z"),
    fetchPage: vi.fn(async (url: string) => ({ status: 200, finalUrl: url, html: HOME })),
    askModel: vi.fn(async () => YES),
    ...overrides,
  };
}

async function apply(fields: Partial<import("../utils/robotTeamEarlyAccess").RobotTeamAccessApplication> = {}) {
  const { record } = await early.recordAccessApplication({ name: "Ada Lovelace", email: "Ada@Arm.Example", company: "Arm Co",
    website: "https://www.arm.example/", partnerRole: "deployment", ...fields });
  return { id: early.accessRecordId(record.email), record };
}
const stored = (id: string) => state.docs.get(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${id}`) as Record<string, any>;
const approvalEmails = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_approved"));

beforeEach(() => { state.docs.clear(); slack.mockClear(); recheckBell.mockClear(); });

describe("the email's domain against the website", () => {
  it("matches the same domain, www and subdomains either way, and never a personal email provider", () => {
    expect(check.domainMatch("ada@arm.example", "https://www.arm.example/about")).toEqual({ matches: true });
    expect(check.domainMatch("ada@sales.arm.example", "https://arm.example")).toEqual({ matches: true });
    expect(check.domainMatch("ada@arm.example", "https://robots.arm.example")).toEqual({ matches: true });
    expect(check.domainMatch("ada@gmail.com", "https://gmail.com")).toEqual({ matches: false, reason: "webmail" });
    expect(check.domainMatch("ada@outlook.com", "https://arm.example")).toEqual({ matches: false, reason: "webmail" });
    expect(check.domainMatch("ada@arm.example", "https://notarm.example")).toEqual({ matches: false, reason: "domain_mismatch" });
    expect(check.domainMatch("ada@arm.example", "https://arm.example.evil.test")).toEqual({ matches: false, reason: "domain_mismatch" });
    expect(check.domainMatch("ada@arm.example", null)).toEqual({ matches: false, reason: "website_invalid" });
  });
});

describe("the page and the quote", () => {
  it("reads only the visible text, and finds the model's quote word for word, case and spacing aside", () => {
    const text = check.pageText(HOME);
    expect(text).not.toMatch(/var ignore|p\{\}/);
    expect(text).toContain("We design, install and support robotic palletizing cells");
    expect(check.quoteOnPage(QUOTE, text)).toBe(true);
    expect(check.quoteOnPage(`  "${QUOTE.toUpperCase()}."`, text)).toBe(true);
    expect(check.quoteOnPage("We deploy robots", text)).toBe(false);
    expect(check.quoteOnPage("robotic", text)).toBe(false); // too short to stand as evidence
  });
});

describe("what the rule finds", () => {
  const record = { email: "ada@arm.example", website: "https://arm.example" };

  it("approves a company whose email is at its website's domain and whose page shows it deploys robots", async () => {
    const run = deps();
    const found = await check.assessCompany(record, run);
    expect(found).toMatchObject({ outcome: "approved", reasons: [], modelAnswer: "yes", evidenceQuote: QUOTE, emailDomain: "arm.example" });
    // The model sees the public page and its host only: nothing the applicant typed.
    expect(run.askModel).toHaveBeenCalledWith({ websiteHost: "arm.example", pageText: expect.stringContaining(QUOTE) });
    expect(JSON.stringify(run.askModel.mock.calls)).not.toMatch(/ada@|Ada Lovelace/);
  });

  it("fetches the https form of an http website", async () => {
    const run = deps();
    await check.assessCompany({ ...record, website: "http://arm.example/home" }, run);
    expect(run.fetchPage).toHaveBeenCalledWith("https://arm.example/home");
  });

  it.each([
    ["webmail", { email: "ada@gmail.com" }, {}],
    ["domain_mismatch", { website: "https://other.example" }, {}],
  ])("sends %s to the owner without fetching, asking a model or counting against the cap", async (reason, change, _unused) => {
    const run = deps();
    expect(await check.assessCompany({ ...record, ...change }, run)).toMatchObject({ outcome: "needs_owner", reasons: [reason] });
    expect(run.fetchPage).not.toHaveBeenCalled();
    expect(run.askModel).not.toHaveBeenCalled();
    expect([...state.docs.keys()].some(key => key.startsWith(check.COMPANY_CHECK_COUNTER_COLLECTION))).toBe(false);
  });

  it.each([
    ["website_unreadable", { fetchPage: vi.fn(async () => { throw new Error("refused"); }) }],
    ["website_unreadable", { fetchPage: vi.fn(async (url: string) => ({ status: 404, finalUrl: url, html: "" })) }],
    ["redirected_off_domain", { fetchPage: vi.fn(async () => ({ status: 200, finalUrl: "https://elsewhere.example/", html: HOME })) }],
    ["website_no_text", { fetchPage: vi.fn(async (url: string) => ({ status: 200, finalUrl: url, html: "<div id=app></div>" })) }],
    ["no_model", { askModel: vi.fn(async () => "no_model" as const) }],
    ["model_unavailable", { askModel: vi.fn(async () => "model_unavailable" as const) }],
    ["model_unavailable", { askModel: vi.fn(async () => { throw new Error("provider down"); }) }],
    ["not_a_robot_company", { askModel: vi.fn(async () => ({ deploys_robots: "no" as const, evidence_quote: "", reason: "A bakery." })) }],
    ["unclear", { askModel: vi.fn(async () => ({ deploys_robots: "unclear" as const, evidence_quote: "", reason: "Too little text." })) }],
    ["quote_not_found", { askModel: vi.fn(async () => ({ ...YES, evidence_quote: "We are the leading robot deployment company" })) }],
  ])("sends %s to the owner", async (reason, overrides) => {
    expect(await check.assessCompany(record, deps(overrides as never))).toMatchObject({ outcome: "needs_owner", reasons: [reason] });
  });

  it("stops at the daily cap of automatic checks, before any model call", async () => {
    state.docs.set(`${check.COMPANY_CHECK_COUNTER_COLLECTION}/day-2026-11-23`, { count: check.COMPANY_CHECK_DAILY_CAP });
    const run = deps();
    expect(await check.assessCompany(record, run)).toMatchObject({ outcome: "needs_owner", reasons: ["daily_check_cap"] });
    expect(run.askModel).not.toHaveBeenCalled();
  });

  // Stress test round 2 (2026-11-24): junk applications whose websites never answered used up the day's checks.
  it("counts against the day's cap only a check that reaches the model", async () => {
    await check.assessCompany(record, deps());
    await check.assessCompany(record, deps({ fetchPage: vi.fn(async () => { throw new Error("no such host"); }) }));
    await check.assessCompany(record, deps({ fetchPage: vi.fn(async (url: string) => ({ status: 200, finalUrl: url, html: "<p>Hi</p>" })) }));
    await check.assessCompany({ email: "ada@gmail.com", website: "https://arm.example" }, deps());
    await check.assessCompany(record, deps());
    expect(state.docs.get(`${check.COMPANY_CHECK_COUNTER_COLLECTION}/day-2026-11-23`)).toMatchObject({ count: 2 });
  });

  it("checks at most a few applications a day from one email domain, before reading its website", async () => {
    for (let index = 0; index < check.COMPANY_CHECK_DOMAIN_DAILY_CAP; index += 1)
      expect(await check.assessCompany({ email: `ops${index}@arm.example`, website: "https://arm.example" }, deps()))
        .toMatchObject({ outcome: "approved" });
    const run = deps();
    expect(await check.assessCompany({ email: "ops9@arm.example", website: "https://arm.example" }, run))
      .toMatchObject({ outcome: "needs_owner", reasons: ["domain_daily_check_cap"] });
    expect(run.fetchPage).not.toHaveBeenCalled();
    // Another domain still has its share, and the next day this one does again.
    expect(await check.assessCompany({ email: "ada@zed.example", website: "https://zed.example" }, deps())).toMatchObject({ outcome: "approved" });
    expect(await check.assessCompany({ email: "ops9@arm.example", website: "https://arm.example" },
      deps({ now: () => new Date("2026-11-24T12:00:00.000Z") }))).toMatchObject({ outcome: "approved" });
  });
});

describe("recording the check", () => {
  it("approves through the same decision as a person's, queuing the same approval email", async () => {
    const { id } = await apply();
    const found = await check.checkCompanyApplication(id, deps());
    expect(found).toMatchObject({ outcome: "approved" });
    expect(stored(id)).toMatchObject({ status: "approved", decidedBy: COMPANY_CHECK_DECIDED_BY,
      companyCheck: { outcome: "approved", evidenceQuote: QUOTE } });
    const automatic = approvalEmails();
    expect(automatic).toHaveLength(1);

    // A person approving another application queues an email of the same kind, subject and shape.
    state.docs.clear();
    const manual = await apply({ email: "grace@arm.example" });
    await early.decideAccessApplication({ id: manual.id, status: "approved", note: null, decidedBy: "owner@tryblueprint.io" });
    const person = approvalEmails();
    expect(person).toHaveLength(1);
    const shape = (row: Record<string, any>) => ({ kind: row.kind, subject: row.subject, replyTo: row.replyTo,
      body: String(row.body).replace(/invitation=[^\s]+/g, "invitation=…").replace(/Ada|Grace/g, "Name")
        .replace(/(ada|grace)@arm\.example/g, "name@arm.example") });
    expect(shape(automatic[0][1] as never)).toEqual(shape(person[0][1] as never));
  });

  it("stores what needs the owner on the application, and leaves it waiting", async () => {
    const { id } = await apply({ email: "ada@gmail.com" });
    expect(await check.checkCompanyApplication(id, deps())).toMatchObject({ outcome: "needs_owner", reasons: ["webmail"] });
    expect(stored(id)).toMatchObject({ status: "applied", decidedBy: null, companyCheck: { outcome: "needs_owner", reasons: ["webmail"] } });
    expect(approvalEmails()).toHaveLength(0);
  });

  it("leaves an owner's decision made meanwhile exactly as it is", async () => {
    const { id } = await apply();
    const run = deps({ askModel: vi.fn(async () => {
      await early.decideAccessApplication({ id, status: "declined", note: "Not a fit", decidedBy: "owner@tryblueprint.io" });
      return YES;
    }) });
    expect(await check.checkCompanyApplication(id, run)).toBeNull();
    expect(stored(id)).toMatchObject({ status: "declined", decidedBy: "owner@tryblueprint.io" });
    expect(stored(id)).not.toHaveProperty("companyCheck");
    expect(approvalEmails()).toHaveLength(0);
  });

  it("leaves an application changed meanwhile for the owner, unapproved", async () => {
    const { id } = await apply();
    const run = deps({ askModel: vi.fn(async () => {
      await apply({ website: "https://other.example" });
      return YES;
    }) });
    expect(await check.checkCompanyApplication(id, run)).toBeNull();
    expect(stored(id)).toMatchObject({ status: "applied", website: "https://other.example" });
    expect(stored(id)).not.toHaveProperty("companyCheck");
  });

  it("never checks a technology partner, and checks an application once", async () => {
    const tech = await apply({ email: "lin@arm.example", partnerRole: "technology" });
    const run = deps();
    expect(await check.checkCompanyApplication(tech.id, run)).toBeNull();
    expect(run.fetchPage).not.toHaveBeenCalled();
    const { id } = await apply({ email: "ada@gmail.com" });
    await check.checkCompanyApplication(id, run);
    expect(await check.checkCompanyApplication(id, run)).toBeNull();
  });

  it("keeps the check on a pending application applied again with the same website, and drops it for a new one", async () => {
    const { id } = await apply({ email: "ada@gmail.com" });
    await check.checkCompanyApplication(id, deps());
    await apply({ email: "ada@gmail.com", company: "Arm Co Ltd" });
    expect(stored(id).companyCheck).toMatchObject({ reasons: ["webmail"] });
    await apply({ email: "ada@gmail.com", website: "https://arm2.example" });
    expect(stored(id)).not.toHaveProperty("companyCheck");
  });
});

describe("the bell", () => {
  it("says approved automatically, or needs you with the reasons, and never names the applicant", async () => {
    const { record } = await apply();
    await check.checkNewCompanyApplication(record, deps());
    expect(slack).toHaveBeenLastCalledWith({ email: "ada@arm.example", autoApproved: true, check: { outcome: "approved", reasons: [] } });
    const other = await apply({ email: "ada@gmail.com" });
    await check.checkNewCompanyApplication(other.record, deps());
    expect(slack).toHaveBeenLastCalledWith({ email: "ada@gmail.com", autoApproved: false, check: { outcome: "needs_owner", reasons: ["webmail"] } });
  });

  it("still rings as needing the owner when the check cannot run at all", async () => {
    const { record } = await apply();
    const broken = deps({ now: () => { throw new Error("clock"); } });
    await check.checkNewCompanyApplication(record, broken);
    expect(slack).toHaveBeenLastCalledWith({ email: "ada@arm.example", autoApproved: false, check: { outcome: "needs_owner", reasons: ["check_failed"] } });
  });
});

// An application the immediate check missed (a restart mid-check, or one that came before the rule) is not left
// waiting silently: the ops monitor checks it after ten minutes and Slack rings.
describe("the catch-up sweep", () => {
  it("checks an unchecked waiting application after ten minutes, rings Slack, and leaves checked or newer ones alone", async () => {
    const { id, record } = await apply();
    const applied = Date.parse(record.appliedAtIso);
    expect(await check.sweepUncheckedCompanyApplications(applied + 60_000, deps())).toBe(0);
    expect(slack).not.toHaveBeenCalled();
    expect(await check.sweepUncheckedCompanyApplications(applied + check.COMPANY_CHECK_SWEEP_AFTER_MS, deps())).toBe(1);
    expect(stored(id)).toMatchObject({ status: "approved", companyCheck: { outcome: "approved" } });
    expect(slack).toHaveBeenLastCalledWith({ email: "ada@arm.example", autoApproved: true, check: { outcome: "approved", reasons: [] } });
    // Once checked (or decided), it is never checked again.
    expect(await check.sweepUncheckedCompanyApplications(applied + 3_600_000, deps())).toBe(0);
  });

  it("pages past waiting applications that were already checked, so a later unchecked one is still reached", async () => {
    const { id, record } = await apply({ email: "zed@arm.example" });
    const applied = Date.parse(record.appliedAtIso);
    for (let index = 0; index < 205; index += 1) {
      const prefix = index.toString().padStart(4, "0");
      state.docs.set(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${"0".repeat(60)}${prefix}`, { email: `checked-${prefix}@elsewhere.example`,
        status: "applied", appliedAtIso: record.appliedAtIso, companyCheck: { outcome: "needs_owner", reasons: ["domain_mismatch"] } });
    }
    expect(await check.sweepUncheckedCompanyApplications(applied + 3_600_000, deps())).toBe(1);
    expect(stored(id)).toMatchObject({ companyCheck: { outcome: "approved" } });
  });

  // Stress test round 2 (2026-11-24): a real company that met the day's cap waited for the owner and was never checked again.
  it("checks again the next day an application whose check failed only for the moment, ringing Slack only when it settles", async () => {
    const { id, record } = await apply();
    // Fixed times, whatever today is: applied an hour before the check's clock (`deps().now`).
    state.docs.set(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${id}`, { ...stored(id), appliedAtIso: "2026-11-23T11:00:00.000Z" });
    state.docs.set(`${check.COMPANY_CHECK_COUNTER_COLLECTION}/day-2026-11-23`, { count: check.COMPANY_CHECK_DAILY_CAP });
    await check.checkNewCompanyApplication(record, deps());
    expect(stored(id)).toMatchObject({ status: "applied", companyCheck: { reasons: ["daily_check_cap"] } });
    expect(slack).toHaveBeenCalledTimes(1);
    // Later the same day: not again.
    expect(await check.sweepUncheckedCompanyApplications(Date.parse("2026-11-23T18:00:00.000Z"), deps())).toBe(0);
    // The next day: the website still does not answer. Checked, stored, and no second bell.
    const tomorrow = () => new Date(Date.parse("2026-11-23T12:00:00.000Z") + check.COMPANY_RECHECK_RETRY_MS + 60_000);
    expect(await check.sweepUncheckedCompanyApplications(tomorrow().getTime(),
      deps({ now: tomorrow, fetchPage: vi.fn(async () => { throw new Error("down"); }) }))).toBe(1);
    expect(stored(id)).toMatchObject({ status: "applied", companyCheck: { reasons: ["website_unreadable"] } });
    expect(slack).toHaveBeenCalledTimes(1);
    // A day after that the website answers: approved, and Slack rings.
    const later = () => new Date(tomorrow().getTime() + check.COMPANY_RECHECK_RETRY_MS + 60_000);
    expect(await check.sweepUncheckedCompanyApplications(later().getTime(), deps({ now: later }))).toBe(1);
    expect(stored(id)).toMatchObject({ status: "approved", companyCheck: { outcome: "approved" } });
    expect(slack).toHaveBeenCalledTimes(2);
    expect(slack).toHaveBeenLastCalledWith({ email: "ada@arm.example", autoApproved: true, check: { outcome: "approved", reasons: [] } });
  });

  it("never checks again an application the rule sent to the owner for a reason that holds", async () => {
    const { id, record } = await apply({ website: "https://other.example" });
    await check.checkNewCompanyApplication(record, deps());
    expect(stored(id)).toMatchObject({ companyCheck: { reasons: ["domain_mismatch"] } });
    expect(await check.sweepUncheckedCompanyApplications(Math.max(Date.parse(record.appliedAtIso), Date.parse("2026-11-23T12:00:00.000Z"))
      + 3 * check.COMPANY_RECHECK_RETRY_MS, deps())).toBe(0);
  });

  it("never sweeps a technology partner", async () => {
    const { record } = await apply({ partnerRole: "technology" });
    expect(await check.sweepUncheckedCompanyApplications(Date.parse(record.appliedAtIso) + 3_600_000, deps())).toBe(0);
  });
});

// Owner, 2026-11-23, after freight marketplaces: a company the rule approved is checked again every 90 days. A company
// that no longer passes keeps its access (only privacy, rights and money stop anything); the owner is told once.
describe("the 90-day re-check", () => {
  const DAY = 24 * 60 * 60 * 1000;
  async function approvedCompany() {
    const { id, record } = await apply();
    await check.checkNewCompanyApplication(record, deps());
    expect(stored(id)).toMatchObject({ status: "approved" });
    return { id, checkedAt: Date.parse(stored(id).companyCheck.checkedAtIso) };
  }
  const at = (ms: number) => () => new Date(ms);

  it("re-checks only after 90 days, records a pass, and never re-checks a company the owner approved without the rule", async () => {
    const { id, checkedAt } = await approvedCompany();
    expect(await check.recheckApprovedCompanies(checkedAt + 89 * DAY, deps())).toBe(0);
    expect(await check.recheckApprovedCompanies(checkedAt + 90 * DAY, deps({ now: at(checkedAt + 90 * DAY) }))).toBe(1);
    expect(stored(id)).toMatchObject({ status: "approved", companyRecheck: { outcome: "approved", failuresInARow: 0 } });
    expect(recheckBell).not.toHaveBeenCalled();
    // The next one is 90 days after the re-check.
    expect(await check.recheckApprovedCompanies(checkedAt + 179 * DAY, deps())).toBe(0);
    const owner = await apply({ email: "bo@gmail.com" });
    await check.checkNewCompanyApplication(owner.record, deps());
    state.docs.set(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${owner.id}`, { ...stored(owner.id), status: "approved" });
    expect(check.companyRecheckDueAtMs(stored(owner.id) as never)).toBeNull();
  });

  it("tells the owner once when the website no longer shows robot work, and never changes the company's access", async () => {
    const { id, checkedAt } = await approvedCompany();
    const no = deps({ now: at(checkedAt + 90 * DAY), askModel: vi.fn(async () => ({ deploys_robots: "no" as const, evidence_quote: "", reason: "A bakery." })) });
    expect(await check.recheckApprovedCompanies(checkedAt + 90 * DAY, no)).toBe(1);
    expect(stored(id)).toMatchObject({ status: "approved", companyRecheck: { outcome: "needs_owner", reasons: ["not_a_robot_company"], failuresInARow: 1 } });
    expect(recheckBell).toHaveBeenCalledTimes(1);
    expect(recheckBell).toHaveBeenLastCalledWith({ email: "ada@arm.example", reasons: ["not_a_robot_company"] });
    // Still failing 90 days on: not told again. Passing again, then failing again: told again.
    const later = checkedAt + 180 * DAY;
    expect(await check.recheckApprovedCompanies(later, { ...no, now: at(later) })).toBe(1);
    expect(recheckBell).toHaveBeenCalledTimes(1);
    expect(await check.recheckApprovedCompanies(later + 90 * DAY, deps({ now: at(later + 90 * DAY) }))).toBe(1);
    expect(stored(id).companyRecheck).toMatchObject({ outcome: "approved", failuresInARow: 0 });
    expect(await check.recheckApprovedCompanies(later + 180 * DAY, { ...no, now: at(later + 180 * DAY) })).toBe(1);
    expect(recheckBell).toHaveBeenCalledTimes(2);
    expect(stored(id)).toMatchObject({ status: "approved" });
  });

  it("tries a website that did not answer again the next day, and tells the owner only on the third failure in a row", async () => {
    const { id, checkedAt } = await approvedCompany();
    const down = (ms: number) => deps({ now: at(ms), fetchPage: vi.fn(async () => { throw new Error("timeout"); }) });
    let when = checkedAt + 90 * DAY;
    for (const expected of [0, 0, 1]) {
      expect(await check.recheckApprovedCompanies(when, down(when))).toBe(1);
      expect(recheckBell).toHaveBeenCalledTimes(expected);
      // Not due again until a day later.
      expect(await check.recheckApprovedCompanies(when + DAY - 1, down(when + DAY - 1))).toBe(0);
      when += DAY;
    }
    expect(stored(id)).toMatchObject({ status: "approved", companyRecheck: { reasons: ["website_unreadable"], failuresInARow: 3 } });
  });
});
