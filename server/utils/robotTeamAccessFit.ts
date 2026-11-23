/**
 * A short, explicit fit checklist for robot-team applications.
 *
 * It runs on submit and its reasons show on the review page, so a person
 * reads a pre-sorted application rather than a blank one. It is plain rules,
 * not a model: at early volume every application is read by a person anyway,
 * and a rule's reason is exact.
 *
 * The checklist supports manual invitations when a real site task fits.
 * It never grants access automatically. Approval unlocks the task cards sites chose to share (never
 * footage, names or addresses), and still needs the approved email to be
 * verified at sign-in.
 */
import type { RobotTeamAccessApplication } from "./robotTeamEarlyAccess";

export interface AccessFitCheck {
  id: "work_email" | "website_matches_email";
  label: string;
  passed: boolean;
  detail: string;
}

export interface AccessFit {
  checks: AccessFitCheck[];
  /** Work email and a website on the same domain. */
  clearFit: boolean;
  /** Listed site tasks when the application was assessed. */
  listedTaskCount: number;
  assessedAtIso: string;
}

type ListedTask = { title: string; region: string };

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.net", "gmx.de", "mail.com", "yandex.com", "yandex.ru", "zoho.com", "qq.com",
  "163.com", "126.com", "hey.com", "fastmail.com", "tutanota.com", "web.de",
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() || "";
}

function websiteHost(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameOrganization(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
}

export function assessAccessFit(
  application: Pick<RobotTeamAccessApplication, "email" | "website" | "region">,
  listed: ListedTask[],
  now = new Date(),
): AccessFit {
  const domain = emailDomain(application.email);
  const workEmail = Boolean(domain) && !FREE_MAIL.has(domain);
  const host = websiteHost(application.website);
  const matches = Boolean(host && workEmail && sameOrganization(host, domain));

  const checks: AccessFitCheck[] = [
    {
      id: "work_email",
      label: "Work email",
      passed: workEmail,
      detail: workEmail ? `Company domain ${domain}` : `${domain || "No domain"} is a personal email provider`,
    },
    {
      id: "website_matches_email",
      label: "Website matches the email",
      passed: matches,
      detail: !host
        ? "No website given"
        : matches ? `${host} matches ${domain}` : `${host} does not match ${domain}`,
    },
  ];
  return {
    checks,
    clearFit: workEmail && matches,
    listedTaskCount: listed.length,
    assessedAtIso: now.toISOString(),
  };
}

const THIN_LIBRARY_TASKS = 5;

/** Compatibility metadata: invited beta admission always needs a person's decision. */
export function autoApproveMinimumTasks(): number | null {
  return null;
}

/** Fit is review evidence, never an admission decision, including for matching domains. */
export function shouldAutoApprove(_fit: AccessFit): boolean {
  return false;
}

/** So few listed tasks that each team is matched to a site by hand. */
export function libraryIsThin(listedTaskCount: number): boolean {
  return listedTaskCount < THIN_LIBRARY_TASKS;
}
