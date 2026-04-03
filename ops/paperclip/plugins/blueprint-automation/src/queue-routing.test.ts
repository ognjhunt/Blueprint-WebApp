import { describe, expect, it } from "vitest";
import {
  isInboundEngineeringQueueTask,
  preferredQueueRepoAgent,
  type RepoAgentConfig,
} from "./queue-routing.js";

const REPO_CATALOG: RepoAgentConfig[] = [
  { key: "webapp", implementationAgent: "webapp-codex", reviewAgent: "webapp-review" },
  { key: "pipeline", implementationAgent: "pipeline-codex", reviewAgent: "pipeline-review" },
  { key: "capture", implementationAgent: "capture-codex", reviewAgent: "capture-review" },
];

describe("queue routing", () => {
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
});
