import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDefaultScanTargets,
  renderClaimsGuardReport,
  scanClaims,
} from "./cross-source-claims-guard";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

describe("cross-source claims guard", () => {
  it("blocks the required operational-proof drift negative controls", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["scripts/claims/fixtures/negative"],
      writeReports: false,
    });

    expect(result.findingsByType.no_change_churn).toBeGreaterThan(0);
    expect(result.findingsByType.unsupported_hosted_session_proof).toBeGreaterThan(0);
    expect(result.findingsByType.public_copy_proof_drift).toBeGreaterThan(0);
    expect(result.findingsByType.unsupported_robot_readiness_claim).toBeGreaterThan(0);
    expect(result.findingsByType.stale_payment_payout_provider_doc).toBeGreaterThan(0);
    expect(result.findingsByType.city_live_claim).toBeGreaterThan(0);
    expect(result.findingsByType.customer_or_traction_claim).toBeGreaterThan(0);
    expect(result.findingsByType.rights_cleared_claim).toBeGreaterThan(0);
    expect(result.findingsByType.support_guarantee_claim).toBeGreaterThan(0);
  });

  it("preserves confident Public Launch Ready copy with request-scoped proof boundaries", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["scripts/claims/fixtures/allowed"],
      writeReports: false,
    });

    expect(result.findings).toEqual([]);
  });

  it("allows explicit negative proof-boundary lines that name blocked payment, payout, and provider claims", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["server/routes/requests.ts"],
      writeReports: false,
    });

    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "server/routes/requests.ts",
          line: 27,
          type: "payment_or_payout_claim",
        }),
      ]),
    );
  });

  it("renders exact file and line evidence with proof owners and safe replacements", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["scripts/claims/fixtures/negative/unsupported-hosted-session-proof.md"],
      writeReports: false,
    });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]).toMatchObject({
      file: "scripts/claims/fixtures/negative/unsupported-hosted-session-proof.md",
      line: 1,
      type: "unsupported_hosted_session_proof",
    });
    expect(result.findings[0].ownerProofRequired).toContain("hosted-session");
    expect(result.findings[0].safeReplacement).toContain("book hosted review");

    const report = renderClaimsGuardReport(result);

    expect(report).toContain("| File | Line | Claim type | Claim text | Owner proof required | Safe replacement |");
    expect(report).toContain("scripts/claims/fixtures/negative/unsupported-hosted-session-proof.md");
    expect(report).toContain("unsupported_hosted_session_proof");
  });

  it("defaults to the cross-source surfaces named by the goal", () => {
    const targets = buildDefaultScanTargets(repoRoot).map((target) => target.relativePath);

    expect(targets).toContain("client/src/pages");
    expect(targets).toContain("../BlueprintCapture/docs/PUBLIC_COPY_TRUTH_INDEX_2026-05-24.md");
    expect(targets).toContain("scripts/gtm");
    expect(targets).toContain("ops/paperclip/playbooks");
    expect(targets).toContain("knowledge/reports");
    expect(targets).toContain("output");
  });
});
