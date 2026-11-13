// @vitest-environment node
/**
 * A job's Privacy version for the provider gate is written once, when the job is created, and by nothing else:
 * a later acceptance on the job's page, a claim or a setup never moves a job to a newer version.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordingConsentWrite } from "../utils/jobSharedListing";
import { RECORDING_RIGHTS_STATEMENT_V4_VERSION, RECORDING_RIGHTS_STATEMENT_VERSION } from "../../client/src/lib/recordingRightsStatement";

const ROOT = path.resolve(__dirname, "../..");
function sources(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "tests" || entry.name === "node_modules" ? [] : sources(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

describe("privacy_version_at_submission", () => {
  it("is written only by the intake that creates the job", () => {
    const writers = [...sources("server"), ...sources("client/src"), ...sources("scripts")]
      .filter((file) => /privacy_version_at_submission\s*:/.test(fs.readFileSync(path.join(ROOT, file), "utf8")));
    expect(writers).toEqual(["server/routes/inbound-request.ts"]);
  });

  it.each([
    ["an older job with no acceptance", { request: { buyerType: "site_operator" } }],
    ["a job submitted under 2026-11-12.2", { request: { buyerType: "site_operator" }, privacy_version_at_submission: "2026-11-12.2",
      terms_acceptance: { accepted_terms: true, terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" } }],
  ])("is left alone when the site accepts on the job's page: %s", (_name, record) => {
    for (const [statementVersion, hasCurrentGrant] of [[RECORDING_RIGHTS_STATEMENT_V4_VERSION, false],
      [RECORDING_RIGHTS_STATEMENT_V4_VERSION, true], [RECORDING_RIGHTS_STATEMENT_VERSION, false]] as const) {
      const stored = hasCurrentGrant ? { ...record, request: { ...record.request,
        consent_attestation: { granted: true, statement_version: RECORDING_RIGHTS_STATEMENT_VERSION } } } : record;
      const write = recordingConsentWrite({ record: stored, statementVersion, atIso: "2026-11-13T10:00:00.000Z",
        taskStatement: "Move totes", hasCurrentGrant, canGrantInitial: true, revoked: false });
      if (write.outcome === "held") continue;
      expect(write.request ?? {}).not.toHaveProperty("privacy_version_at_submission");
      expect(write.listing ?? {}).not.toHaveProperty("privacy_version_at_submission");
    }
  });
});
