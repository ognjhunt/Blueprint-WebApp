// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROBOT_AGENT_CONTRACT_VERSION,
  ROBOT_AGENT_TRUTH_LABELS,
  buildRobotAgentAccessManifest,
  buildRobotAgentOpenApiContract,
} from "../../server/utils/robot-agent-contract";
import { BLUEPRINT_MCP_TOOLS } from "./blueprint-mcp-server";

const repoRoot = process.cwd();
const expectedContractVersion = "2026-07-16";

const readText = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const requiredCliFragments = [
  "help --format json",
  "doctor --format json",
  "setup-auth --format json",
  "plan --q",
  "site-world search",
  "request location",
  "commerce quote",
  "commerce checkout",
  "commerce entitlement-readiness",
  "session create",
] as const;

const requiredLifecyclePhrases = [
  "request/commerce/session lifecycle",
  "request intake",
  "dry-run commerce",
  "hosted-session lifecycle",
] as const;

function expectIncludesAll(label: string, text: string, terms: readonly string[]) {
  for (const term of terms) {
    expect(text, `${label} is missing ${term}`).toContain(term);
  }
}

describe("agent-access contract drift guard", () => {
  it("keeps static OpenAPI artifacts identical to the dynamic contract", () => {
    const dynamicContract = buildRobotAgentOpenApiContract();
    const dynamicJson = JSON.stringify(dynamicContract, null, 2);

    expect(ROBOT_AGENT_CONTRACT_VERSION).toBe(expectedContractVersion);
    expect(dynamicContract.info.version).toBe(expectedContractVersion);

    for (const staticPath of [
      "client/public/agent-access.openapi.json",
      "docs/agent-access/agent-access.openapi.json",
    ]) {
      const staticJson = readText(staticPath).trim();
      expect(JSON.parse(staticJson), `${staticPath} is stale; run npm run agent:contract`).toEqual(dynamicContract);
      expect(staticJson, `${staticPath} is missing the current contract version`).toContain(
        `"version": "${expectedContractVersion}"`,
      );
      expect(staticJson).toBe(dynamicJson);
    }
  });

  it("keeps MCP tool names aligned across manifest, docs, llms files, and /agents", () => {
    const toolNames = BLUEPRINT_MCP_TOOLS.map((tool) => tool.name);
    const manifestText = JSON.stringify(buildRobotAgentAccessManifest(), null, 2);

    expectIncludesAll("agent access manifest", manifestText, toolNames);

    for (const [label, text] of [
      ["client/public/llms.txt", readText("client/public/llms.txt")],
      ["client/public/llms-full.txt", readText("client/public/llms-full.txt")],
      ["client/src/pages/Agents.tsx", readText("client/src/pages/Agents.tsx")],
      ["docs/agent-access/robot-team-agent-access.md", readText("docs/agent-access/robot-team-agent-access.md")],
    ] as const) {
      expectIncludesAll(label, text, toolNames);
    }
  });

  it("keeps CLI command fragments and lifecycle language aligned across public agent surfaces", () => {
    const manifestText = JSON.stringify(buildRobotAgentAccessManifest(), null, 2);
    const cliSurfaceTexts = [
      ["agent access manifest", manifestText],
      ["client/src/pages/Agents.tsx", readText("client/src/pages/Agents.tsx")],
      ["docs/agent-access/robot-team-agent-access.md", readText("docs/agent-access/robot-team-agent-access.md")],
    ] as const;

    for (const [label, text] of cliSurfaceTexts) {
      expectIncludesAll(label, text, requiredCliFragments);
    }

    for (const [label, text] of [
      ["client/public/llms.txt", readText("client/public/llms.txt")],
      ["client/public/llms-full.txt", readText("client/public/llms-full.txt")],
      ["client/src/pages/Agents.tsx", readText("client/src/pages/Agents.tsx")],
      ["docs/agent-access/robot-team-agent-access.md", readText("docs/agent-access/robot-team-agent-access.md")],
    ] as const) {
      expectIncludesAll(label, text, requiredLifecyclePhrases);
    }
  });

  it("keeps truth labels visible in every machine-readable agent surface", () => {
    const truthLabels = [...ROBOT_AGENT_TRUTH_LABELS];
    const dynamicContractText = JSON.stringify(buildRobotAgentOpenApiContract(), null, 2);

    for (const [label, text] of [
      ["dynamic OpenAPI contract", dynamicContractText],
      ["client/public/agent-access.openapi.json", readText("client/public/agent-access.openapi.json")],
      ["docs/agent-access/agent-access.openapi.json", readText("docs/agent-access/agent-access.openapi.json")],
      ["client/public/llms.txt", readText("client/public/llms.txt")],
      ["client/public/llms-full.txt", readText("client/public/llms-full.txt")],
      ["client/src/pages/Agents.tsx", readText("client/src/pages/Agents.tsx")],
      ["docs/agent-access/robot-team-agent-access.md", readText("docs/agent-access/robot-team-agent-access.md")],
    ] as const) {
      expectIncludesAll(label, text, truthLabels);
    }
  });
});
