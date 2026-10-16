import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * What a site receives: one recommended pilot, from a team whose simulated
 * evaluation on the job passed, shown for a few kinds of site. Examples, not
 * bookings or results. Each illustration is a slow loop of the robot doing the task.
 *
 * Every example is a kind of job the simulation can score today: picking up a
 * rigid object and placing it, and opening a drawer
 * (`server/utils/siteTaskScope.ts`). An example of a job we cannot score would
 * promise an evaluation no site could get.
 */

type P = [number, number];
type Scene = (props: { t: number }) => JSX.Element;
type Example = { site: string; tests: string; provide: string; teamProvides: string; when: string; uncertain: string; Art: Scene };

const LOOP = 10; // seconds per task loop; one rotation shows one full loop
const STILL = 4.5; // the frame shown before motion starts, when paused, and under reduced motion

const ink = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const tint = "#dfe6de";
const paper = "#f6f5ef";

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (v: number) => { const c = clamp(v); return c * c * (3 - 2 * c); };
const fade = (t: number, from: number, to: number) => ease((t - from) / (to - from));

/** Eased value along keyframes [[time, value], ...]. */
function track(t: number, keys: [number, number][], linear = false): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) { const u = (t - t0) / (t1 - t0 || 1); return v0 + (v1 - v0) * (linear ? clamp(u) : ease(u)); }
  }
  return keys[keys.length - 1][1];
}
function trackP(t: number, keys: [number, P][]): P {
  return [track(t, keys.map(([k, p]) => [k, p[0]])), track(t, keys.map(([k, p]) => [k, p[1]]))];
}

