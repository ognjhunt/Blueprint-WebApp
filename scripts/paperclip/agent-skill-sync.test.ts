import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

type AgentFrontmatter = {
  skills?: unknown;
};

type PaperclipCompany = {
  agents?: Record<string, {
    adapter?: {
      config?: {
        instructionsFilePath?: string;
        paperclipSkillSync?: {
          desiredSkills?: unknown;
        };
      };
    };
  }>;
};

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function parseFrontmatter(content: string): AgentFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  return (yaml.load(match[1]) as AgentFrontmatter | undefined) ?? {};
}

describe("Blueprint Paperclip skill sync", () => {
  it("keeps .paperclip skill sync aligned with each agent's declared frontmatter skills", async () => {
    const companyPath = path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml");
    const companyContent = await fs.readFile(companyPath, "utf8");
    const company = (yaml.load(companyContent) as PaperclipCompany | undefined) ?? {};
    const agentEntries = Object.entries(company.agents ?? {});

    expect(agentEntries.length).toBeGreaterThan(0);

    for (const [agentKey, agent] of agentEntries) {
      const config = agent.adapter?.config;
      if (!config?.instructionsFilePath) continue;

      const instructionsPath = path.resolve(config.instructionsFilePath);
      const instructions = await fs.readFile(instructionsPath, "utf8");
      const frontmatter = parseFrontmatter(instructions);
      const declaredSkills = normalizeStringArray(frontmatter.skills);
      const syncedSkills = normalizeStringArray(config.paperclipSkillSync?.desiredSkills);
      const missingSkills = declaredSkills.filter((skill) => !syncedSkills.includes(skill));

      expect(
        missingSkills,
        `${agentKey} is missing AGENTS.md skills in .paperclip.yaml paperclipSkillSync.desiredSkills`,
      ).toEqual([]);
    }
  });
});
