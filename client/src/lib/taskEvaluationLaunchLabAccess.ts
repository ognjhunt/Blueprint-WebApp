export const TASK_EVALUATION_LAUNCH_LAB_HEADER = "X-Blueprint-Launch-Lab-Token";
const TOKEN_SESSION_KEY = "blueprint.task-evaluation-launch-lab-token";
const TOKEN_FRAGMENT_KEY = "launch-access";

export function resolveTaskEvaluationLaunchLabToken(): string {
  if (typeof window === "undefined") return "";

  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fragmentToken = String(fragment.get(TOKEN_FRAGMENT_KEY) || "").trim();
  if (fragmentToken) {
    window.sessionStorage.setItem(TOKEN_SESSION_KEY, fragmentToken);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    return fragmentToken;
  }

  return String(window.sessionStorage.getItem(TOKEN_SESSION_KEY) || "").trim();
}

export function withTaskEvaluationLaunchLabHeader(
  token: string,
  headers: Record<string, string>,
): Record<string, string> {
  return token
    ? { ...headers, [TASK_EVALUATION_LAUNCH_LAB_HEADER]: token }
    : headers;
}

