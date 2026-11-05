import { useState } from "react";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

type Candidate = NonNullable<JobManagedEvidenceSummary["screening"]>["candidates"][number];
type PracticeRun = NonNullable<Candidate["practiceRuns"]>[number];
/** Short-lived, view-only URLs for some of one candidate's videos, by video id. */
export type PracticeRunVideoUrls = (candidateId: string, videoIds: string[]) => Promise<Record<string, string>>;

export const PRACTICE_RUN_OUTCOME_LABEL: Readonly<Record<PracticeRun["outcome"], string>> = {
  success: "Succeeded", failure: "Did not finish the task", void: "Could not be scored",
};
const CAMERA_LABEL: Readonly<Record<string, string>> = {
  overview: "Overview", external: "Side view", wrist: "Wrist camera", exact_policy_input: "What the robot saw", episode: "Run",
};
const CAMERA_ORDER = ["overview", "external", "wrist", "exact_policy_input", "episode"];
const cameraLabel = (camera: string) => CAMERA_LABEL[camera] ?? "Camera view";
const byCamera = (a: { camera: string }, b: { camera: string }) =>
  (CAMERA_ORDER.indexOf(a.camera) + 1 || 99) - (CAMERA_ORDER.indexOf(b.camera) + 1 || 99);

function length(seconds: number | null) {
  if (seconds === null) return null;
  const whole = Math.max(1, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function Videos({ run, videos, urls, onError }: { run: PracticeRun; videos: PracticeRun["videos"];
  urls: Record<string, string>; onError: () => void }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...videos].sort(byCamera).map(video => {
    const url = urls[video.videoId];
    const label = `${cameraLabel(video.camera)}, practice run ${run.number}`;
    return <figure key={`${video.phase}-${video.camera}-${video.videoId}`} className="grid gap-1">
      {url ? <video src={url} controls preload="metadata" playsInline controlsList="nodownload noremoteplayback"
        disablePictureInPicture disableRemotePlayback aria-label={label} onError={onError}
        onContextMenu={event => event.preventDefault()} className="w-full rounded bg-black" />
        : <p>This video is unavailable.</p>}
      <figcaption className="ms-field-hint">{cameraLabel(video.camera)}{length(video.durationSeconds)
        ? ` · ${length(video.durationSeconds)}` : ""}</figcaption>
    </figure>;
  })}</div>;
}

/** One practice run: its outcome, and its videos once the owner opens it (each ticket lasts 15 minutes). */
function PracticeRunItem({ candidateId, run, loadUrls }: { candidateId: string; run: PracticeRun; loadUrls: PracticeRunVideoUrls }) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  async function toggle() {
    if (open) {
      // Closing drops the tickets; opening again asks for fresh ones.
      setOpen(false); setUrls(null); setState("idle");
      return;
    }
    setOpen(true);
    if (!run.videos.length) return;
    setState("loading");
    try {
      setUrls(await loadUrls(candidateId, run.videos.map(video => video.videoId)));
      setState("idle");
    } catch {
      setState("error");
    }
  }
  const played = run.videos.filter(video => video.phase === "run");
  const setup = run.videos.filter(video => video.phase === "setup_check");
  return <li className="grid gap-2">
    <button type="button" className="ws-link text-left" aria-expanded={open} onClick={() => void toggle()}>
      Practice run {run.number} · {PRACTICE_RUN_OUTCOME_LABEL[run.outcome]}
    </button>
    {open && (run.videos.length === 0 ? <p>No video was kept of this practice run.</p>
      : state === "loading" ? <p role="status">Loading the videos…</p>
      : state === "error" || !urls ? <p role="alert">The videos could not be loaded. Close this practice run and open it again to retry.</p>
      : <div className="grid gap-3">
        {played.length > 0 && <Videos run={run} videos={played} urls={urls} onError={() => setState("error")} />}
        {setup.length > 0 && <div className="grid gap-2"><p className="font-medium">Before the robot started</p>
          <Videos run={run} videos={setup} urls={urls} onError={() => setState("error")} /></div>}
      </div>)}
  </li>;
}

/**
 * A candidate's practice runs in the simulation of the site, each with its
 * outcome and the review videos kept of it. Shown only where the job's owner
 * can ask for view tickets; the videos are watched here and never offered as files.
 */
export function ScreeningPracticeRuns({ candidate, loadUrls }: { candidate: Candidate; loadUrls: PracticeRunVideoUrls }) {
  const runs = candidate.practiceRuns ?? [];
  if (!runs.length) return null;
  return <section className="grid gap-2" aria-label={`Practice runs: ${candidate.name}`}>
    <h4 className="font-medium">Practice runs: {candidate.name}</h4>
    <p className="ms-field-hint">Each practice run is one try of your job in the simulation of your site. The videos are renders
      of that simulation, not footage of a real robot. You can watch them here; they can't be downloaded.</p>
    <ul className="grid gap-2">{runs.map(run =>
      <PracticeRunItem key={run.number} candidateId={candidate.candidateId} run={run} loadUrls={loadUrls} />)}</ul>
  </section>;
}
