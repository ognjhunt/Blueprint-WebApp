/** Site-stated interest only. These answers do not authorize a visit or commit a purchase. */
export const pilotConsiderationOptions = [
  { value: "yes", label: "Yes, if the evaluation shows a fit" },
  { value: "subject_to_review", label: "Possibly, after internal review" },
  { value: "evaluation_only", label: "Evaluation only" },
  { value: "undecided", label: "We have not decided" },
] as const;

export const deploymentPathOptions = [
  { value: "this_site", label: "Paid deployment at this site" },
  { value: "multiple_sites", label: "Potential rollout to multiple sites" },
  { value: "pilot_only", label: "Pilot only" },
  { value: "undecided", label: "We have not decided" },
] as const;

export const siteVisitOptions = [
  { value: "yes", label: "Yes, for a scoped visit or pilot" },
  { value: "subject_to_approval", label: "Possibly, subject to site approval" },
  { value: "no", label: "No on-site robot-team work" },
  { value: "undecided", label: "We have not decided" },
] as const;

export type PilotConsideration = (typeof pilotConsiderationOptions)[number]["value"];
export type DeploymentPath = (typeof deploymentPathOptions)[number]["value"];
export type SiteVisitAnswer = (typeof siteVisitOptions)[number]["value"];
export type SitePilotIntent = { pilotConsideration: PilotConsideration; deploymentPath: DeploymentPath };

export function sitePilotIntentFrom(value: unknown): SitePilotIntent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const pilotConsideration = pilotConsiderationOptions.find((option) => option.value === record.pilotConsideration)?.value;
  const deploymentPath = deploymentPathOptions.find((option) => option.value === record.deploymentPath)?.value;
  return pilotConsideration && deploymentPath ? { pilotConsideration, deploymentPath } : null;
}

export function optionLabel<T extends string>(options: readonly { value: T; label: string }[], value: T | null | undefined): string {
  return options.find((option) => option.value === value)?.label ?? "Not recorded";
}
