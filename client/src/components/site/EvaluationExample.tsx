import { useEffect, useRef, useState, type RefObject } from "react";

type Episode = { policy: string; file: string; passed: boolean; outcome: string; detail: string };

// Selected research episodes from the current corrected scoring receipts for
// capture-run-c257ae6e11a18e883637739477e5ded8. Retain their source bindings;
// see docs/design/public-evaluation-example/README.md before publication.
const conditions: { id: string; label: string; detail: string; episodes: Episode[] }[] = [
  {
    id: "00", label: "Baseline",
    detail: "The cup starts at the original position. Both policies receive the same task on the same robot and scene.",
    episodes: [
      { policy: "π0.5 DROID", file: "00-pi05", passed: false, outcome: "Missed the target", detail: "The cup moved, but did not finish inside the target at the required height." },
      { policy: "GR00T N1.7 DROID", file: "00-groot", passed: false, outcome: "Missed the target", detail: "The cup moved, but did not reach the target or meet the required travel distance." },
    ],
  },
  {
    id: "02", label: "Cup shifted 2 cm",
    detail: "The cup starts 2 cm from its baseline position. The recorded starting position and seed match for both policies.",
    episodes: [
      { policy: "π0.5 DROID", file: "02-pi05", passed: false, outcome: "Missed the target", detail: "The cup moved about 2.2 cm, short of the required 10 cm, and remained outside the target." },
      { policy: "GR00T N1.7 DROID", file: "02-groot", passed: true, outcome: "Reached and settled", detail: "The cup reached the target, settled on the table, and cleared contact with the robot." },
    ],
  },
  {
    id: "04", label: "Lighting",
    detail: "This pair comes from the run’s lighting-variation condition. The cup starts at the baseline position.",
    episodes: [
      { policy: "π0.5 DROID", file: "04-pi05", passed: false, outcome: "Contact threshold exceeded", detail: "The corrected scorer recorded a contact-force violation, and the cup finished outside the target." },
      { policy: "GR00T N1.7 DROID", file: "04-groot", passed: false, outcome: "Did not settle", detail: "The cup reached the target but did not remain still for the required settling window." },
    ],
  },
];

/**
 * Plays an episode while it is on screen, and pauses it when it scrolls away.
 *
 * The two episodes are meant to be read side by side, so starting them together
 * is what makes the comparison legible — a pair started by hand never lines up.
 * It is tied to visibility rather than page load on purpose: with
 * `preload="none"` a reader who never reaches the section downloads nothing,
 * and each episode is about 4 MB.
 *
 * A reader's own choice always wins. Pausing stops us resuming it, pressing
 * play hands control back, and under `prefers-reduced-motion: reduce` nothing
 * starts on its own — the poster stands until the reader asks for motion.
 */
function useInViewPlayback(video: RefObject<HTMLVideoElement>) {
  useEffect(() => {
    const element = video.current;
    if (!element) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Distinguishes a pause we caused (scrolling away) from the reader's own.
    let pausedByScroll = false;
    let readerPaused = false;

    const onPause = () => {
      if (pausedByScroll) pausedByScroll = false;
      else readerPaused = true;
    };
    const onPlay = () => {
      readerPaused = false;
    };

    const stop = () => {
      if (element.paused) return;
      pausedByScroll = true;
      element.pause();
    };
    const start = () => {
      if (readerPaused || reducedMotion.matches || !element.paused) return;
      // A rejected play() just leaves the poster up — blocked autoplay and a
      // failed media load are both already handled by the controls and the
      // error overlay.
      void element.play().catch(() => {});
    };

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.5 },
    );

    const onReducedMotionChange = () => {
      if (reducedMotion.matches) stop();
    };

    element.addEventListener("pause", onPause);
    element.addEventListener("play", onPlay);
    reducedMotion.addEventListener("change", onReducedMotionChange);
    observer.observe(element);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("play", onPlay);
    };
  }, [video]);
}

