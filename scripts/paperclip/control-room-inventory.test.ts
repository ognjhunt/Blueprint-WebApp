import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildControlRoomInventory,
  renderControlRoomInventoryMarkdown,
} from "./control-room-inventory";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function writeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-control-room-inventory-"));
  tempRoots.push(root);
  const configPath = path.join(root, ".paperclip.yaml");
  const skillsRoot = path.join(root, "skills");
  const pluginRoot = path.join(root, "plugins");
  await fs.mkdir(path.join(skillsRoot, "platform-doctrine"), { recursive: true });
  await fs.mkdir(path.join(skillsRoot, "browser"), { recursive: true });
  await fs.mkdir(path.join(pluginRoot, "stripe", "bundle", "skills", "stripe-best-practices"), {
    recursive: true,
  });
  await fs.mkdir(path.join(pluginRoot, "vercel", "bundle", "skills", "react-best-practices"), {
    recursive: true,
  });
  await fs.writeFile(path.join(skillsRoot, "platform-doctrine", "SKILL.md"), "# Platform doctrine\n");
  await fs.writeFile(path.join(skillsRoot, "browser", "SKILL.md"), "# Browser\n");
  await fs.writeFile(
    path.join(pluginRoot, "stripe", "bundle", "skills", "stripe-best-practices", "SKILL.md"),
    "# Stripe best practices\n",
  );
  await fs.writeFile(
    path.join(pluginRoot, "vercel", "bundle", "skills", "react-best-practices", "SKILL.md"),
    "# React best practices\n",
  );
  await fs.writeFile(
    configPath,
    [
      "agents:",
      "  webapp-codex:",
      "    adapter:",
      "      type: codex_local",
      "      config:",
      "        cwd: /tmp/webapp",
      "        model: gpt-5.4-mini",
      "        paperclipGoalPromptEnabled: true",
      "        paperclipSkillSync:",
      "          desiredSkills:",
      "            - platform-doctrine",
      "            - stripe-best-practices",
      "            - browse",
      "            - product-marketing",
      "            - vercel-react-best-practices",
      "            - missing-skill",
      "    budgetMonthlyCents: 3000",
      "  growth-lead:",
      "    adapter:",
      "      type: hermes_local",
      "      config:",
      "        paperclipSkillSync:",
      "          desiredSkills:",
      "            - platform-doctrine",
      "    budgetMonthlyCents: 1000",
      "routines:",
      "  webapp-autonomy-loop:",
      "    agent: webapp-codex",
      "    priority: high",
      "    concurrencyPolicy: coalesce_if_active",
      "    catchUpPolicy: skip_missed",
      "    triggers:",
      "      - kind: schedule",
      "        cronExpression: '15 11 * * 1-5'",
      "        timezone: America/New_York",
      "  paused-sweep:",
      "    agent: growth-lead",
      "    enabled: false",
      "    triggers: []",
      "",
    ].join("\n"),
  );
  return { configPath, skillsRoot, pluginRoot };
}

