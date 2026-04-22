import { describe, expect, it, vi } from "vitest";
import { pollGithubWorkflows } from "./github-workflow-polling.js";

describe("github workflow polling", () => {
  it("skips workflow polling when no token is configured", async () => {
    const fetchWorkflowRuns = vi.fn(async () => {
      throw new Error("should not be called");
    });
    const handleWorkflowRun = vi.fn(async () => {});

    const result = await pollGithubWorkflows(
      {
        enableGithubPolling: true,
        githubOwner: "ognjhunt",
        repoCatalog: [
          {
            key: "webapp",
            projectName: "Blueprint WebApp",
            githubRepo: "Blueprint-WebApp",
            defaultBranch: "main",
          },
        ],
      },
      fetchWorkflowRuns,
      async () => null,
      handleWorkflowRun,
    );

    expect(fetchWorkflowRuns).not.toHaveBeenCalled();
    expect(handleWorkflowRun).not.toHaveBeenCalled();
    expect(result).toEqual({
      polled: 0,
      errors: ["GitHub workflow polling token is required; skipping workflow polling."],
    });
  });

  it("does not retry workflow polling without a token after auth failure", async () => {
    const fetchWorkflowRuns = vi.fn(async (_url: string, token?: string) => {
      expect(token).toBe("github-token");
      throw new Error("HTTP 401 from GitHub API: unauthorized");
    });
    const handleWorkflowRun = vi.fn(async () => {});

    const result = await pollGithubWorkflows(
      {
        enableGithubPolling: true,
        githubOwner: "ognjhunt",
        githubTokenRef: "secret://github-token",
        repoCatalog: [
          {
            key: "webapp",
            projectName: "Blueprint WebApp",
            githubRepo: "Blueprint-WebApp",
            defaultBranch: "main",
          },
        ],
      },
      fetchWorkflowRuns,
      async (secretRef: string) => (secretRef === "secret://github-token" ? "github-token" : null),
      handleWorkflowRun,
    );

    expect(fetchWorkflowRuns).toHaveBeenCalledTimes(1);
    expect(handleWorkflowRun).not.toHaveBeenCalled();
    expect(result).toEqual({
      polled: 0,
      errors: [
        "Blueprint WebApp: GitHub workflow polling auth failed with the configured token; skipping unauthenticated fallback.",
      ],
    });
  });

  it("polls and handles the latest workflow run when auth succeeds", async () => {
    const fetchWorkflowRuns = vi.fn(async (_url: string, token?: string) => {
      expect(token).toBe("github-token");
      return {
        workflow_runs: [
          { id: 123, name: "CI", head_branch: "main" },
          { id: 122, name: "CI", head_branch: "main" },
        ],
      };
    });
    const handleWorkflowRun = vi.fn(async () => {});

    const result = await pollGithubWorkflows(
      {
        enableGithubPolling: true,
        githubOwner: "ognjhunt",
        githubTokenRef: "secret://github-token",
        repoCatalog: [
          {
            key: "webapp",
            projectName: "Blueprint WebApp",
            githubRepo: "Blueprint-WebApp",
            defaultBranch: "main",
          },
        ],
      },
      fetchWorkflowRuns,
      async () => "github-token",
      handleWorkflowRun,
    );

    expect(fetchWorkflowRuns).toHaveBeenCalledTimes(1);
    expect(handleWorkflowRun).toHaveBeenCalledTimes(1);
    expect(handleWorkflowRun).toHaveBeenCalledWith(
      {
        key: "webapp",
        projectName: "Blueprint WebApp",
        githubRepo: "Blueprint-WebApp",
        defaultBranch: "main",
      },
      { id: 123, name: "CI", head_branch: "main" },
    );
    expect(result).toEqual({ polled: 1, errors: [] });
  });
});
