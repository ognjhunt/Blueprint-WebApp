import { DEFAULT_REPO_CATALOG } from "./constants.js";

export type GithubWorkflowRepoConfig = {
  key: string;
  projectName: string;
  githubRepo: string;
  defaultBranch: string;
};

export type GithubWorkflowPollingConfig = {
  enableGithubPolling?: boolean;
  githubOwner?: string;
  githubTokenRef?: string;
  repoCatalog?: GithubWorkflowRepoConfig[];
};

export type FetchWorkflowRuns = (url: string, token?: string) => Promise<Record<string, unknown>>;
export type ResolveSecretRef = (secretRef: string) => Promise<string | null>;
export type HandleWorkflowRun = (
  repoConfig: GithubWorkflowRepoConfig,
  workflowRun: Record<string, unknown>,
) => Promise<void>;

function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /HTTP 401|HTTP 403/i.test(message);
}

export async function pollGithubWorkflows(
  config: GithubWorkflowPollingConfig,
  fetchWorkflowRuns: FetchWorkflowRuns,
  resolveSecretRef: ResolveSecretRef,
  handleWorkflowRun: HandleWorkflowRun,
) {
  if (!config.enableGithubPolling || !config.githubOwner) {
    return { polled: 0, errors: [] as string[] };
  }

  const repoCatalog = config.repoCatalog ?? DEFAULT_REPO_CATALOG;
  const token = config.githubTokenRef
    ? await resolveSecretRef(config.githubTokenRef).catch(() => null)
    : null;
  const errors: string[] = [];

  if (!token) {
    errors.push("GitHub workflow polling token is required; skipping workflow polling.");
    return { polled: 0, errors };
  }

  let polled = 0;

  for (const repoConfig of repoCatalog) {
    const url = `https://api.github.com/repos/${config.githubOwner}/${repoConfig.githubRepo}/actions/runs?per_page=3`;
    let response: Record<string, unknown>;
    try {
      response = await fetchWorkflowRuns(url, token ?? undefined);
    } catch (error) {
      if (token && isAuthFailure(error)) {
        errors.push(
          `${repoConfig.projectName}: GitHub workflow polling auth failed with the configured token; skipping unauthenticated fallback.`,
        );
        continue;
      }
      throw error;
    }

    const workflowRuns = Array.isArray(response.workflow_runs)
      ? response.workflow_runs.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [];

    if (workflowRuns[0]) {
      await handleWorkflowRun(repoConfig, workflowRuns[0]);
      polled += 1;
    }
  }

  return { polled, errors };
}
