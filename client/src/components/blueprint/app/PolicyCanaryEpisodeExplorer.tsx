import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { ChevronLeft, ChevronRight, Download, Film } from "lucide-react";

import { Button, ProofBoundary, StatusChip } from "@/components/blueprint";
import {
  buildAlignedCanaryCells,
  humanCanaryCellLabel,
  resolvedCanaryCandidates,
} from "@/lib/policyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  humanBytes,
  TaskEvaluationArtifactTicketError,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultEpisode,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";
import {
  humanPolicyCanaryEpisodeOutcome,
  type PolicyCanaryScoreReceipt,
} from "@/lib/policyCanaryEpisodeOutcome";

async function downloadArtifact(
  user: FirebaseUser | null,
  recordId: string,
  artifact: TaskEvaluationResultArtifact,
) {
  const url = await createTaskEvaluationResultArtifactTicket(
    user,
    recordId,
    artifact.artifact_id,
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  const relativePath = String(artifact.relative_path || artifact.artifact_id);
  anchor.download = relativePath.split("/").pop() || artifact.role || artifact.artifact_id;
  anchor.click();
}

function episodeVideos(
  episode?: TaskEvaluationResultEpisode,
): Record<string, TaskEvaluationResultArtifact> {
  return episode?.artifacts?.videos || episode?.evidence?.videos || {};
}

function cameraLabel(camera: string) {
  const labels: Record<string, string> = {
    external: "External camera",
    wrist: "Wrist camera",
    overview: "Overview camera",
    review: "Review camera",
  };
  return labels[camera] || camera.replaceAll("_", " ");
}

function terminalStatus(episode?: TaskEvaluationResultEpisode) {
  if (!episode) return { label: "Episode absent", tone: "neutral" as const };
  const material = [episode.score.status, episode.failure?.code, episode.failure?.phase]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (material.includes("blocked")) return { label: "Blocked", tone: "block" as const };
  if (material.includes("cancel")) return { label: "Cancelled", tone: "neutral" as const };
  if (episode.score.task_succeeded === true) return { label: "Success", tone: "proof" as const };
  if (episode.score.task_succeeded === false) return { label: "Task not complete", tone: "block" as const };
  return {
    label: episode.score.status.replaceAll("_", " ") || "Status unavailable",
    tone: "warn" as const,
  };
}

function EpisodeOutcomeSummary({
  artifact,
  correctedScore,
  user,
  recordId,
}: {
  artifact?: TaskEvaluationResultArtifact;
  correctedScore?: PolicyCanaryScoreReceipt;
  user: FirebaseUser | null;
  recordId: string;
}) {
  const [receipt, setReceipt] = useState<PolicyCanaryScoreReceipt | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReceipt(null);
    setFailed(false);
    if (correctedScore) {
      setReceipt(correctedScore);
      return () => { cancelled = true; };
    }
    if (!artifact) return () => { cancelled = true; };
    void (async () => {
      try {
        const url = await createTaskEvaluationResultArtifactTicket(
          user,
          recordId,
          artifact.artifact_id,
        );
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error(`score receipt ${response.status}`);
        const text = await response.text();
        if (text.length > 256_000) throw new Error("score receipt too large");
        const parsed = JSON.parse(text) as PolicyCanaryScoreReceipt;
        if (!cancelled) setReceipt(parsed);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [artifact?.artifact_id, correctedScore, recordId, user]);

  if (!artifact && !correctedScore) return null;
  if (!receipt) return <div className="mt-4 border-l-4 border-runway-amber bg-inset p-4" aria-live="polite">
    <p className="runway-meta">Why this episode failed</p>
    <p className="mt-1 text-body-s font-semibold text-ink-900">
      {failed ? "Detailed score receipt could not be loaded" : "Loading deterministic score…"}
    </p>
  </div>;

  const summary = humanPolicyCanaryEpisodeOutcome(receipt);
  const border = summary.tone === "proof"
    ? "border-runway-green"
    : summary.tone === "warn"
      ? "border-runway-amber"
      : "border-runway-red";
  return <div className={`mt-4 border-l-4 ${border} bg-inset p-4`} aria-live="polite">
    <p className="runway-meta">{summary.tone === "proof" ? "Episode result" : "Why this episode failed"}</p>
    <h4 className="mt-1 text-body font-semibold text-ink-900">{summary.title}</h4>
    <p className="mt-1 text-body-s text-ink-600">{summary.explanation}</p>
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-caption sm:grid-cols-3">
      {summary.facts.map((fact) => <div key={fact.label}>
        <dt className="text-ink-400">{fact.label}</dt>
        <dd className="mt-0.5 font-semibold text-ink-800">{fact.value}</dd>
      </div>)}
    </dl>
  </div>;
}

function EvidenceVideo({
  artifact,
  camera,
  policy,
  user,
  recordId,
  selectedTimeSeconds,
  timebaseOffsetSeconds,
}: {
  artifact?: TaskEvaluationResultArtifact;
  camera: string;
  policy: string;
  user: FirebaseUser | null;
  recordId: string;
  selectedTimeSeconds: number | null;
  timebaseOffsetSeconds: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setUrl(null);
    setState("idle");
    setError(null);
  }, [artifact?.artifact_id]);

  useEffect(() => {
    if (
      videoRef.current
      && selectedTimeSeconds !== null
      && timebaseOffsetSeconds !== null
    ) videoRef.current.currentTime = Math.max(0, selectedTimeSeconds + timebaseOffsetSeconds);
  }, [selectedTimeSeconds, timebaseOffsetSeconds, url]);

  async function load() {
    if (!artifact) return;
    setState("loading");
    setError(null);
    try {
      setUrl(await createTaskEvaluationResultArtifactTicket(
        user,
        recordId,
        artifact.artifact_id,
      ));
      setState("ready");
    } catch (reason) {
      setState("failed");
      setError(reason instanceof TaskEvaluationArtifactTicketError
        ? reason.message
        : "The video could not be loaded. Try again.");
    }
  }

  if (!artifact) {
    return <div className="flex aspect-video flex-col items-center justify-center border border-line bg-inset px-5 text-center">
      <StatusChip tone="warn" square>Not delivered</StatusChip>
      <p className="mt-3 text-body-s text-ink-500">
        Typed evidence gap — no {cameraLabel(camera).toLowerCase()} video was delivered.
      </p>
    </div>;
  }

  const status = state === "ready"
    ? { label: "Ready", tone: "proof" as const }
    : state === "loading"
      ? { label: "Loading", tone: "neutral" as const }
      : state === "failed"
        ? { label: "Load failed", tone: "block" as const }
        : { label: "Not loaded", tone: "neutral" as const };

  return <div className="border border-line bg-paper-0 p-3" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-body-s font-semibold text-ink-900">{cameraLabel(camera)}</p>
        <p className="runway-num mt-1 text-[0.65rem] text-ink-400">
          {humanBytes(artifact.size_bytes)} · authenticated evidence
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusChip tone={status.tone} square>{status.label}</StatusChip>
        {state !== "ready" ? <Button
          type="button"
          size="sm"
          variant="secondary"
          iconLeft={<Film aria-hidden="true" />}
          onClick={() => void load()}
          disabled={state === "loading"}
          aria-label={`${state === "failed" ? "Retry" : "Load"} ${cameraLabel(camera)} video for ${policy}`}
        >
          {state === "failed" ? "Retry video" : state === "loading" ? "Loading…" : "Load video"}
        </Button> : null}
      </div>
    </div>
    {url ? <video
      ref={videoRef}
      aria-label={`${cameraLabel(camera)} evidence for ${policy}`}
      className="mt-3 aspect-video w-full bg-runway-black"
      src={url}
      controls
      playsInline
      preload="metadata"
    /> : <div className="mt-3 flex aspect-video items-center justify-center bg-runway-black px-4 text-center text-caption text-runway-muted">
      Video bytes load only when requested.
    </div>}
    {error ? <p className="mt-2 text-body-s text-runway-red">{error}</p> : null}
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
  if (!rows.length) {
    return <ProofBoundary level="info" title="Synchronized timeline unavailable">
      No indexed action, joint, object, contact, force, or scoring rows were delivered.
    </ProofBoundary>;
  }
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[82rem] border-collapse text-left text-[0.68rem]">
      <thead>
        <tr className="border-b border-line bg-runway-black">
          <th className="runway-meta px-2 py-2">Time</th>
          {episodes.map((episode) => <th key={episode.episode_id} colSpan={6} className="runway-meta border-l border-line px-2 py-2">{episode.subject_id}</th>)}
        </tr>
        <tr className="border-b border-line bg-inset">
          <th />
          {episodes.flatMap((episode) => ["Action", "Joint / pose", "Object", "Contact", "Force N", "Score"].map((label) => <th key={`${episode.episode_id}-${label}`} className="runway-meta px-2 py-2">{label}</th>))}
        </tr>
      </thead>
      <tbody>{rows.map((row) => <tr
        key={row.time}
        role="button"
        tabIndex={0}
        aria-label={`Seek paired evidence to ${row.time.toFixed(3)} seconds`}
        onClick={() => onSelectTime(row.time)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectTime(row.time);
          }
        }}
        className={`cursor-pointer border-b border-line-soft align-top outline-none focus-visible:ring-2 focus-visible:ring-action ${selectedTime === row.time ? "bg-runway-signal/[0.08]" : ""}`}
      >
        <td className="runway-num px-2 py-2">{row.time.toFixed(3)}s</td>
        {row.events.flatMap((event, index) => [
          event?.action,
          event?.joint_pose,
          event?.task_object_pose,
          event?.contact_state,
          event?.force_newtons,
          event?.scoring_state,
        ].map((value, column) => <td key={`${index}-${column}`} className="max-w-[12rem] px-2 py-2 text-ink-700">{value === null || value === undefined || value === "" ? "—" : String(value)}</td>))}
      </tr>)}</tbody>
    </table>
  </div>;
}

