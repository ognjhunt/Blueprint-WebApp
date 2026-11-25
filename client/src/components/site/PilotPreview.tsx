import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { SITE_RESPONSE_LABELS, companyAliasName, type CompanyResponseState } from "@/lib/companyResponses";
import { EXAMPLE_TAG } from "@/lib/publicCopy";
import { LOOP, scenes, useSceneClock, type Illustration } from "@/components/site/RobotScene";

/**
 * The home page's moving example card, back where it was on 11 Nov (owner, 2026-11-12: "where did the
 * animations/graphics go from before - can we add it back in where we had it?"). The artwork, motion, tabs, pause
 * control and reduced-motion handling are the 11 Nov card's (`9b6e3821b`); only what it says changed. Preserve that
 * artwork and motion when revising copy.
 *
 * Each example is a small version of what a site sees on its job page once deployment companies answer: the job, how
 * many companies opened it, and up to three answers, each an alias and one of the real answer labels
 * (`SITE_RESPONSE_LABELS`), as the site sees them. Every site, job, count and answer is made up and the card says
 * "Example" in words at all times. No company names, product or robot names, prices, percentages or "how sure".
 * Three examples, each leading with an answer a company can give today; no company can give a "Tested it" answer
 * (owner, 2026-11-25), so the card shows none of them (ledger AL02, EL03, 2026-11-23).
 */
type Example = Illustration & { job: string; views: number; answers: CompanyResponseState[] };

const job: Record<string, { job: string; views: number; answers: CompanyResponseState[] }> = {
  Warehouse: { job: "Picking small parcels off a shelf into a tote", views: 6, answers: ["interested", "needs_something", "declined"] },
  "Café": { job: "Moving clean cups from the dish rack onto a tray", views: 4, answers: ["interested", "declined"] },
  // The state before any company answers.
  Lab: { job: "Placing sample tubes into a rack", views: 5, answers: [] },
};

const examples: Example[] = scenes.filter(scene => scene.site in job).map(scene => ({ ...scene, ...job[scene.site] }));
const ALIASES = ["A", "B", "C"];

export function PilotPreview() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState(false);
  // Keyboard focus on the tabs holds the example. Hover does not: a cursor resting on it after a page load would
  // stop rotation indefinitely.
  const [held, setHeld] = useState(false);
  const [inView, setInView] = useState(true);
  const artRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    if (typeof IntersectionObserver === "undefined" || !artRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(artRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (paused || pinned || held || !inView) return;
    const id = window.setTimeout(() => setActive(i => (i + 1) % examples.length), LOOP * 1000);
    return () => window.clearTimeout(id);
  }, [active, paused, pinned, held, inView]);

  const example = examples[active];
  const t = useSceneClock(!paused && inView, example.site);
  const { Art } = example;
  return (
    <section className="bare-example" aria-labelledby="pilot-example-label">
      <div className="bare-example-stage">
        <div className="bare-example-head">
          <p className="bare-example-tag" id="pilot-example-label">{EXAMPLE_TAG}</p>
          <button type="button" className="bare-example-pause" onClick={() => { setPaused(p => !p); setPinned(false); }} aria-label={paused ? "Play examples" : "Pause examples"}>
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        </div>
        <svg ref={artRef} className="bare-example-art" viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example: ${example.embodiment.toLowerCase()}`}>
          <g key={example.site} className="ms-pilot-art-scene">
            <path d="M8 180 H312" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <Art t={t} />
          </g>
        </svg>
      </div>
      <div className="bare-example-content">
        <div role="tablist" aria-label="Example sites" className="bare-example-tabs"
          onFocus={() => setHeld(true)}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false); }}
          onKeyDown={event => {
            const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            const next = event.key === "Home" ? 0 : event.key === "End" ? examples.length - 1 : direction ? (active + direction + examples.length) % examples.length : null;
            if (next === null) return;
            event.preventDefault();
            setActive(next);
            setPinned(true);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}>
          {examples.map((item, i) => (
            <button key={item.site} type="button" role="tab" id={`pilot-tab-${i}`} aria-selected={i === active} aria-controls="pilot-example" tabIndex={i === active ? 0 : -1}
              onClick={() => { setActive(i); setPinned(true); }}>{item.site}</button>
          ))}
        </div>
        <div id="pilot-example" role="tabpanel" aria-labelledby={`pilot-tab-${active}`} key={example.site} className="bare-example-panel" tabIndex={0}>
          <h2 className="bare-example-name">{example.job}</h2>
          <p className="bare-example-by">{example.views} views · {example.answers.length} {example.answers.length === 1 ? "response" : "responses"}</p>
          {example.answers.length > 0
            ? <ul className="bare-example-answers" aria-label="Example responses">
              {example.answers.map((state, i) => (
                <li key={ALIASES[i]}>
                  <span>{companyAliasName(ALIASES[i])}</span>
                  <span className="bare-example-status" data-state={state}>{SITE_RESPONSE_LABELS[state]}</span>
                </li>
              ))}
            </ul>
            : <p className="bare-example-by">No responses yet.</p>}
        </div>
      </div>
    </section>
  );
}
