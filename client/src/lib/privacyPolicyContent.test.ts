import { existsSync, readFileSync } from "node:fs";
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
  it("publishes one retention schedule with explicit windows", () => {
    expect(betaRetentionSchedule).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record: "Site footage and capture data",
          defaultWindow: "180 days after the task closes",
        }),
        expect.objectContaining({
          record: "Temporary processing files",
          defaultWindow: "14 days after processing succeeds",
        }),
        expect.objectContaining({
          record: "Scenes, evaluation results, pilot records and reports",
          defaultWindow: "365 days after the task closes or the contract ends",
        }),
        expect.objectContaining({
          record: "Support and privacy requests",
          defaultWindow: "90 days after the request is closed",
        }),
      ]),
    );
  });

  it("states one response time and names every provider that can receive personal data", () => {
    const steps = privacyRightsRequestSteps.join(" ");
    expect(steps).toContain("privacy@tryblueprint.io");
    expect(steps).toContain("10 business days");
    expect(steps).toContain("30 calendar days");
    const providers = privacySubprocessorCategories.flatMap((group) => group.providers.map(([name]) => name)).join(" | ");
    for (const name of ["Resend", "PostHog", "Google Analytics", "Sentry", "Google Gemini", "OpenAI", "Stripe", "Render", "Backblaze B2"]) {
      expect(providers).toContain(name);
    }
    expect(betaResidencyTransferRows.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Where we operate", "Outside the United States", "Provider limits"]),
    );
  });

  it("keeps a single retention schedule and no internal jargon on the page", () => {
    const source = readFileSync(join(pagesDirectory, "Privacy.tsx"), "utf8");
    expect(source.match(/<LegalRows rows=\{betaRetentionSchedule/g)).toHaveLength(1);
    expect(source).not.toMatch(/capture truth|Task Evaluation Run|hosted-session|--/);
  });

  it("does not keep the stale PrivacyPolicy stub in the routed page folder", () => {
    expect(existsSync(join(pagesDirectory, "PrivacyPolicy.tsx"))).toBe(false);
  });
});
