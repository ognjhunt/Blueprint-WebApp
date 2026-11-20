// @vitest-environment node
/**
 * Settings shows the job-email switch as it actually stands (owner, 2026-11-20): on unless turned off in Settings. What
 * Settings shows and what the new-job send decides must agree for every saved source, so saving an unrelated change in
 * Settings never turns job emails off by accident.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));

import { companyWantsJobEmails } from "../utils/newJobAlerts";
import { buildUpdatePreferences, effectiveUpdatePreferences, savedUpdatePreferences } from "../utils/updatePreferences";
import type { UpdatePreferences } from "../../client/src/types/updatePreferences";

const saved = (source: UpdatePreferences["source"], newJobAlerts: boolean, version: UpdatePreferences["version"] = "optional-updates-v1") =>
  ({ newsletter: false, newJobAlerts, interests: {}, declaredCategories: {}, requirements: {}, source,
    updatedAtIso: "2026-11-03T00:00:00.000Z", version }) as UpdatePreferences;

describe("the job-email switch Settings shows", () => {
  it.each([
    ["no saved choice", null, true],
    ["the old bundled box at application, unticked", saved("application", false), true],
    ["the old bundled box at account setup, unticked", saved("signup", false), true],
    ["turned off in Settings", saved("settings", false, "optional-updates-v2"), false],
    ["turned on in Settings", saved("settings", true, "optional-updates-v2"), true],
  ] as const)("%s: Settings shows what the send decides", (_name, preferences, on) => {
    expect(effectiveUpdatePreferences(preferences)?.newJobAlerts ?? true).toBe(on);
    expect(companyWantsJobEmails({ updatePreferences: preferences ?? undefined })).toBe(on);
    expect(companyWantsJobEmails({ preferencesAccountUid: "uid-1" }, preferences ?? undefined)).toBe(on);
  });

  it("keeps every other saved choice as it was", () => {
    const application = { ...saved("application", false), newsletter: true };
    expect(effectiveUpdatePreferences(application)).toEqual({ ...application, newJobAlerts: true });
  });

  it("writes new choices as v2 and still reads v1 records", () => {
    expect(buildUpdatePreferences({ newsletter: false, newJobAlerts: true, interests: {}, declaredCategories: {}, requirements: {} },
      "settings").version).toBe("optional-updates-v2");
    expect(savedUpdatePreferences(saved("settings", false, "optional-updates-v1"))).not.toBeNull();
    expect(savedUpdatePreferences({ ...saved("settings", false), version: "optional-updates-v0" })).toBeNull();
  });
});
