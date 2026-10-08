import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

/**
 * What a site receives: one recommended pilot, shown for a few kinds of site.
 * Examples, not bookings. Each illustration is a slow loop of the robot doing the task.
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
const lower = (a: P, b: P) => (a[1] > b[1] ? a : b);
const toward = (dir: number) => (a: P, b: P) => (a[0] * dir > b[0] * dir ? a : b);

const line = (...pts: P[]) => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}`;

function Wheel({ c, r, turn }: { c: P; r: number; turn: number }) {
  return (
    <g {...ink}>
      <circle cx={c[0]} cy={c[1]} r={r} fill={paper} />
      <path d={line([c[0] - Math.cos(turn) * (r - 2), c[1] - Math.sin(turn) * (r - 2)], [c[0] + Math.cos(turn) * (r - 2), c[1] + Math.sin(turn) * (r - 2)])} strokeWidth={1.5} />
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

/** A bipedal humanoid. s runs from -1 (facing left) to 1 (facing right); hands are world points. */
function Humanoid({ x, s, hand, phase, walking, held }: { x: number; s: number; hand: P; phase: number; walking: boolean; held?: ReactNode }) {
  const dir = s >= 0 ? 1 : -1;
  const bob = walking ? -Math.abs(Math.sin(phase)) * 1.5 : 0;
  const hip: P = [x, 130 + bob];
  const stride = walking ? 7 * Math.sin(phase) : 5;
  const lift = (v: number) => (walking ? Math.max(0, v) * 3 : 0);
  const feet: P[] = [[x + stride, 178 - lift(Math.cos(phase))], [x - stride, 178 - lift(-Math.cos(phase))]];
  const knees = feet.map(f => joint(hip, f, 25, 24, toward(dir)));
  const front: P = [x + 4 * s, 84 + bob], back: P = [x - 3 * s, 84 + bob];
  const backHand: P = [hand[0] - 3 * s, hand[1] - 2];
  const arm = (sh: P, h: P) => line(sh, joint(sh, h, 20, 22, lower), h);
  const half = 10 * (0.6 + 0.4 * Math.abs(s));
  return (
    <g {...ink}>
      {feet.map((f, i) => (
        <g key={i}>
          <path d={line(hip, knees[i], f)} strokeWidth={6} />
          <path d={`M${f[0] - 5 + 2 * dir} ${f[1] + 2} H${f[0] + 5 + 2 * dir}`} strokeWidth={4} />
        </g>
      ))}
      <path d={arm(back, backHand)} strokeWidth={5} />
      <rect x={x - 8} y={119 + bob} width={16} height={12} rx={4} fill={tint} />
      <path d={`M${x - half} ${79 + bob} Q${x - half - 2} ${104 + bob} ${x - half * 0.7} ${121 + bob} H${x + half * 0.7} Q${x + half + 2} ${104 + bob} ${x + half} ${79 + bob} Z`} fill={tint} />
      <path d={`M${x} ${71 + bob} V78`} />
      <ellipse cx={x} cy={58 + bob} rx={11} ry={13} fill={tint} />
      <ellipse cx={x + 4 * s} cy={58 + bob} rx={2 + 4 * Math.abs(s)} ry={8} fill="currentColor" />
      {held}
      <path d={arm(front, hand)} strokeWidth={5} />
    </g>
  );
}

function Tote({ c, opacity = 1 }: { c: P; opacity?: number }) {
  return <rect x={c[0] - 16} y={c[1] - 9} width={32} height={18} {...ink} fill={tint} opacity={opacity} />;
}

