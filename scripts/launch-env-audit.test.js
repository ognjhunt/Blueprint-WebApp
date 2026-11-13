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

  it("asks for the removed providers' settings to be deleted, naming them and never their values", () => {
    const stdout = runAudit([], { DEEPSEEK_API_KEY: "left-over-value", ZAI_API_KEY: "left-over-value",
      ANTHROPIC_BASE_URL: "https://api.other-company.example" }).stdout;
    expect(stdout).toContain("Settings of removed providers");
    expect(stdout).toContain("DEEPSEEK_API_KEY, ZAI_API_KEY, ANTHROPIC_BASE_URL");
    expect(stdout).not.toContain("left-over-value");
    expect(stdout).not.toContain("other-company");
    expect(runAudit([], { ANTHROPIC_BASE_URL: "https://api.anthropic.com" }).stdout).not.toContain("Settings of removed providers");
  });

  it("does not count an OpenAI key whose base URL names another host, and says why without the value", () => {
    const section = (stdout, title) => stdout.split(title)[1]?.split("\n\n")[0] ?? "";
    const own = runAudit([], { OPENAI_API_KEY: "fixture-not-a-key", OPENAI_BASE_URL: "https://api.openai.com/v1" }).stdout;
    expect(section(own, "Required-ready")).toContain("Structured runtime provider");
    const elsewhere = runAudit([], { OPENAI_API_KEY: "fixture-not-a-key", OPENAI_BASE_URL: "https://compat.other-company.example/v1" }).stdout;
    expect(section(elsewhere, "Blocked-by-env")).toContain("Structured runtime provider");
    expect(elsewhere).toContain("openai_base_url_names_another_host");
    expect(elsewhere).toContain("OPENAI_BASE_URL");
    expect(elsewhere).not.toContain("other-company");
  });

  it("lists every left-over setting of a removed provider by name: base URLs, models and provider settings naming one", () => {
    const stdout = runAudit([], {
      ZAI_BASE_URL: "https://left-over.example", DEEPSEEK_BASE_URL: "https://left-over.example",
      OPENROUTER_BASE_URL: "https://left-over.example", BLUEPRINT_OPENROUTER_VIDEO_MODEL: "left-over-model",
      BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER: "deepseek_chat", BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER: "zai_glm",
      BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER: "deepseek_chat", BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER: "deepseek_chat",
      // A provider setting naming a kept provider is not a left-over.
      BLUEPRINT_SUPPORT_TRIAGE_PROVIDER: "openai_responses",
    }).stdout;
    for (const name of ["ZAI_BASE_URL", "DEEPSEEK_BASE_URL", "OPENROUTER_BASE_URL", "BLUEPRINT_OPENROUTER_VIDEO_MODEL",
      "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
      "BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER"]) {
      expect(stdout).toContain(name);
    }
    expect(stdout).not.toContain("BLUEPRINT_SUPPORT_TRIAGE_PROVIDER");
    expect(stdout).not.toContain("left-over");
  });

  it("the alpha preflight applies the same OpenAI host rule and names left-over settings without values", () => {
    const run = (extraEnv) => spawnSync(process.execPath, ["scripts/launch-preflight.mjs"], {
      cwd: repoRoot, env: { ...nodeEnv, ...extraEnv }, encoding: "utf8" });
    const elsewhere = run({ OPENAI_API_KEY: "fixture-not-a-key", OPENAI_BASE_URL: "https://compat.other-company.example/v1",
      BLUEPRINT_OUTBOUND_OUTREACH_PROVIDER: "zai_glm" });
    const output = elsewhere.stdout + elsewhere.stderr;
    expect(output).toContain("One structured automation provider is required");
    expect(output).toContain("openai_base_url_names_another_host");
    expect(output).toContain("BLUEPRINT_OUTBOUND_OUTREACH_PROVIDER");
    expect(output).not.toContain("other-company");
    const own = run({ OPENAI_API_KEY: "fixture-not-a-key" });
    expect(own.stdout + own.stderr).not.toContain("One structured automation provider is required");
  });
});
