/**
 * The automatic check on a new deployment company application (owner direction 2026-11-23: approval in minutes, not
 * days). The published rule, stated on the application form (`COMPANY_CHECK_RULE_SENTENCE`): a company is approved at
 * once when its work email is at its website's domain and that website shows it deploys robots. Everything the rule
 * does not settle goes to the owner, with the reasons, and is decided there with one press as before.
 *
 * Plain code decides: the email's domain against the website's host (a personal email provider never matches), the
 * page fetched through the SSRF guard (`fetchPinnedPublicText`) and still on that domain after redirects, the daily
 * cap on automatic checks (money is a hard stop), and that the model's quote is on the page word for word. The model
 * (`tasks/company-website-check.ts`) decides only whether the page shows a company that deploys robots, and sees only
 * the public page and its host. An approval goes through `decideAccessApplication`, so it queues the same approval
 * email in the same transaction as a person's, and only while the application is still the one that was checked.
 *
 * An approved company still signs in through a link sent to that email address, so an application made with someone
 * else's address approves nobody the inbox owner did not ask for.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  COMPANY_CHECK_DECIDED_BY, COMPANY_CHECK_DECISION_NOTE, COMPANY_CHECK_SCHEMA,
  type CompanyCheck, type CompanyCheckReason,
} from "../../client/src/lib/companyCheck";
import { logger } from "../logger";
import { fetchPinnedPublicText } from "./publicFetchGuard";
import {
  accessRecordId, decideAccessApplication, ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord,
} from "./robotTeamEarlyAccess";

/** At most this many automatic checks a day (UTC). Over it, an application waits for the owner. */
export const COMPANY_CHECK_DAILY_CAP = 100;
export const COMPANY_CHECK_COUNTER_COLLECTION = "opsCompanyChecks";
const MODEL_DEADLINE_MS = 45_000;
const PAGE_TEXT_LIMIT = 20_000;
const MIN_PAGE_TEXT = 40;
const MIN_QUOTE = 12;

/** Personal email providers: an address there is never a company's own domain. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.net", "gmx.de", "mail.com", "yandex.com", "yandex.ru", "zoho.com", "zohomail.com", "qq.com",
  "163.com", "126.com", "hey.com", "fastmail.com", "tutanota.com", "web.de",
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() || "";
}

export function websiteHost(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function sameOrganization(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
}

/** Whether the email is at the website's own domain, and why not. */
export function domainMatch(email: string, website: string | null | undefined):
  { matches: true } | { matches: false; reason: Extract<CompanyCheckReason, "webmail" | "domain_mismatch" | "website_invalid"> } {
  const domain = emailDomain(email);
  if (!domain || FREE_MAIL.has(domain)) return { matches: false, reason: "webmail" };
  const host = websiteHost(website);
  if (!host) return { matches: false, reason: "website_invalid" };
  return sameOrganization(host, domain) ? { matches: true } : { matches: false, reason: "domain_mismatch" };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", "#39": "'" };

/** The visible text of an HTML page: no scripts, styles or tags, whitespace collapsed, at most 20,000 characters. */
export function pageText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (match, name: string) => ENTITIES[name.toLowerCase()]
      ?? (/^#\d+$/.test(name) ? String.fromCodePoint(Number(name.slice(1))) : match))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PAGE_TEXT_LIMIT);
}

const normalized = (value: string) => value.toLowerCase()
  .replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, "\"").replace(/[–—]/g, "-")
  .replace(/\s+/g, " ").trim();