/** Humanoid lifts a tote off the shelf, turns, walks it to the cart and sets it down. */
function Warehouse({ t }: { t: number }) {
  const x = track(t, [[0, 150], [2.6, 150], [5.4, 198], [7.6, 198], [9.6, 150]]);
  const s = track(t, [[0, -1], [2.0, -1], [2.6, 1], [7.4, 1], [8.0, -1]]);
  const walking = (t > 2.6 && t < 5.4) || (t > 7.6 && t < 9.6);
  const phase = (x - 150) / 6;
  let hand: P;
  if (t < 2.0) hand = trackP(t, [[0, [138, 108]], [0.8, [126, 111]], [1.6, [126, 104]], [2.0, [132, 102]]]);
  else if (t < 5.4) hand = [x + 18 * s, 102];
  else if (t < 7.0) hand = trackP(t, [[5.4, [216, 102]], [6.2, [226, 119]], [6.6, [226, 119]], [7.0, [212, 108]]]);
  else hand = [x + 12 * s, track(t, [[7.0, 108], [9.6, 106]])];
  const carrying = t >= 1.2 && t < 6.6;
  const toteHeld: P = [hand[0] + 14 * s, hand[1]];
  return (
    <g>
      <g {...ink}>
        <rect x={20} y={40} width={110} height={140} />
        {[80, 120, 160].map(y => <path key={y} d={`M20 ${y} H130`} />)}
        {[[28, 52, 28], [70, 58, 22], [34, 94, 26], [40, 136, 24], [86, 140, 20]].map(([bx, by, h]) => <rect key={`${bx}-${by}`} x={bx} y={by} width={32} height={h} fill={tint} />)}
        <rect x={222} y={128} width={88} height={36} />
        <path d="M310 128 L316 108" />
        <circle cx={234} cy={172} r={7} /><circle cx={298} cy={172} r={7} />
        <rect x={270} y={106} width={34} height={22} fill={tint} />
      </g>
      {t < 1.2 && <Tote c={[112, 111]} />}
      {t >= 9 && <Tote c={[112, 111]} opacity={fade(t, 9, 10)} />}
      {t >= 6.6 && <Tote c={[240, 119]} opacity={1 - fade(t, 8.6, 9.6)} />}
      <Humanoid x={x} s={s} hand={hand} phase={phase} walking={walking} held={carrying ? <Tote c={toteHeld} /> : undefined} />
    </g>
  );
}

function Cup({ c, opacity = 1 }: { c: P; opacity?: number }) {
  return <path d={`M${c[0] - 8} ${c[1] - 5} h16 l-2 10 h-12 z`} {...ink} fill={tint} opacity={opacity} />;
}

/** Fixed arm moves cups one by one from the dish rack onto a stack. */
function Cafe({ t }: { t: number }) {
  const rackX = [216, 236, 256, 276];
  const start = (i: number) => 0.2 + i * 2.35;
  const shoulder: P = [184, 131];
  let hand: P = [216, 96];
  let open = true;
  for (let i = 0; i < 4; i++) {
    const u = t - start(i);
    if (u < 0 || u > 2.35) continue;
    const next: P = i < 3 ? [rackX[i + 1], 96] : [216, 96];
    hand = trackP(u, [[0, [rackX[i], 96]], [0.35, [rackX[i], 111]], [0.7, [rackX[i], 94]], [1.4, [150, 92 - 5 * i]], [1.8, [150, 118 - 5 * i]], [2.05, [150, 100 - 5 * i]], [2.35, next]]);
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
      <Cup c={[150, 135]} />
      {rackX.map((cx, i) => {
        const u = t - start(i);
        if (t >= 9.6) return <g key={cx}><Cup c={[cx, 123]} opacity={reset} /><Cup c={[150, 130 - 5 * i]} opacity={1 - reset} /></g>;
        if (u < 0.35) return <Cup key={cx} c={[cx, 123]} />;
        if (u < 1.8) return <Cup key={cx} c={[hand[0], hand[1] + 12]} />;
        return <Cup key={cx} c={[150, 130 - 5 * i]} />;
      })}
      <RobotArm shoulder={shoulder} hand={hand} l1={48} l2={50} open={open} />
    </g>
  );
}

