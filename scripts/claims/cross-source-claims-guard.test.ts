import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  buildDefaultScanTargets,
  renderClaimsGuardReport,
  scanClaims,
} from "./cross-source-claims-guard";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

describe("cross-source claims guard", () => {
  it("finds unsupported capture derivation in default routes, components and API text even with a physical-proof caveat", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "blueprint-claims-surfaces-"));
    try {
      const files = ["server/routes/site-content.ts", "client/src/components/site/Example.tsx", "client/public/agent-access.openapi.json"];
      for (const file of files) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), 'A simulation built from your site; not physical proof.');
      }
      const result = await scanClaims({ rootDir: root, writeReports: false });
      for (const file of files) expect(result.findings).toContainEqual(expect.objectContaining({
        file, type: "unsupported_capture_derivation_claim",
      }));
      await writeFile(path.join(root, files[0]), "A simplified simulation of your task, informed by your footage.");
      const repaired = await scanClaims({ rootDir: root, targets: [files[0]], writeReports: false });
      expect(repaired.findings).toEqual([]);
      await writeFile(path.join(root, files[0]), [
        'const blockedClaims = ["real-world accuracy"];',
        'const section = { aliases: ["deployment ready"] };',
        'logger.info("Hosted session reset runtime inputs resolved");',
        'const response = "A simulation built from your site; not physical proof.";',
      ].join("\n"));
      const mixed = await scanClaims({ rootDir: root, targets: [files[0]], writeReports: false });
      expect(mixed.findings).toEqual([expect.objectContaining({ line: 4, type: "unsupported_capture_derivation_claim" })]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("blocks the required operational-proof drift negative controls", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["scripts/claims/fixtures/negative"],
      writeReports: false,
    });

    expect(result.findingsByType.no_change_churn).toBeGreaterThan(0);
    expect(result.findingsByType.stale_root_doctrine).toBeGreaterThan(0);
    expect(result.findingsByType.unsupported_hosted_session_proof).toBeGreaterThan(0);
    expect(result.findingsByType.public_copy_proof_drift).toBeGreaterThan(0);
    expect(result.findingsByType.unsupported_rank_fidelity_claim).toBeGreaterThan(0);
    expect(result.findingsByType.unsupported_robot_eval_dataset_claim).toBeGreaterThan(0);
    expect(result.findingsByType.stale_payment_payout_provider_doc).toBeGreaterThan(0);
    expect(result.findingsByType.city_live_claim).toBeGreaterThan(0);
    expect(result.findingsByType.customer_or_traction_claim).toBeGreaterThan(0);
    expect(result.findingsByType.rights_cleared_claim).toBeGreaterThan(0);
    expect(result.findingsByType.support_guarantee_claim).toBeGreaterThan(0);
  });

  it("blocks standalone Sim2Real guarantee claims", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["scripts/claims/fixtures/negative/unsupported-quality-guarantee-claim.md"],
      writeReports: false,
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "unsupported_rank_fidelity_claim",
        }),
      ]),
    );
  });

  it("blocks public rank-fidelity report claims", async () => {
    const result = await scanClaims({
      rootDir: repoRoot,
      targets: ["scripts/claims/fixtures/negative/unsupported-rank-fidelity-report-claim.md"],
      writeReports: false,
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "unsupported_rank_fidelity_claim",
        }),
      ]),
    );
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
    for (const surface of ["client/src/components", "client/public/agent-access.openapi.json", "client/public/samples",
      "server/routes", "server/retrieval", "server/agents", "server/utils/robot-agent-contract.ts"]) {
      expect(targets).toContain(surface);
    }
    expect(targets).toContain("AGENTS.md");
    expect(targets).toContain("VISION.md");
    expect(targets).toContain("PLATFORM_CONTEXT.md");
    expect(targets).toContain("WORLD_MODEL_STRATEGY_CONTEXT.md");
    expect(targets).toContain("ops/paperclip/blueprint-company/agents");
    expect(targets).toContain("ops/paperclip/blueprint-company/skills");
    expect(targets).toContain("ops/paperclip/blueprint-company/tasks");
    expect(targets).toContain("ops/paperclip/programs");
    expect(targets).toContain("knowledge/compiled/playbooks/platform-doctrine.md");
    expect(targets).toContain("../BlueprintCapture/docs/PUBLIC_COPY_TRUTH_INDEX_2026-05-24.md");
    expect(targets).toContain("scripts/gtm");
    expect(targets).toContain("ops/paperclip/playbooks");
    expect(targets).toContain("knowledge/reports");
    expect(targets).toContain("output");
  });

  it("scans the builders of messages sites and robot teams receive", () => {
    const targets = buildDefaultScanTargets(repoRoot);
    const groupOf = (relativePath: string) => targets.find((target) => target.relativePath === relativePath)?.sourceGroup;

    expect(groupOf("server/utils/qualificationEmails.ts")).toBe("customer_messages");
    // Picked up by name, so a new notification builder is scanned without being listed.
    expect(groupOf("server/utils/taskLifecycleNotifications.ts")).toBe("customer_messages");
    expect(groupOf("server/utils/robotTeamNotifications.ts")).toBe("customer_messages");
    expect(groupOf("client/public/llms.txt")).toBe("agent_public_text");
    expect(groupOf("client/public/llms-full.txt")).toBe("agent_public_text");
  });
});
