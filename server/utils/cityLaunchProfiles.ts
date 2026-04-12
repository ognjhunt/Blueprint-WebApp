export type FocusCityKey = "austin-tx" | "san-francisco-ca";

export type FocusCityProfile = {
  key: FocusCityKey;
  city: string;
  shortLabel: string;
  launchPlaybookPath: string;
  demandPlaybookPath: string;
  systemDocPath: string;
  issueBundlePath: string;
  targetLedgerPath: string;
};

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
  },
};

export function slugifyCityName(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveFocusCityProfile(city: string): FocusCityProfile {
  const slug = slugifyCityName(city);
  const profile = FOCUS_CITY_PROFILES[slug as FocusCityKey];
  if (!profile) {
    throw new Error(
      `Execution harness is currently scoped to active focus cities only. Unsupported city: ${city}.`,
    );
  }
  return profile;
}
