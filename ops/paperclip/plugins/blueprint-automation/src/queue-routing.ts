export type RepoAgentConfig = {
  key: string;
  implementationAgent: string;
  reviewAgent: string;
  projectName?: string;
  githubRepo?: string;
};

const INBOUND_ENGINEERING_TITLE_HINTS = [
  "build",
  "bridge",
  "implement",
  "fix",
  "refactor",
  "integrate",
  "wire",
  "sync",
  "review",
  "audit",
  "plan",
] as const;

const REVIEW_TASK_HINTS = [
  "review",
  "audit",
  "benchmark",
  "changes requested",
  "branch drift",
  "worktree drift",
  "cleanup-stale-agent-branches",
  "git add and review",
  "normalize branch",
  "sync state",
  "qa",
  "plan",
  "guide",
  "posture",
] as const;

const IMPLEMENTATION_TASK_HINTS = [
  "build",
  "implement",
  "fix",
  "refactor",
  "split",
  "extract",
  "integrate",
  "wire",
  "unit test",
  "unit tests",
  "add tests",
  "test coverage",
  "coverage",
  "handler",
  "action handler",
  "action file",
  "worker.ts",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
] as const;

const WEBAPP_REPO_HINTS = [
  "blueprint-webapp",
  "blueprintwebapp",
  "ops/paperclip/",
  "scripts/paperclip/",
  "client/src/",
  "server/",
  "render.yaml",
  "worker.ts",
  "slack-notify.ts",
  "analytics-report.ts",
  "market-intel.ts",
  "founder-report.ts",
  "cleanup-stale-agent-branches.sh",
] as const;

function normalizeTaskText(parts: Array<string | null | undefined>) {
  return parts
    .map((value) => value?.trim().toLowerCase() ?? "")
    .filter((value) => value.length > 0)
    .join("\n");
}

function repoHintsForConfig(repo: RepoAgentConfig) {
  const normalizedKey = repo.key.trim().toLowerCase();
  if (normalizedKey === "webapp") {
    return WEBAPP_REPO_HINTS;
  }
  return [] as const;
}

function matchesRepoConfig(
  repo: RepoAgentConfig,
  normalizedProjectName: string,
  normalizedText: string,
) {
  if (
    normalizedProjectName.length > 0
    && (
      normalizedProjectName === repo.key.trim().toLowerCase()
      || normalizedProjectName === (repo.projectName ?? "").trim().toLowerCase()
      || normalizedProjectName === (repo.githubRepo ?? "").trim().toLowerCase()
    )
  ) {
    return true;
  }

  return [
    repo.key,
    repo.projectName,
    repo.githubRepo,
    ...repoHintsForConfig(repo),
  ]
    .map((value) => value?.trim().toLowerCase() ?? "")
    .filter((value) => value.length > 0)
    .some((value) => normalizedText.includes(value));
}

export function classifyRepoTask(
  title: string,
  description?: string | null,
): "implementation" | "review" | null {
  const normalizedText = normalizeTaskText([title, description]);
  if (!normalizedText) return null;

  if (REVIEW_TASK_HINTS.some((hint) => normalizedText.includes(hint))) {
    return "review";
  }

  if (IMPLEMENTATION_TASK_HINTS.some((hint) => normalizedText.includes(hint))) {
    return "implementation";
  }

  return null;
}

export function inferRepoAgentForTask(
  input: {
    projectName?: string | null;
    title: string;
    description?: string | null;
  },
  repoCatalog: ReadonlyArray<RepoAgentConfig>,
) {
  const normalizedProjectName = (input.projectName ?? "").trim().toLowerCase();
  const normalizedText = normalizeTaskText([input.title, input.description]);
  const repoConfig = repoCatalog.find((entry) =>
    matchesRepoConfig(entry, normalizedProjectName, normalizedText),
  );
  if (!repoConfig) {
    return null;
  }

  const classification = classifyRepoTask(input.title, input.description);
  if (classification === "review") {
    return repoConfig.reviewAgent;
  }
  if (classification === "implementation") {
    return repoConfig.implementationAgent;
  }
  return null;
}

export function preferredQueueRepoAgent(
  system: string,
  title: string,
  repoCatalog: ReadonlyArray<RepoAgentConfig>,
) {
  const normalizedSystem = system.trim().toLowerCase();
  const projectName =
    normalizedSystem === "pipeline"
      ? "pipeline"
      : normalizedSystem === "capture"
        ? "capture"
        : normalizedSystem === "webapp"
          ? "webapp"
          : "";
  const repoConfig = repoCatalog.find((entry) => entry.key === projectName);
  if (!repoConfig) {
    return null;
  }

  const classification = classifyRepoTask(title);
  if (classification === "review") {
    return repoConfig.reviewAgent;
  }
  return repoConfig.implementationAgent;
}

export function isInboundEngineeringQueueTask(
  system: string,
  title: string,
  repoCatalog: ReadonlyArray<RepoAgentConfig>,
) {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle.includes("inbound")) {
    return false;
  }

  if (!preferredQueueRepoAgent(system, title, repoCatalog)) {
    return false;
  }

  return INBOUND_ENGINEERING_TITLE_HINTS.some((hint) => normalizedTitle.includes(hint));
}
