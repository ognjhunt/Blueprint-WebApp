import type { AdStudioDraftState } from "./useAdStudioDraftState";
import type { AdStudioFormState, AdStudioRunRecord } from "./types";

type AdStudioRunsQuery = {
  isLoading: boolean;
  isError: boolean;
};

type AdStudioPanelProps = {
  form: AdStudioFormState;
  onFormChange: (patch: Partial<AdStudioFormState>) => void;
  runs: AdStudioRunRecord[];
  runsQuery: AdStudioRunsQuery;
  draftState: AdStudioDraftState;
  onRefresh: () => unknown;
  onCreateRun: () => unknown;
  onBuildBrief: (runId: string) => unknown;
  onRouteImageHandoff: (runId: string) => unknown;
  onQueueVideo: (runId: string) => unknown;
  onAttachFirstFrame: (runId: string) => unknown;
  onReview: (run: AdStudioRunRecord) => unknown;
  onCreateMetaDraft: (runId: string) => unknown;
};

export function AdStudioPanel({
  form,
  onFormChange,
  runs,
  runsQuery,
  draftState,
  onRefresh,
  onCreateRun,
  onBuildBrief,
  onRouteImageHandoff,
  onQueueVideo,
  onAttachFirstFrame,
  onReview,
  onCreateMetaDraft,
}: AdStudioPanelProps) {
  return (
    <div className="mt-4 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Ad Studio
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Two-lane harness for capturer and buyer concept ads, claims review, and paused Meta draft creation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRefresh()}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900 transition hover:border-zinc-400"
        >
          Refresh runs
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Lane</span>
          <select
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            value={form.lane}
            onChange={(event) => onFormChange({ lane: event.target.value })}
          >
            <option value="capturer">Capturer</option>
            <option value="buyer">Buyer</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Audience</span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.audience}
            onChange={(event) => onFormChange({ audience: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">City</span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.city}
            onChange={(event) => onFormChange({ city: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">CTA</span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.cta}
            onChange={(event) => onFormChange({ cta: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Budget cap (USD)</span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.budgetCapUsd}
            onChange={(event) => onFormChange({ budgetCapUsd: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Aspect ratio</span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.aspectRatio}
            onChange={(event) => onFormChange({ aspectRatio: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Allowed claims</span>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.allowedClaims}
            onChange={(event) => onFormChange({ allowedClaims: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Blocked claims</span>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            value={form.blockedClaims}
            onChange={(event) => onFormChange({ blockedClaims: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onCreateRun()}
          className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Create Ad Studio Run
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {runsQuery.isLoading ? (
          <p className="text-sm text-zinc-500">Loading Ad Studio runs...</p>
        ) : runsQuery.isError ? (
          <p className="text-sm text-rose-700">Failed to load Ad Studio runs.</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No Ad Studio runs yet.</p>
        ) : (
          runs.map((run) => (
            <AdStudioRunCard
              key={run.id}
              run={run}
              draftState={draftState}
              onBuildBrief={onBuildBrief}
              onRouteImageHandoff={onRouteImageHandoff}
              onQueueVideo={onQueueVideo}
              onAttachFirstFrame={onAttachFirstFrame}
              onReview={onReview}
              onCreateMetaDraft={onCreateMetaDraft}
            />
          ))
        )}
      </div>
    </div>
  );
}

type AdStudioRunCardProps = {
  run: AdStudioRunRecord;
  draftState: AdStudioDraftState;
  onBuildBrief: (runId: string) => unknown;
  onRouteImageHandoff: (runId: string) => unknown;
  onQueueVideo: (runId: string) => unknown;
  onAttachFirstFrame: (runId: string) => unknown;
  onReview: (run: AdStudioRunRecord) => unknown;
  onCreateMetaDraft: (runId: string) => unknown;
};

function AdStudioRunCard({
  run,
  draftState,
  onBuildBrief,
  onRouteImageHandoff,
  onQueueVideo,
  onAttachFirstFrame,
  onReview,
  onCreateMetaDraft,
}: AdStudioRunCardProps) {
  const reviewDraft = draftState.getReviewDraft(run);
  const metaDraft = draftState.getMetaDraft(run.id);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-950">{run.lane} - {run.audience}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {run.status} {run.city ? `- ${run.city}` : ""}
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          Meta: {run.metaDraft.status}{run.metaDraft.provider ? ` - ${run.metaDraft.provider}` : ""}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onBuildBrief(run.id)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-900"
        >
          Build brief
        </button>
        <button
          type="button"
          onClick={() => onRouteImageHandoff(run.id)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-900"
        >
          Route image handoff
        </button>
        <button
          type="button"
          onClick={() => onQueueVideo(run.id)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-900"
        >
          Queue video
        </button>
        <button
          type="button"
          onClick={() => onReview(run)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-900"
        >
          Run review
        </button>
        <button
          type="button"
          onClick={() => onCreateMetaDraft(run.id)}
          className="rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
        >
          Create paused Meta draft
        </button>
      </div>

      {run.promptPack ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
          <p className="font-medium text-zinc-950">Prompt pack</p>
          <p className="mt-2">{run.promptPack.imagePromptVariants[0]}</p>
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          First-frame image URI
        </span>
        <div className="flex gap-2">
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={draftState.getAssetUri(run.id)}
            onChange={(event) => draftState.setAssetUri(run.id, event.target.value)}
            placeholder="https://..."
          />
          <button
            type="button"
            onClick={() => onAttachFirstFrame(run.id)}
            className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900"
          >
            Attach
          </button>
        </div>
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Review headline
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={reviewDraft.headline}
            onChange={(event) => draftState.setReviewDraft(run, { headline: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Review primary text
          </span>
          <textarea
            className="min-h-20 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={reviewDraft.primaryText}
            onChange={(event) => draftState.setReviewDraft(run, { primaryText: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Meta provider
          </span>
          <select
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.provider}
            onChange={(event) => draftState.setMetaDraft(run.id, { provider: event.target.value })}
          >
            <option value="graph_api">Graph API video id</option>
            <option value="ads_cli">Ads CLI local media</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Campaign name
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.campaignName}
            onChange={(event) => draftState.setMetaDraft(run.id, { campaignName: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Meta account id
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.accountId}
            onChange={(event) => draftState.setMetaDraft(run.id, { accountId: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Meta page id
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.pageId}
            onChange={(event) => draftState.setMetaDraft(run.id, { pageId: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Meta video id
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.videoId}
            onChange={(event) => draftState.setMetaDraft(run.id, { videoId: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            CLI media path
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.mediaPath}
            onChange={(event) => draftState.setMetaDraft(run.id, { mediaPath: event.target.value })}
            placeholder="/absolute/path/to/ad.mp4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            CLI media type
          </span>
          <select
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.mediaType}
            onChange={(event) => draftState.setMetaDraft(run.id, { mediaType: event.target.value })}
          >
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            CTA
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.callToAction}
            onChange={(event) => draftState.setMetaDraft(run.id, { callToAction: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Destination URL
          </span>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
            value={metaDraft.destinationUrl}
            onChange={(event) => draftState.setMetaDraft(run.id, { destinationUrl: event.target.value })}
          />
        </label>
      </div>

      {run.imageExecutionHandoff ? (
        <p className="mt-3 text-xs text-zinc-600">
          Image handoff: {run.imageExecutionHandoff.assignee} - {run.imageExecutionHandoff.status}
        </p>
      ) : null}
      {run.review.reasons.length ? (
        <p className="mt-2 text-xs text-rose-700">{run.review.reasons.join(" ")}</p>
      ) : null}
      {run.metaDraft.campaignId || run.metaDraft.adId ? (
        <p className="mt-2 text-xs text-emerald-700">
          Meta IDs: {run.metaDraft.campaignId || "none"} / {run.metaDraft.adSetId || "none"} / {run.metaDraft.creativeId || "none"} / {run.metaDraft.adId || "none"}
          {run.metaDraft.provenanceIds?.length ? ` - provenance ${run.metaDraft.provenanceIds.join(", ")}` : ""}
        </p>
      ) : null}
    </div>
  );
}
