import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type {
  PilotDataUsePermissions,
  PilotOpportunityVisibility,
} from "@/types/inbound-request";

export type PilotOpportunityRecord = {
  opportunity_id: string;
  access_level: "anonymized" | "shortlisted_confidential";
  visibility: PilotOpportunityVisibility;
  site_name: string | null;
  site_location: string | null;
  site_type: string | null;
  workflow: string;
  anonymized_summary: string | null;
  benchmark_profile: string;
  object_profile: string | null;
  operational_profile: string | null;
  integration_environment: string | null;
  rollout_readiness: string | null;
  data_use_permissions: PilotDataUsePermissions;
  underlying_site_files: "hosted_not_downloadable";
  controlled_evaluation: "request_required";
  compute_responsibility: string;
  qualification_outcome: "evaluation_candidate";
  qualification_state: "qualified_ready";
  opportunity_state: "handoff_ready";
  deployment_readiness: "not_established";
  claim_ceiling: string;
};

type PilotOpportunitiesResponse = {
  ok: true;
  opportunities: PilotOpportunityRecord[];
  proof_boundary: string;
};

export function usePilotOpportunities() {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["pilot-opportunities", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser && !loading),
    queryFn: async () => {
      const response = await fetch("/api/pilot-opportunities", {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(
          currentUser,
          await withCsrfHeader({}),
        ),
      });
      if (!response.ok) {
        throw new Error(`Private opportunities unavailable (${response.status})`);
      }
      return response.json() as Promise<PilotOpportunitiesResponse>;
    },
    staleTime: 30_000,
  });

  return useMemo(
    () => ({
      opportunities: query.data?.opportunities || [],
      proofBoundary: query.data?.proof_boundary || null,
      isLoading: loading || query.isLoading,
      error: query.error instanceof Error ? query.error : null,
    }),
    [loading, query.data, query.error, query.isLoading],
  );
}