function EpisodeDownloads({
  episode,
  user,
  recordId,
}: {
  episode: TaskEvaluationResultEpisode;
  user: FirebaseUser | null;
  recordId: string;
}) {
  const artifacts = [
    ["lossless_policy_inputs", episode.evidence?.lossless_policy_inputs],
    ["frame_manifest", episode.evidence?.frame_manifest],
    ["episode_json", episode.evidence?.episode_json],
    ["indexed_mcap_rosbag", episode.evidence?.indexed_mcap_rosbag],
    ["returned_action_sequence", episode.action_delivery?.returned_action_sequence],
    ["action_delivery_readback", episode.action_delivery?.delivery_readback],
    ["state_trace", episode.traces?.state],
    ["contact_force_trace", episode.traces?.contact_force],
    ["task_object_trajectory", episode.traces?.task_object_trajectory],
  ].filter((row): row is [string, TaskEvaluationResultArtifact] => Boolean(row[1]));
  return <div className="flex flex-wrap gap-2">
    {artifacts.map(([fallbackRole, artifact]) => <Button
      key={artifact.artifact_id}
      type="button"
      size="sm"
      variant="secondary"
      iconLeft={<Download aria-hidden="true" />}
      onClick={() => void downloadArtifact(user, recordId, artifact)}
    >
      {String(artifact.role || fallbackRole).replaceAll("_", " ")}
    </Button>)}
    {!artifacts.length ? <p className="text-caption text-ink-500">
      Typed gap — no exact frame, episode JSON, action, state, contact, or telemetry artifact was delivered.
    </p> : null}
  </div>;
}

