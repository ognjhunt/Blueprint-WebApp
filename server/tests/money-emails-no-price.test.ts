// @vitest-environment node
/**
 * No price in any email a site or a deployment company receives (owner, 2026-11-12: the site pays nothing; deployment
 * companies will pay, how is not decided, and no price is stated anywhere).
 *
 * Built, not grepped: each email is made the way the server makes it, through its own builder, then wrapped in the
 * branded layout and, where it is a commercial email, its unsubscribe footer, and the whole text is read sentence by
 * sentence with the one price detector (`scripts/qa/price-statements.ts`). The source of every email is also read by
 * the copy guard (`client/tests/money/no-price-copy.guard.test.ts`); this test reads what the variables become.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null, authAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/accountInvitations", () => ({ robotTeamAccountInvitation: () => "invitation-fixture" }));

const { priceFindings } = await import("../../scripts/qa/price-statements");
const { accessApprovedEmail, introductionCompanyEmail, newJobEmail } =
  await import("../utils/robotTeamAccessEmails");
const { introductionMadeSiteEmail } = await import("../utils/introductionSiteEmail");
const { buildIntroductionMadeSiteNotification, buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
const { buildOutcomeQuestionEmail } = await import("../utils/jobOutcomes");
const { WITHDRAWAL_COMPANY_SUBJECT, withdrawalCompanyBody } = await import("../utils/withdrawalCompanyNotice");
const { passwordResetEmail } = await import("../utils/passwordResetEmail");
const { brandedEmail } = await import("../utils/emailLayout");
const { appendCommercialEmailFooter } = await import("../utils/email-suppression");
const { COMPANY_RESPONSE_LABELS } = await import("../../client/src/lib/companyResponses");

type Email = { label: string; to: "site" | "company"; subject: string; body: string };

const JOB_URL = "https://tryblueprint.io/capture-upload/owner-token";
const COMPANY = { name: "North Robotics", contactName: "Avery North", email: "avery@north.example", website: "https://north.example" };
const SITE = { name: "Riverside Depot", contactName: "Sam Rivers", email: "sam@riverside.example", phone: "+1 555 0100",
  location: "Columbus, Ohio" };
const COMPANY_RECORD = { name: "Avery North", email: COMPANY.email, company: COMPANY.name, testSite: "a dish room",
  partnerRole: "deployment", status: "approved" } as never;

/** Every lifecycle milestone a site can be sent, with the parameters its builder needs. */
function lifecycleNotices(): Email[] {
  const base = { requestId: "req-1", to: "owner@site.example", captureUrl: JOB_URL };
  const notices: Array<[string, Parameters<typeof buildTaskLifecycleNotification>[0]]> = [];
  notices.push(["task_received", { ...base, milestone: "task_received" }]);
  notices.push(["job_sent", { ...base, milestone: "job_sent", eventId: "companies", companyCount: 3 }]);
  for (const state of ["interested", "declined", "needs_something", "tested_can_do", "tested_cannot_yet"] as const)
    notices.push([`company_answered ${state}`, { ...base, milestone: "company_answered", companyAnswerState: state }]);
  return notices.map(([label, params]) => {
    const notice = buildTaskLifecycleNotification(params);
    return { label: `lifecycle ${label}`, to: "site" as const, subject: notice.subject, body: notice.body };
  });
}

function everyEmail(): Email[] {
  const emails: Email[] = [];
  const add = (label: string, to: Email["to"], email: { subject: string; body: string }) => emails.push({ label, to, ...email });
  // The site's emails.
  emails.push(...lifecycleNotices());
  for (const [state, label] of Object.entries(COMPANY_RESPONSE_LABELS)) {
    add(`introduction made, site (${state})`, "site", introductionMadeSiteEmail({ jobUrl: JOB_URL, company: COMPANY, answerLabel: label }));
    const notice = buildIntroductionMadeSiteNotification({ requestId: "req-1", to: SITE.email, companyId: "north", company: COMPANY,
      captureUrl: JOB_URL, answerLabel: label });
    add(`introduction made notice, site (${state})`, "site", { subject: notice.subject, body: notice.body });
    // The company's emails.
    add(`introduction made, company (${state})`, "company", introductionCompanyEmail({ site: SITE, jobUrl: "https://tryblueprint.io/jobs/req-1",
      contactName: COMPANY.contactName, answerLabel: label }));
  }
  for (const side of ["site", "company"] as const) add(`outcome question to the ${side}`, side,
    buildOutcomeQuestionEmail({ requestId: "req-1", companyId: "north", side, otherSideName: side === "site" ? COMPANY.name : SITE.name }));
  add("access approved", "company", accessApprovedEmail(COMPANY_RECORD));
  add("access approved by invitation", "company", accessApprovedEmail({ ...(COMPANY_RECORD as object), source: "invite" } as never));
  add("new job", "company", newJobEmail({ to: COMPANY.email, jobUrl: "https://tryblueprint.io/jobs/req-1" }));
  add("job withdrawn", "company", { subject: WITHDRAWAL_COMPANY_SUBJECT, body: withdrawalCompanyBody("12 November 2026", "Move cartons to a pallet") });
  const reset = passwordResetEmail("https://tryblueprint.io/auth/action?mode=resetPassword&oobCode=abc123");
  add("password reset", "site", { subject: reset.subject, body: reset.text });
  // What every email carries around its words: the branded layout's footer and the commercial unsubscribe footer.
  return emails.map(email => ({ ...email, body: [
    brandedEmail({ subject: email.subject, text: email.body }).text,
    appendCommercialEmailFooter({ text: email.body, email: email.to === "site" ? SITE.email : COMPANY.email, scope: "optional_updates" }),
  ].join("\n\n") }));
}

describe("no price in any email to a site or a deployment company", () => {
  const emails = everyEmail();

  it("builds every kind of email both sides receive", () => {
    expect(emails.filter(email => email.to === "site").length).toBeGreaterThanOrEqual(15);
    expect(emails.filter(email => email.to === "company").length).toBeGreaterThanOrEqual(10);
    for (const label of ["introduction made, site (interested)", "introduction made, company (interested)",
      "outcome question to the site", "outcome question to the company", "new job", "job withdrawn", "lifecycle job_sent"])
      expect(emails.map(email => email.label)).toContain(label);
  });

  it.each(everyEmail().map(email => [email.label, email] as const))("%s states no price", (_label, email) => {
    expect(priceFindings(`${email.subject}\n${email.body}`)).toEqual([]);
  });

  it("would catch a price in an introduction email", () => {
    const priced = introductionCompanyEmail({ site: SITE, jobUrl: "https://tryblueprint.io/jobs/req-1",
      contactName: COMPANY.contactName, answerLabel: "Interested $250 per introduction" });
    expect(priceFindings(priced.body).map(finding => finding.split(": ")[0])).toEqual(["an amount of money", "a rate"]);
  });
});
