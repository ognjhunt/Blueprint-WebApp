import { useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download, Eye, Film, ShieldAlert } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, Card, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { EvaluationResultOverview } from "@/components/blueprint/app/EvaluationResultOverview";
import { PolicyCanaryResultPortal } from "@/components/blueprint/app/PolicyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  humanBytes,
  useTaskEvaluationResult,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultEpisode,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

function downloadJson(result: TaskEvaluationResultSiteRecord) {
  const blob = new Blob([`${JSON.stringify(result.publication, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.publication.run_id}-sealed-result.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadArtifact(
  user: FirebaseUser,
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
  user: FirebaseUser;
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
    <Card pad="sm" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div>
          <p className="text-body-s font-semibold text-ink-900">{label}</p>
          <p className="runway-num text-[0.68rem] text-ink-400">{humanBytes(artifact.size_bytes)}{reviewOnly ? " · review-only" : ""}</p>
        </div>
        {!url ? <Button type="button" size="sm" variant="secondary" iconLeft={<Film />} onClick={load} disabled={loading}>{loading ? "Loading…" : "Load video"}</Button> : null}
      </div>
      {url ? <video className="mt-2 aspect-video w-full bg-runway-black" src={url} controls playsInline preload="metadata" /> : null}
      {error ? <p className="px-2 pb-2 text-body-s text-runway-red">{error}</p> : null}
    </Card>
  );
}

function EpisodeCard({
  episode,
  user,
  recordId,
}: {
  episode: TaskEvaluationResultEpisode;
  user: FirebaseUser;
  recordId: string;
}) {
  const succeeded = episode.score.task_succeeded === true;
  const videos: Record<string, TaskEvaluationResultArtifact> = episode.artifacts?.videos
    || episode.evidence?.videos
    || {};
  const receipt = episode.artifacts?.receipt || episode.action_delivery?.delivery_readback || null;
  const frameManifest = episode.artifacts?.frame_manifest || episode.evidence?.frame_manifest || null;
  return (
    <section className="runway-panel flex flex-col gap-4 p-4" aria-labelledby={`episode-${episode.episode_id}`}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <p className="runway-meta">{episode.episode_kind.replace(/_/g, " ")}</p>
          <h3 id={`episode-${episode.episode_id}`} className="runway-num mt-1 text-title-m font-semibold text-ink-900">{episode.subject_id}</h3>
          <p className="runway-num text-[0.68rem] text-ink-400">{episode.episode_id}</p>
        </div>
        <StatusChip tone={succeeded ? "proof" : episode.score.task_succeeded === false ? "block" : "warn"} square>
          {succeeded ? "Task complete" : episode.score.task_succeeded === false ? "Not complete" : episode.score.status}
        </StatusChip>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {Object.entries(videos).map(([camera, artifact]) => <ProtectedVideo key={camera} user={user} recordId={recordId} label={camera.replaceAll("_", " ")} artifact={artifact} reviewOnly={camera === "overview" || camera === "review"} />)}
      </div>
      {episode.action_delivery ? <dl className="grid gap-px border border-line bg-line sm:grid-cols-4"><div className="bg-paper-0 p-3"><dt className="runway-meta">Policy queried</dt><dd className="mt-1 text-body-s font-semibold">{episode.policy_candidate_id ? "Yes" : "Control"}</dd></div><div className="bg-paper-0 p-3"><dt className="runway-meta">Actions reached robot</dt><dd className="mt-1 text-body-s font-semibold">{episode.action_delivery.actions_reached_robot ? "Yes" : "No"}</dd></div><div className="bg-paper-0 p-3"><dt className="runway-meta">Arm moved</dt><dd className="mt-1 text-body-s font-semibold">{episode.action_delivery.arm_moved ? "Yes" : "No"}</dd></div><div className="bg-paper-0 p-3"><dt className="runway-meta">Interpretability</dt><dd className="mt-1 text-body-s font-semibold">{episode.score.policy_outcome_interpretable === false ? "Uninterpretable" : "Interpretable"}</dd></div></dl> : null}
      <div className="flex flex-wrap gap-2">
        {receipt ? <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, receipt)}>Episode receipt</Button> : null}
        {frameManifest ? <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, frameManifest)}>Frame manifest</Button> : null}
        {episode.action_delivery?.returned_action_sequence ? <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, episode.action_delivery!.returned_action_sequence!)}>Actions</Button> : null}
        {episode.traces?.state ? <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, episode.traces!.state!)}>State trace</Button> : null}
      </div>
      <p className="text-body-s text-ink-500">Score authority: {episode.score.grader_authority.replace(/_/g, " ")}. The videos are derived review media; the digest-bound receipt and exact retained frames carry the evidence claim.</p>
    </section>
  );
}

function ResultContent({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser }) {
  const delivery = result.publication.result_delivery;
  const envelope = result.publication.decision_envelope;
  const canary = result.publication.run_kind === "internal_policy_canary";
  const canaryResult = result.publication.policy_canary_result;
  const canaryReproducibility = delivery?.reproducibility;
  const canaryScene = result.publication.scene?.id
    || canaryReproducibility?.scene_id
    || "Scene 839873";
  const canaryTask = result.publication.task?.label
    || canaryReproducibility?.task_id
    || "Policy canary";
  const packages = delivery?.artifacts.filter((artifact) => artifact.content_type === "application/zip") || [];
  return (
    <>
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-start">
        <div>
          <Eyebrow tone="brass" rule>{canary ? "Internal policy canary" : "Sealed Task Evaluation Result"}</Eyebrow>
          <h1 className="mt-2 font-display text-[1.65rem] font-semibold uppercase tracking-[0.005em] text-ink-900">{canary ? `${canaryScene} · ${canaryTask}` : envelope?.decision_question || result.publication.run_id}</h1>
          <p className="runway-num mt-2 text-[0.72rem] text-ink-500">{result.publication.run_id}</p>
        </div>
        <Button type="button" variant="secondary" iconLeft={<Download />} onClick={() => downloadJson(result)}>Exact result JSON</Button>
      </header>

      <ProofBoundary level="warn" title={canary ? "Unqualified policy canary — controls pending" : "Bounded evidence, not a leaderboard"} icon={ShieldAlert}>
        {canary ? "Controls pending — results are unqualified. This diagnostic history cannot declare a winner, contribute to official ranking, or promote the scene to evaluation ready. " : ""}This result belongs to {result.access_visibility === "organization_members" ? "this verified team" : "the run owner"}. It is not published across teams. Simulation is not physical success, the overview is review-only, and this record does not approve deployment or safety.
      </ProofBoundary>

      {!delivery ? <ProofBoundary level="info" title="Legacy result record">The decision is sealed, but this older publication predates automatic media packaging.</ProofBoundary> : null}
      {delivery?.status === "blocked" ? (
        <ProofBoundary level="block" title="Evidence delivery blocked">
          The decision remains visible, but Blueprint did not package missing evidence. Blocker: {delivery.blockers.map((blocker) => blocker.replace(/_/g, " ")).join(", ")}.
        </ProofBoundary>
      ) : null}

      {delivery ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Result delivery stages">
          {delivery.stages.map((stage, index) => (
            <Card key={stage.stage} pad="sm">
              <p className="runway-meta">{index + 1}. {stage.stage}</p>
              <StatusChip className="mt-2" tone={stage.status === "complete" || stage.status === "ready" ? "proof" : stage.status === "blocked" ? "block" : "neutral"} square>{stage.status}</StatusChip>
            </Card>
          ))}
        </section>
      ) : null}

      {delivery?.status === "ready" ? (
        <>
          {canary ? <PolicyCanaryResultPortal result={result} user={user} /> : <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Episode summary">
            {[
              ["Episodes", delivery.summary.episode_count],
              ["Policy episodes", delivery.summary.learned_candidate_episode_count],
              ["Controls", delivery.summary.control_episode_count],
              ["Task complete", delivery.summary.successful_episode_count],
            ].map(([label, value]) => <Card key={String(label)} pad="md"><p className="runway-meta">{label}</p><p className="runway-num mt-2 text-title-l font-semibold text-ink-900">{value}</p></Card>)}
          </section>

          <EvaluationResultOverview episodes={delivery.episodes} />

          {canary && canaryResult ? <section className="runway-panel overflow-x-auto p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="runway-meta">Policy comparison</p><h2 className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Diagnostic metrics</h2></div><StatusChip tone="warn" square>No winner declaration</StatusChip></div><table className="mt-4 w-full min-w-[50rem] border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Policy</th><th className="runway-meta px-3 py-2">Success</th><th className="runway-meta px-3 py-2">Progress</th><th className="runway-meta px-3 py-2">Destination error</th><th className="runway-meta px-3 py-2">Contact</th><th className="runway-meta px-3 py-2">Collision</th><th className="runway-meta px-3 py-2">Action delivery</th><th className="runway-meta px-3 py-2">Interpretable</th></tr></thead><tbody>{(canaryResult.candidate_results || []).map((candidate: Record<string, any>) => <tr key={candidate.candidate_id} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{candidate.display_name}</td><td className="runway-num px-3 py-3">{candidate.success_rate == null ? "—" : `${Math.round(candidate.success_rate * 100)}%`}</td><td className="runway-num px-3 py-3">{candidate.progress_score ?? "—"}</td><td className="runway-num px-3 py-3">{candidate.mean_destination_error ?? "—"}</td><td className="runway-num px-3 py-3">{candidate.contact_maintenance_rate == null ? "—" : `${Math.round(candidate.contact_maintenance_rate * 100)}%`}</td><td className="runway-num px-3 py-3">{candidate.collision_rate == null ? "—" : `${Math.round(candidate.collision_rate * 100)}%`}</td><td className="runway-num px-3 py-3">{Math.round(Number(candidate.action_delivery_rate || 0) * 100)}%</td><td className="runway-num px-3 py-3">{candidate.interpretable_episode_count}/{candidate.episodes_completed}</td></tr>)}</tbody></table></section> : null}

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><Eye className="size-4 text-ink-500" /><h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Episode review</h2></div>
            {delivery.episodes.map((episode) => <EpisodeCard key={episode.episode_id} episode={episode} user={user} recordId={result.record_id} />)}
          </section>

          <section className="runway-panel p-5">
            <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Evidence downloads</h2>
            <p className="mt-1 text-body-s text-ink-500">The review pack is convenient for people. The full package also includes exact lossless policy inputs and camera frames and may be large.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(canary ? delivery.artifacts : packages).map((artifact) => (
                <Button key={artifact.artifact_id} type="button" variant={artifact.role === "full_evidence_package" ? "action" : "secondary"} iconLeft={<Download />} onClick={() => void downloadArtifact(user, result.record_id, artifact)}>
                  {artifact.role.replaceAll("_", " ")} · {humanBytes(artifact.size_bytes)}
                </Button>
              ))}
            </div>
            <p className="runway-num mt-3 text-[0.68rem] text-ink-400">Delivery {delivery.delivery_digest}</p>
          </section>
          </>}
        </>
      ) : null}

      <details className="runway-panel p-4">
        <summary className="cursor-pointer font-display text-body-s font-semibold uppercase tracking-[0.005em] text-ink-800">Inspect {canary ? "sealed publication and exact bindings" : "decision envelope and exact bindings"}</summary>
        <pre className="runway-num mt-4 max-h-[32rem] overflow-auto bg-runway-black p-4 text-[0.7rem] leading-relaxed text-runway-body">{JSON.stringify(result.publication, null, 2)}</pre>
      </details>
    </>
  );
}

export default function TaskEvaluationResultDetail() {
  const params = useParams<{ recordId: string }>();
  const recordId = params.recordId || "";
  const { result, currentUser, notFound, isLoading, error } = useTaskEvaluationResult(recordId);
  return (
    <AppShell active="runs" breadcrumb={`results / ${recordId || "unknown"}`}>
      <Helmet><title>Sealed Task Evaluation Result · Blueprint</title><meta name="description" content="Private sealed Task Evaluation Run result, media, and evidence downloads." /></Helmet>
      <div className="mx-auto flex max-w-[76rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href="/app/runs" className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="size-4" />All runs</Link>
        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error && result && currentUser ? <ResultContent result={result} user={currentUser} /> : null}
        {!isLoading && !error && notFound ? <ProofBoundary level="block" title="Result not available">No result in your owner or verified-team scope matched this identifier.</ProofBoundary> : null}
      </div>
    </AppShell>
  );
}
