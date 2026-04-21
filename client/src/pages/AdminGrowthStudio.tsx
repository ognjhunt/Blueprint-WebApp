import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2 } from "lucide-react";
import { withCsrfHeader } from "@/lib/csrf";
import { analyticsEvents } from "@/components/Analytics";

type CampaignKitResponse = {
  ok: boolean;
  kit?: {
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
  error?: string;
};

type ProviderStatus = {
  configured?: boolean;
  available?: boolean;
  model?: string;
  executionState?: string;
  note?: string;
  lastError?: string | null;
};

type ImageGenerationResponse = {
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

type CampaignCreateResponse = {
  ok: boolean;
  id?: string;
  error?: string;
};

type QueueSendResponse = {
  ok?: boolean;
  result?: {
    state?: string;
    ledgerDocId?: string;
  };
  error?: string;
};

type LifecycleRunResponse = {
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

type NotionSyncResponse = {
  ok?: boolean;
  result?: {
    processedCount: number;
    failedCount: number;
  };
  error?: string;
};

type VerifyResponse = {
  analytics?: {
    firstPartyIngest?: {
      enabled?: boolean;
      verificationLogged?: boolean;
      persisted?: boolean;
      error?: string | null;
    };
    ga4?: { configured?: boolean };
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

type RunwayTask = {
  id: string;
  status: string;
  createdAt?: string | null;
  failure?: string | null;
  output?: Array<string | { url?: string | null }> | null;
  progress?: number | null;
  model?: string | null;
};

type RunwayVideoResponse = {
  ok: boolean;
  task?: RunwayTask;
  requestedBy?: string;
  error?: string;
};

type CampaignRecord = {
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

type CampaignListResponse = {
  localCampaigns: CampaignRecord[];
};

type ShipBroadcastApprovalRecord = {
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

type ShipBroadcastApprovalQueueResponse = {
  items: ShipBroadcastApprovalRecord[];
};

type CreativeRunRecord = {
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

type CreativeRunsResponse = {
  items: CreativeRunRecord[];
};

function metricValue(record: CampaignRecord, key: string) {
  return Number(record.event_counts?.[key] || 0);
}

function formatEventTime(value: string | null | undefined) {
  if (!value) return "No events yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminGrowthStudio() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    skuName: "Exact-Site Hosted Review",
    audience: "robotics deployment leads",
    siteType: "warehouse",
    workflow: "pre-deployment site review",
    callToAction: "Book a 30-minute exact-site hosted-review scoping call.",
    proofPoints:
      "One real facility\nCapture-backed package\nHosted review tied to the same site",
    differentiators:
      "Rights and provenance stay explicit\nNo generic synthetic stand-ins\nHuman gates on pricing and legal",
    assetGoal: "landing_page",
    recipientEmails: "",
    imageAspectRatio: "16:9",
    imageSize: "1K",
    thinkingLevel: "HIGH",
    videoRatio: "1280:720",
    videoDuration: "5",
  });
  const [kit, setKit] = useState<CampaignKitResponse["kit"] | null>(null);
  const [images, setImages] = useState<ImageGenerationResponse["images"]>([]);
  const [imageProviderStatus, setImageProviderStatus] = useState<ProviderStatus | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [runwayTask, setRunwayTask] = useState<RunwayTask | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [lifecycleDays, setLifecycleDays] = useState(30);
  const [lifecycleResult, setLifecycleResult] = useState<LifecycleRunResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadingKit, setLoadingKit] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [renderingProofReel, setRenderingProofReel] = useState(false);
  const [runningLifecycle, setRunningLifecycle] = useState(false);
  const [runningExperimentRollout, setRunningExperimentRollout] = useState(false);
  const [runningAutonomousOutbound, setRunningAutonomousOutbound] = useState(false);
  const [runningCreativeFactory, setRunningCreativeFactory] = useState(false);
  const [runningNotionSync, setRunningNotionSync] = useState(false);
  const [shipBroadcastRejectReasons, setShipBroadcastRejectReasons] = useState<Record<string, string>>({});

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
      setNotice("Ship-broadcast draft approved and sent.");
      setError("");
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to approve ship-broadcast draft");
      setNotice("");
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
      setShipBroadcastRejectReasons((current) => ({
        ...current,
        [variables.ledgerId]: "",
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-growth-campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-growth-ship-broadcast-approval-queue"] }),
      ]);
      setNotice("Ship-broadcast draft rejected.");
      setError("");
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to reject ship-broadcast draft");
      setNotice("");
    },
  });

  async function refreshCampaigns() {
    await campaignsQuery.refetch();
    await shipBroadcastApprovalQueueQuery.refetch();
  }

  async function refreshCreativeRuns() {
    await creativeRunsQuery.refetch();
  }

  async function generateCampaignKit() {
    setLoadingKit(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/creative/campaign-kit", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...form,
          proofPoints: form.proofPoints.split("\n").map((line) => line.trim()).filter(Boolean),
          differentiators: form.differentiators.split("\n").map((line) => line.trim()).filter(Boolean),
        }),
      });
      const json = (await response.json()) as CampaignKitResponse;
      if (!response.ok || !json.ok || !json.kit) {
        throw new Error(json.error || "Failed to generate campaign kit");
      }

      setKit(json.kit);
      setNotice("Campaign kit generated from the current proof-led brief.");
      analyticsEvents.campaignKitGenerated(form.assetGoal, form.skuName);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate campaign kit");
    } finally {
      setLoadingKit(false);
    }
  }

  async function generateImage() {
    setLoadingImage(false);
    setImages([]);
    setImageProviderStatus({
      configured: false,
      available: false,
      model: "disabled_by_policy",
      executionState: "not_configured",
      note:
        "Server-side paid image generation is disabled. Route image-heavy work to webapp-codex and use Codex desktop OAuth image generation on gpt-image-2 there.",
      lastError: null,
    });
    setError("");
    setNotice(
      "Server-side image generation is disabled by policy. Use the creative factory handoff or a webapp-codex issue for Codex OAuth image execution on gpt-image-2.",
    );
  }

  async function refreshRunwayTask(taskId: string) {
    const response = await fetch(`/api/admin/creative/video-tasks/${encodeURIComponent(taskId)}`, {
      headers: await withCsrfHeader({}),
    });
    const json = (await response.json()) as RunwayVideoResponse;
    if (!response.ok || !json.ok || !json.task) {
      throw new Error(json.error || "Failed to fetch video task status");
    }
    setRunwayTask(json.task);
    return json.task;
  }

  async function generateVideo() {
    if (!kit?.prompts.runwayPrompt) return;
    if (!images?.[0]?.dataUrl) {
      setError("Generate a proof-led image first so the OpenRouter clip stays anchored to real Blueprint evidence.");
      setNotice("");
      return;
    }
    setLoadingVideo(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/creative/generate-video", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          promptText: kit.prompts.runwayPrompt,
          promptImage: images?.[0]?.dataUrl || null,
          ratio: form.videoRatio,
          duration: Number(form.videoDuration || 5),
        }),
      });
      const json = (await response.json()) as RunwayVideoResponse;
      if (!response.ok || !json.ok || !json.task) {
        throw new Error(json.error || "Failed to start OpenRouter video generation");
      }

      setRunwayTask(json.task);
      setNotice(`OpenRouter video task ${json.task.id} started.`);
      analyticsEvents.creativeVideoRequested(form.assetGoal, form.videoRatio);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to start video generation",
      );
    } finally {
      setLoadingVideo(false);
    }
  }

  async function createCampaign() {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/campaigns", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: `${form.skuName} ${form.assetGoal}`.trim(),
          subject: kit?.emailDraft.subjectOptions[0] || `${form.skuName} follow-up`,
          body: kit?.emailDraft.body || "",
          channel: "sendgrid",
          recipientEmails: form.recipientEmails
            .split(/[\n,]+/)
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const json = (await response.json()) as CampaignCreateResponse;
      if (!response.ok || !json.ok || !json.id) {
        throw new Error(json.error || "Failed to create campaign");
      }
      setCampaignId(json.id);
      setNotice(`Campaign draft ${json.id} created.`);
      await refreshCampaigns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create campaign");
    }
  }

  async function queueCampaignSend() {
    if (!campaignId) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/campaigns/${campaignId}/queue-send`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as QueueSendResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to queue campaign send");
      }
      setNotice(
        json.result?.state === "pending_approval"
          ? `Campaign ${campaignId} is now parked in the approval queue.`
          : `Campaign ${campaignId} send state: ${json.result?.state || "queued"}.`,
      );
      await refreshCampaigns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to queue campaign send");
    }
  }

  async function verifyIntegrations() {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/integrations/verify", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) {
        throw new Error("Failed to verify integrations");
      }
      const json = (await response.json()) as VerifyResponse;
      setVerifyResult(json);
      setNotice("Integration status refreshed.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to verify integrations");
    }
  }

  async function renderProofReel() {
    setRenderingProofReel(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/creative/render-proof-reel", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as { ok?: boolean; outputPath?: string; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to render proof reel");
      }
      setNotice(`Proof reel rendered to ${json.outputPath || "/proof/blueprint-proof-reel.mp4"}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to render proof reel");
    } finally {
      setRenderingProofReel(false);
    }
  }

  async function runLifecycle() {
    setRunningLifecycle(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/lifecycle/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ daysSinceGrant: lifecycleDays }),
      });
      const json = (await response.json()) as LifecycleRunResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to run lifecycle automation");
      }
      setLifecycleResult(json);
      setNotice(`Queued ${json.count || 0} lifecycle follow-up items for review.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run lifecycle automation");
    } finally {
      setRunningLifecycle(false);
    }
  }

  async function runExperimentRollout() {
    setRunningExperimentRollout(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/automation/experiments/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as { ok?: boolean; count?: number; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to run experiment autorollout");
      }
      setNotice(`Experiment autorollout evaluated ${json.count || 0} experiment(s).`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run experiment autorollout");
    } finally {
      setRunningExperimentRollout(false);
    }
  }

  async function runAutonomousOutbound() {
    setRunningAutonomousOutbound(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/automation/outbound/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as { ok?: boolean; count?: number; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to run autonomous outbound");
      }
      setNotice(`Autonomous outbound processed ${json.count || 0} topic(s).`);
      await refreshCampaigns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run autonomous outbound");
    } finally {
      setRunningAutonomousOutbound(false);
    }
  }

  async function runCreativeFactory() {
    setRunningCreativeFactory(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/automation/creative/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as { ok?: boolean; status?: string; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to run creative factory");
      }
      setNotice(`Creative factory run status: ${json.status || "completed"}.`);
      await refreshCreativeRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run creative factory");
    } finally {
      setRunningCreativeFactory(false);
    }
  }

  async function syncNotionMirror() {
    setRunningNotionSync(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/notion/sync", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          limit: 50,
          refreshIntegrationSnapshot: true,
        }),
      });
      const json = (await response.json()) as NotionSyncResponse;
      if (!response.ok || !json.ok || !json.result) {
        throw new Error(json.error || "Failed to sync Growth Studio Notion mirror");
      }
      setNotice(
        `Notion mirror sync processed ${json.result.processedCount} row(s) with ${json.result.failedCount} failure(s).`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to sync Growth Studio Notion mirror",
      );
    } finally {
      setRunningNotionSync(false);
    }
  }

  const campaigns = campaignsQuery.data?.localCampaigns ?? [];
  const creativeRuns = creativeRunsQuery.data?.items ?? [];

  useEffect(() => {
    if (!runwayTask) return;
    if (!["PENDING", "THROTTLED", "RUNNING"].includes(runwayTask.status)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshRunwayTask(runwayTask.id).catch(() => undefined);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [runwayTask]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-center gap-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <Sparkles className="h-6 w-6 text-zinc-950" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Growth Studio
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Build proof-led campaign kits from real Blueprint surfaces
            </h1>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4">
              {[
                ["SKU", "skuName"],
                ["Audience", "audience"],
                ["Site Type", "siteType"],
                ["Workflow", "workflow"],
                ["Call To Action", "callToAction"],
              ].map(([label, key]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                    value={form[key as keyof typeof form]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">Asset Goal</span>
                <select
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
                  value={form.assetGoal}
                  onChange={(event) => setForm((current) => ({ ...current, assetGoal: event.target.value }))}
                >
                  <option value="landing_page">Landing page</option>
                  <option value="email_campaign">Email campaign</option>
                  <option value="outbound_sequence">Outbound sequence</option>
                  <option value="social_cutdown">Social cutdown</option>
                  <option value="proof_reel">Proof reel</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">Proof Points</span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                  value={form.proofPoints}
                  onChange={(event) => setForm((current) => ({ ...current, proofPoints: event.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">Differentiators</span>
                <textarea
                  className="min-h-24 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                  value={form.differentiators}
                  onChange={(event) => setForm((current) => ({ ...current, differentiators: event.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Recipients for early testing
                </span>
                <textarea
                  className="min-h-20 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                  value={form.recipientEmails}
                  onChange={(event) => setForm((current) => ({ ...current, recipientEmails: event.target.value }))}
                  placeholder="one email per line"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">Image aspect ratio</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                    value={form.imageAspectRatio}
                    onChange={(event) => setForm((current) => ({ ...current, imageAspectRatio: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">Image size</span>
                  <select
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
                    value={form.imageSize}
                    onChange={(event) => setForm((current) => ({ ...current, imageSize: event.target.value }))}
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">Thinking level</span>
                  <select
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
                    value={form.thinkingLevel}
                    onChange={(event) => setForm((current) => ({ ...current, thinkingLevel: event.target.value }))}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">Video ratio</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                    value={form.videoRatio}
                    onChange={(event) => setForm((current) => ({ ...current, videoRatio: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">Video duration (sec)</span>
                  <input
                    type="number"
                    min={5}
                    max={10}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                    value={form.videoDuration}
                    onChange={(event) => setForm((current) => ({ ...current, videoDuration: event.target.value }))}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Lifecycle follow-up threshold (days)
                </span>
                <input
                  type="number"
                  min={7}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                  value={lifecycleDays}
                  onChange={(event) => setLifecycleDays(Math.max(7, Number(event.target.value || 30)))}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateCampaignKit}
                disabled={loadingKit}
                className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {loadingKit ? "Generating…" : "Generate campaign kit"}
              </button>
              <button
                type="button"
                onClick={createCampaign}
                disabled={!kit}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                Create campaign draft
              </button>
              <button
                type="button"
                onClick={queueCampaignSend}
                disabled={!campaignId}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                Queue send for approval
              </button>
              <button
                type="button"
                onClick={renderProofReel}
                disabled={renderingProofReel}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                {renderingProofReel ? "Rendering reel…" : "Render proof reel"}
              </button>
              <button
                type="button"
                onClick={runLifecycle}
                disabled={runningLifecycle}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                {runningLifecycle ? "Running lifecycle…" : "Queue lifecycle emails"}
              </button>
              <button
                type="button"
                onClick={verifyIntegrations}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400"
              >
                Verify integrations
              </button>
              <button
                type="button"
                onClick={syncNotionMirror}
                disabled={runningNotionSync}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                {runningNotionSync ? "Syncing Notion…" : "Sync Notion mirror"}
              </button>
              <button
                type="button"
                onClick={runExperimentRollout}
                disabled={runningExperimentRollout}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                {runningExperimentRollout ? "Running rollout…" : "Run experiment rollout"}
              </button>
              <button
                type="button"
                onClick={runAutonomousOutbound}
                disabled={runningAutonomousOutbound}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                {runningAutonomousOutbound ? "Running outbound…" : "Run autonomous outbound"}
              </button>
              <button
                type="button"
                onClick={runCreativeFactory}
                disabled={runningCreativeFactory}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                {runningCreativeFactory ? "Running creative factory…" : "Run creative factory"}
              </button>
              <button
                type="button"
                onClick={generateVideo}
                disabled={!kit || loadingVideo || !images?.[0]?.dataUrl}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                <Wand2 className="h-4 w-4" />
                {loadingVideo ? "Starting video…" : "Start OpenRouter video"}
              </button>
              <button
                type="button"
                onClick={generateImage}
                disabled={!kit}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 disabled:opacity-60"
              >
                <Wand2 className="h-4 w-4" />
                Use Codex Image Lane
              </button>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
            {!error && notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
            {campaignId ? (
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
                Campaign draft: {campaignId}
              </p>
            ) : null}

            {verifyResult ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
                <p>First-party ingest enabled: {String(Boolean(verifyResult.analytics?.firstPartyIngest?.enabled))}</p>
                <p>First-party verification persisted: {String(Boolean(verifyResult.analytics?.firstPartyIngest?.persisted))}</p>
                <p>GA4 configured: {String(Boolean(verifyResult.analytics?.ga4?.configured))}</p>
                <p>PostHog configured: {String(Boolean(verifyResult.analytics?.posthog?.configured))}</p>
                <p>SendGrid configured: {String(Boolean(verifyResult.sendgrid?.configured))}</p>
                <p>SendGrid webhook configured: {String(Boolean(verifyResult.sendgridWebhook?.configured))}</p>
                <p>Server-side image generation: disabled by policy</p>
                <p>OpenRouter video configured: {String(Boolean(verifyResult.runway?.configured))}</p>
                <p>ElevenLabs configured: {String(Boolean(verifyResult.elevenlabs?.configured))}</p>
                <p>Telephony configured: {String(Boolean(verifyResult.telephony?.configured))}</p>
                <p>Research outbound configured: {String(Boolean(verifyResult.researchOutbound?.configured))}</p>
                <p>Google creative state: {verifyResult.googleImage?.executionState || "unknown"}</p>
                {verifyResult.analytics?.alignment?.note ? (
                  <p className="mt-2 text-zinc-600">{verifyResult.analytics.alignment.note}</p>
                ) : null}
                {verifyResult.googleImage?.note ? (
                  <p className="mt-2 text-zinc-600">{verifyResult.googleImage.note}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Ship-broadcast approval queue
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Fresh SendGrid ship-broadcast drafts already queued for human approval.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => shipBroadcastApprovalQueueQuery.refetch()}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700"
                >
                  Refresh
                </button>
              </div>

              {shipBroadcastApprovalQueueQuery.isLoading ? (
                <p className="mt-4 text-sm text-zinc-500">Loading approval queue…</p>
              ) : shipBroadcastApprovalQueueQuery.isError ? (
                <p className="mt-4 text-sm text-rose-700">Failed to load ship-broadcast approval queue.</p>
              ) : shipBroadcastApprovalQueueQuery.data?.items?.length ? (
                <div className="mt-4 space-y-3">
                  {shipBroadcastApprovalQueueQuery.data.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-950">{item.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{item.subject}</p>
                        </div>
                        <div className="text-right text-xs text-zinc-500">
                          <p>Status: {item.sendStatus}</p>
                          <p>Recipients: {item.recipientCount}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                        <p>Created: {formatEventTime(item.createdAt)}</p>
                        <p>Ledger: {item.lastLedgerDocId || "none"}</p>
                        <p>Asset key: {item.assetKey || "none"}</p>
                        <p>Source issues: {item.sourceIssueIds.length ? item.sourceIssueIds.join(", ") : "none"}</p>
                      </div>
                      {item.lastLedgerDocId ? (
                        <div className="mt-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <button
                              type="button"
                              onClick={() => approveShipBroadcastMutation.mutate(item.lastLedgerDocId!)}
                              disabled={approveShipBroadcastMutation.isPending || rejectShipBroadcastMutation.isPending}
                              className="rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {approveShipBroadcastMutation.isPending ? "Approving…" : "Approve and Send"}
                            </button>
                            <input
                              type="text"
                              value={shipBroadcastRejectReasons[item.lastLedgerDocId] || ""}
                              onChange={(event) =>
                                setShipBroadcastRejectReasons((current) => ({
                                  ...current,
                                  [item.lastLedgerDocId!]: event.target.value,
                                }))}
                              placeholder="Required reject reason"
                              className="min-w-[220px] rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700"
                              aria-label={`Reject reason for ${item.id}`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                rejectShipBroadcastMutation.mutate({
                                  ledgerId: item.lastLedgerDocId!,
                                  reason: (shipBroadcastRejectReasons[item.lastLedgerDocId!] || "").trim(),
                                })}
                              disabled={
                                approveShipBroadcastMutation.isPending
                                || rejectShipBroadcastMutation.isPending
                                || !(shipBroadcastRejectReasons[item.lastLedgerDocId!] || "").trim()
                              }
                              className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {rejectShipBroadcastMutation.isPending ? "Rejecting…" : "Reject"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {item.proofLinks.length ? (
                        <div className="mt-3 text-xs text-zinc-600">
                          <p className="font-medium text-zinc-800">Proof links</p>
                          {item.proofLinks.slice(0, 2).map((link) => (
                            <p key={link} className="truncate">{link}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No ship-broadcast drafts are currently waiting approval.</p>
              )}
            </div>

            {runwayTask ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
                <p>OpenRouter task id: {runwayTask.id}</p>
                <p>Status: {runwayTask.status}</p>
                <p>Model: {runwayTask.model || "bytedance/seedance-2.0-fast"}</p>
                {typeof runwayTask.progress === "number" ? (
                  <p>Progress: {Math.round(runwayTask.progress * 100)}%</p>
                ) : null}
                {runwayTask.failure ? (
                  <p className="mt-2 text-rose-700">{runwayTask.failure}</p>
                ) : null}
                {runwayTask.output?.length ? (
                  <div className="mt-3 space-y-2">
                    {runwayTask.output.map((item, index) => {
                      const url = typeof item === "string" ? item : item?.url || null;
                      if (!url) return null;
                      return (
                        <a
                          key={`${url}-${index}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-emerald-700 underline"
                        >
                          Open generated video {index + 1}
                        </a>
                      );
                    })}
                  </div>
                ) : null}
                {["PENDING", "THROTTLED", "RUNNING"].includes(runwayTask.status) ? (
                  <button
                    type="button"
                    onClick={() => void refreshRunwayTask(runwayTask.id)}
                    className="mt-3 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900"
                  >
                    Refresh video status
                  </button>
                ) : null}
              </div>
            ) : null}

            {imageProviderStatus ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
                <p>Google creative model: {imageProviderStatus.model || "unknown"}</p>
                <p>Execution state: {imageProviderStatus.executionState || "unknown"}</p>
                <p>Requested image size: {form.imageSize}</p>
                <p>Requested thinking level: {form.thinkingLevel}</p>
                {imageProviderStatus.note ? <p className="mt-2">{imageProviderStatus.note}</p> : null}
                {imageProviderStatus.lastError ? (
                  <p className="mt-2 text-rose-700">{imageProviderStatus.lastError}</p>
                ) : null}
              </div>
            ) : null}

            {lifecycleResult?.results?.length ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
                <p className="font-semibold text-zinc-950">
                  Lifecycle queue results ({lifecycleResult.count || lifecycleResult.results.length})
                </p>
                <div className="mt-3 space-y-2">
                  {lifecycleResult.results.slice(0, 5).map((item) => (
                    <div key={item.ledgerDocId} className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p>{item.buyerEmail}</p>
                      <p className="text-zinc-500">
                        {item.lifecycleStage} • {item.state} • {item.ledgerDocId}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Recent Creative Runs
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Durable creative-factory outputs for operators and Paperclip agents.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCreativeRuns()}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900 transition hover:border-zinc-400"
                >
                  Refresh runs
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {creativeRunsQuery.isLoading ? (
                  <p className="text-sm text-zinc-500">Loading creative runs…</p>
                ) : creativeRunsQuery.isError ? (
                  <p className="text-sm text-rose-700">Failed to load creative runs.</p>
                ) : creativeRuns.length === 0 ? (
                  <p className="text-sm text-zinc-500">No creative runs yet.</p>
                ) : (
                  creativeRuns.map((run) => (
                    <div key={run.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-950">{run.skuName}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                            {run.status} {run.rolloutVariant ? `• ${run.rolloutVariant}` : ""}
                          </p>
                        </div>
                        <p className="text-xs text-zinc-500">{run.createdAt || "Unknown time"}</p>
                      </div>
                      {run.researchTopic ? (
                        <p className="mt-2 text-xs text-zinc-600">Research topic: {run.researchTopic}</p>
                      ) : null}
                      {run.buyerObjections.length > 0 ? (
                        <p className="mt-2 text-xs text-zinc-600">
                          Buyer objections: {run.buyerObjections.join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-3 grid gap-2 text-xs text-zinc-600 md:grid-cols-2">
                        <p>Generated images: {run.generatedImages}</p>
                        <p>Reel status: {run.remotionReel.status || "none"}</p>
                      </div>
                      {run.executionHandoff ? (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                          <p className="font-medium text-zinc-950">Codex execution handoff</p>
                          <p className="mt-2">Issue: {run.executionHandoff.issueId || "none"}</p>
                          <p>Status: {run.executionHandoff.status || "unknown"}</p>
                          <p>Assignee: {run.executionHandoff.assignee || "unknown"}</p>
                          {run.executionHandoff.error ? (
                            <p className="mt-2 text-rose-700">{run.executionHandoff.error}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {run.remotionReel.storageUri ? (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                          <p className="text-xs font-medium text-zinc-950">Durable reel asset</p>
                          <p className="mt-2 break-all font-mono text-[11px] text-zinc-600">
                            {run.remotionReel.storageUri}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3">
                            {run.remotionReel.signedUrl ? (
                              <a
                                href={run.remotionReel.signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-700 underline"
                              >
                                Open reel
                              </a>
                            ) : null}
                            {run.remotionReel.outputPath ? (
                              <span className="text-zinc-500">Local render: {run.remotionReel.outputPath}</span>
                            ) : null}
                          </div>
                        </div>
                      ) : run.remotionReel.error ? (
                        <p className="mt-3 text-xs text-rose-700">{run.remotionReel.error}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {kit ? (
              <>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Hero Options
                  </p>
                  <ul className="mt-4 space-y-3">
                    {kit.landingPage.heroHeadlineOptions.map((option) => (
                      <li key={option} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-800">
                        {option}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Prompt Pack
                  </p>
                  <div className="mt-4 space-y-5 text-sm text-zinc-800">
                    <div>
                      <h2 className="font-semibold text-zinc-950">Google image prompt</h2>
                      <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-xs leading-6">
                        {kit.prompts.googleImagePrompt}
                      </pre>
                    </div>
                    <div>
                      <h2 className="font-semibold text-zinc-950">Nano Banana variants</h2>
                      <ul className="mt-2 space-y-3">
                        {kit.prompts.nanoBananaVariants.map((prompt) => (
                          <li key={prompt} className="rounded-2xl bg-zinc-50 p-4 text-xs leading-6">
                            {prompt}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h2 className="font-semibold text-zinc-950">Video prompt</h2>
                      <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-xs leading-6">
                        {kit.prompts.runwayPrompt}
                      </pre>
                      <p className="mt-2 text-xs text-zinc-500">
                        The OpenRouter action can use the first generated proof-led image as the first frame when one exists.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Remotion Storyboard
                  </p>
                  <div className="mt-4 space-y-3">
                    {kit.remotionStoryboard.map((scene) => (
                      <div key={`${scene.startFrame}-${scene.title}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
                        <p className="font-semibold text-zinc-950">{scene.title}</p>
                        <p className="mt-1">{scene.copy}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                          Frames {scene.startFrame}-{scene.startFrame + scene.durationFrames}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {images && images.length > 0 ? (
              <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Generated Image
                </p>
                <div className="mt-4 grid gap-4">
                  {images.map((image) => (
                    <img
                      key={image.dataUrl.slice(0, 32)}
                      src={image.dataUrl}
                      alt="Generated Blueprint campaign concept"
                      className="w-full rounded-3xl border border-zinc-200 object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Recent Campaigns
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Draft, approval, delivery, and response state from the local campaign store, with SendGrid as the default delivery path.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCampaigns()}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {campaignsQuery.isLoading ? (
                  <p className="text-sm text-zinc-500">Loading campaigns...</p>
                ) : campaignsQuery.isError ? (
                  <p className="text-sm text-rose-700">Failed to load campaign state.</p>
                ) : campaigns.length === 0 ? (
                  <p className="text-sm text-zinc-500">No local campaigns yet.</p>
                ) : (
                  campaigns.map((campaign) => (
                    <div key={campaign.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-950">{campaign.name || campaign.id}</p>
                          <p className="text-xs text-zinc-500">{campaign.subject || "No subject"}</p>
                        </div>
                        <div className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs uppercase tracking-[0.14em] text-zinc-700">
                          {campaign.send_status || "draft"}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-4">
                        <p>Sent: {metricValue(campaign, "sent")}</p>
                        <p>Opened: {metricValue(campaign, "opened")}</p>
                        <p>Clicked: {metricValue(campaign, "clicked")}</p>
                        <p>Replied: {metricValue(campaign, "replied")}</p>
                      </div>

                      <div className="mt-3 text-xs text-zinc-500">
                        <p>Last ledger: {campaign.last_ledger_doc_id || "none"}</p>
                        <p>Last event: {campaign.response_tracking?.last_event_type || "none"} • {formatEventTime(campaign.response_tracking?.last_event_at)}</p>
                        {campaign.response_tracking?.last_recipient ? (
                          <p>Last recipient: {campaign.response_tracking.last_recipient}</p>
                        ) : null}
                        <p>Recipients: {campaign.recipient_count || 0}</p>
                      </div>

                      {campaign.approval_reason ? (
                        <p className="mt-3 text-xs text-amber-700">{campaign.approval_reason}</p>
                      ) : null}
                      {campaign.rejected_reason ? (
                        <p className="mt-3 text-xs text-rose-700">{campaign.rejected_reason}</p>
                      ) : null}
                      {campaign.last_execution_error ? (
                        <p className="mt-3 text-xs text-rose-700">{campaign.last_execution_error}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