export function PolicyCanaryEpisodeExplorer({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const publication = result.publication;
  const episodes = publication.result_delivery?.episodes || [];
  const candidates = resolvedCanaryCandidates(result);
  const rows = useMemo(() => buildAlignedCanaryCells(
    episodes,
    candidates.map((candidate) => candidate.candidate_id),
    { family: "all", seed: "all", outcome: "all", interpretability: "all" },
  ), [candidates, episodes]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = rows[selectedIndex];
  const pairedEpisodes = candidates
    .map((candidate) => selected?.episodesByCandidate[candidate.candidate_id])
    .filter((episode): episode is TaskEvaluationResultEpisode => Boolean(episode));
  const cameras: string[] = Array.from(new Set<string>(
    pairedEpisodes.flatMap((episode) => Object.keys(episodeVideos(episode))),
  ));
  const [camera, setCamera] = useState(cameras[0] || "external");
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const plannedCellCount = Number(
    publication.policy_canary_result?.counts?.episodes_per_policy || 10,
  );
  const plannedEpisodeCount = Number(
    publication.policy_canary_result?.counts?.learned_policy_rollout_count
      || plannedCellCount * Math.max(candidates.length, 2),
  );
  const scoreReceiptByEpisodeId = useMemo(() => new Map<string, TaskEvaluationResultArtifact>(
    (Array.isArray(publication.policy_canary_result?.episodes)
      ? publication.policy_canary_result.episodes
      : [])
      .map((row: Record<string, any>) => [
        String(row.episode_id || ""),
        row.evidence?.score_receipt as TaskEvaluationResultArtifact | undefined,
      ] as const)
      .filter((row): row is readonly [string, TaskEvaluationResultArtifact] => (
        Boolean(row[0]) && Boolean(row[1]?.artifact_id)
      )),
  ), [publication.policy_canary_result]);
  const firstEpisodeNumber = selectedIndex * Math.max(candidates.length, 2) + 1;
  const lastEpisodeNumber = Math.min(
    firstEpisodeNumber + Math.max(candidates.length, 2) - 1,
    plannedEpisodeCount,
  );

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(Math.max(rows.length - 1, 0));
  }, [rows.length, selectedIndex]);
  useEffect(() => {
    if (cameras.length && !cameras.includes(camera)) setCamera(cameras[0]);
  }, [camera, cameras]);

  function select(index: number) {
    setSelectedIndex(Math.min(Math.max(index, 0), Math.max(rows.length - 1, 0)));
    setSelectedTime(null);
  }

  function navigateWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      select(selectedIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select(selectedIndex + 1);
    }
  }

  if (!selected) {
    return <section className="runway-panel p-5">
      <h2 className="font-display text-title-m font-semibold uppercase text-ink-900">Compare episode evidence</h2>
      <p className="mt-3 text-body-s text-ink-500">No learned-policy episode cells were delivered.</p>
    </section>;
  }

  const humanLabel = humanCanaryCellLabel(selected, selectedIndex, rows);
  return <section className="runway-panel overflow-hidden" aria-labelledby="canary-cell-title">
    <div
      className="border-b border-line bg-inset p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action sm:p-5"
      role="group"
      tabIndex={0}
      aria-label="Scenario cell navigator. Use left and right arrow keys to change cells."
      onKeyDown={navigateWithKeyboard}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          iconLeft={<ChevronLeft aria-hidden="true" />}
          disabled={selectedIndex === 0}
          onClick={() => select(selectedIndex - 1)}
        >Previous</Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="runway-meta">Cell {selectedIndex + 1} of {plannedCellCount} · Episodes {firstEpisodeNumber}–{lastEpisodeNumber} of {plannedEpisodeCount}</p>
          <h2 id="canary-cell-title" className="mt-1 font-display text-title-l font-semibold uppercase text-ink-900">{humanLabel}</h2>
          <p className="runway-num mt-1 break-all text-[0.68rem] text-ink-400">{selected.cellId} · seed {selected.seed ?? "unavailable"}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={selectedIndex >= rows.length - 1}
          onClick={() => select(selectedIndex + 1)}
        >Next<ChevronRight aria-hidden="true" /></Button>
      </div>
      <label className="runway-label mx-auto mt-4 block max-w-md">
        Jump to cell
        <select
          className="runway-input"
          value={selectedIndex}
          onChange={(event) => select(Number(event.target.value))}
        >
          {rows.map((row, index) => <option key={row.key} value={index}>
            {index + 1}. {humanCanaryCellLabel(row, index, rows)} — {row.cellId}
          </option>)}
        </select>
      </label>
    </div>

    <div className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="runway-meta">Observation camera</p>
          <p className="mt-1 text-body-s text-ink-500">The same camera is shown for both policies.</p>
        </div>
        <div className="flex flex-wrap border border-line" role="tablist" aria-label="Observation cameras">
          {(cameras.length ? cameras : ["unavailable"]).map((name) => <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === camera}
            disabled={name === "unavailable"}
            onClick={() => setCamera(name)}
            className={`border-r border-line px-3 py-2 text-caption font-semibold last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action ${name === camera ? "bg-runway-black text-runway-body" : "bg-paper-0 text-ink-600 hover:bg-inset"}`}
          >
            {name === "unavailable" ? "No camera delivered" : cameraLabel(name)}
          </button>)}
        </div>
      </div>

      <div className="mt-4 grid gap-px border border-line bg-line md:grid-cols-2">
        {candidates.map((candidate) => {
          const episode = selected.episodesByCandidate[candidate.candidate_id];
          const status = terminalStatus(episode);
          const artifact = episode ? episodeVideos(episode)[camera] : undefined;
          const offset = episode?.video_timebase_offsets_seconds?.[camera];
          return <section
            id={episode ? `episode-${episode.episode_id}` : undefined}
            key={candidate.candidate_id}
            className="min-w-0 bg-paper-0 p-4"
            aria-label={`${candidate.display_name} episode evidence`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="runway-meta">Policy</p>
                <h3 className="mt-1 text-body font-semibold text-ink-900">{candidate.display_name}</h3>
                <p className="runway-num mt-1 break-all text-[0.65rem] text-ink-400">{episode?.episode_id || "episode not delivered"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <StatusChip tone={status.tone} square>{status.label}</StatusChip>
                <StatusChip tone={episode?.score.policy_outcome_interpretable === false ? "warn" : episode ? "proof" : "neutral"} square>
                  {episode?.score.policy_outcome_interpretable === false ? "Uninterpretable" : episode ? "Interpretable" : "No episode"}
                </StatusChip>
              </div>
            </div>
            {episode?.failure ? <p className="mt-3 border-l-2 border-runway-red pl-3 text-body-s text-ink-700">
              <span className="font-semibold">{episode.failure.code.replaceAll("_", " ")}.</span>{" "}
              {episode.failure.summary || "No additional failure summary was delivered."}
            </p> : null}
            {episode ? <EpisodeOutcomeSummary
              artifact={scoreReceiptByEpisodeId.get(episode.episode_id)}
              correctedScore={episode.corrected_score}
              user={user}
              recordId={result.record_id}
            /> : null}
            {episode?.interpretation ? <div className="mt-4 border-l-4 border-runway-amber bg-inset p-4">
              <p className="runway-meta">Independent learned interpretation</p>
              <h4 className="mt-1 text-body font-semibold text-ink-900">
                {episode.interpretation.status === "abstained"
                  ? "Interpreter abstained"
                  : episode.interpretation.episode_outcome.replaceAll("_", " ")}
              </h4>
              <p className="mt-1 text-body-s text-ink-600">{episode.interpretation.summary}</p>
              <p className="mt-2 text-caption text-ink-500">
                Learned explanation only · deterministic score unchanged · confidence {Math.round(episode.interpretation.confidence * 100)}%
              </p>
              {episode.interpretation.deterministic_agreement === "disagrees" ? <p className="mt-2 text-caption font-semibold text-runway-amber">
                This interpretation disagrees with deterministic scoring and is flagged for review; it does not change the result.
              </p> : null}
            </div> : null}
            <div className="mt-4">
              <EvidenceVideo
                artifact={artifact}
                camera={camera}
                policy={candidate.display_name}
                user={user}
                recordId={result.record_id}
                selectedTimeSeconds={selectedTime}
                timebaseOffsetSeconds={typeof offset === "number" ? offset : null}
              />
            </div>
            {episode && typeof offset !== "number" ? <p className="mt-2 text-caption text-runway-amber">
              Timebase offset unavailable; synchronized seek is disabled for this video.
            </p> : null}
            {episode ? <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-caption font-semibold text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">Episode evidence files</summary>
              <div className="mt-3"><EpisodeDownloads episode={episode} user={user} recordId={result.record_id} /></div>
            </details> : null}
          </section>;
        })}
      </div>

      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer font-display text-body font-semibold uppercase text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">Synchronized action and state timeline</summary>
        <p className="mt-2 text-caption text-ink-500">
          Select a delivered timestamp to seek both videos. Missing channels stay explicit.
        </p>
        {selectedTime !== null ? <p className="runway-num mt-2 text-caption font-semibold text-ink-800">Selected playhead {selectedTime.toFixed(3)}s</p> : null}
        <div className="mt-3"><Timeline episodes={pairedEpisodes} selectedTime={selectedTime} onSelectTime={setSelectedTime} /></div>
      </details>
    </div>
  </section>;
}
