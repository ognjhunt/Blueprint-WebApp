import type { Dispatch, SetStateAction } from "react";

export type CampaignKitResponse = {
  ok: boolean;
  kit?: CampaignKit;
  error?: string;
};

export type CampaignKit = {
  offer: {
    skuName: string;
    assetGoal: string;
    heroLabel: string;
    audience: string;
    workflow: string;
    siteType: string;
    callToAction: string;
  };
  landingPage: {
    heroHeadlineOptions: string[];
    proofBullets: string[];
    cta: string;
  };
  prompts: {
    googleImagePrompt: string;
    nanoBananaVariants: string[];
    runwayPrompt: string;
  };
  remotionStoryboard: Array<{
    startFrame: number;
    durationFrames: number;
    title: string;
    copy: string;
    visual: string;
  }>;
  emailDraft: {
    subjectOptions: string[];
    previewText: string;
    body: string;
  };
  outboundSequence: Array<{
    step: number;
    channel: string;
    goal: string;
    subject: string | null;
  }>;
  provenanceGuardrails: string[];
};

export type CampaignKitFormState = {
  skuName: string;
  audience: string;
  siteType: string;
  workflow: string;
  callToAction: string;
  proofPoints: string;
  differentiators: string;
  assetGoal: string;
  recipientEmails: string;
  imageAspectRatio: string;
  imageSize: string;
  thinkingLevel: string;
  videoRatio: string;
  videoDuration: string;
};

export type ProviderStatus = {
  configured?: boolean;
  available?: boolean;
  model?: string;
  executionState?: string;
  note?: string;
  lastError?: string | null;
};

export type ImageGenerationResponse = {
  ok: boolean;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: string | null;
  images?: Array<{
    mimeType: string;
    imageBytes: string;
    dataUrl: string;
  }>;
  providerStatus?: ProviderStatus;
  error?: string;
};

export type CampaignCreateResponse = {
  ok: boolean;
  id?: string;
  error?: string;
};

export type QueueSendResponse = {
  ok?: boolean;
  result?: {
    state?: string;
    ledgerDocId?: string;
  };
  error?: string;
};

export type LifecycleRunResponse = {
  ok?: boolean;
  count?: number;
  results?: Array<{
    entitlementId: string;
    buyerEmail: string;
    lifecycleStage: string;
    ledgerDocId: string;
    state: string;
  }>;
  error?: string;
};

export type NotionSyncResponse = {
  ok?: boolean;
  result?: {
    processedCount: number;
    failedCount: number;
  };
  error?: string;
};

export type VerifyResponse = {
  analytics?: {
    firstPartyIngest?: {
      enabled?: boolean;
      verificationLogged?: boolean;
      persisted?: boolean;
      error?: string | null;
    };
    ga4?: {
      configured?: boolean;
      measurementConfigured?: boolean;
      liveAccessConfigured?: boolean;
      propertyIdConfigured?: boolean;
      credentialsConfigured?: boolean;
      note?: string;
    };
    posthog?: { configured?: boolean };
    alignment?: {
      externalConfigured?: boolean;
      firstPartyEnabled?: boolean;
      note?: string;
    };
  };
  telephony?: { configured?: boolean; forwardNumberConfigured?: boolean };
  researchOutbound?: {
    configured?: boolean;
    topicsConfigured?: boolean;
    recipientsConfigured?: boolean;
  };
  runway?: { configured?: boolean; baseUrl?: string; version?: string };
  elevenlabs?: { configured?: boolean; agentConfigured?: boolean; modelId?: string | null };
  sendgrid?: { enabled?: boolean; configured?: boolean; provider?: string | null };
  sendgridWebhook?: { configured?: boolean };
  googleImage?: ProviderStatus;
};

export type RunwayTask = {
  id: string;
  status: string;
  createdAt?: string | null;
  failure?: string | null;
  output?: Array<string | { url?: string | null }> | null;
  progress?: number | null;
  model?: string | null;
};

export type RunwayVideoResponse = {
  ok: boolean;
  task?: RunwayTask;
  requestedBy?: string;
  error?: string;
};