/** The two possible middle joints of a two-link limb from s to h; pick picks one. */
function joint(s: P, h: P, l1: number, l2: number, pick: (a: P, b: P) => P): P {
  const dx = h[0] - s[0], dy = h[1] - s[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const at = (ang: number): P => [s[0] + l1 * Math.cos(ang), s[1] + l1 * Math.sin(ang)];
  return pick(at(a - off), at(a + off));
}
const higher = (a: P, b: P) => (a[1] < b[1] ? a : b);

const line = (...pts: P[]) => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}`;

/** An industrial arm: shoulder, elbow kept high, wrist and a two-finger gripper pointing down. */
function RobotArm({ shoulder, hand, l1, l2, open }: { shoulder: P; hand: P; l1: number; l2: number; open: boolean }) {
  const elbow = joint(shoulder, hand, l1, l2, higher);
  const g = open ? 9 : 6;
  return (
    <g {...ink}>
      <path d={line(shoulder, elbow, hand)} strokeWidth={5} />
      <circle cx={shoulder[0]} cy={shoulder[1]} r={5} fill={paper} />
      <circle cx={elbow[0]} cy={elbow[1]} r={5} fill={paper} />
      <path d={`M${hand[0] - g} ${hand[1]} H${hand[0] + g} M${hand[0] - g} ${hand[1]} v12 M${hand[0] + g} ${hand[1]} v12`} />
    </g>
  );
}

function Carton({ c, opacity = 1 }: { c: P; opacity?: number }) {
  return (
    <g {...ink} opacity={opacity}>
      <rect x={c[0] - 14} y={c[1] - 12} width={28} height={24} fill={tint} />
      <path d={`M${c[0] - 14} ${c[1] - 5} H${c[0] + 14}`} strokeWidth={1.5} />
    </g>
  );
}

/** Fixed arm lifts a small boxed part off the scale and places it in the outbound tray. */
function Warehouse({ t }: { t: number }) {
  const shoulder: P = [175, 131];
  const hand = trackP(t, [[0, [130, 80]], [1.0, [130, 80]], [1.7, [125, 110]], [2.2, [125, 110]], [3.0, [125, 86]],
    [4.6, [240, 86]], [5.2, [240, 110]], [5.6, [240, 110]], [6.1, [240, 94]], [7.6, [130, 80]]]);
  const holding = t >= 2.0 && t < 5.4;
  // On the scale, carried in the gripper, then in the tray.
  const box: P = t < 2.0 ? [125, 128] : holding ? [hand[0], hand[1] + 18] : [240, 128];
  return (
    <g>
      <g {...ink}>
        <rect x={20} y={140} width={280} height={40} />
        {/* Scale: the plate on the bench and its readout. */}
        <path d="M104 140 V137 H148 V140" />
        <rect x={114} y={146} width={24} height={10} rx={2} fill={tint} />
        {/* Outbound tray: the marked target area. */}
        <path d="M206 140 V128 M274 140 V128" />
        <rect x={206} y={137} width={68} height={3} fill={tint} />
        <rect x={160} y={131} width={30} height={9} rx={2} fill={tint} />
      </g>
      <Carton c={box} opacity={1 - fade(t, 8.6, 9.4)} />
      {t >= 9.0 && <Carton c={[125, 128]} opacity={fade(t, 9.0, 10)} />}
      <RobotArm shoulder={shoulder} hand={hand} l1={56} l2={56} open={!holding} />
    </g>
  );
}

function Cup({ c, opacity = 1 }: { c: P; opacity?: number }) {
  return <path d={`M${c[0] - 8} ${c[1] - 5} h16 l-2 10 h-12 z`} {...ink} fill={tint} opacity={opacity} />;
}

/** Fixed arm moves clean cups one by one from the dish rack to the counter. */
function Cafe({ t }: { t: number }) {
  const rackX = [216, 236, 256, 276];
  const counterX = [160, 146, 132, 118];
  const start = (i: number) => 0.2 + i * 2.35;
  const shoulder: P = [184, 131];
  let hand: P = [216, 96];
  let open = true;
  for (let i = 0; i < 4; i++) {
    const u = t - start(i);
    if (u < 0 || u > 2.35) continue;
    const next: P = i < 3 ? [rackX[i + 1], 96] : [216, 96];
    hand = trackP(u, [[0, [rackX[i], 96]], [0.35, [rackX[i], 111]], [0.7, [rackX[i], 94]], [1.4, [counterX[i], 100]], [1.8, [counterX[i], 123]], [2.05, [counterX[i], 105]], [2.35, next]]);
    open = u < 0.35 || u > 1.8;
  }
  const reset = fade(t, 9.6, 10);
  return (
    <g>
      <g {...ink}>
        <rect x={20} y={140} width={280} height={40} />
        <rect x={34} y={74} width={74} height={66} rx={4} />
        <path d="M50 74 V64 H92 V74 M60 104 h22 M71 104 v10" />
        <rect x={204} y={128} width={84} height={12} />
        {[210, 230, 250, 270, 286].map(rx => <path key={rx} d={`M${rx} 128 V118`} />)}
        <rect x={169} y={131} width={30} height={9} rx={2} fill={tint} />
      </g>
      {rackX.map((cx, i) => {
        const u = t - start(i);
        if (t >= 9.6) return <g key={cx}><Cup c={[cx, 123]} opacity={reset} /><Cup c={[counterX[i], 135]} opacity={1 - reset} /></g>;
        if (u < 0.35) return <Cup key={cx} c={[cx, 123]} />;
        if (u < 1.8) return <Cup key={cx} c={[hand[0], hand[1] + 12]} />;
        return <Cup key={cx} c={[counterX[i], 135]} />;
      })}
      <RobotArm shoulder={shoulder} hand={hand} l1={48} l2={50} open={open} />
    </g>
  );
}

/** One drawer of the sample cabinet, pulled out by `travel`. */
function Drawer({ travel, opacity = 1 }: { travel: number; opacity?: number }) {
  const front = 176 - travel;
  return (
    <g {...ink} opacity={opacity}>
      {travel > 0 && <rect x={front} y={106} width={travel} height={32} fill={tint} />}
      <rect x={front - 4} y={104} width={4} height={36} fill={paper} />
      <path d={`M${front - 4} 117 H${front - 10} V127 H${front - 4}`} />
    </g>
  );
}

/** Fixed arm pulls the sample drawer open and holds it while the batch starts. */
function Lab({ t }: { t: number }) {
  const shoulder: P = [70, 122];
  const travel = track(t, [[0, 0], [2.4, 0], [4.8, 56]]);
  const grip = 176 - travel - 10;
  let hand: P;
  if (t < 2.4) hand = trackP(t, [[0, [104, 92]], [1.0, [104, 92]], [1.9, [166, 102]], [2.4, [166, 112]]]);
  else if (t < 6.6) hand = [grip, 112];
  else hand = trackP(t, [[6.6, [grip, 112]], [7.0, [grip, 98]], [8.2, [104, 92]]]);
  const holding = t >= 2.4 && t < 6.6;
  return (
    <g>
      <g {...ink}>
        <rect x={176} y={60} width={114} height={120} />
        {[[66, 100], [144, 176]].map(([top, bottom]) => (
          <g key={top}>
            <rect x={172} y={top} width={4} height={bottom - top} fill={paper} />
            <path d={`M172 ${(top + bottom) / 2 - 5} H166 V${(top + bottom) / 2 + 5} H172`} />
          </g>
        ))}
        <rect x={52} y={128} width={36} height={52} />
        <rect x={58} y={122} width={24} height={6} rx={2} fill={tint} />
      </g>
      <Drawer travel={travel} opacity={1 - fade(t, 9.0, 9.8)} />
      {t >= 9.0 && <Drawer travel={0} opacity={fade(t, 9.0, 9.8)} />}
      <RobotArm shoulder={shoulder} hand={hand} l1={56} l2={56} open={!holding} />
    </g>
  );
}

const examples: Example[] = [
  { site: "Warehouse", tests: "Moving small boxed parts from the scale to the outbound tray", provide: "A two-hour window and one packing bench", teamProvides: "Fixed robot arm, setup and operation", when: "Two weeks, on dates you approve", uncertain: "Boxes packed tightly together may need separating first", Art: Warehouse },
  { site: "Café", tests: "Moving clean cups from the dish rack to the counter", provide: "An after-close window and bench space by the dish station", teamProvides: "Fixed robot arm, setup and operation", when: "One week of evenings", uncertain: "Cups of very different sizes may need a second grip", Art: Cafe },
  { site: "Lab", tests: "Opening the sample drawer before each batch", provide: "One bench and a quiet hour before the first batch", teamProvides: "Fixed robot arm, setup and operation", when: "One week, mornings only", uncertain: "A sticking drawer may need a firmer pull", Art: Lab },
];

/** Seconds into the current loop. Starts at the still frame; restarts at 0 when the scene changes. */
function useSceneClock(running: boolean, scene: string) {
  const [t, setT] = useState(STILL);
  const tRef = useRef(STILL);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    tRef.current = running ? 0 : STILL;
    setT(tRef.current);
    // Only a scene change resets the clock; pausing keeps the current frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now(), since = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current = (tRef.current + dt) % LOOP;
      since += dt;
      if (since >= 1 / 30) { since = 0; setT(tRef.current); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return t;
}

export function PilotPreview() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(true);
  const artRef = useRef<SVGSVGElement>(null);
  const held = hovered || focused;

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
    <section className="ms-pilot-preview" aria-labelledby="pilot-preview-title"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
      <div className="ms-pilot-preview-intro">
        <p className="ms-eyebrow">What you get</p>
        <h2 id="pilot-preview-title">One recommended pilot, on one page.</h2>
        <p>The robot team whose evaluation on your task passed, what the pilot tests and when. You book it with one click.</p>
        <svg ref={artRef} className="ms-pilot-art" viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example`}>
          <g key={example.site} className="ms-pilot-art-scene">
            <path d="M8 180 H312" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <Art t={t} />
          </g>
        </svg>
      </div>
      <div className="ms-pilot-card">
        <div className="ms-pilot-tabs">
          <div role="tablist" aria-label="Example sites">
            {examples.map((item, i) => (
              <button key={item.site} type="button" role="tab" id={`pilot-tab-${i}`} aria-selected={i === active} aria-controls="pilot-example"
                onClick={() => { setActive(i); setPinned(true); }}>{item.site}</button>
            ))}
          </div>
          <button type="button" className="ms-pilot-pause" onClick={() => { setPaused(p => !p); setPinned(false); }} aria-label={paused ? "Play examples" : "Pause examples"}>
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        </div>
        <div id="pilot-example" role="tabpanel" aria-labelledby={`pilot-tab-${active}`} key={example.site} className="ms-pilot-panel">
          <div className="ms-pilot-card-head">
            <span>Your recommended pilot</span>
            <span className="ms-pilot-card-tag">Example</span>
          </div>
          <dl>
            <div><dt>Robot team</dt><dd>Example Robotics</dd></div>
            <div><dt>Evaluated in simulation</dt><dd>Passed on your task (example)</dd></div>
            <div><dt>What the pilot tests</dt><dd>{example.tests}</dd></div>
            <div><dt>What you provide</dt><dd>{example.provide}</dd></div>
            <div><dt>What the team provides</dt><dd>{example.teamProvides}</dd></div>
            <div><dt>Blueprint fee</dt><dd>None during the beta</dd></div>
            <div><dt>Pilot cost</dt><dd>Quoted by the robot team, paid to them</dd></div>
            <div><dt>When</dt><dd>{example.when}</dd></div>
            <div><dt>Still uncertain</dt><dd>{example.uncertain}</dd></div>
          </dl>
        </div>
        <div className="ms-pilot-card-foot">
          <span className="ms-button" aria-hidden="true">Book this pilot</span>
          <span>Dates and pilot terms are agreed with the team. A simulated pass is an estimate, not proof of on-site performance.</span>
        </div>
      </div>
    </section>
  );
}

