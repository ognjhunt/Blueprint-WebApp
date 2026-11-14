// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
