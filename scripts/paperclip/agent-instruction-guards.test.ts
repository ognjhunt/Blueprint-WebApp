import fs from "node:fs/promises";
import path from "node:path";
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
    }
  });
});
