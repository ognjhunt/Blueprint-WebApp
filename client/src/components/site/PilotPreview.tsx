import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { COMPANY_RESPONSE_LABELS, companyAliasName, type CompanyResponseState } from "@/lib/companyResponses";
import { EXAMPLE_CARD_NAME, EXAMPLE_FOOT, EXAMPLE_NO_ANSWERS, EXAMPLE_TAG, exampleSentTo } from "@/lib/publicCopy";
import { LOOP, scenes, useSceneClock, type Illustration } from "@/components/site/RobotScene";

/**
 * The home page's moving example card, back where it was on 11 Nov (owner, 2026-11-12: "where did the
 * animations/graphics go from before - can we add it back in where we had it?"). The artwork, motion, tabs, pause
 * control and reduced-motion handling are the 11 Nov card's (`9b6e3821b`); only what it says changed. Preserve that
 * artwork and motion when revising copy.
 *
 * Each example is a small version of what a site sees on its job page once deployment companies answer: the job, how
 * many companies it went to, and up to three answers, each an alias and one of the real answer labels
 * (`COMPANY_RESPONSE_LABELS`), as the site sees them. Every site, job, count and answer is made up and the card says
 * "Example" in words at all times. No company names, product or robot names, prices, percentages or "how sure".
 */
type Example = Illustration & { job: string; sent: number; answers: CompanyResponseState[] };

const job: Record<string, { job: string; sent: number; answers: CompanyResponseState[] }> = {
  Warehouse: { job: "Picking small parcels off a shelf into a tote", sent: 6, answers: ["tested_can_do", "needs_something", "declined"] },
  "Café": { job: "Moving clean cups from the dish rack onto a tray", sent: 4, answers: ["interested", "declined"] },
  Laundromat: { job: "Stacking folded towels onto a shelf", sent: 3, answers: ["needs_something"] },
  Factory: { job: "Placing small parts from a conveyor into a fixture", sent: 8, answers: ["tested_can_do", "interested", "declined"] },
  Hotel: { job: "Placing folded napkins onto a tray", sent: 7, answers: ["interested", "needs_something"] },
  // The state before any company answers.
  Lab: { job: "Placing sample tubes into a rack", sent: 5, answers: [] },
};

const examples: Example[] = scenes.map(scene => ({ ...scene, ...job[scene.site] }));
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
    <section className="bare-example" aria-label={EXAMPLE_CARD_NAME}>
      <svg ref={artRef} className="bare-example-art" viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example: ${example.embodiment.toLowerCase()}`}>
        <g key={example.site} className="ms-pilot-art-scene">
          <path d="M8 180 H312" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <Art t={t} />
        </g>
      </svg>
      <div className="bare-example-head">
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
        <button type="button" className="bare-example-pause" onClick={() => { setPaused(p => !p); setPinned(false); }} aria-label={paused ? "Play examples" : "Pause examples"}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
      <div id="pilot-example" role="tabpanel" aria-labelledby={`pilot-tab-${active}`} key={example.site} className="bare-example-panel">
        <p className="bare-example-tag">{EXAMPLE_TAG}</p>
        <p className="bare-example-job">{example.site}: {example.job}</p>
        <p className="bare-example-name">{exampleSentTo(example.sent)}</p>
        {example.answers.length > 0
          ? <ul className="bare-example-answers" aria-label="Example answers">
            {example.answers.map((state, i) => (
              <li key={ALIASES[i]}>{companyAliasName(ALIASES[i])} · {COMPANY_RESPONSE_LABELS[state]}</li>
            ))}
          </ul>
          : <p className="bare-example-by">{EXAMPLE_NO_ANSWERS}</p>}
      </div>
      <p className="bare-example-foot">{EXAMPLE_FOOT}</p>
    </section>
  );
}
