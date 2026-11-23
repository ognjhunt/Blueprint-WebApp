/**
 * The fit checklist older applications carry (`RobotTeamAccessRecord.fit`), shown on the review page for those records.
 * New applications are not assessed: a person reads the name, work email, company and website, and decides.
 */
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

/** Compatibility metadata: invited beta admission always needs a person's decision. */
export function autoApproveMinimumTasks(): number | null {
  return null;
}
