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

  it("keeps the chief of staff heartbeat pinned to the assigned issue on issue_assigned wakes", async () => {
    const heartbeatPath = path.resolve(
      "ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/Heartbeat.md",
    );
    const content = await fs.readFile(heartbeatPath, "utf8");

    expect(content).toContain("issue assigned: start from `PAPERCLIP_TASK_ID` as the sole execution scope.");
  });
});
