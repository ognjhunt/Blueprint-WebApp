// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Render deploy-on-green contract", () => {
  it("disables Render autoDeploy and deploys only after the full CI workflow passes", () => {
    const repoRoot = process.cwd();
    const renderYaml = fs.readFileSync(path.join(repoRoot, "render.yaml"), "utf-8");
    const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf-8");
    const deploymentDoc = fs.readFileSync(path.join(repoRoot, "DEPLOYMENT.md"), "utf-8");

    expect(renderYaml).toContain("autoDeploy: false");
    expect(renderYaml).not.toContain("autoDeploy: true");

    expect(ciWorkflow).toContain("deploy-render:");
    expect(ciWorkflow).toContain("needs: [check, test, e2e, build]");
    expect(ciWorkflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(ciWorkflow).toContain("RENDER_DEPLOY_HOOK_URL");
    expect(ciWorkflow).toContain("::error::RENDER_DEPLOY_HOOK_URL is required for deploy-on-green.");
    expect(ciWorkflow).toContain('"${RENDER_DEPLOY_HOOK_URL}${separator}ref=${GITHUB_SHA}"');
    expect(ciWorkflow).toContain("curl --fail --show-error --silent --request POST");

    expect(deploymentDoc).toContain("Render `autoDeploy` is disabled");
    expect(deploymentDoc).toContain("deploy-on-green");
    expect(deploymentDoc).toContain("check`, `test`,");
    expect(deploymentDoc).toContain("`e2e`, and `build` pass");
    expect(deploymentDoc).toContain("RENDER_DEPLOY_HOOK_URL");
  });
});
