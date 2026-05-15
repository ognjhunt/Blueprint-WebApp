import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const agentsRoot = path.resolve("ops/paperclip/blueprint-company/agents");
const issueBoundScopeLine =
  "When `PAPERCLIP_TASK_ID` or another issue-bound wake context is present, treat that issue as the sole execution scope for the run.";
const bindingFailureLine =
  "If an issue-bound wake arrives without `PAPERCLIP_TASK_ID`, treat that as a binding failure.";
const closeoutPatchLine = "Close issues only with `PATCH /api/issues/$ISSUE_ID`.";
const closeoutStatusesLine = "Valid terminal statuses are `done` and `blocked` only.";
const closeoutCompletedLine = 'Never send `status: "completed"`.';
const preferredCliLine =
  "For checkout, release, status updates, and comments, prefer `npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue ...` so the CLI serializes JSON safely and forwards `PAPERCLIP_RUN_ID` automatically.";
const missingJwtCliFallbackLine =
  'If PAPERCLIP_API_KEY is missing on this trusted host and PAPERCLIP_TASK_ID is present, stop using auth-backed curl and switch to \'npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue get|checkout|update|comment "$PAPERCLIP_TASK_ID" ...\' for the bound issue.';
const noHermesPythonPaperclipDiscoveryLine =
  "Do not use the Hermes Python/execute_code tool for Paperclip API reads, auth/env discovery, or JSON parsing.";
const noSecretFileAuthDebugLine =
  "Never inspect, print, cat, grep, or find Paperclip secret/env/config files while debugging auth.";
const noLocalhostProbeBeforePaperclipLine =
  "On issue-bound runs, before probing any localhost web-app port such as `3000`, first use the injected `PAPERCLIP_API_URL` or the safe heartbeat snapshot fallback to resolve the bound issue context.";
const noPaperclipEnvDumpLine =
  "Never run `env`, `printenv`, `set`, `export`, or broad `rg`/`grep` commands that print `PAPERCLIP_*`, API key, token, cookie, or secret values.";
const sharedEvidenceChecklistLine = "docs/autonomous-loop-evidence-checklist-2026-05-03.md";
const goalCloseoutFields = [
  "Goal objective:",
  "Issue/run id:",
  "Budget/timeout context:",
  "Stage reached:",
  "State claimed:",
  "Owner:",
  "Blocker/decision id:",
  "Proof paths:",
  "Command outputs:",
  "Next action:",
  "Retry/resume condition:",
  "Residual risk:",
];

async function collectAgentInstructionFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectAgentInstructionFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name === "AGENTS.md") {
      files.push(fullPath);
    }
  }

  return files.sort();
}

