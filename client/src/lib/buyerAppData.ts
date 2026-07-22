import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";

import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { StatusChipProps } from "@/components/blueprint";
import type { BenchmarkProjection } from "@/lib/benchmarkProjection";

export type EntitlementAccessState =
  | "provisioned"
  | "manual_review_required"
  | "revoked"
  | "expired"
  | string;

export type EntitlementAccessLink = {
  url: string;
  label: string;
  kind: string;
};

export type BuyerEntitlement = {
  id: string;
  order_id?: string | null;
  buyer_user_id?: string | null;
  buyer_email?: string | null;
  sku?: string | null;
  title?: string | null;
  item_type?: string | null;
  license_tier?: string | null;
  exclusivity?: string | null;
  delivery_mode?: string | null;
  access_state?: EntitlementAccessState | null;
  granted_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  access?: EntitlementAccessLink | null;
};

type EntitlementsResponse = {
  entitlement: BuyerEntitlement | null;
  access: EntitlementAccessLink | null;
  entitlements: BuyerEntitlement[];
};

export type BuyerAppEntitlementsState = {
  entitlements: BuyerEntitlement[];
  provisionedEntitlements: BuyerEntitlement[];
  reviewEntitlements: BuyerEntitlement[];
  revokedEntitlements: BuyerEntitlement[];
  isLoading: boolean;
  error: Error | null;
};

async function fetchBuyerEntitlements(
  currentUser: FirebaseUser,
): Promise<EntitlementsResponse> {
  const response = await fetch("/api/marketplace/entitlements/current", {
    credentials: "include",
    headers: await withFirebaseAuthHeaders(currentUser),
  });

  if (!response.ok) {
    throw new Error(`Failed to load buyer entitlements (${response.status})`);
  }

  return response.json() as Promise<EntitlementsResponse>;
}

export function useBuyerAppEntitlements(): BuyerAppEntitlementsState {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["buyer-app-entitlements", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser && !loading),
    queryFn: () => fetchBuyerEntitlements(currentUser!),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const entitlements = [...(query.data?.entitlements || [])].sort((a, b) => {
      const left = a.granted_at || a.updated_at || "";
      const right = b.granted_at || b.updated_at || "";
      return left < right ? 1 : left > right ? -1 : 0;
    });
    return {
      entitlements,
      provisionedEntitlements: entitlements.filter(
        (entitlement) => entitlement.access_state === "provisioned",
      ),
      reviewEntitlements: entitlements.filter(
        (entitlement) => entitlement.access_state === "manual_review_required",
      ),
      revokedEntitlements: entitlements.filter(
        (entitlement) => entitlement.access_state === "revoked",
      ),
      isLoading: loading || query.isLoading,
      error: query.error instanceof Error ? query.error : null,
    };
  }, [loading, query.data?.entitlements, query.error, query.isLoading]);
}

/* -------------------------------------------------------------------------- */
/*  Evaluation runs (robotEvalJobRequests)                                     */
/* -------------------------------------------------------------------------- */

export type BuyerRunRecord = {
  job_id: string;
  status: string | null;
  pipeline_status?: string | null;
  site_slug?: string | null;
  site_submission_id?: string | null;
  capture_job_id?: string | null;
  capture_id?: string | null;
  error?: string | null;
  entitlement_id?: string | null;
  entitlement_sku?: string | null;
  created_at_iso?: string | null;
  updated_at_iso?: string | null;
};

export type BuyerRunDetail = BuyerRunRecord & {
  result_artifacts?: Record<string, unknown>;
  proof_boundary?: Record<string, unknown>;
  pipeline_forward?: Record<string, unknown> | null;
  benchmark?: BenchmarkProjection | null;
};

type BuyerRunsResponse = {
  ok?: boolean;
  count?: number;
  job_requests?: BuyerRunRecord[];
};

export type BuyerAppRunsState = {
  runs: BuyerRunRecord[];
  isLoading: boolean;
  error: Error | null;
};

async function fetchBuyerRuns(currentUser: FirebaseUser): Promise<BuyerRunsResponse> {
  const response = await fetch("/api/robot-eval/job-requests", {
    credentials: "include",
    headers: await withFirebaseAuthHeaders(currentUser),
  });

  if (!response.ok) {
    throw new Error(`Failed to load evaluation runs (${response.status})`);
  }

  return response.json() as Promise<BuyerRunsResponse>;
}

