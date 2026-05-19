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
  await fs.mkdir(path.join(pluginRoot, "stripe", "bundle", "skills", "stripe-best-practices"), {
    recursive: true,
  });
  await fs.writeFile(path.join(skillsRoot, "platform-doctrine", "SKILL.md"), "# Platform doctrine\n");
  await fs.writeFile(
    path.join(pluginRoot, "stripe", "bundle", "skills", "stripe-best-practices", "SKILL.md"),
    "# Stripe best practices\n",
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
    expect(inventory.desiredSkillCandidateGaps).not.toContain("stripe-best-practices");
    expect(inventory.desiredSkillCandidateGaps).toContain("missing-skill");
    expect(inventory.suppressionSignals.map((signal) => signal.signal)).toContain(
      "no_change and duplicate_suppressed waste signals",
    );

    const markdown = renderControlRoomInventoryMarkdown(inventory);
    expect(markdown).toContain("Declared monthly agent budget: $40.00");
    expect(markdown).toContain("| webapp-codex | codex_local | /tmp/webapp | $30.00 | yes | 3 |");
    expect(markdown).toContain("coalesce_if_active");
  });
});