describe("Blueprint Paperclip agent instruction guards", () => {
  it("keeps issue-bound scope and raw closeout contract on agents that mutate Paperclip issues directly", async () => {
    const files = await collectAgentInstructionFiles(agentsRoot);
    const directPaperclipAgents: string[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      if (
        content.includes(
          "For mutating Paperclip calls, include both `Authorization: Bearer $PAPERCLIP_API_KEY` and `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID`.",
        )
      ) {
        directPaperclipAgents.push(file);
        expect(content, `${file} is missing the issue-bound scope guard`).toContain(issueBoundScopeLine);
        expect(content, `${file} is missing the binding-failure guard`).toContain(bindingFailureLine);
        expect(content, `${file} is missing the raw closeout patch guard`).toContain(closeoutPatchLine);
        expect(content, `${file} is missing the raw closeout status guard`).toContain(closeoutStatusesLine);
        expect(content, `${file} is missing the invalid completed-status guard`).toContain(closeoutCompletedLine);
        expect(content, `${file} is missing the Paperclip CLI mutation guard`).toContain(preferredCliLine);
      }
    }

    expect(directPaperclipAgents.length).toBeGreaterThan(0);
  });

  it("keeps the no-JWT trusted-host CLI fallback in the shared Hermes reconcile template", async () => {
    const reconcilePath = path.resolve("scripts/paperclip/reconcile-blueprint-paperclip-company.sh");
    const content = await fs.readFile(reconcilePath, "utf8");

    expect(content).toContain(missingJwtCliFallbackLine);
    expect(content).toContain(noHermesPythonPaperclipDiscoveryLine);
    expect(content).toContain(noSecretFileAuthDebugLine);
  });

  it("keeps Codex-authored lanes from being demoted to Hermes on transient probe failure", async () => {
    const reconcilePath = path.resolve("scripts/paperclip/reconcile-blueprint-paperclip-company.sh");
    const content = await fs.readFile(reconcilePath, "utf8");
    const chooseAdapterStart = content.indexOf("function chooseAdapterForAgent");
    const codexGuard = content.indexOf("if (desired.adapterType === \"codex_local\")", chooseAdapterStart);
    const hermesMode = content.indexOf("if (requestedMode === \"hermes\")", chooseAdapterStart);

    expect(codexGuard).toBeGreaterThan(chooseAdapterStart);
    expect(codexGuard).toBeLessThan(hermesMode);
    expect(content).toContain("adapter lanes during reconcile. A transient probe timeout is a verifier");
    expect(content).toContain("blocker, not a reason to demote the live primary adapter to Hermes.");
  });

  it("does not preserve fixed live adapter policy when repo-authored adapter differs", async () => {
    const reconcilePath = path.resolve("scripts/paperclip/reconcile-blueprint-paperclip-company.sh");
    const content = await fs.readFile(reconcilePath, "utf8");

    expect(content).toContain("agent.adapterType === desired.adapterType");
    expect(content).toContain("&& shouldPreserveFixedLiveAdapter(");
  });

  it("keeps project reconcile from recreating legacy normalized Capture projects", async () => {
    const reconcilePath = path.resolve("scripts/paperclip/reconcile-blueprint-paperclip-company.sh");
    const content = await fs.readFile(reconcilePath, "utf8");

    expect(content).toContain("function pickCanonicalProject");
    expect(content).toContain("normalizeLookupKey(projectKey)");
    expect(content).toContain("projectWorkspaceMatches(project, workspaceConfig)");
    expect(content).toContain("const existing = pickCanonicalProject(projects, projectKey, projectConfig);");
  });

  it("keeps workspace cooldowns from demoting configured Codex primary lanes", async () => {
    const workerPath = path.resolve("ops/paperclip/plugins/blueprint-automation/src/worker.ts");
    const content = await fs.readFile(workerPath, "utf8");

    expect(content).toContain("function shouldPreserveConfiguredCodexPrimary");
    expect(content).toContain("function wouldDemoteConfiguredCodexPrimary");
    expect(content).toContain("preserveConfiguredCodexPrimary || (isOrgForcedCodexMode() && desired.adapterType === \"codex_local\")");
    expect(content).toContain("Suppressed fallback to ${targetFallback.adapterType} because ${targetLabel} is configured as a Codex primary lane.");
    expect(content).toContain("Suppressed fallback to ${fallback.adapterType} because ${targetLabel} is configured as a Codex primary lane.");
  });

  it("keeps blocked follow-up cleanup covering same-objective duplicate siblings", async () => {
    const workerPath = path.resolve("ops/paperclip/plugins/blueprint-automation/src/worker.ts");
    const content = await fs.readFile(workerPath, "utf8");

    expect(content).toContain("function findDuplicateBlockedFollowUpCanonical");
    expect(content).toContain("sameBlockedFollowUpObjective(candidate.title, issue.title)");
    expect(content).toContain("const canonical = ancestor ?? findDuplicateBlockedFollowUpCanonical(issue, issues);");
    expect(content).toContain("Automation merged ${collapseKind} blocker follow-up");
    expect(content).toContain("maxIssues: 100");
  });

  it("keeps the chief of staff heartbeat pinned to the assigned issue on issue_assigned wakes", async () => {
    const heartbeatPath = path.resolve(
      "ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/Heartbeat.md",
    );
    const content = await fs.readFile(heartbeatPath, "utf8");

    expect(content).toContain("issue assigned: start from `PAPERCLIP_TASK_ID` as the sole execution scope.");
  });

  it("keeps WebApp Codex and Review issue-bound wakes pinned to Paperclip before localhost probes", async () => {
    const guardedFiles = [
      path.resolve("ops/paperclip/blueprint-company/agents/webapp-codex/AGENTS.md"),
      path.resolve("ops/paperclip/blueprint-company/agents/webapp-review/AGENTS.md"),
    ];

    for (const file of guardedFiles) {
      const content = await fs.readFile(file, "utf8");
      expect(content, `${file} is missing the Paperclip-before-localhost guard`).toContain(
        noLocalhostProbeBeforePaperclipLine,
      );
      expect(content, `${file} is missing the no-secret-env-dump guard`).toContain(noPaperclipEnvDumpLine);
    }
  });

  it("keeps WebApp Codex goal-style runs tied to Paperclip evidence closeout", async () => {
    const configPath = path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml");
    const instructionsPath = path.resolve("ops/paperclip/blueprint-company/agents/webapp-codex/AGENTS.md");
    const config = yaml.load(await fs.readFile(configPath, "utf8")) as {
      agents?: Record<string, { adapter?: { config?: Record<string, unknown> } }>;
    };
    const webappCodexConfig = config.agents?.["webapp-codex"]?.adapter?.config ?? {};
    const instructions = await fs.readFile(instructionsPath, "utf8");

    expect(webappCodexConfig.paperclipGoalPromptEnabled).toBe(true);
    expect(instructions).toContain("Goal-style Codex runs");
    for (const field of goalCloseoutFields) {
      expect(instructions, `webapp-codex instructions must preserve ${field}`).toContain(field);
    }
    expect(instructions).toContain(
      "State claimed must be exactly one of: `done`, `blocked`, or `awaiting_human_decision`.",
    );
    expect(instructions).toContain("Blocked closeouts must name the earliest hard stop, owner, and retry/resume condition.");
    expect(instructions).toContain("Do not claim native `/goal` status unless Codex CLI state or run artifacts prove it.");
  });

  it("keeps cross-repo autonomy loops pinned to the shared evidence checklist", async () => {
    const guardedFiles = [
      path.resolve("ops/paperclip/blueprint-company/tasks/webapp-autonomy-loop/TASK.md"),
      path.resolve("ops/paperclip/blueprint-company/tasks/capture-autonomy-loop/TASK.md"),
      path.resolve("ops/paperclip/blueprint-company/tasks/pipeline-autonomy-loop/TASK.md"),
    ];

    for (const file of guardedFiles) {
      const content = await fs.readFile(file, "utf8");
      expect(content, `${file} is missing the shared evidence checklist`).toContain(sharedEvidenceChecklistLine);
      expect(content, `${file} must guard done closeout evidence`).toContain("claiming `done`");
      expect(content, `${file} must guard blocked closeout evidence`).toContain("`blocked`");
      expect(content, `${file} must guard awaiting-human closeout evidence`).toContain("`awaiting_human_decision`");
      expect(content, `${file} must require requirement coverage`).toContain("requirement coverage");
    }
  });
});
