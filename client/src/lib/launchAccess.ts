export type LaunchAccessRole =
  | "capturer"
  | "site_operator"
  | "capturer_and_site_operator";

export type LaunchAccessWaitlistPayload = {
  email: string;
  locationType: string;
  market: string;
  role: LaunchAccessRole;
  device: string;
  company?: string;
  notes?: string;
  phone?: string;
  source?: string;
};

const launchAccessRoleLabels: Record<LaunchAccessRole, string> = {
  capturer: "Boots-on-the-ground capturer",
  site_operator: "Site operator",
  capturer_and_site_operator: "Both",
};

const launchAccessLocationTypes: Record<LaunchAccessRole, string> = {
  capturer: "Future city capturer interest",
  site_operator: "Future city site operator interest",
  capturer_and_site_operator: "Future city power user interest",
};

export function getLaunchAccessRoleLabel(role: LaunchAccessRole): string {
  return launchAccessRoleLabels[role];
}

export function normalizeLaunchAccessCity(rawCity: string | null | undefined): string {
  return (rawCity || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildLaunchAccessWaitlistPayload(input: {
  email: string;
  city: string;
  role: LaunchAccessRole;
  company?: string;
  notes?: string;
  phone?: string;
  source?: string;
}): LaunchAccessWaitlistPayload {
  const city = normalizeLaunchAccessCity(input.city);
  const company = input.company?.trim() || undefined;
  const notes = input.notes?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  const source = input.source?.trim() || "capture_app_launch_access";
  const locationTypeBase = launchAccessLocationTypes[input.role];
  const locationType = company
    ? `${locationTypeBase} · ${company}`
    : locationTypeBase;

  return {
    email: input.email.trim().toLowerCase(),
    locationType,
    market: city,
    role: input.role,
    device: "launch_access_page",
    company,
    notes,
    phone,
    source,
  };
}
