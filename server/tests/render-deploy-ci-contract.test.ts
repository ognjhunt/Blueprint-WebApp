// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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
    expect(deployWorkflow).toContain(
      "RENDER_WORKER_SERVICE_ID: ${{ vars.RENDER_WORKER_SERVICE_ID }}",
    );
    expect(deployWorkflow).toContain("RENDER_API_KEY secret is not set");
    expect(deployWorkflow).toContain(
      "for service_var in RENDER_SERVICE_ID RENDER_WORKER_SERVICE_ID",
    );
    expect(deployWorkflow).toContain(
      "https://api.render.com/v1/services/${service_id}/deploys",
    );
    expect(deployWorkflow).toContain(
      'trigger_deploy "${RENDER_SERVICE_ID}" web',
    );
    expect(deployWorkflow).toContain(
      'trigger_deploy "${RENDER_WORKER_SERVICE_ID}" worker',
    );
    expect(deployWorkflow).toContain("commitId");
    expect(deployWorkflow).toContain("${DEPLOY_REF}");
    expect(deployWorkflow).toContain("render-${label}-deploy.json");
    expect(deployWorkflow).toContain("web_render_commit");
    expect(deployWorkflow).toContain("worker_render_commit");
    expect(deployWorkflow).toContain('"${BASE_URL}/version.json"');
    expect(deployWorkflow).toContain('"${BASE_URL}/health/ready"');

    expect(deploymentDoc).toContain("Render `autoDeploy` is disabled");
    expect(deploymentDoc).toContain("deploy-on-green");
    expect(deploymentDoc).toContain("full `CI` workflow succeeds");
    expect(deploymentDoc).toContain("RENDER_API_KEY");
    expect(deploymentDoc).toContain("RENDER_SERVICE_ID");
    expect(deploymentDoc).toContain("RENDER_WORKER_SERVICE_ID");
  });

  it("deploys automatically only main's current head, so a late green CI re-run cannot roll production back", () => {
    const repoRoot = process.cwd();
    const deployWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/deploy.yml"), "utf-8");
    const deploymentDoc = fs.readFileSync(path.join(repoRoot, "DEPLOYMENT.md"), "utf-8");

    expect(deployWorkflow).toContain('main_head=$(gh api "repos/${REPO}/commits/main" --jq .sha)');
    expect(deployWorkflow).toContain('if [ "${deploy_ref}" != "${main_head}" ]; then');
    expect(deployWorkflow).toContain('echo "stale=true" >> "${GITHUB_OUTPUT}"');
    // Checkout, predecessor capture, deploy and verification all stand down for stale completion.
    expect(deployWorkflow.match(/if: steps\.ref\.outputs\.stale != 'true'/g)?.length).toBe(4);
    expect(deployWorkflow).toContain("if: always() && steps.ref.outputs.stale != 'true'");
    expect(deploymentDoc).toContain("Only main's current head deploys automatically");
  });
});

describe("deploy verification survives a probe that gets no answer", () => {
  const workflow = () => fs.readFileSync(path.join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");
  const probeFunction = () => {
    const lines = workflow().split("\n"), start = lines.findIndex(line => line.trim() === "probe() {");
    const indent = lines[start].indexOf("probe");
    const end = lines.findIndex((line, index) => index > start && line === `${" ".repeat(indent)}}`);
    return lines.slice(start, end + 1).map(line => line.slice(indent)).join("\n");
  };
  // A fake curl that times out (exit 28) `failures` times, then answers `status`.
  const run = (script: string, failures: number, status: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-probe-"));
    fs.writeFileSync(path.join(dir, "curl"), `#!/bin/bash\nn=$(cat "${dir}/count" 2>/dev/null || echo 0); echo $((n+1)) > "${dir}/count"\n`
      + `if [ "$n" -lt ${failures} ]; then exit 28; fi\nprintf '${status}'\n`, { mode: 0o755 });
    const out = execFileSync("bash", ["-c", `set -euo pipefail\n${script}`], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, PROBE_RETRY_SECONDS: "0", BASE_URL: "http://deploy.invalid" } });
    return { out, calls: Number(fs.readFileSync(path.join(dir, "count"), "utf-8")) };
  };
  const probe = (url: string) => `${probeFunction()}\nprintf '%s' "$(probe "$BASE_URL${url}" /dev/null)"`;

  it("retries a timed-out health probe instead of ending the step and rolling back", () => {
    expect(run(probe("/health"), 2, "200")).toEqual({ out: "200", calls: 3 });
  });

  it("keeps any HTTP answer as the verdict, without retrying it", () => {
    expect(run(probe("/health/ready"), 0, "503")).toEqual({ out: "503", calls: 1 });
  });

  it("reports a probe that never answers as 0, which the gate refuses", () => {
    expect(run(probe("/health"), 99, "200")).toEqual({ out: "0", calls: 6 });
  });

  it("keeps polling /version.json after a timed-out request", () => {
    const poll = workflow().split("\n")
      .find(line => line.includes('deployed_sha=$({ curl -sf --max-time 20 "${BASE_URL}/version.json" || true; }'))!.trim();
    expect(run(`${poll}\nprintf 'continued:%s' "$deployed_sha"`, 1, "")).toEqual({ out: "continued:", calls: 1 });
  });
});