/** Wheeled humanoid upper body on a driving base. Faces right; hands are world points. */
function WheeledHumanoid({ x, hands }: { x: number; hands: [P, P] }) {
  const arm = (sh: P, h: P) => line(sh, joint(sh, h, 26, 28, lower), h);
  const turn = x / 6;
  return (
    <g {...ink}>
      <path d={arm([x + 4, 88], hands[1])} strokeWidth={5} />
      <rect x={x - 22} y={158} width={44} height={14} rx={4} fill={tint} />
      <Wheel c={[x - 13, 174]} r={6} turn={turn} /><Wheel c={[x + 13, 174]} r={6} turn={turn} />
      <rect x={x - 5} y={126} width={10} height={32} fill={paper} />
      <rect x={x - 16} y={80} width={32} height={46} rx={8} fill={tint} />
      <path d={`M${x - 8} 96 H${x + 8}`} />
      <rect x={x - 11} y={54} width={22} height={24} rx={9} fill={tint} />
      <rect x={x - 6} y={61} width={14} height={6} rx={3} fill="currentColor" />
      <path d={arm([x + 10, 88], hands[0])} strokeWidth={5} />
    </g>
  );
}

function Washer({ x, t }: { x: number; t: number }) {
  const a = t * 1.6 + x;
  return (
    <g {...ink}>
      <rect x={x} y={70} width={68} height={110} rx={4} />
      <path d={`M${x} 92 H${x + 68}`} />
      <circle cx={x + 34} cy={136} r={23} />
      <circle cx={x + 34} cy={136} r={14} fill={tint} />
      {[0, 2.1, 4.2].map(o => <circle key={o} cx={x + 34 + Math.cos(a + o) * 8} cy={136 + Math.sin(a + o) * 8} r={2} fill="currentColor" />)}
    </g>
  );
}

/** Wheeled humanoid folds a towel, drives along the table and stacks it; the washers keep running. */
function Laundromat({ t }: { t: number }) {
  const x = track(t, [[0, 196], [4.4, 196], [6.2, 232], [7.4, 232], [9.4, 196]]);
  const rest: P = [x + 34, 104];
  let hand: P = rest;
  let flap: P | null = null;
  if (t < 1.2) hand = trackP(t, [[0, [230, 104]], [0.6, [230, 104]], [1.2, [248, 121]]]);
  else if (t < 2.6) { const u = clamp((t - 1.2) / 1.4); const e = ease(u); hand = [248 - 35 * e, 121 - 20 * Math.sin(Math.PI * e)]; flap = hand; }
  else if (t < 3.8) hand = trackP(t, [[2.6, [214, 117]], [3.2, [226, 117]], [3.8, [221, 119]]]);
  else if (t < 7.0) hand = trackP(t, [[3.8, [221, 119]], [4.4, [221, 104]], [6.2, [257, 104]], [6.6, [271, 96]], [7.0, [271, 103]]]);
  else hand = trackP(t, [[7.0, [271, 103]], [7.4, [266, 104]], [9.4, rest]]);
  const towel = (c: P, w: number, h: number, opacity = 1) => <rect x={c[0] - w / 2} y={c[1] - h / 2} width={w} height={h} {...ink} fill={tint} opacity={opacity} />;
  const holding = t >= 3.8 && t < 7.0;
  const towelCenter: P = holding ? [hand[0], hand[1] + 2] : [221, 121];
  return (
    <g>
      <Washer x={18} t={t} />
      <Washer x={92} t={t + 1} />
      <g {...ink}>
        <path d="M206 124 H306 M214 124 V180 M298 124 V180" />
        {[118, 112, 106].map(y => <rect key={y} x={262} y={y} width={18} height={6} fill={tint} />)}
      </g>
      {t < 1.2 && towel([230, 122], 36, 4, fade(t, 0, 0.6))}
      {t >= 1.2 && t < 2.6 && <g>{towel([221, 121.5], 18, 5)}<path d={`M230 121 Q${(230 + flap![0]) / 2} ${flap![1] - 8} ${flap![0]} ${flap![1]}`} {...ink} strokeWidth={3} /></g>}
      {t >= 2.6 && t < 7.0 && towel(towelCenter, 18, 6)}
      {t >= 7.0 && towel([271, 103], 18, 6, 1 - fade(t, 9.0, 9.8))}
      <WheeledHumanoid x={x} hands={[hand, [hand[0] - 4, hand[1] - 2]]} />
    </g>
  );
}

