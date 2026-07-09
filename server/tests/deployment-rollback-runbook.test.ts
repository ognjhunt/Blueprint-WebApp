// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("deployment rollback and beta incident runbook", () => {
  it("documents a non-destructive rollback path and beta incident closeout requirements", () => {
    const repoRoot = process.cwd();
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> };
    const rollbackScript = fs.readFileSync(
      path.join(repoRoot, "scripts/deploy-rollback.mjs"),
      "utf-8",
    );
    const deploymentDoc = fs.readFileSync(
      path.join(repoRoot, "DEPLOYMENT.md"),
      "utf-8",
    );
    const runbook = fs.readFileSync(
      path.join(repoRoot, "docs/beta-ops-incident-runbook-2026-07-08.md"),
      "utf-8",
    );

    expect(packageJson.scripts?.["deploy:rollback"]).toBe("node scripts/deploy-rollback.mjs");
    expect(rollbackScript).toContain('run("git", ["revert", "--no-edit", ...commits])');
    expect(rollbackScript).not.toContain("reset --hard");
    expect(deploymentDoc).toContain("npm run deploy:rollback");
    expect(deploymentDoc).toContain("docs/beta-ops-incident-runbook-2026-07-08.md");
    expect(runbook).toContain("Primary owner:");
    expect(runbook).toContain("Takedown And Access Freeze");
    expect(runbook).toContain("Customer Communications");
    expect(runbook).toContain("Rollback evidence required before closing");
  });
});