describe("Paperclip control-room inventory", () => {
  it("summarizes adapters, goal lanes, routines, budgets, skills, and suppression signals", async () => {
    const { configPath, skillsRoot, pluginRoot } = await writeFixture();
    const inventory = buildControlRoomInventory({ configPath, skillRoots: [skillsRoot, pluginRoot] });

    expect(inventory.agentCount).toBe(2);
    expect(inventory.adapterCounts).toEqual({ codex_local: 1, hermes_local: 1 });
    expect(inventory.totalAgentBudgetCents).toBe(4000);
    expect(inventory.codexGoalEnabledAgents).toEqual(["webapp-codex"]);
    expect(inventory.routineStatusCounts).toEqual({ active: 1, paused: 1 });
    expect(inventory.routineConcurrencyCounts).toMatchObject({ coalesce_if_active: 1 });
    expect(inventory.routineCatchUpCounts).toMatchObject({ skip_missed: 1 });
    expect(inventory.readinessClassCounts).toEqual({
      "blocked-by-env": 1,
      "needs-human": 1,
      "recommended-missing": 0,
      "required-ready": 1,
    });
    expect(inventory.routineReadinessRows).toEqual([
      expect.objectContaining({
        slug: "paused-sweep",
        readinessClass: "blocked-by-env",
      }),
      expect.objectContaining({
        slug: "webapp-autonomy-loop",
        readinessClass: "required-ready",
      }),
    ]);
    expect(inventory.desiredSkillCandidateGaps).toEqual([]);
    expect(inventory.desiredSkillAliasMappings).toMatchObject([
      {
        skill: "browse",
        resolvedAs: "browser",
        source: "local-skill-alias",
      },
      {
        skill: "vercel-react-best-practices",
        resolvedAs: "react-best-practices",
        source: "plugin-skill-alias",
      },
    ]);
    expect(inventory.intentionalDesiredSkillDeferrals).toMatchObject([
      {
        skill: "product-marketing",
        category: "company-library",
      },
    ]);
    expect(inventory.trueMissingDesiredSkills).toMatchObject([
      {
        skill: "missing-skill",
        nextAction: expect.stringContaining("Add a repo skill"),
      },
    ]);
    expect(inventory.suppressionSignals.map((signal) => signal.signal)).toContain(
      "no_change and duplicate_suppressed waste signals",
    );

    const markdown = renderControlRoomInventoryMarkdown(inventory);
    expect(markdown).toContain("Declared monthly agent budget: $40.00");
    expect(markdown).toContain("## Operator Worker Readiness");
    expect(markdown).toContain("Readiness classes: blocked-by-env: 1, needs-human: 1, recommended-missing: 0, required-ready: 1");
    expect(markdown).toContain("| paused-sweep | growth-lead | blocked-by-env | paused or disabled in local Paperclip config");
    expect(markdown).toContain("- missing-skill: needs-human");
    expect(markdown).toContain("| webapp-codex | codex_local | /tmp/webapp | $30.00 | yes | 6 |");
    expect(markdown).toContain("coalesce_if_active");
    expect(markdown).toContain("No ambiguous desiredSkill candidate gaps.");
    expect(markdown).toContain("| browse | browser | local-skill-alias |");
    expect(markdown).toContain("| product-marketing | company-library |");
    expect(markdown).toContain("| missing-skill | 1 | webapp-codex |");
  });

  it("classifies the authored Blueprint package without ambiguous desired-skill gaps", () => {
    const inventory = buildControlRoomInventory();

    expect(inventory.codexGoalEnabledAgents).toEqual([
      "capture-codex",
      "capture-review",
      "conversion-agent",
      "docs-agent",
      "pipeline-codex",
      "pipeline-review",
      "webapp-codex",
      "webapp-review",
    ]);
    expect(inventory.codexGoalDisabledAgents).toEqual([
      "beta-launch-commander",
      "blueprint-cto",
    ]);
    expect(inventory.desiredSkillCandidateGaps).toEqual([]);
    expect(inventory.trueMissingDesiredSkills).toEqual([]);
    expect(inventory.intentionalDesiredSkillDeferrals.map((entry) => entry.skill)).toContain(
      "product-marketing",
    );
    expect(inventory.intentionalDesiredSkillDeferrals.map((entry) => entry.skill)).toContain("find-skills");
  });

  it("keeps the checked-in local readiness report aligned with authored goal lanes", async () => {
    const inventory = buildControlRoomInventory();
    const report = await fs.readFile(
      path.resolve("docs/operator-provider-worker-readiness-local-report-2026-05-25.md"),
      "utf8",
    );

    expect(report).toContain(
      `- Codex \`/goal\` enabled lanes: ${inventory.codexGoalEnabledAgents.map((agent) => `\`${agent}\``).join(", ")}.`,
    );
    expect(report).toContain(
      `- Codex \`/goal\` disabled lanes: ${inventory.codexGoalDisabledAgents.map((agent) => `\`${agent}\``).join(", ")}.`,
    );
  });

  it("registers the recursive improvement routine as dry-run report-only by default", async () => {
    const inventory = buildControlRoomInventory();
    const routine = inventory.routineRows.find(
      (row) => row.slug === "recursive-agent-improvement-loop",
    );
    const taskPath = path.resolve(
      "ops/paperclip/blueprint-company/tasks/recursive-agent-improvement-loop/TASK.md",
    );
    const task = await fs.readFile(taskPath, "utf8");
    const config = await fs.readFile(
      path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml"),
      "utf8",
    );
    const routineConfig = config.match(
      /routines:[\s\S]*?^  recursive-agent-improvement-loop:\n(?:    .*\n)+/m,
    )?.[0] ?? "";

    expect(routine).toMatchObject({
      agent: "webapp-codex",
      status: "active",
      priority: "medium",
      concurrencyPolicy: "coalesce_if_active",
      catchUpPolicy: "skip_missed",
      cadence: "25 6 * * * America/New_York",
    });
    expect(task).toContain("npm run autoagent:recursive-improve -- --dry-run");
    expect(task).toContain("output/autoagent/recursive-improvement/latest/report.md");
    expect(task).toContain("`status`, `proof_paths`, `next_action`, `retry_condition`, and `residual_risk`");
    expect(task).toContain("no_change_report_only");
    expect(task).toContain("no new failure family, no new proof path, no generated fixture, the same held reason, and the same selected candidate");
    expect(task).toContain(
      "Do not run `--auto-apply-low-risk`, `--apply-canary`, or `--apply-rollback`",
    );
    expect(task).toContain("central-policy-approved low-risk AutoAgent lanes");
    expect(routineConfig).toContain("cronExpression: 25 6 * * *");

    const disallowedLiveCommands = [
      /\b--live\b/i,
      /\b--export-live\b/i,
      /\b--founder-approved\b/i,
      /\bnpm run gtm:send\b/i,
      /\bnpm run city-launch:send\b/i,
      /\bnpm run city-launch:run\b/i,
      /\bnpm run human-replies:poll\b/i,
      /\bnpm run human-replies:send-test-blocker\b/i,
      /\bnpm run human-replies:prove-production\b/i,
      /\bnpm run notion:sync:growth-studio\b/i,
      /\bnpm run render:import-env\b(?!.*\b--dry-run\b)/i,
      /\bscripts\/paperclip\/.*(bootstrap|reconcile|repair|restart|import)/i,
    ];

    for (const pattern of disallowedLiveCommands) {
      expect(task, `recursive routine must not include ${pattern}`).not.toMatch(pattern);
      expect(routineConfig, `recursive routine config must not include ${pattern}`).not.toMatch(pattern);
    }
    expect(inventory.suppressionSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signal: "recursive improvement no-change repeat suppression",
        }),
      ]),
    );
  });
});
