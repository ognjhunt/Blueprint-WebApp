import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "./firebaseAuthHeaders";
import { withCsrfHeader } from "./csrf";
import type { WorkspaceSnapshot } from "@/types/workspace";
export function useWorkspace() {
  const { currentUser, loading } = useAuth(),
    client = useQueryClient();
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`/api/workspace${path}`, {
      method,
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        currentUser,
        method === "GET"
          ? {}
          : await withCsrfHeader({ "Content-Type": "application/json" }),
      ),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        value.error ||
          value.message ||
          "Could not load your workspace. Please try again.",
      );
    return value as T;
  }
  const query = useQuery({
    queryKey: ["workspace", currentUser?.uid],
    queryFn: () => request<WorkspaceSnapshot>("/"),
    enabled: Boolean(currentUser && !loading),
    staleTime: 15000,
    refetchInterval: 30000,
    retry: 1,
  });
  return {
    ...query,
    isLoading: loading || query.isLoading,
    request,
    refresh: () =>
      client.invalidateQueries({ queryKey: ["workspace", currentUser?.uid] }),
  };
}
export function dateLabel(value: string | null, time = false) {
  if (!value) return "To be confirmed";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(time
      ? {
          hour: "numeric" as const,
          minute: "2-digit" as const,
          timeZoneName: "short" as const,
        }
      : {}),
  }).format(date);
}
export function money(value: number | null) {
  return value === null
    ? "To be agreed"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}
export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    requested: "Review pending",
    awaiting_confirmation: "Waiting for confirmation",
    submitted: "Review pending",
    accepted: "Preparing evaluation",
    planning: "Preparing evaluation",
    awaiting_authorization: "Awaiting approval",
    aggregating: "Preparing results",
    decision_available: "Evaluation complete",
    superseded: "Replaced",
    criteria_changed: "Targets changed",
    running: "Evaluation running",
    executing: "Evaluation running",
    decided: "Evaluation complete",
    partially_decided: "Partial result",
    abstained: "Inconclusive",
    failed: "Needs attention",
    cancelled: "Cancelled",
    selected: "Selected for pilot",
    invited: "Invited to pilot",
    not_selected: "Not selected",
    pilot: "Pilot underway",
    pilot_complete: "Pilot complete",
    deployed: "Deployed",
    closed: "Closed",
    pending_review: "Change requested",
  };
  return labels[value] || value.replaceAll("_", " ");
}
