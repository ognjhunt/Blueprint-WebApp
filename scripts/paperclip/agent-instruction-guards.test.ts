import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const agentsRoot = path.resolve("ops/paperclip/blueprint-company/agents");
const missingJwtCliFallbackLine =
  'If PAPERCLIP_API_KEY is missing on this trusted host and PAPERCLIP_TASK_ID is present, stop using auth-backed curl and switch to \'npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue get|checkout|update|comment "$PAPERCLIP_TASK_ID" ...\' for the bound issue.';
const noHermesPythonPaperclipDiscoveryLine =
  "Do not use the Hermes Python/execute_code tool for Paperclip API reads, auth/env discovery, or JSON parsing.";
const noSecretFileAuthDebugLine =
  "Never inspect, print, cat, grep, or find Paperclip secret/env/config files while debugging auth.";
// Every Paperclip role was retired on 2026-11-12 (AUTONOMOUS_ORG.md). A running agent reads these
// files by path, so each one must tell it to do nothing and must carry no working instruction.
const retiredRoleLine =
  "This role is retired as of 2026-11-12. Do nothing: start no work, send nothing, change nothing.";
const kitFiles = ["AGENTS.md", "Soul.md", "Heartbeat.md", "Tools.md"];
const workingInstructionMarkers = [
  /PAPERCLIP_API_KEY/,
  /PATCH \/api\/issues/,
  /## (Triggered Runs|Scheduled Runs|Primary Sources|Actions You Own|Why You Exist)/,
  /Primary scope:/,
  /Goal-style Codex runs/,
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
    if (entry.isFile() && kitFiles.includes(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

describe("Blueprint Paperclip agent instruction guards", () => {
  it("retires every agent kit file: each says do nothing and carries no working instruction", async () => {
    const files = await collectAgentInstructionFiles(agentsRoot);
    const agentDirs = (await fs.readdir(agentsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());

    expect(agentDirs.length).toBeGreaterThan(0);
    expect(files.length).toBe(agentDirs.length * kitFiles.length);
    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      expect(content, `${file} must carry the retirement line`).toContain(retiredRoleLine);
      expect(content, `${file} must point at the current frame`).toContain("shared block of PLATFORM_CONTEXT.md");
      for (const marker of workingInstructionMarkers) {
        expect(content, `${file} must not carry a working instruction (${marker})`).not.toMatch(marker);
      }
      if (file.endsWith("AGENTS.md")) {
        expect(content, `${file} keeps the front matter the import needs`).toMatch(/^---\nname: [^\n]+\ntitle: /);
      }
    }
  });

  it("pauses every routine and retires every task file still kept at its path", async () => {
    const config = yaml.load(
      await fs.readFile(path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml"), "utf8"),
    ) as { routines?: Record<string, { status?: string }> };
    const routines = Object.entries(config.routines ?? {});

    expect(routines.length).toBeGreaterThan(0);
    expect(routines.filter(([, routine]) => routine.status !== "paused").map(([slug]) => slug)).toEqual([]);

    const tasksRoot = path.resolve("ops/paperclip/blueprint-company/tasks");
    for (const slug of await fs.readdir(tasksRoot)) {
      const content = await fs.readFile(path.join(tasksRoot, slug, "TASK.md"), "utf8");
      expect(content, `${slug}/TASK.md must be a retirement stub`).toMatch(/^Retired 2026-11-12\. Do nothing/);
    }
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

  it("only goal-enables bounded Codex implementation and review lanes, whose instructions now say do nothing", async () => {
    const configPath = path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml");
    const config = yaml.load(await fs.readFile(configPath, "utf8")) as {
      agents?: Record<
        string,
        {
          adapter?: {
            type?: string;
            config?: Record<string, unknown>;
          };
        }
      >;
    };
    const agents = config.agents ?? {};
    const enabled = Object.entries(agents)
      .filter(([, agent]) => agent.adapter?.config?.paperclipGoalPromptEnabled === true)
      .map(([slug]) => slug)
      .sort();

    expect(enabled).toEqual([
      "capture-codex",
      "capture-review",
      "conversion-agent",
      "docs-agent",
      "pipeline-codex",
      "pipeline-review",
      "webapp-codex",
      "webapp-review",
    ]);

    for (const slug of enabled) {
      const agent = agents[slug];
      expect(agent?.adapter?.type, `${slug} must stay on Codex for goal-style runs`).toBe("codex_local");
      const instructionsPath = path.resolve(`ops/paperclip/blueprint-company/agents/${slug}/AGENTS.md`);
      const instructions = await fs.readFile(instructionsPath, "utf8");
      const timeoutSec = agent?.adapter?.config?.timeoutSec;
      const budgetMonthlyCents = agent?.budgetMonthlyCents;
      expect(typeof timeoutSec, `${slug} must declare an adapter timeoutSec for goal-style budget/timeout context`).toBe(
        "number",
      );
      expect(Number(timeoutSec), `${slug} timeoutSec must be positive`).toBeGreaterThan(0);
      expect(
        typeof budgetMonthlyCents,
        `${slug} must declare budgetMonthlyCents for goal-style budget/timeout context`,
      ).toBe("number");
      expect(Number(budgetMonthlyCents), `${slug} budgetMonthlyCents must be positive`).toBeGreaterThan(0);
      expect(instructions, `${slug} is retired and must say do nothing`).toContain(retiredRoleLine);
    }

    const intentionallyDisabled = [
      "blueprint-cto",
      "beta-launch-commander",
    ];
    for (const slug of intentionallyDisabled) {
      expect(
        agents[slug]?.adapter?.config?.paperclipGoalPromptEnabled,
        `${slug} is intentionally not /goal-enabled because it is strategy, release orchestration, or architecture control work`,
      ).not.toBe(true);
    }
  });

});
