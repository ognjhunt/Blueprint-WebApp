import { getConfiguredEnvValue, requireConfiguredEnvValue } from "../config/env";

function nitrosendBaseUrl() {
  return requireConfiguredEnvValue(
    ["NITROSEND_BASE_URL"],
    "Nitrosend integration",
  );
}

function nitrosendApiKey() {
  return requireConfiguredEnvValue(
    ["NITROSEND_API_KEY"],
    "Nitrosend integration",
  );
}

async function nitrosendRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${nitrosendBaseUrl().replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${nitrosendApiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Nitrosend ${response.status}: ${text.slice(0, 300)}`);
  }

  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export interface NitrosendCampaign {
  id: string;
  name: string;
  status?: string;
  audienceId?: string;
  sequenceId?: string;
}

export async function listNitrosendCampaigns() {
  const payload = await nitrosendRequest<{ items?: NitrosendCampaign[] }>("/campaigns", {
    method: "GET",
  });
  return payload.items || [];
}

export async function createNitrosendCampaignDraft(params: Record<string, unknown>) {
  return nitrosendRequest<NitrosendCampaign>("/campaigns/drafts", {
    method: "POST",
    body: JSON.stringify({
      ...params,
      status: "draft",
    }),
  });
}

export async function approveNitrosendCampaignSend(
  campaignId: string,
  approvedBy: string,
  approvalNote?: string,
) {
  return nitrosendRequest<Record<string, unknown>>(
    `/campaigns/${encodeURIComponent(campaignId)}/approve-send`,
    {
      method: "POST",
      body: JSON.stringify({
        approvedBy,
        approvalNote: approvalNote || null,
      }),
    },
  );
}

export async function sendNitrosendCampaign(
  campaignId: string,
  approvedBy?: string,
  approvalNote?: string,
) {
  return nitrosendRequest<Record<string, unknown>>(
    `/campaigns/${encodeURIComponent(campaignId)}/send`,
    {
      method: "POST",
      body: JSON.stringify({
        approvedBy: approvedBy || "approved-operator",
        approvalNote: approvalNote || null,
      }),
    },
  );
}

export function getNitrosendStatus() {
  return {
    configured: Boolean(
      getConfiguredEnvValue("NITROSEND_BASE_URL") &&
      getConfiguredEnvValue("NITROSEND_API_KEY"),
    ),
  };
}
