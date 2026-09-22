import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";

import { PrimaryDownload, WrapAtUnderscores } from "./PolicyCanaryPrimarySummary";
import { fetchVerifiedResultArtifactJson } from "@/lib/verifiedResultArtifactJson";
import {
  buildAlignedCanaryCells,
  canaryCellCoverageNotes,
  canaryEpisodeOutcome,
  canaryUnscoredReason,
  humanCanaryCellLabel,
  isScorableCanaryEpisode,
  normalizedArtifact,
  resolvedCanaryCandidates,
  runtimeCanaryCoverage,
  runtimeCoverageGapsByEpisode,
  type AlignedCanaryCell,
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

type Outcome = { label: string; tone: "green" | "red" | "neutral" };

export function OutcomeTag({ outcome }: { outcome: Outcome }) {
  return <span className="ws-tag whitespace-nowrap" data-tone={outcome.tone}>{outcome.label}</span>;
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

function cellOutcome(row: AlignedCanaryCell, candidateId: string): Outcome {
  return row.duplicateEpisodesByCandidate[candidateId]?.length
    ? { label: "Ambiguous", tone: "neutral" }
    : canaryEpisodeOutcome(row.episodesByCandidate[candidateId]);
}

/** "Not scored — <why>." with the producer's own summary when it adds something. */
function unscoredSentence(episode: TaskEvaluationResultEpisode) {
  const reason = canaryUnscoredReason(episode);
  const code = episode.failure?.code;
  const summary = episode.failure?.summary?.trim();
  const extra = summary && code && summary.replace(/[.\s]+$/, "") !== code && !summary.startsWith(code)
    ? ` ${summary}` : "";
  const codeNote = code && !extra && !reason.includes(code.replaceAll("_", " ")) ? ` (${code})` : "";
  return `Not scored — ${reason}${codeNote}.${extra}`;
}

function useScoreReceipt(
  artifact: TaskEvaluationResultArtifact | undefined,
  correctedScore: PolicyCanaryScoreReceipt | undefined,
  user: FirebaseUser | null,
  recordId: string,
  enabled: boolean,
) {
  const [receipt, setReceipt] = useState<PolicyCanaryScoreReceipt | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setReceipt(null);
    setFailed(false);
    if (!enabled) return () => { cancelled = true; };
    if (correctedScore) {
      setReceipt(correctedScore);
      return () => { cancelled = true; };
    }
    if (!artifact) return () => { cancelled = true; };
    void (async () => {
      try {
        const parsed = await fetchVerifiedResultArtifactJson(user, recordId, artifact, { signal: controller.signal }) as PolicyCanaryScoreReceipt;
        if (!cancelled) setReceipt(parsed);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [artifact?.artifact_id, artifact?.sha256, artifact?.size_bytes, correctedScore, enabled, recordId, user, retry]);
  return {
    receipt,
    failed,
    loading: enabled && Boolean(artifact || correctedScore) && !receipt && !failed,
    retry: () => setRetry((value) => value + 1),
  };
}

export function EvidenceVideo(props: Parameters<typeof EvidenceVideoContent>[0]) {
  return <EvidenceVideoContent key={`${props.user?.uid || "anonymous"}:${props.user?.tenantId || ""}:${props.recordId}:${props.artifact?.artifact_id || "missing"}`} {...props} />;
}

function EvidenceVideoContent({
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
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const [retryWait, setRetryWait] = useState<number | null>(null);
  useEffect(() => {
    if (!retryWait) return;
    const timer = setTimeout(() => setRetryWait(null), retryWait * 1000);
    return () => clearTimeout(timer);
  }, [retryWait]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => {
    if (!url || state !== "loading") return;
    const timer = setTimeout(() => {
      setUrl(null); setState("failed");
      setError("Media loading timed out. Retry to authorize a fresh download.");
    }, 30_000);
    return () => clearTimeout(timer);
  }, [url, state]);

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
    if (!artifact || retryWait) return;
    request.current?.abort(); request.current = new AbortController();
    setState("loading");
    setError(null);
    try {
      const ticket = await createTaskEvaluationResultArtifactTicket(
        user,
        recordId,
        artifact.artifact_id,
        { signal: request.current.signal },
      );
      if (mounted.current) setUrl(ticket);
    } catch (reason) {
      if (!mounted.current) return;
      setState("failed");
      if (reason instanceof TaskEvaluationArtifactTicketError && reason.status === 429) setRetryWait(reason.retryAfterSeconds);
      setError(reason instanceof TaskEvaluationArtifactTicketError
        ? reason.message
        : "The video could not be loaded. Try again.");
    }
  }

  if (!artifact) {
    return <div className="flex aspect-video items-center justify-center border border-line bg-inset px-5 text-center text-sm text-ink-500">
      No {cameraLabel(camera).toLowerCase()} video was delivered.
    </div>;
  }

  return <div aria-live="polite">
    {url ? <video
      ref={videoRef}
      aria-label={`${cameraLabel(camera)} evidence for ${policy}`}
      className="aspect-video w-full bg-runway-black"
      src={url}
      controls
      playsInline
      preload="metadata"
      onLoadedData={() => setState("ready")}
      onError={() => {
        setUrl(null); setState("failed");
        setError("The media could not be read or its access expired. Retry to authorize a fresh download.");
      }}
    /> : <div className="flex aspect-video flex-col items-center justify-center gap-1 border border-line bg-inset px-4 text-center">
      <button
        type="button"
        className="ws-link"
        onClick={() => void load()}
        disabled={state === "loading" || Boolean(retryWait)}
        aria-label={`${state === "failed" ? "Retry" : "Load"} ${cameraLabel(camera)} video for ${policy}`}
      >
        <Film size={18} aria-hidden="true" />
        {state === "failed" ? "Retry video" : state === "loading" ? "Loading…" : "Load video"}
      </button>
      <span className="text-xs text-ink-500">{cameraLabel(camera)} · {humanBytes(artifact.size_bytes)}</span>
    </div>}
    {error ? <p className="mt-2 text-sm text-runway-red">{error}</p> : null}
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
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[82rem] border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-line text-ink-500">
          <th className="px-2 py-2 font-normal">Time</th>
          {episodes.map((episode) => <th key={episode.episode_id} colSpan={6} className="border-l border-line px-2 py-2 font-normal">{episode.subject_id}</th>)}
        </tr>
        <tr className="border-b border-line text-ink-500">
          <th />
          {episodes.flatMap((episode) => ["Action", "Joint / pose", "Object", "Contact", "Force N", "Score"].map((label) => <th key={`${episode.episode_id}-${label}`} className="px-2 py-2 font-normal">{label}</th>))}
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
        className={`cursor-pointer border-b border-line align-top outline-none focus-visible:ring-2 focus-visible:ring-action ${selectedTime === row.time ? "bg-inset" : ""}`}
      >
        <td className="tabular-nums px-2 py-2">{row.time.toFixed(3)}s</td>
        {row.events.flatMap((event, index) => [
          event?.action,
          event?.joint_pose,
          event?.task_object_pose,
          event?.contact_state,
          event?.force_newtons,
          event?.scoring_state,
        ].map((value, column) => <td key={`${index}-${column}`} className="max-w-[12rem] px-2 py-2">{value === null || value === undefined || value === "" ? "—" : String(value)}</td>))}
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
  if (!artifacts.length) return <p className="text-sm text-ink-500">No files were delivered for this episode.</p>;
  return <div className="flex flex-wrap gap-x-5 gap-y-2">
    {artifacts.map(([fallbackRole, artifact]) => <PrimaryDownload
      key={artifact.artifact_id} artifact={artifact}
      label={String(artifact.role || fallbackRole).replaceAll("_", " ")}
      user={user} recordId={recordId}
    />)}
  </div>;
}

function EpisodeCard({
  candidateName,
  episode,
  duplicates,
  camera,
  scoreReceipt,
  selectedTime,
  user,
  recordId,
}: {
  candidateName: string;
  episode?: TaskEvaluationResultEpisode;
  duplicates: TaskEvaluationResultEpisode[];
  camera: string;
  scoreReceipt?: TaskEvaluationResultArtifact;
  selectedTime: number | null;
  user: FirebaseUser | null;
  recordId: string;
}) {
  const scored = Boolean(episode && !duplicates.length && isScorableCanaryEpisode(episode));
  const score = useScoreReceipt(scoreReceipt, episode?.corrected_score, user, recordId, scored);
  const summary = score.receipt ? humanPolicyCanaryEpisodeOutcome(score.receipt) : null;
  const outcome: Outcome = duplicates.length
    ? { label: "Ambiguous", tone: "neutral" }
    : canaryEpisodeOutcome(episode);
  const offset = episode?.video_timebase_offsets_seconds?.[camera];
  const interpretation = episode?.interpretation;

  return <section aria-label={`${candidateName} episode`} className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="break-words text-lg font-medium">{candidateName}</h4>
      <OutcomeTag outcome={outcome} />
    </div>
    <div className="mt-1.5 text-sm text-ink-700" aria-live="polite">
      {duplicates.length ? <>
        <p>{duplicates.length} records exist for this scenario, so neither is used in the counts.</p>
        <ul className="mt-1 text-ink-500">{duplicates.map((row, index) => <li key={`${row.episode_id}-${index}`} className="break-all">
          {row.episode_id} · {canaryEpisodeOutcome(row).label}
        </li>)}</ul>
      </> : !episode ? <p>No episode was delivered for this scenario.</p>
        : !scored ? <p>{unscoredSentence(episode)}</p>
          : summary ? <p>{summary.title}. <span className="text-ink-500">{summary.explanation}</span></p>
            : score.failed ? <p>
              Score details couldn't be loaded.{" "}
              <button type="button" className="ws-link" onClick={score.retry}>Retry</button>
            </p>
              : score.loading ? <p className="text-ink-500">Loading score details…</p>
                : episode.failure?.summary ? <p>{episode.failure.summary}</p> : null}
      {interpretation?.status === "completed" && interpretation.deterministic_agreement === "disagrees"
        ? <p className="mt-1 text-runway-amber">An AI review disagrees with this score. It's flagged for review and doesn't change the result.</p>
        : null}
    </div>
    <div className="mt-3">
      <EvidenceVideo
        artifact={episode ? episodeVideos(episode)[camera] : undefined}
        camera={camera}
        policy={candidateName}
        user={user}
        recordId={recordId}
        selectedTimeSeconds={selectedTime}
        timebaseOffsetSeconds={typeof offset === "number" ? offset : null}
      />
    </div>
    {episode ? <details className="mt-3">
      <summary>Details and files</summary>
      <div className="flex flex-col gap-4 text-sm">
        {summary ? <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {summary.facts.map((fact) => <div key={fact.label}>
            <dt className="text-ink-500">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>)}
        </dl> : null}
        {interpretation ? <p>
          {interpretation.status === "abstained"
            ? `AI review: no interpretation (${(interpretation.abstention_reason || "no reason given").replaceAll("_", " ")}).`
            : `AI review, ${Math.round(interpretation.confidence * 100)}% confidence: ${interpretation.summary}`}
          {" "}<span className="text-ink-500">It doesn't change the score.</span>
        </p> : null}
        <p className="break-all text-xs text-ink-500">
          Episode {episode.episode_id}{episode.variation?.cell_id ? ` · cell ${episode.variation.cell_id}` : ""}
        </p>
        <EpisodeDownloads episode={episode} user={user} recordId={recordId} />
      </div>
    </details> : null}
  </section>;
}

export function PolicyCanaryEpisodeExplorer({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const publication = result.publication;
  const projection = publication.policy_canary_result;
  const candidates = useMemo(() => resolvedCanaryCandidates(result), [result]);
  const rows = useMemo(() => buildAlignedCanaryCells(
    publication.result_delivery?.episodes || [],
    candidates.map((candidate) => candidate.candidate_id),
  ), [candidates, publication.result_delivery?.episodes]);
  const projectedEpisodes: Array<Record<string, any>> = Array.isArray(projection?.episodes) ? projection.episodes : [];
  const gapsByEpisode = useMemo(() => runtimeCoverageGapsByEpisode(projectedEpisodes), [projection]);
  const scoreReceiptByEpisodeId = useMemo(() => new Map<string, TaskEvaluationResultArtifact>(
    projectedEpisodes
      .map((row) => [
        String(row.episode_id || ""),
        normalizedArtifact(row.evidence?.score_receipt) || undefined,
      ] as const)
      .filter((row): row is readonly [string, TaskEvaluationResultArtifact] => (
        Boolean(row[0]) && Boolean(row[1]?.artifact_id)
      )),
  ), [projection]);
  const coverage = runtimeCanaryCoverage(projectedEpisodes);
  const plannedCells = Number(projection?.counts?.episodes_per_policy || 0);
  const plannedGaps: Array<Record<string, any>> = Array.isArray(projection?.coverage_gaps) ? projection.coverage_gaps : [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [camera, setCamera] = useState("external");
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const selected = rows[selectedIndex];
  const pairedEpisodes = candidates
    .map((candidate) => selected?.episodesByCandidate[candidate.candidate_id])
    .filter((episode): episode is TaskEvaluationResultEpisode => Boolean(episode));
  const cameras: string[] = Array.from(new Set<string>(
    pairedEpisodes.flatMap((episode) => Object.keys(episodeVideos(episode))),
  ));
  const hasTimeline = pairedEpisodes.some((episode) => episode.timeline?.length);
  const unsyncedVideos = pairedEpisodes
    .filter((episode) => typeof episode.video_timebase_offsets_seconds?.[camera] !== "number")
    .map((episode) => candidates.find((candidate) => (
      candidate.candidate_id === (episode.policy_candidate_id || episode.subject_id)
    ))?.display_name || episode.subject_id);

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

  function openScenario(index: number) {
    select(index);
    const reduceMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewer.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
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
    return <section aria-labelledby="canary-episodes-title">
      <h2 id="canary-episodes-title">Episodes</h2>
      <p className="mt-2 text-ink-500">No policy episodes were delivered.</p>
    </section>;
  }

  const selectedNotes = canaryCellCoverageNotes(selected, gapsByEpisode);
  return <section aria-labelledby="canary-episodes-title">
    <h2 id="canary-episodes-title">Episodes</h2>
    <p className="mt-1 text-sm text-ink-500">Choose a scenario to watch both policies side by side.</p>

    <div className="mt-4 max-w-3xl overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-ink-500">
            <th scope="col" className="py-2 pr-3 font-normal sm:pr-4">Scenario</th>
            {candidates.map((candidate) => <th key={candidate.candidate_id} scope="col" className="py-2 pr-3 font-normal [overflow-wrap:anywhere] sm:pr-4"><WrapAtUnderscores text={candidate.display_name} /></th>)}
          </tr>
        </thead>
        <tbody>{rows.map((row, index) => {
          const notes = canaryCellCoverageNotes(row, gapsByEpisode);
          const current = index === selectedIndex;
          return <tr key={row.key} onClick={() => openScenario(index)} className={`cursor-pointer border-t border-line ${current ? "bg-inset" : "hover:bg-[var(--bp-paper-50)]"}`}>
            <th scope="row" className="py-2.5 pr-3 font-normal sm:pr-4">
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                className={`text-left underline-offset-4 hover:underline ${current ? "font-medium" : ""}`}
              >{humanCanaryCellLabel(row, index, rows)}</button>
              {notes.length ? <span className="block text-xs text-ink-500">{notes.join(" · ")}</span> : null}
            </th>
            {candidates.map((candidate) => <td key={candidate.candidate_id} className="py-2.5 pr-3 sm:pr-4">
              <OutcomeTag outcome={cellOutcome(row, candidate.candidate_id)} />
            </td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="mt-3 flex max-w-3xl flex-col gap-1 text-sm text-ink-500">
      {plannedCells > rows.length ? <p>{plannedCells - rows.length} of {plannedCells} planned scenarios weren't delivered.</p> : null}
      {plannedGaps.map((gap, index) => <p key={`${gap.family}-${index}`}>
        {String(gap.family || "").replaceAll("_", " ")}: {gap.explanation} Replaced by {String(gap.deterministic_fallback_family || "another scenario").replaceAll("_", " ")}.
      </p>)}
      {coverage.reported === 0
        ? <p>Whether each scenario's variation was actually applied wasn't reported for this run.</p>
        : coverage.reported < coverage.total
          ? <p>Whether each scenario's variation was applied was reported for {coverage.reported} of {coverage.total} episodes.</p>
          : null}
    </div>

    <div ref={viewer} className="mt-8 scroll-mt-6 border-t border-line pt-6">
      <div
        role="group"
        tabIndex={0}
        aria-label="Scenario viewer. Use the left and right arrow keys to change scenarios."
        onKeyDown={navigateWithKeyboard}
        className="flex flex-wrap items-end justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-4"
      >
        <div className="min-w-0">
          <h3 id="canary-cell-title" className="text-xl">{humanCanaryCellLabel(selected, selectedIndex, rows)}</h3>
          <p className="text-sm text-ink-500">
            Scenario {selectedIndex + 1} of {rows.length}
            {selected.seed !== null ? ` · seed ${selected.seed}` : ""}
            {selectedNotes.length ? ` · ${selectedNotes.join(" · ")}` : ""}
          </p>
        </div>
        <div className="flex gap-6">
          <button type="button" className="ws-link" disabled={selectedIndex === 0} onClick={() => select(selectedIndex - 1)}>
            <ChevronLeft size={16} aria-hidden="true" />Previous
          </button>
          <button type="button" className="ws-link" disabled={selectedIndex >= rows.length - 1} onClick={() => select(selectedIndex + 1)}>
            Next<ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {cameras.length > 1 ? <div className="ws-tabs mt-5" role="tablist" aria-label="Camera">
        {cameras.map((name) => <button
          key={name}
          type="button"
          role="tab"
          aria-selected={name === camera}
          tabIndex={name === camera ? 0 : -1}
          onClick={() => setCamera(name)}
        >{cameraLabel(name).replace(/ camera$/, "")}</button>)}
      </div> : <div className="mt-5" />}

      <div className="grid gap-10 md:grid-cols-2 md:gap-8">
        {candidates.map((candidate) => {
          const episode = selected.episodesByCandidate[candidate.candidate_id];
          return <EpisodeCard
            key={`${user?.uid || "anonymous"}:${user?.tenantId || ""}:${result.record_id}:${candidate.candidate_id}:${episode?.episode_id || "missing"}`}
            candidateName={candidate.display_name}
            episode={episode}
            duplicates={selected.duplicateEpisodesByCandidate[candidate.candidate_id] || []}
            camera={camera}
            scoreReceipt={episode ? scoreReceiptByEpisodeId.get(episode.episode_id) : undefined}
            selectedTime={selectedTime}
            user={user}
            recordId={result.record_id}
          />;
        })}
      </div>

      {hasTimeline ? <details className="mt-8">
        <summary>Step-by-step timeline</summary>
        <p className="text-sm text-ink-500">
          Select a row to move both videos to that moment.
          {unsyncedVideos.length ? ` Seeking isn't available for ${unsyncedVideos.join(" and ")}: no video time offset was delivered.` : ""}
        </p>
        {selectedTime !== null ? <p className="mt-1 text-sm tabular-nums">Selected {selectedTime.toFixed(3)}s</p> : null}
        <div className="mt-3"><Timeline episodes={pairedEpisodes} selectedTime={selectedTime} onSelectTime={setSelectedTime} /></div>
      </details> : null}
    </div>
  </section>;
}
