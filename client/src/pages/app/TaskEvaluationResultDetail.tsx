import { useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import type { User as FirebaseUser } from "firebase/auth";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { EvaluationResultOverview } from "@/components/blueprint/app/EvaluationResultOverview";
import { PolicyCanaryResultPortal } from "@/components/blueprint/app/PolicyCanaryResultPortal";
import { ActionLink, Tag } from "@/components/workspace/WorkspaceUI";
import { canaryRunLabels, resolvedCanaryCandidates } from "@/lib/policyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  downloadTaskEvaluationPublication,
  humanBytes,
  useTaskEvaluationResult,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultEpisode,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

const candidateLabels: Record<string, string> = {
  pi05_droid: "π0.5 DROID",
  groot_n17_droid: "GR00T N1.7 DROID",
};

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

async function downloadArtifact(
  user: FirebaseUser | null,
  recordId: string,
  artifact: TaskEvaluationResultArtifact,
) {
  const url = await createTaskEvaluationResultArtifactTicket(user, recordId, artifact.artifact_id);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.relative_path.split("/").pop() || artifact.role;
  anchor.click();
}

function ProtectedVideo({
  user,
  recordId,
  label,
  artifact,
  reviewOnly = false,
}: {
  user: FirebaseUser | null;
  recordId: string;
  label: string;
  artifact: TaskEvaluationResultArtifact;
  reviewOnly?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUrl(await createTaskEvaluationResultArtifactTicket(user, recordId, artifact.artifact_id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Video unavailable");
    } finally {
      setLoading(false);
    }
  }
  return (
    <figure>
      <figcaption className="flex items-center justify-between gap-3 text-sm">
        <span>{humanize(label)} <span className="text-ink-500">· {humanBytes(artifact.size_bytes)}{reviewOnly ? " · for review" : ""}</span></span>
        {!url ? <button type="button" className="ws-link" onClick={load} disabled={loading}>{loading ? "Loading…" : "Load video"}</button> : null}
      </figcaption>
      {url ? <video className="mt-2 aspect-video w-full bg-black" src={url} controls playsInline preload="metadata" /> : null}
      {error ? <p className="mt-1 text-sm text-runway-red">{error}</p> : null}
    </figure>
  );
}

/** One episode per closed drawer: outcome in the summary, videos and files inside. */
function EpisodeRow({
  episode,
  user,
  recordId,
}: {
  episode: TaskEvaluationResultEpisode;
  user: FirebaseUser | null;
  recordId: string;
}) {
  const videos: Record<string, TaskEvaluationResultArtifact> = episode.artifacts?.videos
    || episode.evidence?.videos
    || {};
  const receipt = episode.artifacts?.receipt || episode.action_delivery?.delivery_readback || null;
  const frameManifest = episode.artifacts?.frame_manifest || episode.evidence?.frame_manifest || null;
  const [outcome, tone] = episode.score.task_succeeded === true
    ? ["Completed", "green" as const]
    : episode.score.task_succeeded === false
      ? ["Not completed", "red" as const]
      : [humanize(episode.score.status), "neutral" as const];
  const downloads = [
    receipt ? ["Episode receipt", receipt] : null,
    frameManifest ? ["Frame manifest", frameManifest] : null,
    episode.action_delivery?.returned_action_sequence ? ["Actions", episode.action_delivery.returned_action_sequence] : null,
    episode.traces?.state ? ["State trace", episode.traces.state] : null,
  ].filter(Boolean) as Array<[string, TaskEvaluationResultArtifact]>;
  return (
    <details>
      <summary>
        <span className="inline-flex flex-wrap items-center gap-3">
          <span>{candidateLabels[episode.subject_id] || humanize(episode.subject_id)}</span>
          <span className="text-ink-500">{episode.episode_kind === "control" ? "Control" : "Policy"}{episode.variation?.label ? ` · ${episode.variation.label}` : ""}</span>
          <Tag tone={tone}>{outcome}</Tag>
        </span>
      </summary>
      <div className="flex flex-col gap-5">
        {Object.keys(videos).length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(videos).map(([camera, artifact]) => (
              <ProtectedVideo key={camera} user={user} recordId={recordId} label={camera} artifact={artifact} reviewOnly={camera === "overview" || camera === "review"} />
            ))}
          </div>
        ) : null}
        {episode.action_delivery ? (
          <p className="text-sm">
            Policy queried: {episode.policy_candidate_id ? "yes" : "no (control)"} · actions reached the robot:{" "}
            {episode.action_delivery.actions_reached_robot ? "yes" : "no"} · arm moved: {episode.action_delivery.arm_moved ? "yes" : "no"}
            {episode.score.policy_outcome_interpretable === false ? " · outcome can't be scored" : ""}
          </p>
        ) : null}
        {downloads.length ? (
          <div className="flex flex-wrap gap-5">
            {downloads.map(([label, artifact]) => (
              <button key={label} type="button" className="ws-link" onClick={() => void downloadArtifact(user, recordId, artifact)}>{label}</button>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-ink-500">
          Scored by {humanize(episode.score.grader_authority).toLowerCase()}. Videos are for review; the receipt and saved
          frames are the evidence. <span className="break-all">{episode.episode_id}</span>
        </p>
      </div>
    </details>
  );
}

export function ResultContent({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser | null }) {
  const delivery = result.publication.result_delivery;
  const envelope = result.publication.decision_envelope;
  const canary = result.publication.run_kind === "internal_policy_canary";
  const labels = canaryRunLabels(result);
  const developmentSurface = /-development(?:-configured)?$/.test(labels.scene || "");
  const packages = delivery?.artifacts.filter((artifact) => artifact.content_type === "application/zip") || [];
  const deliveryNotice = !delivery
    ? <p className="text-sm text-ink-600">This older result has no packaged videos or files.</p>
    : delivery.status === "blocked"
      ? (
        <div className="ws-alert" role="alert">
          <p>Some evidence couldn't be packaged ({delivery.blockers.map((blocker) => blocker.replace(/_/g, " ")).join(", ")}). The result itself is still shown.</p>
        </div>
      )
      : null;

  if (canary) {
    return (
      <>
        <header className="mb-4">
          <h1>Head-to-head policy test</h1>
          <p className="mt-3 text-ink-600">{[
            resolvedCanaryCandidates(result).map((candidate) => candidate.display_name).join(" vs "),
            labels.taskLabel,
            "Simulation",
          ].filter(Boolean).join(" · ")}</p>
          {developmentSurface ? <p className="mt-1 text-sm text-ink-500">Development test on an authored surface; captured scene integration pending.</p> : null}
        </header>
        {deliveryNotice}
        {delivery?.status === "ready" ? <PolicyCanaryResultPortal result={result} user={user} /> : null}
      </>
    );
  }

  const visibility = result.access_visibility === "unlisted_public"
    ? "Anyone with this link can see this result."
    : result.access_visibility === "organization_members"
      ? "Only your team can see this result."
      : "Only you can see this result.";
  return (
    <>
      <header className="ws-heading">
        <div>
          <p>Task evaluation result</p>
          <h1>{envelope?.decision_question || "Task evaluation result"}</h1>
        </div>
      </header>
      {developmentSurface ? <p className="text-sm text-ink-600">Development test on an authored surface; captured scene integration pending.</p> : null}
      <p className="max-w-3xl text-ink-600">
        {visibility} Simulation only: it doesn't show real-world performance, and it doesn't approve deployment or safety.
      </p>
      {deliveryNotice}

      {delivery?.status === "ready" ? (
        <>
          <dl className="ws-facts max-w-xl">
            <div><dt>Policy episodes</dt><dd>{delivery.summary.learned_candidate_episode_count}</dd></div>
            <div><dt>Control episodes</dt><dd>{delivery.summary.control_episode_count}</dd></div>
            <div><dt>Completed the task</dt><dd>{delivery.summary.successful_episode_count} of {delivery.summary.episode_count} episodes</dd></div>
          </dl>

          <EvaluationResultOverview episodes={delivery.episodes} />

          <section aria-labelledby="result-episodes">
            <h2 id="result-episodes">Episodes</h2>
            <div className="mt-4">
              {delivery.episodes.map((episode) => <EpisodeRow key={episode.episode_id} episode={episode} user={user} recordId={result.record_id} />)}
            </div>
          </section>

          {packages.length ? (
            <section aria-labelledby="result-downloads">
              <h2 id="result-downloads">Downloads</h2>
              <p className="mt-2 text-sm text-ink-600">
                The review pack is for people. The full package adds the exact policy inputs and camera frames, and it can be large.
              </p>
              <div className="ws-form-actions">
                {packages.map((artifact) => (
                  <button key={artifact.artifact_id} type="button" className={artifact.role === "full_evidence_package" ? "ws-primary" : "ws-link"} onClick={() => void downloadArtifact(user, result.record_id, artifact)}>
                    {humanize(artifact.role)} · {humanBytes(artifact.size_bytes)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <details>
        <summary>Run details</summary>
        <p className="break-all text-xs text-ink-500">{result.publication.run_id}{delivery ? ` · delivery ${delivery.delivery_digest}` : ""}</p>
        {delivery?.stages.length ? (
          <ul className="mt-3 text-sm">
            {delivery.stages.map((stage) => <li key={stage.stage}>{humanize(stage.stage)}: {stage.status.replace(/_/g, " ")}</li>)}
          </ul>
        ) : null}
        <button type="button" className="ws-link mt-3" onClick={() => downloadTaskEvaluationPublication(result)}>Download the exact result (JSON)</button>
        <pre className="mt-3 max-h-[32rem] overflow-auto text-xs leading-relaxed">{JSON.stringify(result.publication, null, 2)}</pre>
      </details>
    </>
  );
}

export default function TaskEvaluationResultDetail() {
  const params = useParams<{ recordId: string }>();
  const recordId = params.recordId || "";
  const { result, pending, currentUser, notFound, isLoading, error } = useTaskEvaluationResult(recordId);
  return (
    <AppShell active="runs" breadcrumb={`results / ${recordId || "unknown"}`} publicView={!currentUser}>
      <Helmet><title>Task evaluation result · Blueprint</title><meta name="description" content="A task evaluation result, its episodes, and evidence downloads." /><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="mx-auto flex max-w-[76rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href={currentUser ? "/app/runs" : "/"} className="ws-back">← {currentUser ? "All runs" : "Blueprint"}</Link>
        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && error && !result ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && result ? <>
          {error ? <p role="status" className="text-sm text-ink-600">The result couldn't be refreshed. Showing the last loaded version.</p> : null}
          <ResultContent result={result} user={currentUser} />
        </> : null}
        {!isLoading && pending ? (
          <section aria-labelledby="pending-result-title">
            <h1 id="pending-result-title">{pending.run.terminal ? "Run ended · results pending" : "Run registered · results pending"}</h1>
            <p className="mt-3 max-w-3xl text-ink-600">{pending.run.terminal
              ? "The run has ended, but its results aren't published yet."
              : "Results and files show up here once they're published. This page checks for updates while it's open."}</p>
            <p role="status" className="mt-4">
              Last status: {humanize(pending.run.state).toLowerCase()}{pending.run.phase ? ` · ${humanize(pending.run.phase).toLowerCase()}` : ""}.
            </p>
            {pending.run.progress ? <p className="mt-2 text-ink-600">{pending.run.progress.completed_episodes} of {pending.run.progress.total_episodes} episodes recorded complete.</p> : null}
            {pending.run.error ? <p className="mt-2 text-ink-600">{pending.run.error.message}</p> : null}
            <p className="mt-6"><ActionLink href={pending.run.href}>View run progress</ActionLink></p>
          </section>
        ) : null}
        {!isLoading && !error && notFound ? (
          <section className="ws-empty">
            <h2>Result not available</h2>
            <p>
              No result you can see matches this link.{!currentUser ? <> <Link href="/sign-in" className="ws-link">Sign in</Link> to check for private results.</> : null}
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
