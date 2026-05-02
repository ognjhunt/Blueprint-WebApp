declare module "../../../../../server/utils/agentSpendLedger.js" {
  export type AgentSpendRequestRecordLike = {
    id: string;
    status: string;
    amountUsd: number;
    vendorName: string;
    provider: string;
  };

  export function requestAgentSpend(input: unknown): Promise<AgentSpendRequestRecordLike>;
}

declare module "../../../../../server/utils/growth-ops.js" {
  export type GrowthCampaignRecordLike = {
    id: string;
  };

  export function queueGrowthCampaignSend(input: {
    campaignId: string;
    operatorEmail: string;
  }): Promise<{
    ledgerDocId?: string;
    state: string;
  }>;

  export function createGrowthCampaignDraft(input: Record<string, unknown>): Promise<GrowthCampaignRecordLike>;
  export function getGrowthCampaignRecord(campaignId: string): Promise<Record<string, unknown> | null>;
}
