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
  id: "work_email" | "website_matches_email" | "open_tasks_in_region";
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

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1));
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
  const region = words(application.region || "");
  const inRegion = region.size
    ? listed.filter((task) => [...words(task.region)].some((word) => region.has(word)))
    : [];

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
    {
      id: "open_tasks_in_region",
      label: "Open site jobs in their region",
      passed: inRegion.length > 0,
      detail: !region.size
        ? "No region given"
        : inRegion.length
          ? `${inRegion.length} listed: ${inRegion.slice(0, 3).map((task) => task.title).join("; ")}`
          : `None of ${listed.length} listed job${listed.length === 1 ? "" : "s"} mention ${application.region}`,
    },
  ];
  return {
    checks,
    clearFit: workEmail && matches,
    listedTaskCount: listed.length,
    assessedAtIso: now.toISOString(),
  };
}

/** At this many listed tasks, browsing may be worth discussing with the owner. */
export const OPEN_LIBRARY_SUGGESTED_AT_TASKS = 10;
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
