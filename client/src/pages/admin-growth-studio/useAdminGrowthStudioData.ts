import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";
import type {
  AdStudioRunsResponse,
  CampaignListResponse,
  CreativeRunsResponse,
  ShipBroadcastApprovalQueueResponse,
} from "./types";

type AdminGrowthStudioDataHandlers = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onShipBroadcastRejected?: (ledgerId: string) => void;
};

export function useAdminGrowthStudioData({
  onNotice,
  onError,
  onShipBroadcastRejected,
}: AdminGrowthStudioDataHandlers) {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery<CampaignListResponse>({
    queryKey: ["admin-growth-campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/admin/growth/campaigns", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch growth campaigns");
      }
      return response.json();
    },
  });

  const creativeRunsQuery = useQuery<CreativeRunsResponse>({
    queryKey: ["admin-growth-creative-runs"],
    queryFn: async () => {
      const response = await fetch("/api/admin/growth/creative-runs?limit=8", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch creative runs");
      }
      return response.json();
    },
  });

  const adStudioRunsQuery = useQuery<AdStudioRunsResponse>({
    queryKey: ["admin-growth-ad-studio-runs"],
    queryFn: async () => {
      const response = await fetch("/api/admin/growth/ad-studio/runs?limit=12", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Ad Studio runs");
      }
      return response.json();
    },
  });

  const shipBroadcastApprovalQueueQuery = useQuery<ShipBroadcastApprovalQueueResponse>({
    queryKey: ["admin-growth-ship-broadcast-approval-queue"],
    queryFn: async () => {
      const response = await fetch("/api/admin/growth/campaigns/ship-broadcast/pending-approval?limit=8", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch ship-broadcast approval queue");
      }
      return response.json();
    },
  });

  const approveShipBroadcastMutation = useMutation({
    mutationFn: async (ledgerId: string) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/approve`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) {
        throw new Error("Failed to approve ship-broadcast draft");
      }
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-growth-campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-growth-ship-broadcast-approval-queue"] }),
      ]);
      onNotice("Ship-broadcast draft approved and sent.");
    },
    onError: (mutationError) => {
      onError(mutationError instanceof Error ? mutationError.message : "Failed to approve ship-broadcast draft");
    },
  });

  const rejectShipBroadcastMutation = useMutation({
    mutationFn: async ({ ledgerId, reason }: { ledgerId: string; reason: string }) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/reject`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        throw new Error("Failed to reject ship-broadcast draft");
      }
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      onShipBroadcastRejected?.(variables.ledgerId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-growth-campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-growth-ship-broadcast-approval-queue"] }),
      ]);
      onNotice("Ship-broadcast draft rejected.");
    },
    onError: (mutationError) => {
      onError(mutationError instanceof Error ? mutationError.message : "Failed to reject ship-broadcast draft");
    },
  });

  async function refreshCampaigns() {
    await campaignsQuery.refetch();
    await shipBroadcastApprovalQueueQuery.refetch();
  }

  async function refreshCreativeRuns() {
    await creativeRunsQuery.refetch();
  }

  async function refreshAdStudioRuns() {
    await adStudioRunsQuery.refetch();
  }

  return {
    campaignsQuery,
    creativeRunsQuery,
    adStudioRunsQuery,
    shipBroadcastApprovalQueueQuery,
    approveShipBroadcastMutation,
    rejectShipBroadcastMutation,
    refreshCampaigns,
    refreshCreativeRuns,
    refreshAdStudioRuns,
  };
}