/** The model's quote, found word for word on the page (case, spacing and typographic quotes aside). */
export function quoteOnPage(quote: string, text: string): boolean {
  const needle = normalized(quote).replace(/^["'.\s]+|["'.\s]+$/g, "");
  return needle.length >= MIN_QUOTE && normalized(text).includes(needle);
}

type ModelAnswer = { deploys_robots: "yes" | "no" | "unclear"; evidence_quote: string; reason: string };

export interface CompanyCheckDeps {
  now: () => Date;
  /** The website's home page as HTML, through the SSRF guard; the final URL after redirects. */
  fetchPage: (url: string) => Promise<{ status: number; finalUrl: string; html: string }>;
  /** The model's answer, or null when no provider is set up ("no_model") or it did not answer ("model_unavailable"). */
  askModel: (input: { websiteHost: string; pageText: string }) => Promise<ModelAnswer | "no_model" | "model_unavailable">;
}

const defaultDeps: CompanyCheckDeps = {
  now: () => new Date(),
  async fetchPage(url) {
    const page = await fetchPinnedPublicText(url, { maxBytes: 1024 * 1024, timeoutMs: 10_000, maxRedirects: 3,
      contentTypes: /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/ });
    return { status: page.status, finalUrl: page.finalUrl, html: page.text };
  },
  async askModel(input) {
    const { getStructuredProviderOrder } = await import("../agents/provider-config");
    if (!getStructuredProviderOrder("company_website_check").length) return "no_model";
    const { runAgentTask } = await import("../agents/runtime");
    const run = runAgentTask<{ websiteHost: string; pageText: string }, ModelAnswer>({
      kind: "company_website_check", input }, { dispatchQueuedOnFinish: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), MODEL_DEADLINE_MS); });
    const result = await Promise.race([run, deadline]).finally(() => clearTimeout(timer));
    return result && result.status === "completed" && result.output ? result.output : "model_unavailable";
  },
};

/** Count one automatic check against today's cap; false when the cap is reached (nothing is counted then). */
export async function takeDailyCheck(now: Date): Promise<boolean> {
  if (!db) return false;
  const store = db;
  const ref = store.collection(COMPANY_CHECK_COUNTER_COLLECTION).doc(`day-${now.toISOString().slice(0, 10)}`);
  return store.runTransaction(async (tx) => {
    const count = Number((await tx.get(ref)).data()?.count ?? 0);
    if (count >= COMPANY_CHECK_DAILY_CAP) return false;
    tx.set(ref, { count: count + 1, updatedAtIso: now.toISOString() }, { merge: true });
    return true;
  });
}

