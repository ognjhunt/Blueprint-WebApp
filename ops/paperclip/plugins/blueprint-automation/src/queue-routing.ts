export type RepoAgentConfig = {
  key: string;
  implementationAgent: string;
  reviewAgent: string;
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

export function preferredQueueRepoAgent(
  system: string,
  title: string,
  repoCatalog: RepoAgentConfig[],
) {
  const normalizedSystem = system.trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  const preferReview =
    normalizedTitle.includes("review")
    || normalizedTitle.includes("audit")
    || normalizedTitle.includes("decide")
    || normalizedTitle.includes("plan")
    || normalizedTitle.includes("guide")
    || normalizedTitle.includes("posture");
  const repoConfig = repoCatalog.find((entry) => entry.key === (
    normalizedSystem === "pipeline"
      ? "pipeline"
      : normalizedSystem === "capture"
        ? "capture"
        : normalizedSystem === "webapp"
          ? "webapp"
          : ""
  ));
  if (!repoConfig) {
    return null;
  }
  return preferReview ? repoConfig.reviewAgent : repoConfig.implementationAgent;
}

export function isInboundEngineeringQueueTask(
  system: string,
  title: string,
  repoCatalog: RepoAgentConfig[],
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
