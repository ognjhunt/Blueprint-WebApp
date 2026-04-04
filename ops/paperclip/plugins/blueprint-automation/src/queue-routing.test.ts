import { describe, expect, it } from "vitest";
import {
  classifyRepoTask,
  inferRepoAgentForTask,
  isInboundEngineeringQueueTask,
  preferredQueueRepoAgent,
  type RepoAgentConfig,
} from "./queue-routing.js";

const REPO_CATALOG: RepoAgentConfig[] = [
  {
    key: "webapp",
    projectName: "blueprint-webapp",
    githubRepo: "Blueprint-WebApp",
    implementationAgent: "webapp-codex",
    reviewAgent: "webapp-review",
  },
  {
    key: "pipeline",
    projectName: "blueprint-capture-pipeline",
    githubRepo: "BlueprintCapturePipeline",
    implementationAgent: "pipeline-codex",
    reviewAgent: "pipeline-review",
  },
  {
    key: "capture",
    projectName: "blueprint-capture",
    githubRepo: "BlueprintCapture",
    implementationAgent: "capture-codex",
    reviewAgent: "capture-review",
  },
];

describe("queue routing", () => {
  it("classifies coding tasks as implementation work", () => {
    expect(
      classifyRepoTask(
        "Split worker.ts action handlers into separate action files (founder-report.ts, market-intel.ts, analytics-report.ts, slack-notify.ts)",
      ),
    ).toBe("implementation");
  });

  it("classifies branch cleanup tasks as review work", () => {
    expect(
      classifyRepoTask("Execute scripts/cleanup-stale-agent-branches.sh after git add and review"),
    ).toBe("review");
  });

  it("routes repo review work to the review lane", () => {
    expect(
      preferredQueueRepoAgent(
        "webapp",
        "Review qualification-first launch and monetization surfaces in the web app",
        REPO_CATALOG,
      ),
    ).toBe("webapp-review");
  });

  it("flags inbound engineering tasks so they stay in the repo lane", () => {
    expect(
      isInboundEngineeringQueueTask(
        "webapp",
        "Build production bridge from pipeline outputs into inbound request state",
        REPO_CATALOG,
      ),
    ).toBe(true);
  });

  it("does not flag generic inbound ops work as engineering", () => {
    expect(
      isInboundEngineeringQueueTask(
        "webapp",
        "Inbound request follow-up for buyer scheduling",
        REPO_CATALOG,
      ),
    ).toBe(false);
  });

  it("routes executive coding tasks into the webapp implementation lane", () => {
    expect(
      inferRepoAgentForTask(
        {
          projectName: "blueprint-executive-ops",
          title: "Split worker.ts action handlers into separate action files (founder-report.ts, market-intel.ts, analytics-report.ts, slack-notify.ts)",
        },
        REPO_CATALOG,
      ),
    ).toBe("webapp-codex");
  });

  it("routes branch cleanup tasks into the webapp review lane", () => {
    expect(
      inferRepoAgentForTask(
        {
          projectName: "blueprint-webapp",
          title: "Execute scripts/cleanup-stale-agent-branches.sh after git add and review",
        },
        REPO_CATALOG,
      ),
    ).toBe("webapp-review");
  });

  it("routes unit test work into the webapp implementation lane", () => {
    expect(
      inferRepoAgentForTask(
        {
          projectName: "blueprint-webapp",
          title: "Add unit tests for the new worker.ts action handler paths",
        },
        REPO_CATALOG,
      ),
    ).toBe("webapp-codex");
  });
});