/** The https form of the website the applicant gave. */
function httpsForm(website: string): string | null {
  try {
    const url = new URL(website);
    url.protocol = "https:";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

/** What the rule finds for this application, without writing anything. */
export async function assessCompany(record: Pick<RobotTeamAccessRecord, "email" | "website">,
  deps: CompanyCheckDeps = defaultDeps): Promise<CompanyCheck> {
  const now = deps.now();
  const base = { schemaVersion: COMPANY_CHECK_SCHEMA, checkedAtIso: now.toISOString(), emailDomain: emailDomain(record.email),
    website: record.website ?? null };
  const needsOwner = (reasons: CompanyCheckReason[], extra: Partial<CompanyCheck> = {}): CompanyCheck =>
    ({ ...base, outcome: "needs_owner", reasons, ...extra });
  const match = domainMatch(record.email, record.website);
  if (!match.matches) return needsOwner([match.reason]);
  const url = httpsForm(record.website!);
  if (!url) return needsOwner(["website_invalid"]);
  if (!await takeDailyCheck(now)) return needsOwner(["daily_check_cap"]);
  let page: Awaited<ReturnType<CompanyCheckDeps["fetchPage"]>>;
  try { page = await deps.fetchPage(url); } catch { return needsOwner(["website_unreadable"]); }
  if (page.status < 200 || page.status >= 300) return needsOwner(["website_unreadable"]);
  // The page must still be the company's own: a site that sends visitors to another domain is not evidence about it.
  if (!domainMatch(record.email, page.finalUrl).matches) return needsOwner(["redirected_off_domain"]);
  const text = pageText(page.html);
  if (text.length < MIN_PAGE_TEXT) return needsOwner(["website_no_text"]);
  let answer: Awaited<ReturnType<CompanyCheckDeps["askModel"]>>;
  try { answer = await deps.askModel({ websiteHost: websiteHost(page.finalUrl)!, pageText: text }); }
  catch { return needsOwner(["model_unavailable"]); }
  if (answer === "no_model" || answer === "model_unavailable") return needsOwner([answer]);
  const said = { modelAnswer: answer.deploys_robots, modelReason: String(answer.reason ?? "").trim().slice(0, 300) || undefined };
  if (answer.deploys_robots === "no") return needsOwner(["not_a_robot_company"], said);
  if (answer.deploys_robots !== "yes") return needsOwner(["unclear"], said);
  const quote = String(answer.evidence_quote ?? "").trim().slice(0, 300);
  if (!quoteOnPage(quote, text)) return needsOwner(["quote_not_found"], said);
  return { ...base, outcome: "approved", reasons: [], ...said, evidenceQuote: quote };
}

/** Same application as the one checked: still waiting, at the same email and website. */
function stillTheCheckedApplication(prior: RobotTeamAccessRecord, checked: Pick<RobotTeamAccessRecord, "email" | "website">) {
  return prior.status === "applied" && prior.email === checked.email && (prior.website ?? null) === (checked.website ?? null);
}

/**
 * Run the check once for a new application and record it: an approval through the same decision as a person's (and
 * its approval email), anything else stored for the owner. A decision made meanwhile, or a changed application, is
 * left as it is. Returns what was recorded, or null when nothing was.
 */
export async function checkCompanyApplication(recordId: string, deps: CompanyCheckDeps = defaultDeps): Promise<CompanyCheck | null> {
  if (!db) return null;
  const store = db;
  const ref = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(recordId);
  const record = (await ref.get()).data() as RobotTeamAccessRecord | undefined;
  if (!record || record.status !== "applied" || record.partnerRole === "technology" || record.companyCheck) return null;
  if (accessRecordId(record.email) !== recordId) return null;
  const checked = { email: record.email, website: record.website ?? null };
  const check = await assessCompany(checked, deps);
  if (check.outcome === "approved") {
    const decided = await decideAccessApplication({ id: recordId, status: "approved", note: COMPANY_CHECK_DECISION_NOTE,
      decidedBy: COMPANY_CHECK_DECIDED_BY, guard: (prior) => stillTheCheckedApplication(prior, checked),
      extra: { companyCheck: check } });
    return decided ? check : null;
  }
  const stored = await store.runTransaction(async (tx) => {
    const prior = (await tx.get(ref)).data() as RobotTeamAccessRecord | undefined;
    if (!prior || !stillTheCheckedApplication(prior, checked)) return false;
    tx.set(ref, { companyCheck: check }, { merge: true });
    return true;
  });
  return stored ? check : null;
}

/**
 * After a new deployment company applies: run the check, then ring Slack with what it found ("approved automatically"
 * or "needs you", with the reasons). Never throws; a check that cannot run at all still rings as "needs you".
 */
export async function checkNewCompanyApplication(record: Pick<RobotTeamAccessRecord, "email">,
  deps: CompanyCheckDeps = defaultDeps): Promise<void> {
  const { notifySlackRobotTeamAccessApplication } = await import("./slack");
  let check: CompanyCheck | null = null;
  let failed = false;
  try {
    check = await checkCompanyApplication(accessRecordId(record.email), deps);
  } catch (error) {
    failed = true;
    logger.warn({ error }, "The automatic company check could not run");
  }
  // Nothing recorded and nothing failed: the application was decided or changed meanwhile; the plain bell.
  const rung = check ? { outcome: check.outcome, reasons: check.reasons as string[] }
    : failed ? { outcome: "needs_owner" as const, reasons: ["check_failed"] } : undefined;
  await notifySlackRobotTeamAccessApplication({ email: record.email, autoApproved: rung?.outcome === "approved",
    ...(rung ? { check: rung } : {}) }).catch(() => undefined);
}

/** An application left unchecked this long (the server restarted mid-check, or it came before the rule) is swept. */
export const COMPANY_CHECK_SWEEP_AFTER_MS = 10 * 60 * 1000;
const SWEEP_PER_PASS = 5;
const SWEEP_PAGE_SIZE = 200;
const SWEEP_MAX_PAGES = 50;

/**
 * The ops monitor's catch-up (`betaOpsMonitor.ts`, step 8): a waiting deployment-company application with no check
 * after ten minutes is checked now and Slack rings with what was found, as at the moment it applied. At most five
 * a pass, oldest first; the daily cap still applies. Returns how many were checked.
 */
export async function sweepUncheckedCompanyApplications(nowMs = Date.now(), deps: CompanyCheckDeps = defaultDeps): Promise<number> {
  if (!db) return 0;
  // Every waiting application is read, a page at a time by document id: checked ones waiting for the owner never
  // hide an unchecked one behind them.
  const found: Array<{ id: string; record: RobotTeamAccessRecord }> = [];
  let after: string | null = null;
  for (let page = 0; page < SWEEP_MAX_PAGES; page += 1) {
    let query = db.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "applied").orderBy("__name__").limit(SWEEP_PAGE_SIZE);
    if (after) query = query.startAfter(after);
    const { docs } = await query.get();
    found.push(...docs.map(doc => ({ id: doc.id, record: doc.data() as RobotTeamAccessRecord })));
    if (docs.length < SWEEP_PAGE_SIZE) break;
    after = docs[docs.length - 1].id;
  }
  const due = found
    .filter(({ id, record }) => !record.companyCheck && record.partnerRole !== "technology" && typeof record.email === "string"
      && accessRecordId(record.email) === id && Date.parse(String(record.appliedAtIso ?? "")) <= nowMs - COMPANY_CHECK_SWEEP_AFTER_MS)
    .sort((a, b) => String(a.record.appliedAtIso).localeCompare(String(b.record.appliedAtIso)))
    .slice(0, SWEEP_PER_PASS);
  for (const { record } of due) await checkNewCompanyApplication(record, deps);
  return due.length;
}

/* --------------------------------------------------------------- re-checking approved companies */

/**
 * The published rule is checked again for every company it approved (owner, 2026-11-23, after freight marketplaces:
 * a carrier's authority and insurance are watched for as long as it can book, not only at sign-up). Every 90 days a
 * company the rule approved is assessed again exactly as an application is (`assessCompany`). A company that still
 * passes is recorded so; one that no longer passes keeps its access (only privacy, rights and money stop anything) and
 * the owner is told once, on the change, with the reasons. A failure that may be the moment's (the website did not
 * answer, the model did not, today's cap) is tried again the next day and told only on the third in a row.
 */
export const COMPANY_RECHECK_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
export const COMPANY_RECHECK_RETRY_MS = 24 * 60 * 60 * 1000;
export const COMPANY_RECHECK_TELL_AFTER_PASSING_FAILURES = 3;
const RECHECK_PER_PASS = 3;
const MOMENTARY: ReadonlySet<CompanyCheckReason> = new Set(["daily_check_cap", "website_unreadable", "model_unavailable",
  "no_model", "check_failed"]);

/** The latest re-check, as stored on the company's record (`companyRecheck`). */
export type CompanyRecheck = CompanyCheck & { failuresInARow: number; toldOwnerAtIso?: string };

const momentary = (check: Pick<CompanyCheck, "outcome" | "reasons">) =>
  check.outcome !== "approved" && check.reasons.length > 0 && check.reasons.every(reason => MOMENTARY.has(reason));

/** When this approved company is next due: 90 days after its last check, or a day after a momentary failure. */
export function companyRecheckDueAtMs(record: RobotTeamAccessRecord & { companyRecheck?: CompanyRecheck }): number | null {
  if (record.status !== "approved" || record.partnerRole === "technology" || record.companyCheck?.outcome !== "approved") return null;
  const last = record.companyRecheck ?? record.companyCheck;
  const at = Date.parse(String(last.checkedAtIso ?? ""));
  if (!Number.isFinite(at)) return 0;
  return at + (record.companyRecheck && momentary(record.companyRecheck) ? COMPANY_RECHECK_RETRY_MS : COMPANY_RECHECK_AFTER_MS);
}

/**
 * The ops monitor's re-check (`betaOpsMonitor.ts`, step 10): at most three due companies a pass, the longest waiting
 * first; the daily cap still applies. Never changes a company's access. Returns how many were checked.
 */
export async function recheckApprovedCompanies(nowMs = Date.now(), deps: CompanyCheckDeps = defaultDeps): Promise<number> {
  if (!db) return 0;
  const store = db;
  const found: Array<{ id: string; record: RobotTeamAccessRecord & { companyRecheck?: CompanyRecheck }; due: number }> = [];
  let after: string | null = null;
  for (let page = 0; page < SWEEP_MAX_PAGES; page += 1) {
    let query = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved").orderBy("__name__").limit(SWEEP_PAGE_SIZE);
    if (after) query = query.startAfter(after);
    const { docs } = await query.get();
    for (const doc of docs) {
      const record = doc.data() as RobotTeamAccessRecord & { companyRecheck?: CompanyRecheck };
      const due = companyRecheckDueAtMs(record);
      if (due !== null && due <= nowMs && typeof record.email === "string" && accessRecordId(record.email) === doc.id)
        found.push({ id: doc.id, record, due });
    }
    if (docs.length < SWEEP_PAGE_SIZE) break;
    after = docs[docs.length - 1].id;
  }
  const due = found.sort((a, b) => a.due - b.due).slice(0, RECHECK_PER_PASS);
  for (const { id, record } of due) {
    const checked = { email: record.email, website: record.website ?? null };
    let check: CompanyCheck;
    try { check = await assessCompany(checked, deps); }
    catch { check = { schemaVersion: COMPANY_CHECK_SCHEMA, checkedAtIso: deps.now().toISOString(), outcome: "needs_owner",
      reasons: ["check_failed"], emailDomain: emailDomain(record.email), website: record.website ?? null }; }
    const told = await store.runTransaction(async (tx) => {
      const ref = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(id);
      const prior = (await tx.get(ref)).data() as (RobotTeamAccessRecord & { companyRecheck?: CompanyRecheck }) | undefined;
      // Decided again, or changed, meanwhile: this check is about a company that no longer stands as it was.
      if (!prior || prior.status !== "approved" || prior.email !== checked.email || (prior.website ?? null) !== checked.website) return null;
      const before = prior.companyRecheck;
      const failuresInARow = check.outcome === "approved" ? 0 : (before && before.outcome !== "approved" ? before.failuresInARow : 0) + 1;
      // Told once per run of failures: on the first failure that is not momentary, or the third momentary one in a row.
      const alreadyTold = Boolean(before?.toldOwnerAtIso) && before!.outcome !== "approved";
      const tell = check.outcome !== "approved" && !alreadyTold
        && (!momentary(check) || failuresInARow >= COMPANY_RECHECK_TELL_AFTER_PASSING_FAILURES);
      const next: CompanyRecheck = { ...check, failuresInARow,
        ...(tell ? { toldOwnerAtIso: check.checkedAtIso } : alreadyTold && check.outcome !== "approved" ? { toldOwnerAtIso: before!.toldOwnerAtIso } : {}) };
      tx.set(ref, { companyRecheck: next }, { merge: true });
      return tell ? next : null;
    });
    if (told) {
      const { notifySlackCompanyRecheck } = await import("./slack");
      await notifySlackCompanyRecheck({ email: record.email, reasons: told.reasons }).catch(() => undefined);
    }
  }
  return due.length;
}
