import { buildCityLaunchBudgetPolicy, type CityLaunchBudgetTier } from "./cityLaunchPolicy";

export type FocusCityKey = "austin-tx" | "san-francisco-ca";

export type CityLaunchProfile = {
  key: string;
  city: string;
  shortLabel: string;
  launchPlaybookPath: string;
  demandPlaybookPath: string;
  systemDocPath: string;
  issueBundlePath: string;
  targetLedgerPath: string;
  budgetTier: CityLaunchBudgetTier;
  isFocusCity: boolean;
};

export type FocusCityProfile = CityLaunchProfile;

export const FOCUS_CITY_PROFILES: Record<FocusCityKey, FocusCityProfile> = {
  "austin-tx": {
    key: "austin-tx",
    city: "Austin, TX",
    shortLabel: "Austin",
    launchPlaybookPath: "ops/paperclip/playbooks/city-launch-austin-tx.md",
    demandPlaybookPath: "ops/paperclip/playbooks/city-demand-austin-tx.md",
    systemDocPath: "docs/city-launch-system-austin-tx.md",
    issueBundlePath: "ops/paperclip/playbooks/city-launch-austin-tx-execution-issue-bundle.md",
    targetLedgerPath: "ops/paperclip/playbooks/city-capture-target-ledger-austin-tx.md",
    budgetTier: "zero_budget",
    isFocusCity: true,
  },
  "san-francisco-ca": {
    key: "san-francisco-ca",
    city: "San Francisco, CA",
    shortLabel: "San Francisco",
    launchPlaybookPath: "ops/paperclip/playbooks/city-launch-san-francisco-ca.md",
    demandPlaybookPath: "ops/paperclip/playbooks/city-demand-san-francisco-ca.md",
    systemDocPath: "docs/city-launch-system-san-francisco-ca.md",
    issueBundlePath:
      "ops/paperclip/playbooks/city-launch-san-francisco-ca-execution-issue-bundle.md",
    targetLedgerPath:
      "ops/paperclip/playbooks/city-capture-target-ledger-san-francisco-ca.md",
    budgetTier: "zero_budget",
    isFocusCity: true,
  },
};

export function slugifyCityName(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeCityLabel(city: string) {
  const trimmed = city.trim();
  if (!trimmed) {
    return "City";
  }
  return trimmed.split(",")[0]?.trim() || trimmed;
}

function fallbackPlaybookPath(prefix: string, slug: string) {
  return `ops/paperclip/playbooks/${prefix}-${slug}.md`;
}

function fallbackDocPath(slug: string) {
  return `docs/city-launch-system-${slug}.md`;
}

export function resolveCityLaunchProfile(city: string, budgetTier?: CityLaunchBudgetTier) {
  const normalizedCity = city.trim();
  const slug = slugifyCityName(normalizedCity);
  const focusProfile = FOCUS_CITY_PROFILES[slug as FocusCityKey];
  if (focusProfile) {
    return {
      ...focusProfile,
      budgetTier: budgetTier || focusProfile.budgetTier,
    } satisfies CityLaunchProfile;
  }

  return {
    key: slug,
    city: normalizedCity,
    shortLabel: humanizeCityLabel(normalizedCity),
    launchPlaybookPath: fallbackPlaybookPath("city-launch", slug),
    demandPlaybookPath: fallbackPlaybookPath("city-demand", slug),
    systemDocPath: fallbackDocPath(slug),
    issueBundlePath: fallbackPlaybookPath("city-launch", `${slug}-execution-issue-bundle`),
    targetLedgerPath: fallbackPlaybookPath("city-capture-target-ledger", slug),
    budgetTier: budgetTier || buildCityLaunchBudgetPolicy().tier,
    isFocusCity: false,
  } satisfies CityLaunchProfile;
}

export function resolveFocusCityProfile(city: string): FocusCityProfile {
  return resolveCityLaunchProfile(city) as FocusCityProfile;
}
