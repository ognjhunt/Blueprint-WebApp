import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";

import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { StatusChipProps } from "@/components/blueprint";

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