/** Conveyor runs; a mobile manipulator picks a part, drives over and loads the CNC machine. */
function Factory({ t }: { t: number }) {
  const baseX = track(t, [[0, 190], [4.0, 190], [5.6, 164], [7.6, 164], [9.2, 190]]);
  const shoulder: P = [baseX, 147];
  const hand = trackP(t, [[0, [216, 112]], [3.0, [216, 112]], [3.5, [216, 127]], [4.0, [216, 108]], [5.6, [110, 88]], [6.4, [71, 85]], [6.9, [71, 91]], [7.2, [80, 86]], [7.6, [110, 88]], [9.6, [216, 112]]]);
  const open = t < 3.5 || t > 6.9;
  const partX = track(t, [[0, 300], [3.0, 216]], true);
  const nextX = track(t, [[6, 340], [10, 300]], true);
  const spindle = track(t, [[0, 68], [7.6, 68], [8.4, 86], [9.0, 68]]);
  const part = (c: P, opacity = 1) => <rect x={c[0] - 8} y={c[1] - 6} width={16} height={12} {...ink} fill={tint} opacity={opacity} />;
  const roll = -t * 3;
  return (
    <g>
      <g {...ink}>
        <rect x={22} y={44} width={118} height={136} />
        <rect x={36} y={62} width={70} height={56} fill={tint} />
        <rect x={114} y={62} width={16} height={34} />
        <circle cx={122} cy={104} r={3} fill={t > 7.6 && t < 9 ? "currentColor" : paper} />
        <path d="M56 118 V104 H86 V118" />
        <path d={`M71 62 V${spindle}`} strokeWidth={4} />
        <rect x={204} y={140} width={100} height={12} />
        <path d="M214 152 V180 M294 152 V180" />
      </g>
      {[214, 236, 258, 280].map(rx => <Wheel key={rx} c={[rx, 146]} r={4} turn={roll} />)}
      {t < 3.5 && part([partX, 134])}
      {t >= 3.5 && t < 6.9 && part([hand[0], hand[1] + 7])}
      {t >= 6.9 && part([71, 98], 1 - fade(t, 9.0, 9.6))}
      {t >= 6 && part([nextX, 134], clamp((318 - nextX) / 14))}
      <g {...ink}>
        <rect x={baseX - 24} y={156} width={48} height={18} rx={4} fill={tint} />
        <rect x={baseX - 22} y={150} width={8} height={6} rx={1} />
        <rect x={baseX - 15} y={147} width={30} height={9} rx={2} fill={tint} />
      </g>
      <Wheel c={[baseX - 15, 176]} r={4} turn={baseX / 4} /><Wheel c={[baseX + 15, 176]} r={4} turn={baseX / 4} />
      <RobotArm shoulder={shoulder} hand={hand} l1={56} l2={56} open={open} />
    </g>
  );
}

