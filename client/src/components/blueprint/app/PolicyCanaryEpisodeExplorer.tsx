import { useEffect, useMemo, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Download, Film } from "lucide-react";

import { Button, ProofBoundary, StatusChip } from "@/components/blueprint";
import { buildAlignedCanaryCells, resolvedCanaryCandidates } from "@/lib/policyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  humanBytes,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultEpisode,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

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

function episodeVideos(
  episode?: TaskEvaluationResultEpisode,
): Record<string, TaskEvaluationResultArtifact> {
  return episode?.artifacts?.videos || episode?.evidence?.videos || {};
}

function EvidenceVideo({
  artifact,
  label,
  user,
  recordId,
  selectedTimeSeconds,
  timebaseOffsetSeconds,
}: {
  artifact?: TaskEvaluationResultArtifact;
  label: string;
  user: FirebaseUser;
  recordId: string;
  selectedTimeSeconds: number | null;
  timebaseOffsetSeconds: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (
      videoRef.current
      && selectedTimeSeconds !== null
      && timebaseOffsetSeconds !== null
    ) videoRef.current.currentTime = Math.max(0, selectedTimeSeconds + timebaseOffsetSeconds);
  }, [selectedTimeSeconds, timebaseOffsetSeconds, url]);
  if (!artifact) return <div className="flex aspect-video items-center justify-center border border-line bg-inset px-4 text-center text-caption text-ink-500">Typed gap — {label} video was not delivered.</div>;
  return <div className="border border-line p-3">
    <div className="flex items-center justify-between gap-2"><div><p className="text-caption font-semibold text-ink-800">{label}</p><p className="runway-num text-[0.65rem] text-ink-400">{humanBytes(artifact.size_bytes)}</p></div>{!url ? <Button type="button" size="sm" variant="secondary" iconLeft={<Film />} onClick={() => void createTaskEvaluationResultArtifactTicket(user, recordId, artifact.artifact_id).then(setUrl).catch((reason) => setError(reason instanceof Error ? reason.message : "Video unavailable"))}>Load</Button> : null}</div>
    {url ? <video ref={videoRef} className="mt-3 aspect-video w-full bg-runway-black" src={url} controls playsInline preload="metadata" /> : null}
    {error ? <p className="mt-2 text-caption text-runway-red">{error}</p> : null}
  </div>;
}

function Timeline({
  episodes,
  selectedTime,
  onSelectTime,
}: {
  episodes: TaskEvaluationResultEpisode[];
  selectedTime: number | null;
  onSelectTime: (time: number) => void;
}) {
  const rows = useMemo(() => {
    const times = [...new Set(episodes.flatMap((episode) => (
      (episode.timeline || []).map((event) => event.time_seconds)
    )))].sort((a, b) => a - b);
    return times.map((time) => ({
      time,
      events: episodes.map((episode) => (
        (episode.timeline || []).find((event) => event.time_seconds === time)
      )),
    }));
  }, [episodes]);
  if (!rows.length) return <ProofBoundary level="info" title="Synchronized timeline unavailable">No indexed action, joint/pose, object, contact/force, or scoring-transition rows were delivered. Raw trace artifacts remain listed below when present.</ProofBoundary>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[82rem] border-collapse text-left text-[0.68rem]"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-2 py-2">Time</th>{episodes.map((episode) => <th key={episode.episode_id} colSpan={6} className="runway-meta border-l border-line px-2 py-2">{episode.subject_id}</th>)}</tr><tr className="border-b border-line bg-inset"><th />{episodes.flatMap((episode) => ["Action", "Joint / pose", "Object", "Contact", "Force N", "Score"].map((label) => <th key={`${episode.episode_id}-${label}`} className="runway-meta px-2 py-2">{label}</th>))}</tr></thead><tbody>{rows.map((row) => <tr key={row.time} role="button" tabIndex={0} aria-label={`Seek paired evidence to ${row.time.toFixed(3)} seconds`} onClick={() => onSelectTime(row.time)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectTime(row.time); } }} className={`cursor-pointer border-b border-line-soft align-top outline-none focus-visible:ring-2 focus-visible:ring-action ${selectedTime === row.time ? "bg-runway-signal/[0.08]" : ""}`}><td className="runway-num px-2 py-2">{row.time.toFixed(3)}s</td>{row.events.flatMap((event, index) => [event?.action, event?.joint_pose, event?.task_object_pose, event?.contact_state, event?.force_newtons, event?.scoring_state].map((value, column) => <td key={`${index}-${column}`} className="max-w-[12rem] px-2 py-2 text-ink-700">{value === null || value === undefined || value === "" ? "—" : String(value)}</td>))}</tr>)}</tbody></table></div>;
}

