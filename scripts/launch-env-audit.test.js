import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const nodeEnv = {
  PATH: process.env.PATH || "",
  NODE_ENV: "test",
};

function runAudit(args = [], extraEnv = {}) {
  return spawnSync(process.execPath, ["scripts/launch-env-audit.mjs", ...args], {
    cwd: repoRoot,
    env: { ...nodeEnv, ...extraEnv },
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

  it("does not count an Anthropic key whose base URL names another company's host", () => {
    const section = (stdout, title) => stdout.split(title)[1]?.split("\n\n")[0] ?? "";
    const own = runAudit([], { ANTHROPIC_API_KEY: "fixture-not-a-key" }).stdout;
    expect(section(own, "Required-ready")).toContain("Structured runtime provider");
    const elsewhere = runAudit([], { ANTHROPIC_API_KEY: "fixture-not-a-key", ANTHROPIC_BASE_URL: "https://api.other-company.example" }).stdout;
    expect(section(elsewhere, "Required-ready")).not.toContain("Structured runtime provider");
    expect(section(elsewhere, "Blocked-by-env")).toContain("Structured runtime provider");
  });
});
