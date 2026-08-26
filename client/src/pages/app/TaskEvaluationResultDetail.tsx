import { useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download, Eye, Film, ShieldAlert } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, Card, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
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
          <p className="font-mono text-[0.68rem] text-ink-400">{humanBytes(artifact.size_bytes)}{reviewOnly ? " · review-only" : ""}</p>
        </div>
        {!url ? <Button type="button" size="sm" variant="secondary" iconLeft={<Film />} onClick={load} disabled={loading}>{loading ? "Loading…" : "Load video"}</Button> : null}
      </div>
      {url ? <video className="mt-2 aspect-video w-full bg-ink-950" src={url} controls playsInline preload="metadata" /> : null}
      {error ? <p className="px-2 pb-2 text-body-s text-danger-fg">{error}</p> : null}
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
  return (
    <section className="flex flex-col gap-4 rounded-md border border-line bg-white p-4" aria-labelledby={`episode-${episode.episode_id}`}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">{episode.episode_kind.replace(/_/g, " ")}</p>
          <h3 id={`episode-${episode.episode_id}`} className="mt-1 text-title-m font-semibold text-ink-900">{episode.subject_id}</h3>
          <p className="font-mono text-[0.68rem] text-ink-400">{episode.episode_id}</p>
        </div>
        <StatusChip tone={succeeded ? "proof" : episode.score.task_succeeded === false ? "block" : "warn"} square>
          {succeeded ? "Task complete" : episode.score.task_succeeded === false ? "Not complete" : episode.score.status}
        </StatusChip>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <ProtectedVideo user={user} recordId={recordId} label="External camera" artifact={episode.artifacts.videos.external} />
        <ProtectedVideo user={user} recordId={recordId} label="Wrist camera" artifact={episode.artifacts.videos.wrist} />
        <ProtectedVideo user={user} recordId={recordId} label="Overview" artifact={episode.artifacts.videos.overview} reviewOnly />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, episode.artifacts.receipt)}>Episode receipt</Button>
        <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, episode.artifacts.frame_manifest)}>Frame manifest</Button>
      </div>
      <p className="text-body-s text-ink-500">Score authority: {episode.score.grader_authority.replace(/_/g, " ")}. The videos are derived review media; the digest-bound receipt and exact retained frames carry the evidence claim.</p>
    </section>
  );
}

function ResultContent({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser }) {
  const delivery = result.publication.result_delivery;
  const envelope = result.publication.decision_envelope;
  const packages = delivery?.artifacts.filter((artifact) => artifact.content_type === "application/zip") || [];
  return (
    <>
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-start">
        <div>
          <Eyebrow tone="brass" rule>Sealed Task Evaluation Result</Eyebrow>
          <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight text-ink-900">{envelope.decision_question || result.publication.run_id}</h1>
          <p className="mt-2 font-mono text-[0.72rem] text-ink-500">{result.publication.run_id}</p>
        </div>
        <Button type="button" variant="secondary" iconLeft={<Download />} onClick={() => downloadJson(result)}>Exact result JSON</Button>
      </header>

      <ProofBoundary level="warn" title="Bounded evidence, not a leaderboard" icon={ShieldAlert}>
        This result belongs to {result.access_visibility === "organization_members" ? "this verified team" : "the run owner"}. It is not published across teams. Simulation is not physical success, the overview is review-only, and this record does not approve deployment or safety.
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
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">{index + 1}. {stage.stage}</p>
              <StatusChip className="mt-2" tone={stage.status === "complete" || stage.status === "ready" ? "proof" : stage.status === "blocked" ? "block" : "neutral"} square>{stage.status}</StatusChip>
            </Card>
          ))}
        </section>
      ) : null}

      {delivery?.status === "ready" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Episode summary">
            {[
              ["Episodes", delivery.summary.episode_count],
              ["Policy episodes", delivery.summary.learned_candidate_episode_count],
              ["Controls", delivery.summary.control_episode_count],
              ["Task complete", delivery.summary.successful_episode_count],
            ].map(([label, value]) => <Card key={String(label)} pad="md"><p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">{label}</p><p className="mt-2 font-mono text-title-l font-semibold text-ink-900">{value}</p></Card>)}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><Eye className="size-4 text-ink-500" /><h2 className="text-title-m font-semibold text-ink-900">Episode review</h2></div>
            {delivery.episodes.map((episode) => <EpisodeCard key={episode.episode_id} episode={episode} user={user} recordId={result.record_id} />)}
          </section>

          <section className="rounded-md border border-line bg-white p-5">
            <h2 className="text-title-m font-semibold text-ink-900">Evidence downloads</h2>
            <p className="mt-1 text-body-s text-ink-500">The review pack is convenient for people. The full package also includes exact lossless policy inputs and camera frames and may be large.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {packages.map((artifact) => (
                <Button key={artifact.artifact_id} type="button" variant={artifact.role === "full_evidence_package" ? "action" : "secondary"} iconLeft={<Download />} onClick={() => void downloadArtifact(user, result.record_id, artifact)}>
                  {artifact.role === "full_evidence_package" ? "Full evidence ZIP" : "Review ZIP"} · {humanBytes(artifact.size_bytes)}
                </Button>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.68rem] text-ink-400">Delivery {delivery.delivery_digest}</p>
          </section>
        </>
      ) : null}

      <details className="rounded-md border border-line bg-white p-4">
        <summary className="cursor-pointer text-body-s font-semibold text-ink-800">Inspect decision envelope and exact bindings</summary>
        <pre className="mt-4 max-h-[32rem] overflow-auto bg-ink-950 p-4 text-[0.7rem] leading-relaxed text-white">{JSON.stringify(result.publication, null, 2)}</pre>
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