function EpisodeDownloads({ episode, user, recordId }: { episode: TaskEvaluationResultEpisode; user: FirebaseUser; recordId: string }) {
  const artifacts = [
    episode.evidence?.lossless_policy_inputs,
    episode.evidence?.frame_manifest,
    episode.evidence?.episode_json,
    episode.evidence?.indexed_mcap_rosbag,
    episode.action_delivery?.returned_action_sequence,
    episode.action_delivery?.delivery_readback,
    episode.traces?.state,
    episode.traces?.contact_force,
    episode.traces?.task_object_trajectory,
  ].filter((artifact): artifact is TaskEvaluationResultArtifact => Boolean(artifact));
  return <div className="flex flex-wrap gap-2">{artifacts.map((artifact) => <Button key={artifact.artifact_id} type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, recordId, artifact)}>{artifact.role.replaceAll("_", " ")}</Button>)}{!artifacts.length ? <p className="text-caption text-ink-500">Typed gap — no exact frame, episode JSON, action, state, contact, or indexed telemetry artifact was delivered.</p> : null}</div>;
}

export function PolicyCanaryEpisodeExplorer({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser }) {
  const publication = result.publication;
  const episodes = publication.result_delivery?.episodes || [];
  const candidates = resolvedCanaryCandidates(result);
  const rows = useMemo(() => buildAlignedCanaryCells(episodes, candidates.map((candidate) => candidate.candidate_id), { family: "all", seed: "all", outcome: "all", interpretability: "all" }), [candidates, episodes]);
  const [selectedKey, setSelectedKey] = useState(rows[0]?.key || "");
  const selected = rows.find((row) => row.key === selectedKey) || rows[0];
  const pairedEpisodes = candidates.map((candidate) => selected?.episodesByCandidate[candidate.candidate_id]).filter((episode): episode is TaskEvaluationResultEpisode => Boolean(episode));
  const cameras: string[] = Array.from(new Set<string>(
    pairedEpisodes.flatMap((episode) => Object.keys(episodeVideos(episode))),
  ));
  const [camera, setCamera] = useState<string>(cameras[0] || "external");
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedKey && rows[0]) setSelectedKey(rows[0].key);
  }, [rows, selectedKey]);
  useEffect(() => {
    if (cameras.length && !cameras.includes(camera)) setCamera(cameras[0]);
  }, [camera, cameras]);

  return <details className="runway-panel p-5" open>
    <summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Paired episode explorer</summary>
    {!selected ? <p className="mt-4 text-body-s text-ink-500">No learned-policy episode pair was delivered.</p> : <div className="mt-5 flex flex-col gap-5">
      <div className="flex flex-wrap gap-4"><label className="runway-label min-w-72">Aligned cell<select className="runway-input" value={selected.key} onChange={(event) => setSelectedKey(event.target.value)}>{rows.map((row) => <option key={row.key} value={row.key}>{row.cellId} · seed {row.seed ?? "unavailable"} · {row.familyId}</option>)}</select></label><label className="runway-label min-w-52">Camera<select className="runway-input" value={camera} onChange={(event) => setCamera(event.target.value)}>{cameras.length ? cameras.map((name) => <option key={name} value={name}>{name.replaceAll("_", " ")}</option>) : <option value="external">No camera delivered</option>}</select></label></div>
      <div className="grid gap-4 lg:grid-cols-2">{candidates.map((candidate) => { const episode = selected.episodesByCandidate[candidate.candidate_id]; const artifact = episode ? episodeVideos(episode)[camera] : undefined; const offset = episode?.video_timebase_offsets_seconds?.[camera]; return <section id={episode ? `episode-${episode.episode_id}` : undefined} key={candidate.candidate_id} className="border border-line p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-body-s font-semibold text-ink-900">{candidate.display_name}</p><p className="runway-num mt-1 text-[0.66rem] text-ink-400">{episode?.episode_id || "episode missing"}</p></div><StatusChip tone={episode?.score.policy_outcome_interpretable === false ? "warn" : episode?.score.task_succeeded ? "proof" : "block"} square>{episode ? episode.score.policy_outcome_interpretable === false ? "Uninterpretable" : episode.score.task_succeeded ? "Success" : "Failure" : "Typed gap"}</StatusChip></div><div className="mt-3"><EvidenceVideo artifact={artifact} label={`${camera.replaceAll("_", " ")} review`} user={user} recordId={result.record_id} selectedTimeSeconds={selectedTime} timebaseOffsetSeconds={typeof offset === "number" ? offset : null} /></div>{episode && typeof offset !== "number" ? <p className="mt-2 text-caption text-runway-amber">Video timebase offset unavailable; synchronized seek is disabled for this video.</p> : null}{episode ? <div className="mt-3"><EpisodeDownloads episode={episode} user={user} recordId={result.record_id} /></div> : <p className="mt-3 text-caption text-ink-500">No episode record was delivered for this policy and cell.</p>}</section>; })}</div>
      <section><h3 className="font-display text-body font-semibold uppercase text-ink-900">Synchronized evidence timeline</h3><p className="mt-1 text-caption text-ink-500">Select a delivered timestamp to seek both videos using their sealed timebase offsets. Empty channels remain explicit gaps; Blueprint does not interpolate missing messages.</p>{selectedTime !== null ? <p className="runway-num mt-2 text-caption font-semibold text-ink-800">Selected playhead {selectedTime.toFixed(3)}s</p> : null}<div className="mt-3"><Timeline episodes={pairedEpisodes} selectedTime={selectedTime} onSelectTime={setSelectedTime} /></div></section>
    </div>}
  </details>;
}