export function useBuyerAppRuns(): BuyerAppRunsState {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["buyer-app-runs", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser && !loading),
    queryFn: () => fetchBuyerRuns(currentUser!),
    staleTime: 30_000,
  });

  return useMemo(() => {
    const runs = [...(query.data?.job_requests || [])].sort((a, b) => {
      const left = a.created_at_iso || "";
      const right = b.created_at_iso || "";
      return left < right ? 1 : left > right ? -1 : 0;
    });
    return {
      runs,
      isLoading: loading || query.isLoading,
      error: query.error instanceof Error ? query.error : null,
    };
  }, [loading, query.data?.job_requests, query.error, query.isLoading]);
}

export type BuyerAppRunDetailState = {
  run: BuyerRunDetail | null;
  /** True when the server confirmed no buyer-owned record exists (404/403). */
  notFound: boolean;
  isLoading: boolean;
  error: Error | null;
};

async function fetchBuyerRunDetail(
  currentUser: FirebaseUser,
  runId: string,
): Promise<BuyerRunDetail | null> {
  const response = await fetch(
    `/api/robot-eval/job-requests/${encodeURIComponent(runId)}/status`,
    {
      credentials: "include",
      headers: await withFirebaseAuthHeaders(currentUser),
    },
  );

  // 404: no record. 403: record exists but is not owned by this buyer. Both
  // render as "no buyer-owned run record" rather than a transport error.
  if (response.status === 404 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load run record (${response.status})`);
  }

  return response.json() as Promise<BuyerRunDetail>;
}

export function useBuyerAppRunDetail(runId: string): BuyerAppRunDetailState {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["buyer-app-run", currentUser?.uid || "anonymous", runId],
    enabled: Boolean(currentUser && !loading && runId),
    queryFn: () => fetchBuyerRunDetail(currentUser!, runId),
    staleTime: 30_000,
  });

  return useMemo(
    () => ({
      run: query.data || null,
      notFound: query.isFetched && query.data === null,
      isLoading: loading || query.isLoading,
      error: query.error instanceof Error ? query.error : null,
    }),
    [loading, query.data, query.error, query.isFetched, query.isLoading],
  );
}

export function runDisplayName(run: BuyerRunRecord) {
  return run.site_slug || run.site_submission_id || run.capture_job_id || run.job_id;
}

export function runStatusLabel(status: string | null | undefined) {
  if (!status || status === "unknown") {
    return "Not recorded";
  }
  if (status === "queued_for_pipeline") {
    return "Queued";
  }
  if (status === "pipeline_running") {
    return "Running";
  }
  if (status === "completed") {
    return "Completed";
  }
  if (status === "failed") {
    return "Failed";
  }
  if (status === "pipeline_forward_failed") {
    return "Forward failed";
  }
  return status.replace(/_/g, " ");
}

export function runStatusTone(
  status: string | null | undefined,
): NonNullable<StatusChipProps["tone"]> {
  if (status === "completed") {
    return "proof";
  }
  if (status === "failed" || status === "pipeline_forward_failed") {
    return "block";
  }
  if (status === "queued_for_pipeline") {
    return "warn";
  }
  if (status === "pipeline_running") {
    return "info";
  }
  return "neutral";
}

export function entitlementDisplayName(entitlement: BuyerEntitlement) {
  return entitlement.title || entitlement.sku || entitlement.id;
}

export function entitlementScope(entitlement: BuyerEntitlement) {
  const parts = [
    entitlement.license_tier,
    entitlement.exclusivity,
    entitlement.delivery_mode,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Scope recorded on the order";
}

export function formatEntitlementDate(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function entitlementStateLabel(state: string | null | undefined) {
  if (state === "provisioned") {
    return "Provisioned";
  }
  if (state === "manual_review_required") {
    return "Review required";
  }
  if (state === "revoked") {
    return "Revoked";
  }
  if (state === "expired") {
    return "Expired";
  }
  return state ? state.replace(/_/g, " ") : "Pending";
}

export function entitlementStateTone(
  state: string | null | undefined,
): NonNullable<StatusChipProps["tone"]> {
  if (state === "provisioned") {
    return "proof";
  }
  if (state === "manual_review_required") {
    return "warn";
  }
  if (state === "revoked") {
    return "block";
  }
  if (state === "expired") {
    return "block";
  }
  return "neutral";
}