/**
 * The home pilot examples on their own, for pages that carry the robot without the pilot card.
 * Each example plays one loop, then the next one starts. It holds the first still frame under
 * reduced motion, pauses while scrolled out of view, and has a pause control, since it keeps
 * moving beside forms.
 */
export function RobotScene() {
  const artRef = useRef<SVGSVGElement>(null);
  const [inView, setInView] = useState(true);
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(0);
  const [reducedMotion] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  // Seconds left in the current example's loop. The first loop starts at the still frame.
  const remaining = useRef(LOOP - STILL);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !artRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(artRef.current);
    return () => observer.disconnect();
  }, []);

  const running = !reducedMotion && !paused && inView;
  const example = examples[active];
  const t = useSceneClock(running, example.site);

  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let finished = false;
    const id = window.setTimeout(() => {
      finished = true;
      remaining.current = LOOP;
      setActive(i => (i + 1) % examples.length);
    }, remaining.current * 1000);
    return () => {
      window.clearTimeout(id);
      // Paused or scrolled away mid-loop: keep the rest of the loop for when it resumes.
      if (!finished) remaining.current = Math.max(0, remaining.current - (performance.now() - started) / 1000);
    };
  }, [active, running]);

  const { Art } = example;
  return (
    <div className="robot-scene">
      <svg ref={artRef} viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example`}>
        <path d="M8 180 H312" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        <g key={example.site} className="ms-pilot-art-scene">
          <Art t={t} />
        </g>
      </svg>
      {reducedMotion ? null : (
        <button type="button" className="ms-pilot-pause robot-scene-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? "Play robot animation" : "Pause robot animation"}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
