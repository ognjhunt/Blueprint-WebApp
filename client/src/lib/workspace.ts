import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "./firebaseAuthHeaders";
import { withCsrfHeader } from "./csrf";
import type { User as FirebaseUser } from "firebase/auth";
import type {
  WorkspaceAccountSetup,
  WorkspaceSnapshot,
} from "@/types/workspace";
export class WorkspaceRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "WorkspaceRequestError";
  }
}
export function workspaceNeedsSetup(error: unknown) {
  return (
    error instanceof WorkspaceRequestError &&
    error.code === "workspace_setup_required"
  );
}
export async function workspaceRequest<T>(
  currentUser: FirebaseUser | null,
  path: string,
  method = "GET",
  body?: unknown,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Include CSRF and Firebase token acquisition in the deadline. If either
  // settles late, never start the workspace request after the caller retries.
  const perform = async () => {
    const headers = await withFirebaseAuthHeaders(
      currentUser,
      method === "GET"
        ? {}
        : await withCsrfHeader({ "Content-Type": "application/json" }),
    );
    controller.signal.throwIfAborted();
    const response = await fetch(`/api/workspace${path}`, {
      method,
      credentials: "include",
      headers,
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new WorkspaceRequestError(
        value.error ||
          value.message ||
          "Could not load your workspace. Please try again.",
        response.status,
        value.code ||
          (response.status === 403 &&
          value.error === "A site or robot-team account is required."
            ? "workspace_setup_required"
            : undefined),
      );
    return value as T;
  };
  try {
    if (options.timeoutMs === undefined) return await perform();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new WorkspaceRequestError(
          "The request took too long. Please try again.", 408, "request_timeout",
        );
        reject(error);
        controller.abort(error);
      }, options.timeoutMs);
    });
    return await Promise.race([perform(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function useWorkspace() {
  const { currentUser, loading } = useAuth(),
    client = useQueryClient();
  const request = <T>(path: string, method = "GET", body?: unknown, options?: { timeoutMs?: number }) =>
    workspaceRequest<T>(currentUser, path, method, body, options);
  const query = useQuery({
    queryKey: ["workspace", currentUser?.uid],
    queryFn: () => request<WorkspaceSnapshot>("/"),
    enabled: Boolean(currentUser && !loading),
    staleTime: 15000,
    refetchInterval: (query) =>
      query.state.error instanceof WorkspaceRequestError &&
      query.state.error.status < 500
        ? false
        : 30000,
    retry: (count, error) =>
      !(error instanceof WorkspaceRequestError && error.status < 500) &&
      count < 1,
  });
  return {
    ...query,
    isLoading: loading || query.isLoading,
    request,
    needsSetup: workspaceNeedsSetup(query.error),
    refresh: () =>
      client.invalidateQueries({ queryKey: ["workspace", currentUser?.uid] }),
  };
}
export function useWorkspaceAccountSetup() {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["workspace-account-setup", currentUser?.uid],
    queryFn: () =>
      workspaceRequest<WorkspaceAccountSetup>(currentUser, "/setup"),
    enabled: Boolean(currentUser && !loading),
    retry: (count, error) =>
      !(error instanceof WorkspaceRequestError && error.status < 500) &&
      count < 1,
  });
  return {
    ...query,
    isLoading: loading || query.isLoading,
    save: (body: {
      name: string;
      organization: string;
      workspaceType: string;
      acceptedTerms: boolean;
    }) => workspaceRequest(currentUser, "/setup", "POST", body),
  };
}