export type CampaignRecord = {
  id: string;
  name?: string;
  subject?: string;
  channel?: string;
  send_status?: string;
  recipient_count?: number;
  last_ledger_doc_id?: string | null;
  last_execution_error?: string | null;
  approval_reason?: string | null;
  rejected_reason?: string | null;
  response_tracking?: {
    last_event_type?: string | null;
    last_event_at?: string | null;
    last_recipient?: string | null;
  };
  event_counts?: Record<string, number>;
};

export type CampaignListResponse = {
  localCampaigns: CampaignRecord[];
};

export type ShipBroadcastApprovalRecord = {
  id: string;
  name: string;
  subject: string;
  recipientCount: number;
  sendStatus: string;
  createdAt: string | null;
  lastLedgerDocId: string | null;
  approvalReason: string | null;
  assetKey: string | null;
  assetType: string | null;
  sourceIssueIds: string[];
  proofLinks: string[];
};

export type ShipBroadcastApprovalQueueResponse = {
  items: ShipBroadcastApprovalRecord[];
};

export type CreativeRunRecord = {
  id: string;
  status: string;
  skuName: string;
  researchTopic: string | null;
  rolloutVariant: string | null;
  createdAt: string | null;
  generatedImages: number;
  executionHandoff: {
    issueId: string | null;
    status: string | null;
    assignee: string | null;
    error: string | null;
  } | null;
  buyerObjections: string[];
  remotionReel: {
    status: string | null;
    outputPath: string | null;
    storageUri: string | null;
    signedUrl: string | null;
    durationSeconds: number | null;
    frames: number | null;
    error: string | null;
  };
};

export type CreativeRunsResponse = {
  items: CreativeRunRecord[];
};

export type AdStudioRunRecord = {
  id: string;
  lane: "capturer" | "buyer";
  status: string;
  audience: string;
  cta: string;
  city: string | null;
  aspectRatio: string;
  claimsLedger: {
    allowedClaims: string[];
    blockedClaims: string[];
    evidenceLinks: string[];
    reviewDecision: string;
    reviewNotes: string[];
  };
  brief: {
    visualDirection: string;
    copyHooks: string[];
  } | null;
  promptPack: {
    imagePromptVariants: string[];
    videoPrompt: string;
    headlineOptions: string[];
    primaryTextOptions: string[];
  } | null;
  assets: Array<{
    type: "image" | "video";
    role: string;
    uri: string;
    provider: string;
    prompt?: string | null;
    createdAtIso: string;
  }>;
  imageExecutionHandoff: {
    issueId: string | null;
    status: string;
    assignee: string;
    error: string | null;
  } | null;
  videoTask: {
    taskId: string | null;
    status: string;
    firstFrameUrl: string | null;
    ratio: string | null;
    promptText: string | null;
  } | null;
  review: {
    status: string;
    reasons: string[];
    headline: string | null;
    primaryText: string | null;
  };
  metaDraft: {
    campaignId: string | null;
    adSetId: string | null;
    creativeId?: string | null;
    adId: string | null;
    status: string;
    provider?: "graph_api" | "ads_cli" | null;
    provenanceIds?: string[];
    ledgerLink?: string | null;
  };
  createdAtIso: string;
  updatedAtIso: string;
};

export type AdStudioRunsResponse = {
  items: AdStudioRunRecord[];
};

export type AdStudioFormState = {
  lane: string;
  audience: string;
  city: string;
  cta: string;
  budgetCapUsd: string;
  aspectRatio: string;
  allowedClaims: string;
  blockedClaims: string;
  firstFrameUrl: string;
  reviewHeadline: string;
  reviewPrimaryText: string;
  metaAccountId: string;
  metaPageId: string;
  metaVideoId: string;
  metaProvider: string;
  metaMediaPath: string;
  metaMediaType: string;
  metaCallToAction: string;
  metaDestinationUrl: string;
  metaCampaignName: string;
};

export type AdStudioReviewDraft = {
  headline: string;
  primaryText: string;
};

export type AdStudioMetaDraft = {
  accountId: string;
  pageId: string;
  videoId: string;
  provider: string;
  mediaPath: string;
  mediaType: string;
  callToAction: string;
  destinationUrl: string;
  campaignName: string;
};

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
