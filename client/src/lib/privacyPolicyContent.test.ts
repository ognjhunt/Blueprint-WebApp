import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  betaResidencyTransferRows,
  betaRetentionSchedule,
  privacyRightsRequestSteps,
  privacySubprocessorCategories,
} from "@/pages/Privacy";

const pagesDirectory = join(process.cwd(), "client", "src", "pages");

describe("privacy policy content", () => {
  it("publishes explicit beta retention windows", () => {
    expect(betaRetentionSchedule).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record: "Raw capture truth and provenance",
          defaultWindow: "180 days after beta package closeout",
        }),
        expect.objectContaining({
          record: "Temporary processing files",
          defaultWindow: "14 days after successful packaging",
        }),
        expect.objectContaining({
          record: "Buyer package and hosted-session artifacts",
          defaultWindow: "365 days after package closeout or contract end",
        }),
        expect.objectContaining({
          record: "Support, privacy request, and operational evidence",
          defaultWindow: "90 days after ticket or request closeout",
        }),
      ]),
    );
  });

  it("explains DSR handling, subprocessor categories, and transfer gates", () => {
    expect(privacyRightsRequestSteps.join(" ")).toContain("privacy@tryblueprint.io");
    expect(privacyRightsRequestSteps.join(" ")).toContain("10 business days");
    expect(privacyRightsRequestSteps.join(" ")).toContain("30 calendar days");
    expect(privacySubprocessorCategories.map((item) => item.category)).toEqual(
      expect.arrayContaining([
        "Cloud hosting and storage",
        "Payments and payouts",
        "Communication, analytics, and support",
        "Authorized model or runtime providers",
      ]),
    );
    expect(betaResidencyTransferRows.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "External beta default",
        "Non-US participation",
        "Provider boundaries",
      ]),
    );
  });

  it("does not keep the stale PrivacyPolicy stub in the routed page folder", () => {
    expect(existsSync(join(pagesDirectory, "PrivacyPolicy.tsx"))).toBe(false);
  });
});
