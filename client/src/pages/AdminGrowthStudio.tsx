import { useEffect, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { withCsrfHeader } from "@/lib/csrf";
import { analyticsEvents } from "@/components/Analytics";
import { AdStudioPanel } from "./admin-growth-studio/AdStudioPanel";
import { GrowthTruthBoundary } from "./admin-growth-studio/GrowthTruthBoundary";
import { ShipBroadcastApprovalQueuePanel } from "./admin-growth-studio/ShipBroadcastApprovalQueuePanel";
import {
  DEFAULT_AD_STUDIO_FORM,
  DEFAULT_CAMPAIGN_FORM,
  buildAdStudioMetaDraftPayload,
  buildAdStudioReviewPayload,
  buildAdStudioRunPayload,
  buildCampaignDraftPayload,
  buildCampaignKitPayload,
  buildDisabledImageProviderStatus,
  formatEventTime,
  isRunwayTaskPending,
  metricValue,
} from "./admin-growth-studio/model";
import { useAdStudioDraftState } from "./admin-growth-studio/useAdStudioDraftState";
import { useAdminGrowthStudioData } from "./admin-growth-studio/useAdminGrowthStudioData";
import type {
  AdStudioFormState,
  AdStudioRunRecord,
  CampaignCreateResponse,
  CampaignKit,
  CampaignKitResponse,
  CampaignKitFormState,
  ImageGenerationResponse,
  LifecycleRunResponse,
  NotionSyncResponse,
  ProviderStatus,
  QueueSendResponse,
  RunwayTask,
  RunwayVideoResponse,
  VerifyResponse,
} from "./admin-growth-studio/types";

export default function AdminGrowthStudio() {
  const [form, setForm] = useState<CampaignKitFormState>(DEFAULT_CAMPAIGN_FORM);
  const [adStudioForm, setAdStudioForm] = useState<AdStudioFormState>(DEFAULT_AD_STUDIO_FORM);
  const adStudioDraftState = useAdStudioDraftState(adStudioForm);
  const [kit, setKit] = useState<CampaignKit | null>(null);
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

  const {
    campaignsQuery,
    creativeRunsQuery,
    adStudioRunsQuery,
    shipBroadcastApprovalQueueQuery,
    approveShipBroadcastMutation,
    rejectShipBroadcastMutation,
    refreshCampaigns,
    refreshCreativeRuns,
    refreshAdStudioRuns,
  } = useAdminGrowthStudioData({
    onNotice: (message) => {
      setNotice(message);
      setError("");
    },
    onError: (message) => {
      setError(message);
      setNotice("");
    },
    onShipBroadcastRejected: (ledgerId) => {
      setShipBroadcastRejectReasons((current) => ({
        ...current,
        [ledgerId]: "",
      }));
    },
  });

  async function generateCampaignKit() {
    setLoadingKit(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/creative/campaign-kit", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildCampaignKitPayload(form)),
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
    setImageProviderStatus(buildDisabledImageProviderStatus());
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
        body: JSON.stringify(buildCampaignDraftPayload(form, kit)),
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

  async function createAdStudioRunRequest() {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/growth/ad-studio/runs", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildAdStudioRunPayload(adStudioForm)),
      });
      const json = (await response.json()) as { run?: AdStudioRunRecord; error?: string };
      if (!response.ok || !json.run) {
        throw new Error(json.error || "Failed to create Ad Studio run");
      }
      setNotice(`Ad Studio run ${json.run.id} created.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create Ad Studio run");
    }
  }

  async function buildAdStudioBriefRequest(runId: string) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/ad-studio/runs/${runId}/brief`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to build Ad Studio brief");
      }
      setNotice(`Ad Studio brief built for ${runId}.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to build Ad Studio brief");
    }
  }

  async function routeAdStudioImageHandoff(runId: string) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/ad-studio/runs/${runId}/image-handoff`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to route Ad Studio image handoff");
      }
      setNotice(`Ad Studio image handoff queued for ${runId}.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to route Ad Studio image handoff");
    }
  }

  async function attachAdStudioFirstFrame(runId: string) {
    const uri = adStudioDraftState.getAssetUri(runId).trim();
    if (!uri) {
      setError("Add a first-frame image URI before attaching it to the run.");
      setNotice("");
      return;
    }
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/ad-studio/runs/${runId}/assets`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          type: "image",
          role: "first_frame",
          uri,
          provider: "codex_gpt_image_2",
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to attach first-frame asset");
      }
      setNotice(`Attached first-frame asset to ${runId}.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to attach first-frame asset");
    }
  }

  async function queueAdStudioVideoRequest(runId: string) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/ad-studio/runs/${runId}/video`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          firstFrameUrl: adStudioDraftState.getAssetUri(runId).trim() || undefined,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to queue Ad Studio video");
      }
      setNotice(`Queued Ad Studio video for ${runId}.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to queue Ad Studio video");
    }
  }

  async function reviewAdStudioRunRequest(run: AdStudioRunRecord) {
    const reviewDraft = adStudioDraftState.getReviewDraft(run);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/ad-studio/runs/${run.id}/review`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildAdStudioReviewPayload(reviewDraft, adStudioForm)),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to review Ad Studio creative");
      }
      setNotice(`Ad Studio review completed for ${run.id}.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to review Ad Studio creative");
    }
  }

  async function createAdStudioMetaDraftRequest(runId: string) {
    const metaDraft = adStudioDraftState.getMetaDraft(runId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/growth/ad-studio/runs/${runId}/meta-draft`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildAdStudioMetaDraftPayload(metaDraft)),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to create Ad Studio Meta draft");
      }
      setNotice(`Paused Meta draft created for ${runId}.`);
      await refreshAdStudioRuns();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create Ad Studio Meta draft");
    }
  }

  const campaigns = campaignsQuery.data?.localCampaigns ?? [];
  const creativeRuns = creativeRunsQuery.data?.items ?? [];
  const adStudioRuns = adStudioRunsQuery.data?.items ?? [];

  useEffect(() => {
    if (!runwayTask || !isRunwayTaskPending(runwayTask)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshRunwayTask(runwayTask.id).catch(() => undefined);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [runwayTask]);

  return (
    <div className="min-h-screen bg-runway-line-soft">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-center gap-3">
          <div className="rounded-none bg-paper-0 p-3 shadow-sm">
            <Sparkles className="h-6 w-6 text-runway-black" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-runway-faint">
              Growth Studio
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-runway-black">
              Build proof-led campaign kits from real Blueprint surfaces
            </h1>
          </div>
        </div>

        <GrowthTruthBoundary />

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
            <div className="grid gap-4">
              {[
                ["SKU", "skuName"],
                ["Audience", "audience"],
                ["Site Type", "siteType"],
                ["Workflow", "workflow"],
                ["Call To Action", "callToAction"],
              ].map(([label, key]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-sm font-medium text-runway-line-strong">{label}</span>
                  <input
                    className="w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                    value={form[key as keyof typeof form]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-runway-line-strong">Asset Goal</span>
                <select
                  className="w-full rounded-none border border-runway-line bg-paper-0 px-4 py-3 text-sm"
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
                <span className="mb-1 block text-sm font-medium text-runway-line-strong">Proof Points</span>
                <textarea
                  className="min-h-28 w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                  value={form.proofPoints}
                  onChange={(event) => setForm((current) => ({ ...current, proofPoints: event.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-runway-line-strong">Differentiators</span>
                <textarea
                  className="min-h-24 w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                  value={form.differentiators}
                  onChange={(event) => setForm((current) => ({ ...current, differentiators: event.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-runway-line-strong">
                  Recipients for early testing
                </span>
                <textarea
                  className="min-h-20 w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                  value={form.recipientEmails}
                  onChange={(event) => setForm((current) => ({ ...current, recipientEmails: event.target.value }))}
                  placeholder="one email per line"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-runway-line-strong">Image aspect ratio</span>
                  <input
                    className="w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                    value={form.imageAspectRatio}
                    onChange={(event) => setForm((current) => ({ ...current, imageAspectRatio: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-runway-line-strong">Image size</span>
                  <select
                    className="w-full rounded-none border border-runway-line bg-paper-0 px-4 py-3 text-sm"
                    value={form.imageSize}
                    onChange={(event) => setForm((current) => ({ ...current, imageSize: event.target.value }))}
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-runway-line-strong">Thinking level</span>
                  <select
                    className="w-full rounded-none border border-runway-line bg-paper-0 px-4 py-3 text-sm"
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
                  <span className="mb-1 block text-sm font-medium text-runway-line-strong">Video ratio</span>
                  <input
                    className="w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                    value={form.videoRatio}
                    onChange={(event) => setForm((current) => ({ ...current, videoRatio: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-runway-line-strong">Video duration (sec)</span>
                  <input
                    type="number"
                    min={5}
                    max={10}
                    className="w-full rounded-none border border-runway-line px-4 py-3 text-sm"
                    value={form.videoDuration}
                    onChange={(event) => setForm((current) => ({ ...current, videoDuration: event.target.value }))}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-runway-line-strong">
                  Lifecycle follow-up threshold (days)
                </span>
                <input
                  type="number"
                  min={7}
                  className="w-full rounded-none border border-runway-line px-4 py-3 text-sm"
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
                className="rounded-full bg-runway-black px-5 py-3 text-sm font-medium text-white transition hover:bg-runway-panel disabled:opacity-60"
              >
                {loadingKit ? "Generating…" : "Generate campaign kit"}
              </button>
              <button
                type="button"
                onClick={createCampaign}
                disabled={!kit}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                Create campaign draft
              </button>
              <button
                type="button"
                onClick={queueCampaignSend}
                disabled={!campaignId}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                Queue send for approval
              </button>
              <button
                type="button"
                onClick={renderProofReel}
                disabled={renderingProofReel}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                {renderingProofReel ? "Rendering reel…" : "Render proof reel"}
              </button>
              <button
                type="button"
                onClick={runLifecycle}
                disabled={runningLifecycle}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                {runningLifecycle ? "Running lifecycle…" : "Queue lifecycle emails"}
              </button>
              <button
                type="button"
                onClick={verifyIntegrations}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint"
              >
                Verify integrations
              </button>
              <button
                type="button"
                onClick={syncNotionMirror}
                disabled={runningNotionSync}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                {runningNotionSync ? "Syncing Notion…" : "Sync Notion mirror"}
              </button>
              <button
                type="button"
                onClick={runExperimentRollout}
                disabled={runningExperimentRollout}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                {runningExperimentRollout ? "Running rollout…" : "Run experiment rollout"}
              </button>
              <button
                type="button"
                onClick={runAutonomousOutbound}
                disabled={runningAutonomousOutbound}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                {runningAutonomousOutbound ? "Running outbound…" : "Run autonomous outbound"}
              </button>
              <button
                type="button"
                onClick={runCreativeFactory}
                disabled={runningCreativeFactory}
                className="rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                {runningCreativeFactory ? "Running creative factory…" : "Run creative factory"}
              </button>
              <button
                type="button"
                onClick={generateVideo}
                disabled={!kit || loadingVideo || !images?.[0]?.dataUrl}
                className="inline-flex items-center gap-2 rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                <Wand2 className="h-4 w-4" />
                {loadingVideo ? "Starting video…" : "Start OpenRouter video"}
              </button>
              <button
                type="button"
                onClick={generateImage}
                disabled={!kit}
                className="inline-flex items-center gap-2 rounded-full border border-runway-line-strong bg-paper-0 px-5 py-3 text-sm font-medium text-runway-deep transition hover:border-runway-faint disabled:opacity-60"
              >
                <Wand2 className="h-4 w-4" />
                Use Codex Image Lane
              </button>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
            {!error && notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
            {campaignId ? (
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-runway-faint">
                Campaign draft: {campaignId}
              </p>
            ) : null}

            {verifyResult ? (
              <div className="mt-4 rounded-none border border-runway-line bg-runway-line-soft p-4 text-xs text-runway-line-strong">
                <p>First-party ingest enabled: {String(Boolean(verifyResult.analytics?.firstPartyIngest?.enabled))}</p>
                <p>First-party verification persisted: {String(Boolean(verifyResult.analytics?.firstPartyIngest?.persisted))}</p>
                <p>GA4 live access: {String(Boolean(verifyResult.analytics?.ga4?.liveAccessConfigured))}</p>
                <p>GA4 measurement: {String(Boolean(verifyResult.analytics?.ga4?.configured))}</p>
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
                  <p className="mt-2 text-runway-mute">{verifyResult.analytics.alignment.note}</p>
                ) : null}
                {verifyResult.googleImage?.note ? (
                  <p className="mt-2 text-runway-mute">{verifyResult.googleImage.note}</p>
                ) : null}
              </div>
            ) : null}

            <AdStudioPanel
              form={adStudioForm}
              onFormChange={(patch) => setAdStudioForm((current) => ({ ...current, ...patch }))}
              runs={adStudioRuns}
              runsQuery={adStudioRunsQuery}
              draftState={adStudioDraftState}
              onRefresh={() => void refreshAdStudioRuns()}
              onCreateRun={createAdStudioRunRequest}
              onBuildBrief={buildAdStudioBriefRequest}
              onRouteImageHandoff={routeAdStudioImageHandoff}
              onQueueVideo={queueAdStudioVideoRequest}
              onAttachFirstFrame={attachAdStudioFirstFrame}
              onReview={reviewAdStudioRunRequest}
              onCreateMetaDraft={createAdStudioMetaDraftRequest}
            />

            <ShipBroadcastApprovalQueuePanel
              query={shipBroadcastApprovalQueueQuery}
              approveMutation={approveShipBroadcastMutation}
              rejectMutation={rejectShipBroadcastMutation}
              rejectReasons={shipBroadcastRejectReasons}
              onRejectReasonChange={(ledgerId, reason) =>
                setShipBroadcastRejectReasons((current) => ({
                  ...current,
                  [ledgerId]: reason,
                }))}
            />

            {runwayTask ? (
              <div className="mt-4 rounded-none border border-runway-line bg-runway-line-soft p-4 text-xs text-runway-line-strong">
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
                {isRunwayTaskPending(runwayTask) ? (
                  <button
                    type="button"
                    onClick={() => void refreshRunwayTask(runwayTask.id)}
                    className="mt-3 rounded-full border border-runway-line-strong bg-paper-0 px-4 py-2 text-xs font-medium text-runway-deep"
                  >
                    Refresh video status
                  </button>
                ) : null}
              </div>
            ) : null}

            {imageProviderStatus ? (
              <div className="mt-4 rounded-none border border-runway-line bg-runway-line-soft p-4 text-xs text-runway-line-strong">
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
              <div className="mt-4 rounded-none border border-runway-line bg-runway-line-soft p-4 text-xs text-runway-line-strong">
                <p className="font-semibold text-runway-black">
                  Lifecycle queue results ({lifecycleResult.count || lifecycleResult.results.length})
                </p>
                <div className="mt-3 space-y-2">
                  {lifecycleResult.results.slice(0, 5).map((item) => (
                    <div key={item.ledgerDocId} className="rounded-xl border border-runway-line bg-paper-0 p-3">
                      <p>{item.buyerEmail}</p>
                      <p className="text-runway-faint">
                        {item.lifecycleStage} • {item.state} • {item.ledgerDocId}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-runway-faint">
                    Recent Creative Runs
                  </p>
                  <p className="mt-1 text-sm text-runway-mute">
                    Durable creative-factory outputs for operators and Paperclip agents.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCreativeRuns()}
                  className="rounded-full border border-runway-line-strong bg-paper-0 px-4 py-2 text-xs font-medium text-runway-deep transition hover:border-runway-faint"
                >
                  Refresh runs
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {creativeRunsQuery.isLoading ? (
                  <p className="text-sm text-runway-faint">Loading creative runs…</p>
                ) : creativeRunsQuery.isError ? (
                  <p className="text-sm text-rose-700">Failed to load creative runs.</p>
                ) : creativeRuns.length === 0 ? (
                  <p className="text-sm text-runway-faint">No creative runs yet.</p>
                ) : (
                  creativeRuns.map((run) => (
                    <div key={run.id} className="rounded-none border border-runway-line bg-runway-line-soft p-4 text-sm text-runway-panel">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-runway-black">{run.skuName}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-runway-faint">
                            {run.status} {run.rolloutVariant ? `• ${run.rolloutVariant}` : ""}
                          </p>
                        </div>
                        <p className="text-xs text-runway-faint">{run.createdAt || "Unknown time"}</p>
                      </div>
                      {run.researchTopic ? (
                        <p className="mt-2 text-xs text-runway-mute">Research topic: {run.researchTopic}</p>
                      ) : null}
                      {run.buyerObjections.length > 0 ? (
                        <p className="mt-2 text-xs text-runway-mute">
                          Buyer objections: {run.buyerObjections.join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-3 grid gap-2 text-xs text-runway-mute md:grid-cols-2">
                        <p>Generated images: {run.generatedImages}</p>
                        <p>Reel status: {run.remotionReel.status || "none"}</p>
                      </div>
                      {run.executionHandoff ? (
                        <div className="mt-3 rounded-xl border border-runway-line bg-paper-0 p-3 text-xs text-runway-mute">
                          <p className="font-medium text-runway-black">Codex execution handoff</p>
                          <p className="mt-2">Issue: {run.executionHandoff.issueId || "none"}</p>
                          <p>Status: {run.executionHandoff.status || "unknown"}</p>
                          <p>Assignee: {run.executionHandoff.assignee || "unknown"}</p>
                          {run.executionHandoff.error ? (
                            <p className="mt-2 text-rose-700">{run.executionHandoff.error}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {run.remotionReel.storageUri ? (
                        <div className="mt-3 rounded-xl border border-runway-line bg-paper-0 p-3">
                          <p className="text-xs font-medium text-runway-black">Durable reel asset</p>
                          <p className="mt-2 break-all font-mono text-[11px] text-runway-mute">
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
                              <span className="text-runway-faint">Local render: {run.remotionReel.outputPath}</span>
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
                <div className="rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-runway-faint">
                    Hero Options
                  </p>
                  <ul className="mt-4 space-y-3">
                    {kit.landingPage.heroHeadlineOptions.map((option) => (
                      <li key={option} className="rounded-none border border-runway-line bg-runway-line-soft px-4 py-4 text-sm text-runway-panel">
                        {option}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-runway-faint">
                    Prompt Pack
                  </p>
                  <div className="mt-4 space-y-5 text-sm text-runway-panel">
                    <div>
                      <h2 className="font-semibold text-runway-black">Google image prompt</h2>
                      <pre className="mt-2 whitespace-pre-wrap rounded-none bg-runway-line-soft p-4 text-xs leading-6">
                        {kit.prompts.googleImagePrompt}
                      </pre>
                    </div>
                    <div>
                      <h2 className="font-semibold text-runway-black">Nano Banana variants</h2>
                      <ul className="mt-2 space-y-3">
                        {kit.prompts.nanoBananaVariants.map((prompt) => (
                          <li key={prompt} className="rounded-none bg-runway-line-soft p-4 text-xs leading-6">
                            {prompt}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h2 className="font-semibold text-runway-black">Video prompt</h2>
                      <pre className="mt-2 whitespace-pre-wrap rounded-none bg-runway-line-soft p-4 text-xs leading-6">
                        {kit.prompts.runwayPrompt}
                      </pre>
                      <p className="mt-2 text-xs text-runway-faint">
                        The OpenRouter action can use the first generated proof-led image as the first frame when one exists.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-runway-faint">
                    Remotion Storyboard
                  </p>
                  <div className="mt-4 space-y-3">
                    {kit.remotionStoryboard.map((scene) => (
                      <div key={`${scene.startFrame}-${scene.title}`} className="rounded-none border border-runway-line bg-runway-line-soft p-4 text-sm text-runway-panel">
                        <p className="font-semibold text-runway-black">{scene.title}</p>
                        <p className="mt-1">{scene.copy}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-runway-faint">
                          Frames {scene.startFrame}-{scene.startFrame + scene.durationFrames}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {images && images.length > 0 ? (
              <div className="rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-runway-faint">
                  Generated Image
                </p>
                <div className="mt-4 grid gap-4">
                  {images.map((image) => (
                    <img
                      key={image.dataUrl.slice(0, 32)}
                      src={image.dataUrl}
                      alt="Generated Blueprint campaign concept"
                      className="w-full rounded-none border border-runway-line object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-runway-line bg-paper-0 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-runway-faint">
                    Recent Campaigns
                  </p>
                  <p className="mt-2 text-sm text-runway-mute">
                    Draft, approval, delivery, and response state from the local campaign store, with SendGrid as the default delivery path.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCampaigns()}
                  className="rounded-full border border-runway-line-strong bg-paper-0 px-4 py-2 text-sm text-runway-deep"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {campaignsQuery.isLoading ? (
                  <p className="text-sm text-runway-faint">Loading campaigns...</p>
                ) : campaignsQuery.isError ? (
                  <p className="text-sm text-rose-700">Failed to load campaign state.</p>
                ) : campaigns.length === 0 ? (
                  <p className="text-sm text-runway-faint">No local campaigns yet.</p>
                ) : (
                  campaigns.map((campaign) => (
                    <div key={campaign.id} className="rounded-none border border-runway-line bg-runway-line-soft p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-runway-black">{campaign.name || campaign.id}</p>
                          <p className="text-xs text-runway-faint">{campaign.subject || "No subject"}</p>
                        </div>
                        <div className="rounded-full border border-runway-line-strong bg-paper-0 px-3 py-1 text-xs uppercase tracking-[0.14em] text-runway-line-strong">
                          {campaign.send_status || "draft"}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-runway-mute sm:grid-cols-4">
                        <p>Sent: {metricValue(campaign, "sent")}</p>
                        <p>Opened: {metricValue(campaign, "opened")}</p>
                        <p>Clicked: {metricValue(campaign, "clicked")}</p>
                        <p>Replied: {metricValue(campaign, "replied")}</p>
                      </div>

                      <div className="mt-3 text-xs text-runway-faint">
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
