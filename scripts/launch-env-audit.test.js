import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const nodeEnv = {
  PATH: process.env.PATH || "",
  NODE_ENV: "test",
};

function runAudit(args = []) {
  return spawnSync(process.execPath, ["scripts/launch-env-audit.mjs", ...args], {
    cwd: repoRoot,
    env: nodeEnv,
    encoding: "utf8",
  });
}

describe("launch env audit", () => {
  it("renders a local-first operator readiness report without failing on missing local credentials", () => {
    const result = runAudit();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Operator provider readiness report");
    expect(result.stdout).toContain("Required-ready");
    expect(result.stdout).toContain("Blocked-by-env");
    expect(result.stdout).toContain("Recommended-missing");
    expect(result.stdout).toContain("Needs-human");
    expect(result.stdout).toContain("Firebase Admin");
    expect(result.stdout).toContain("FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS");
  });

  it("can still act as a hard gate when explicitly requested", () => {
    const result = runAudit(["--require-ready"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Hard gate: failing because required runtime readiness is blocked by local env.");
  });
});
