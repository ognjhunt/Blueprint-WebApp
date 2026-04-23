import {
  getConfiguredEnvValue,
  requireConfiguredEnvValue,
} from "../config/env";

const DEFAULT_META_MARKETING_API_BASE_URL = "https://graph.facebook.com";
const DEFAULT_META_MARKETING_API_VERSION = "v23.0";
const DEFAULT_TARGETING_COUNTRY = "US";

export interface CreatePausedMetaDraftInput {
  accountId: string;
  campaignName: string;
  objective: string;
  dailyBudgetMinorUnits: number;
  primaryText: string;
  headline: string;
  videoId: string;
  destinationUrl: string;
  pageId?: string | null;
  adSetName?: string | null;
  adName?: string | null;
  campaignNameOverride?: string | null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metaBaseUrl() {
  return (
    getConfiguredEnvValue("META_MARKETING_API_BASE_URL")
    || DEFAULT_META_MARKETING_API_BASE_URL
  ).replace(/\/+$/, "");
}

function metaApiVersion() {
  return getConfiguredEnvValue("META_MARKETING_API_VERSION") || DEFAULT_META_MARKETING_API_VERSION;
}

function metaAccessToken() {
  return requireConfiguredEnvValue(
    ["META_MARKETING_API_ACCESS_TOKEN"],
    "Meta Marketing API draft creation",
  );
}

function normalizeAccountId(accountId: string) {
  const normalized = normalizeString(accountId).replace(/^act_/i, "");
  if (!normalized) {
    throw new Error("Meta Marketing API draft creation requires an ad account id.");
  }
  return normalized;
}

function assertCreateInput(input: CreatePausedMetaDraftInput) {
  const campaignName = normalizeString(input.campaignName || input.campaignNameOverride);
  const objective = normalizeString(input.objective);
  const primaryText = normalizeString(input.primaryText);
  const headline = normalizeString(input.headline);
  const videoId = normalizeString(input.videoId);
  const destinationUrl = normalizeString(input.destinationUrl);
  const pageId = normalizeString(input.pageId) || getConfiguredEnvValue("META_PAGE_ID") || "";
  const dailyBudgetMinorUnits = Number(input.dailyBudgetMinorUnits);

  if (
    !campaignName
    || !objective
    || !primaryText
    || !headline
    || !videoId
    || !destinationUrl
    || !pageId
    || !Number.isFinite(dailyBudgetMinorUnits)
    || dailyBudgetMinorUnits <= 0
  ) {
    throw new Error(
      "Meta Marketing API draft creation requires campaign name, objective, copy, video id, destination URL, page id, and budget.",
    );
  }

  return {
    accountId: normalizeAccountId(input.accountId),
    campaignName,
    objective,
    primaryText,
    headline,
    videoId,
    destinationUrl,
    pageId,
    dailyBudgetMinorUnits,
    adSetName: normalizeString(input.adSetName) || `${campaignName} Ad Set`,
    adName: normalizeString(input.adName) || `${campaignName} Ad`,
  };
}

async function parseMetaResponse(response: Response | Pick<Response, "ok" | "status" | "text">) {
  const text = await response.text();
  const payload = text.trim().length > 0 ? JSON.parse(text) as Record<string, unknown> : {};

  if (!response.ok) {
    const errorMessage =
      typeof payload.error === "object" && payload.error
        ? String((payload.error as Record<string, unknown>).message || "Unknown Meta API error")
        : typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : text.slice(0, 300) || "Unknown Meta API error";
    throw new Error(`Meta ${response.status}: ${errorMessage}`);
  }

  return payload;
}

async function postForm(
  fetchImpl: typeof fetch,
  url: string,
  payload: Record<string, string>,
  accessToken: string,
) {
  const body = new URLSearchParams({
    ...payload,
    access_token: accessToken,
  });

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  return await parseMetaResponse(response);
}

export async function createPausedMetaDraft(
  input: CreatePausedMetaDraftInput,
  fetchImpl: typeof fetch = fetch,
) {
  const normalized = assertCreateInput(input);
  const accessToken = metaAccessToken();
  const baseUrl = metaBaseUrl();
  const apiVersion = metaApiVersion();
  const accountPath = `${baseUrl}/${apiVersion}/act_${normalized.accountId}`;

  const campaign = await postForm(
    fetchImpl,
    `${accountPath}/campaigns`,
    {
      name: normalized.campaignName,
      objective: normalized.objective,
      status: "PAUSED",
      special_ad_categories: "[]",
    },
    accessToken,
  );

  const adSet = await postForm(
    fetchImpl,
    `${accountPath}/adsets`,
    {
      name: normalized.adSetName,
      campaign_id: String(campaign.id || ""),
      status: "PAUSED",
      daily_budget: String(Math.round(normalized.dailyBudgetMinorUnits)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      destination_type: "WEBSITE",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify({
        geo_locations: {
          countries: [DEFAULT_TARGETING_COUNTRY],
        },
      }),
    },
    accessToken,
  );

  const creative = {
    object_story_spec: {
      page_id: normalized.pageId,
      video_data: {
        video_id: normalized.videoId,
        message: normalized.primaryText,
        title: normalized.headline,
        call_to_action: {
          type: "LEARN_MORE",
          value: {
            link: normalized.destinationUrl,
          },
        },
      },
    },
  };

  const ad = await postForm(
    fetchImpl,
    `${accountPath}/ads`,
    {
      name: normalized.adName,
      adset_id: String(adSet.id || ""),
      status: "PAUSED",
      creative: JSON.stringify(creative),
    },
    accessToken,
  );

  return {
    campaignId: String(campaign.id || ""),
    adSetId: String(adSet.id || ""),
    adId: String(ad.id || ""),
  };
}