function EpisodeVideo({ episode }: { episode: Episode }) {
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useInViewPlayback(video);
  return <figure>
    <figcaption>{episode.policy}<span>Franka / DROID</span></figcaption>
    <div className="ms-eval-video">
      {/* Looped because each episode is a silent 15.8s clip and comparing the
          pair usually takes more than one viewing. `muted` carries no loss —
          these recordings have no audio track — and it is what lets
          useInViewPlayback start them. */}
      <video ref={video} controls loop muted playsInline preload="none" poster={`/proof/cup-evaluation/${episode.file}-poster.webp`} aria-label={`${episode.policy} recorded simulation episode`} onError={() => setFailed(true)} onLoadedData={() => setFailed(false)}>
        <source src={`/proof/cup-evaluation/${episode.file}-external.mp4`} type="video/mp4" />
        Your browser does not support this episode video.
      </video>
      {failed && <div className="ms-eval-video-error" role="alert"><p>This episode could not load.</p><button type="button" onClick={() => { setFailed(false); video.current?.load(); }}>Try loading again</button></div>}
    </div>
    <div className="ms-eval-outcome">
      <p className={episode.passed ? "ms-eval-pass" : "ms-eval-miss"}><span aria-hidden="true">{episode.passed ? "✓" : "—"}</span><span>{episode.passed ? "Met recorded criteria" : "Did not meet criteria"}</span></p>
      <h3>{episode.outcome}</h3><p>{episode.detail}</p>
    </div>
  </figure>;
}

export function EvaluationExample() {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === "#evaluation-example") {
      const frame = requestAnimationFrame(() => section.current?.scrollIntoView());
      return () => cancelAnimationFrame(frame);
    }
  }, []);
  const [selected, setSelected] = useState("02");
  const condition = conditions.find(item => item.id === selected)!;
  return (
    <section ref={section} className="ms-eval-example" id="evaluation-example" aria-labelledby="evaluation-example-title">
      <p className="ms-eyebrow">An evaluation, explained</p>
      <h2 id="evaluation-example-title">Same task. Different policies.</h2>
      <p className="ms-eval-lede">Move the cup to the green spot. Same robot, same scene, different policies—the software that controls the robot.</p>
      <div className="ms-eval-toolbar">
        <span>Recorded simulation · 3 conditions · 6 episodes</span>
        <div className="ms-eval-options" role="group" aria-label="Explore recorded conditions">
          {conditions.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}
        </div>
      </div>
      <div className="ms-eval-pair">
        {condition.episodes.map(episode => <EpisodeVideo key={episode.file} episode={episode} />)}
      </div>
      <div className="ms-eval-explanation" aria-live="polite" aria-atomic="true">
        <div><h3>What changes</h3><p>{condition.detail}</p></div>
        <div><h3>What counts as success</h3><p>Move the cup at least 10 cm, finish within the green target, and leave it settled on the table with robot contact cleared and contact limits respected. Pushing is allowed; lifting is not required.</p></div>
      </div>
      <p className="ms-eval-boundary">Selected episodes from one research run, shown with corrected scoring. Controls were not verified for this run; these outcomes do not establish a policy winner or physical performance.</p>
      <details className="ms-eval-details"><summary>What an evaluation can vary</summary><p>Object position and approach, lighting, camera views, bounded friction or mass changes, and agreed object or material variants. The test plan defines the ranges and repeated attempts. Teams can bring different embodiments, policies, and checkpoints; this example keeps the embodiment fixed.</p></details>
      <details className="ms-eval-details"><summary>What the results tell you</summary><p>Review the episode videos alongside success rate, cycle time, and the conditions where a candidate struggles. Compare results against the site’s targets to decide what deserves a physical pilot—or whether to pause. The physical pilot checks real performance.</p></details>
      <details className="ms-eval-details"><summary>How results stay private</summary><p>The site reviews anonymized candidate results. Robot teams see their own results against the site’s targets, without competitor scores. This research example names the policies; customer identities and access follow the site’s permissions.</p></details>
      <p className="ms-eval-source">Simulation research example · <a href="https://tryblueprint.io/app/results/capture-run-c257ae6e11a18e883637739477e5ded8" target="_blank" rel="noreferrer">View source run ↗</a> · <a href="https://huggingface.co/datasets/spatialverse/InteriorGS" target="_blank" rel="noreferrer">InteriorGS scene</a></p>
    </section>
  );
}
