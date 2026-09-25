import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import type { User as FirebaseUser } from "firebase/auth";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { Helmet } from "@/lib/helmet";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";

type Artifact = { artifact_id: string; relative_path: string; sha256: string; size_bytes: number;
  role: "g1_frame_manifest" | "g1_head_video" | "g1_overview_video" };
type Episode = { candidate_id: string; objective_id: string; policy_query_count: number;
  score: { outcome: string; [key: string]: unknown }; frame_manifest: Artifact;
  review_videos: { head: Artifact; overview: Artifact } };
type SiteReview = { schema_version: "native_g1_private_review_site_record.v1"; run_id: string;
  review: { scene_id: string; task_id: string; embodiment_id: string; claim_ceiling: "development_only";
    runtime_delivery_mode: string; review_digest: string; episodes: Episode[] };
  artifacts: Artifact[] };

async function loadReview(user: FirebaseUser, runId: string, signal?: AbortSignal): Promise<SiteReview> {
  const headers = await withFirebaseAuthHeaders(user);
  const response = await fetch(`/api/native-g1-reviews/${encodeURIComponent(runId)}`,
    { headers, credentials: "include", signal, redirect: "error" });
  if (!response.ok) throw new Error(response.status === 404
    ? "This private G1 review is unavailable to this account."
    : `Couldn't load the G1 review (${response.status}).`);
  const value = await response.json() as SiteReview;
  if (value.schema_version !== "native_g1_private_review_site_record.v1"
    || value.run_id !== runId || value.review?.episodes?.length !== 4) {
    throw new Error("The G1 review response is incomplete.");
  }
  return value;
}

async function ticket(user: FirebaseUser, runId: string, artifactId: string) {
  const headers = await withFirebaseAuthHeaders(user,
    await withCsrfHeader({ "Content-Type": "application/json" }));
  const response = await fetch(
    `/api/native-g1-reviews/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}/ticket`,
    { method: "POST", headers, body: "{}", credentials: "include", redirect: "error" },
  );
  if (!response.ok) throw new Error(`Review media is unavailable (${response.status}).`);
  const value = await response.json() as { download_url?: unknown };
  const path = `/api/native-g1-review-downloads/${encodeURIComponent(runId)}/${artifactId}?`;
  if (typeof value.download_url !== "string" || !value.download_url.startsWith(path)
    || value.download_url.includes("#") || value.download_url.includes("\\")) {
    throw new Error("Review media returned an invalid download link.");
  }
  return value.download_url;
}

function ReviewMedia({ user, runId, artifact, label }: {
  user: FirebaseUser; runId: string; artifact: Artifact; label: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextUrl = await ticket(user, runId, artifact.artifact_id);
      if (artifact.role === "g1_frame_manifest") {
        const anchor = document.createElement("a");
        anchor.href = nextUrl;
        anchor.download = artifact.relative_path.split("/").pop() || "frames.json";
        anchor.click();
      } else setUrl(nextUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review media is unavailable.");
    } finally { setLoading(false); }
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span>{label}</span>
        <button type="button" className="ws-link" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : artifact.role === "g1_frame_manifest" ? "Download frames" : "Load video"}
        </button>
      </div>
      {url && artifact.role !== "g1_frame_manifest"
        ? <video className="mt-2 aspect-video w-full bg-black" src={url} controls playsInline preload="metadata" /> : null}
      {error ? <p role="alert" className="mt-1 text-sm text-runway-red">{error}</p> : null}
    </div>
  );
}

export default function NativeG1PrivateReview() {
  const { runId = "" } = useParams<{ runId: string }>();
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["native-g1-private-review", currentUser?.uid, runId],
    enabled: Boolean(currentUser && !loading && runId),
    queryFn: ({ signal }) => loadReview(currentUser!, runId, signal),
    retry: 1,
  });
  const result = query.data;
  const artifact = (role: Artifact["role"], path: string) =>
    result?.artifacts.find((row) => row.role === role && row.relative_path === path);
  return (
    <AppShell active="runs" breadcrumb="G1 review">
      <Helmet>
        <title>Private G1 evaluation · Blueprint</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>
      <div className="mx-auto flex max-w-[76rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href="/app/runs" className="ws-back">← All runs</Link>
        {loading || query.isLoading ? <BuyerAppLoadingState /> : null}
        {!loading && !currentUser ? <p>Sign in to review this run.</p> : null}
        {query.error ? <BuyerAppErrorState message={query.error instanceof Error ? query.error.message : "Review unavailable"} /> : null}
        {result && currentUser ? <>
          <header className="ws-heading">
            <div>
              <h1>Unitree G1 evaluation</h1>
              <p>{result.review.task_id} · {result.review.scene_id}</p>
              <p>Simulation development review · 4 policy episodes · container runtime</p>
            </div>
          </header>
          <p className="text-sm text-ink-600">These are simulated outcomes for development review. They are not physical task proof or cleared public video.</p>
          <section className="ws-section" aria-label="Policy episodes">
            <h2 className="mb-4">Policy results</h2>
            <div className="flex flex-col gap-6">
              {result.review.episodes.map((episode) => {
                const frame = artifact("g1_frame_manifest", episode.frame_manifest.relative_path);
                const head = artifact("g1_head_video", episode.review_videos.head.relative_path);
                const overview = artifact("g1_overview_video", episode.review_videos.overview.relative_path);
                return <article key={episode.candidate_id} className="rounded-xl border border-ink-200 p-5">
                  <h3 className="break-all text-lg font-semibold">{episode.candidate_id}</h3>
                  <p className="mt-1 text-sm">{episode.objective_id === "task_success" ? "Book placement" : "Movement to goal"}
                    {" · "}Outcome: {episode.score.outcome.replaceAll("_", " ")}
                    {" · "}Policy queries: {episode.policy_query_count}</p>
                  <div className="mt-4 grid gap-5 lg:grid-cols-2">
                    {head ? <ReviewMedia user={currentUser} runId={runId} artifact={head} label="G1 head camera" /> : null}
                    {overview ? <ReviewMedia user={currentUser} runId={runId} artifact={overview} label="Overview camera" /> : null}
                  </div>
                  {frame ? <div className="mt-4"><ReviewMedia user={currentUser} runId={runId} artifact={frame} label="Lossless frame manifest" /></div> : null}
                </article>;
              })}
            </div>
          </section>
          <p className="break-all text-xs text-ink-500">Review digest: {result.review.review_digest}</p>
        </> : null}
      </div>
    </AppShell>
  );
}
