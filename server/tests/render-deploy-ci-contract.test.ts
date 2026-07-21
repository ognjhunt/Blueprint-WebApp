// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Render deploy-on-green contract", () => {
  it("disables Render autoDeploy and deploys only after the full CI workflow passes", () => {
    const repoRoot = process.cwd();
    const renderYaml = fs.readFileSync(path.join(repoRoot, "render.yaml"), "utf-8");
    const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf-8");
    const deployWorkflow = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/deploy.yml"),
      "utf-8",
    );
    const deploymentDoc = fs.readFileSync(path.join(repoRoot, "DEPLOYMENT.md"), "utf-8");

    expect(renderYaml).toContain("autoDeploy: false");
    expect(renderYaml).not.toContain("autoDeploy: true");

    expect(ciWorkflow).not.toContain("deploy-render:");
    expect(ciWorkflow).not.toContain("RENDER_DEPLOY_HOOK_URL");

    expect(deployWorkflow).toContain('workflows: ["CI"]');
    expect(deployWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deployWorkflow).toContain("WORKFLOW_RUN_SHA: ${{ github.event.workflow_run.head_sha }}");
    expect(deployWorkflow).toContain("RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}");
    expect(deployWorkflow).toContain("RENDER_SERVICE_ID: ${{ vars.RENDER_SERVICE_ID }}");
    expect(deployWorkflow).toContain("RENDER_API_KEY secret is not set");
    expect(deployWorkflow).toContain("RENDER_SERVICE_ID Actions variable is missing or invalid");
    expect(deployWorkflow).toContain("https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys");
    expect(deployWorkflow).toContain("commitId");
    expect(deployWorkflow).toContain("${DEPLOY_REF}");
    expect(deployWorkflow).toContain("render-deploy.json");
    expect(deployWorkflow).toContain('"${BASE_URL}/version.json"');
    expect(deployWorkflow).toContain('"${BASE_URL}/health/ready"');

    expect(deploymentDoc).toContain("Render `autoDeploy` is disabled");
    expect(deploymentDoc).toContain("deploy-on-green");
    expect(deploymentDoc).toContain("full `CI` workflow succeeds");
    expect(deploymentDoc).toContain("RENDER_API_KEY");
    expect(deploymentDoc).toContain("RENDER_SERVICE_ID");
  });
});
