import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * What a site receives: one recommended pilot, from a team whose simulated
 * evaluation on the job passed, shown for a few kinds of site. Examples, not
 * bookings or results. Each illustration is a slow loop of the robot doing the task.
 *
 * Every example is a kind of job the simulation can score today: picking up a
 * rigid object and placing it, and opening a drawer
 * (`server/utils/siteTaskScope.ts`). Robot form is separate from task scope:
 * broader embodiments illustrate the same bounded actions at one station,
 * without implying navigation, towel folding or machine tending is scored.
 */

type P = [number, number];
type Scene = (props: { t: number }) => JSX.Element;
type Example = { site: string; embodiment: string; tests: string; provide: string; teamProvides: string; when: string; uncertain: string; Art: Scene };

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
const lower = (a: P, b: P) => (a[1] > b[1] ? a : b);

const line = (...pts: P[]) => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}`;

function Wheel({ c, r }: { c: P; r: number }) {
  return <g {...ink}><circle cx={c[0]} cy={c[1]} r={r} fill={paper} /><path d={`M${c[0] - r + 2} ${c[1]} H${c[0] + r - 2}`} strokeWidth={1.5} /></g>;
}

/** A standing humanoid reaches between two trays; its feet stay planted. */
function Humanoid({ x, hand }: { x: number; hand: P }) {
  const arm = (shoulder: P, h: P) => line(shoulder, joint(shoulder, h, 36, 37, lower), h);
  return (
    <g {...ink}>
      <path d={line([x - 5, 129], [x - 12, 153], [x - 14, 178])} strokeWidth={6} />
      <path d={line([x + 5, 129], [x + 10, 153], [x + 14, 178])} strokeWidth={6} />
      <path d={`M${x - 19} 180 H${x - 8} M${x + 9} 180 H${x + 22}`} strokeWidth={4} />
      <path d={arm([x - 6, 85], [hand[0] - 4, hand[1] - 2])} strokeWidth={5} />
      <rect x={x - 9} y={120} width={18} height={13} rx={4} fill={tint} />
      <rect x={x - 13} y={79} width={26} height={44} rx={9} fill={tint} />
      <path d={`M${x} 71 V79 M${x - 6} 95 H${x + 6}`} />
      <ellipse cx={x} cy={58} rx={11} ry={13} fill={tint} />
      <ellipse cx={x + 4} cy={58} rx={6} ry={8} fill="currentColor" />
      <path d={arm([x + 7, 85], hand)} strokeWidth={5} />
      <path d={`M${hand[0] - 7} ${hand[1]} h14 M${hand[0] - 7} ${hand[1]} v12 M${hand[0] + 7} ${hand[1]} v12`} />
    </g>
  );
}

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

/** Humanoid lifts a small boxed part off the scale and places it in the outbound tray. */
function Warehouse({ t }: { t: number }) {
  const hand = trackP(t, [[0, [130, 80]], [1.0, [130, 80]], [1.7, [125, 110]], [2.2, [125, 110]], [3.0, [125, 86]],
    [4.6, [240, 86]], [5.2, [240, 110]], [5.6, [240, 110]], [6.1, [240, 94]], [7.6, [130, 80]]]);
  const holding = t >= 2.0 && t < 5.4;
  // On the scale, carried in the gripper, then in the tray.
  const box: P = t < 2.0 ? [125, 128] : holding ? [hand[0], hand[1] + 18] : [240, 128];
  return (
    <g>
      <g {...ink}>
        <path d="M20 140 H148 M28 140 V180 M140 140 V180 M206 140 H300 M212 140 V180 M294 140 V180" />
        {/* Scale: the plate on the bench and its readout. */}
        <path d="M104 140 V137 H148 V140" />
        <rect x={114} y={146} width={24} height={10} rx={2} fill={tint} />
        {/* Outbound tray: the marked target area. */}
        <path d="M206 140 V128 M274 140 V128" />
        <rect x={206} y={137} width={68} height={3} fill={tint} />
      </g>
      <Carton c={box} opacity={1 - fade(t, 8.6, 9.4)} />
      {t >= 9.0 && <Carton c={[125, 128]} opacity={fade(t, 9.0, 10)} />}
      <Humanoid x={175} hand={hand} />
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

/** The wheeled humanoid works at a cabinet beside the washers; the base stays still. */
function WheeledHumanoid({ x, hand }: { x: number; hand: P }) {
  const arm = (shoulder: P, h: P) => line(shoulder, joint(shoulder, h, 26, 28, lower), h);
  return (
    <g {...ink}>
      <path d={arm([x + 4, 88], [x + 30, 126])} strokeWidth={5} />
      <rect x={x - 22} y={158} width={44} height={14} rx={4} fill={tint} />
      <Wheel c={[x - 13, 174]} r={6} /><Wheel c={[x + 13, 174]} r={6} />
      <rect x={x - 5} y={126} width={10} height={32} fill={paper} />
      <rect x={x - 16} y={80} width={32} height={46} rx={8} fill={tint} />
      <path d={`M${x - 8} 96 H${x + 8}`} />
      <rect x={x - 11} y={54} width={22} height={24} rx={9} fill={tint} />
      <rect x={x - 6} y={61} width={14} height={6} rx={3} fill="currentColor" />
      <path d={arm([x + 10, 88], hand)} strokeWidth={5} />
    </g>
  );
}

function Washer({ x }: { x: number }) {
  return (
    <g {...ink}>
      <rect x={x} y={70} width={68} height={110} rx={4} />
      <path d={`M${x} 92 H${x + 68}`} />
      <circle cx={x + 34} cy={136} r={23} />
      <circle cx={x + 34} cy={136} r={14} fill={tint} />
      <circle cx={x + 56} cy={81} r={2} fill="currentColor" />
    </g>
  );
}

/** Opens a rigid supply drawer, with no textile handling or driving. */
function Laundromat({ t }: { t: number }) {
  const travel = track(t, [[0, 0], [2.4, 0], [4.8, 40]]);
  const grip = 248 - travel;
  const hand = t < 2.4
    ? trackP(t, [[0, [230, 101]], [1, [230, 101]], [2.4, [248, 117]]])
    : t < 6.6 ? [grip, 117] as P : trackP(t, [[6.6, [grip, 117]], [7, [grip, 101]], [8.2, [230, 101]]]);
  return (
    <g>
      <Washer x={18} /><Washer x={92} />
      <g {...ink}>
        <rect x={258} y={60} width={52} height={120} />
        <path d="M258 100 H310 M258 142 H310 M268 82 H286 M268 160 H286" />
      </g>
      <g transform="translate(82 0)">
        <Drawer travel={travel} opacity={1 - fade(t, 9, 9.8)} />
        {t >= 9 && <Drawer travel={0} opacity={fade(t, 9, 9.8)} />}
      </g>
      <WheeledHumanoid x={200} hand={hand} />
    </g>
  );
}

/** A mobile base parked at the task station, with an optional service-robot screen. */
function MobileManipulator({ x, hand, open, service = false }: { x: number; hand: P; open: boolean; service?: boolean }) {
  return (
    <g>
      <g {...ink}>
        <rect x={x - 24} y={156} width={48} height={18} rx={service ? 7 : 4} fill={tint} />
        {service ? <>
          <rect x={x - 4} y={106} width={8} height={50} fill={tint} />
          <rect x={x - 14} y={86} width={28} height={20} rx={5} fill={tint} />
          <circle cx={x - 6} cy={96} r={2} fill="currentColor" /><circle cx={x + 3} cy={96} r={2} fill="currentColor" />
        </> : <>
          <rect x={x - 22} y={150} width={8} height={6} rx={1} />
          <rect x={x - 15} y={147} width={30} height={9} rx={2} fill={tint} />
        </>}
      </g>
      <Wheel c={[x - 15, 176]} r={4} /><Wheel c={[x + 15, 176]} r={4} />
      <RobotArm shoulder={[x, service ? 112 : 147]} hand={hand} l1={service ? 42 : 56} l2={service ? 42 : 56} open={open} />
    </g>
  );
}

/** Mobile manipulator moves a rigid blank between a stopped conveyor and a nearby tray. */
function Factory({ t }: { t: number }) {
  const hand = trackP(t, [[0, [245, 100]], [1, [245, 100]], [1.7, [245, 110]], [2.2, [245, 110]],
    [3, [245, 84]], [4.6, [78, 84]], [5.2, [78, 110]], [5.6, [78, 110]], [6.1, [78, 94]], [7.6, [245, 100]]]);
  const holding = t >= 2 && t < 5.4;
  const blank: P = t < 2 ? [245, 128] : holding ? [hand[0], hand[1] + 18] : [78, 128];
  const part = (c: P, opacity = 1) => <rect x={c[0] - 10} y={c[1] - 12} width={20} height={24} rx={2} {...ink} fill={tint} opacity={opacity} />;
  return (
    <g>
      <g {...ink}>
        <rect x={20} y={44} width={104} height={80} rx={3} />
        <rect x={32} y={58} width={62} height={52} fill={tint} />
        <path d="M104 62 V94 M30 140 H120 M38 140 V180 M112 140 V180 M48 140 V128 M108 140 V128" />
        <rect x={214} y={140} width={90} height={12} />
        <path d="M220 152 V180 M298 152 V180" />
      </g>
      {[222, 244, 266, 288].map(x => <Wheel key={x} c={[x, 146]} r={4} />)}
      {part(blank, 1 - fade(t, 8.6, 9.4))}
      {t >= 9 && part([245, 128], fade(t, 9, 10))}
      <MobileManipulator x={165} hand={hand} open={!holding} />
    </g>
  );
}

/** A service robot stocks boxed amenities at one station beside the hotel elevator. */
function Hotel({ t }: { t: number }) {
  const hand = trackP(t, [[0, [152, 100]], [1, [152, 100]], [1.7, [152, 110]], [2.2, [152, 110]],
    [3, [152, 84]], [4.6, [282, 84]], [5.2, [282, 110]], [5.6, [282, 110]], [6.1, [282, 94]], [7.6, [152, 100]]]);
  const holding = t >= 2 && t < 5.4;
  const box: P = t < 2 ? [152, 128] : holding ? [hand[0], hand[1] + 18] : [282, 128];
  return (
    <g>
      <g {...ink}>
        <rect x={14} y={36} width={88} height={144} />
        <rect x={14} y={36} width={88} height={20} fill={tint} />
        <rect x={22} y={56} width={72} height={124} fill="#c9d4ca" />
        <path d="M58 56 V180 M48 50 l4 -8 l4 8 z M62 42 l4 8 l4 -8 z" />
        <rect x={107} y={98} width={8} height={20} rx={2} fill={paper} />
        <path d="M118 140 H186 M124 140 V180 M180 140 V180 M130 140 V128 M174 140 V128 M252 140 H308 M258 140 V180 M302 140 V180 M260 140 V128 M304 140 V128" />
      </g>
      <Carton c={box} opacity={1 - fade(t, 8.6, 9.4)} />
      {t >= 9 && <Carton c={[152, 128]} opacity={fade(t, 9, 10)} />}
      <MobileManipulator x={218} hand={hand} open={!holding} service />
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
  { site: "Warehouse", embodiment: "Humanoid robot", tests: "Moving small boxed parts from the scale to the outbound tray", provide: "A two-hour window and one packing bench", teamProvides: "Humanoid robot, setup and operation", when: "Two weeks, on dates you approve", uncertain: "Boxes packed tightly together may need separating first", Art: Warehouse },
  { site: "Café", embodiment: "Fixed robot arm", tests: "Moving clean cups from the dish rack to the counter", provide: "An after-close window and bench space by the dish station", teamProvides: "Fixed robot arm, setup and operation", when: "One week of evenings", uncertain: "Cups of very different sizes may need a second grip", Art: Cafe },
  { site: "Laundromat", embodiment: "Wheeled humanoid", tests: "Opening the supply drawer before each shift", provide: "Access to one supply cabinet before the morning shift", teamProvides: "Wheeled humanoid, setup and operation", when: "One week, mornings only", uncertain: "A sticking drawer may need a firmer pull", Art: Laundromat },
  { site: "Factory", embodiment: "Mobile manipulator", tests: "Moving rigid blanks from the conveyor to the nearby tray", provide: "One stopped conveyor and its adjacent tray for a shift", teamProvides: "Mobile manipulator, setup and operation", when: "Two weeks, on one shift", uncertain: "Parts that arrive in mixed orientations may need separating first", Art: Factory },
  { site: "Hotel", embodiment: "Mobile robot with arm", tests: "Moving boxed amenities from the stock tray to the service tray", provide: "One amenities station during quiet hours", teamProvides: "Mobile robot with arm, setup and operation", when: "Two weeks, overnight", uncertain: "Boxes packed tightly together may need separating first", Art: Hotel },
  { site: "Lab", embodiment: "Fixed robot arm", tests: "Opening the sample drawer before each batch", provide: "One bench and a quiet hour before the first batch", teamProvides: "Fixed robot arm, setup and operation", when: "One week, mornings only", uncertain: "A sticking drawer may need a firmer pull", Art: Lab },
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
        <svg ref={artRef} className="ms-pilot-art" viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example: ${example.embodiment.toLowerCase()}`}>
          <g key={example.site} className="ms-pilot-art-scene">
            <path d="M8 180 H312" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <Art t={t} />
          </g>
        </svg>
        <p className="ms-pilot-art-caption">{example.embodiment}</p>
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
      <svg ref={artRef} viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example: ${example.embodiment.toLowerCase()}`}>
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