/** Delivery robot tows a linen cart in from the right and into the service elevator. */
function Hotel({ t }: { t: number }) {
  const x = track(t, [[0, 360], [7.0, 46]], true);
  const opening = track(t, [[0, 0], [3.6, 0], [4.8, 55], [7.4, 55], [8.6, 0]]);
  const going = t > 7.4;
  const turn = -x / 5;
  return (
    <g>
      <rect x={22} y={56} width={110} height={124} fill="#c9d4ca" stroke="none" />
      <g {...ink}>
        {/* Delivery robot, facing left: base, mast, screen face. */}
        <rect x={x - 20} y={154} width={40} height={18} rx={6} fill={tint} />
        <rect x={x - 4} y={112} width={8} height={42} fill={tint} />
        <rect x={x - 14} y={92} width={28} height={20} rx={5} fill={tint} />
        <circle cx={x - 6} cy={102} r={2} fill="currentColor" /><circle cx={x + 3} cy={102} r={2} fill="currentColor" />
        <path d={`M${x + 20} 163 H${x + 28}`} />
        {/* Linen cart with folded sheets above the rim. */}
        <path d={`M${x + 28} 118 V166 H${x + 78} V118 M${x + 28} 140 H${x + 78}`} fill={paper} />
        <rect x={x + 31} y={106} width={21} height={12} rx={2} fill={tint} />
        <rect x={x + 33} y={96} width={18} height={10} rx={2} fill={tint} />
        <rect x={x + 55} y={110} width={20} height={8} rx={2} fill={tint} />
        <rect x={x + 55} y={102} width={20} height={8} rx={2} fill={tint} />
      </g>
      <Wheel c={[x - 11, 175]} r={5} turn={turn} /><Wheel c={[x + 11, 175]} r={5} turn={turn} />
      <Wheel c={[x + 36, 174]} r={6} turn={turn} /><Wheel c={[x + 70, 174]} r={6} turn={turn} />
      <g {...ink}>
        <rect x={22} y={56} width={55 - opening} height={124} fill={paper} />
        <rect x={77 + opening} y={56} width={55 - opening} height={124} fill={paper} />
        <rect x={14} y={36} width={126} height={144} />
        <rect x={14} y={36} width={126} height={20} fill={tint} />
        <path d="M66 50 l4 -8 l4 8 z" fill={going ? "currentColor" : paper} />
        <path d="M80 42 l4 8 l4 -8 z" fill={paper} />
        <rect x={146} y={98} width={12} height={24} rx={3} fill={paper} />
        <path d="M149 108 l3 -5 l3 5 M149 113 l3 5 l3 -5" />
      </g>
    </g>
  );
}

const examples: Example[] = [
  { site: "Warehouse", tests: "Moving full totes from the packing line to outbound carts", provide: "A two-hour window, one escort, floor space by line 3", teamProvides: "Humanoid robot, setup and operation", when: "Two weeks, on dates you approve", uncertain: "Shrink-wrapped totes may need a different gripper", Art: Warehouse },
  { site: "Café", tests: "Unloading the dish rack and restacking cups and plates", provide: "An after-close window and bench space by the dish station", teamProvides: "Fixed robot arm, setup and operation", when: "One week of evenings", uncertain: "Mixed cup sizes may slow stacking", Art: Cafe },
  { site: "Laundromat", tests: "Folding towels for wash-and-fold orders", provide: "One folding table for a morning shift", teamProvides: "Wheeled humanoid, setup and operation", when: "One week, mornings only", uncertain: "Thin or tangled items may need a person", Art: Laundromat },
  { site: "Factory", tests: "Loading blanks into one CNC machine and unloading finished parts", provide: "One machine and a setup day with your maintenance lead", teamProvides: "Mobile manipulator, fixtures, setup and operation", when: "Two weeks, on one shift", uncertain: "Parts that arrive in mixed orientations", Art: Factory },
  { site: "Hotel", tests: "Moving linen carts from the laundry room to each floor", provide: "Service elevator access during quiet hours", teamProvides: "Mobile robot, setup and operation", when: "Two weeks, overnight", uncertain: "Busy elevators at checkout time", Art: Hotel },
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
        <p>The robot team, what the pilot tests, what it costs and when. You decide with one click.</p>
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
            <div><dt>What the pilot tests</dt><dd>{example.tests}</dd></div>
            <div><dt>What you provide</dt><dd>{example.provide}</dd></div>
            <div><dt>What the team provides</dt><dd>{example.teamProvides}</dd></div>
            <div><dt>Pilot cost</dt><dd>Quoted by the robot team, paid to them</dd></div>
            <div><dt>When</dt><dd>{example.when}</dd></div>
            <div><dt>Still uncertain</dt><dd>{example.uncertain}</dd></div>
          </dl>
        </div>
        <div className="ms-pilot-card-foot">
          <span className="ms-button" aria-hidden="true">Book this pilot</span>
          <span>Scope and cost agreed separately.</span>
        </div>
      </div>
    </section>
  );
}
