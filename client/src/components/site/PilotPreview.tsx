import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

type Example = {
  site: string;
  tests: string;
  provide: string;
  teamProvides: string;
  when: string;
  uncertain: string;
  Art: () => JSX.Element;
};

const ink = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const tint = "#dfe6de";

/** A plain two-link arm reaching from a base at (x, y) toward (tx, ty). */
function Arm({ x, y, tx, ty }: { x: number; y: number; tx: number; ty: number }) {
  const ex = x + 16, ey = y - 58;
  return (
    <g {...ink}>
      <rect x={x - 15} y={y - 9} width={30} height={9} rx={2} fill={tint} />
      <path d={`M${x} ${y - 9} L${ex} ${ey} L${tx} ${ty}`} strokeWidth={5} />
      <circle cx={ex} cy={ey} r={5} fill="#fcfbf7" />
      <path d={`M${tx - 6} ${ty} v10 M${tx + 6} ${ty} v10 M${tx - 6} ${ty} h12`} />
    </g>
  );
}

/** A bipedal humanoid standing at x on the floor, carrying something in front of it. */
function Humanoid({ x }: { x: number }) {
  return (
    <g {...ink}>
      <path d={`M${x - 5} 130 L${x - 8} 155 L${x - 5} 177 M${x + 5} 130 L${x + 9} 155 L${x + 7} 177`} strokeWidth={6} />
      <path d={`M${x - 12} 180 H${x} M${x + 2} 180 H${x + 15}`} strokeWidth={4} />
      <rect x={x - 11} y={119} width={22} height={12} rx={4} fill={tint} />
      <path d={`M${x - 14} 79 Q${x - 17} 104 ${x - 10} 121 H${x + 10} Q${x + 17} 104 ${x + 14} 79 Z`} fill={tint} />
      <path d={`M${x} 71 V78`} />
      <ellipse cx={x} cy={58} rx={11} ry={13} fill={tint} />
      <ellipse cx={x + 4} cy={58} rx={6} ry={8} fill="currentColor" />
      <path d={`M${x - 13} 84 L${x - 6} 104 L${x + 24} 110 M${x + 13} 84 L${x + 20} 102 L${x + 30} 104`} strokeWidth={5} />
    </g>
  );
}

/** A humanoid upper body on a wheeled base, centred at x. */
function WheeledHumanoid({ x }: { x: number }) {
  return (
    <g {...ink}>
      <rect x={x - 22} y={158} width={44} height={14} rx={4} fill={tint} />
      <circle cx={x - 13} cy={174} r={6} /><circle cx={x + 13} cy={174} r={6} />
      <rect x={x - 5} y={126} width={10} height={32} />
      <rect x={x - 16} y={80} width={32} height={46} rx={8} fill={tint} />
      <path d={`M${x - 8} 96 H${x + 8}`} />
      <rect x={x - 11} y={54} width={22} height={24} rx={9} fill={tint} />
      <rect x={x - 6} y={61} width={14} height={6} rx={3} fill="currentColor" />
      <path d={`M${x - 15} 86 L${x - 8} 110 L${x + 40} 118 M${x + 15} 86 L${x + 24} 108 L${x + 46} 112`} strokeWidth={5} />
    </g>
  );
}

/** A robot arm on a small driving base, centred at x, reaching toward (tx, ty). */
function MobileManipulator({ x, tx, ty }: { x: number; tx: number; ty: number }) {
  return (
    <g>
      <g {...ink}>
        <rect x={x - 24} y={156} width={48} height={18} rx={4} fill={tint} />
        <circle cx={x - 15} cy={176} r={4} /><circle cx={x + 15} cy={176} r={4} />
        <rect x={x - 22} y={150} width={8} height={6} rx={1} />
      </g>
      <Arm x={x} y={156} tx={tx} ty={ty} />
    </g>
  );
}

function Warehouse() {
  return (
    <g>
      <g {...ink}>
        <rect x={20} y={40} width={110} height={140} />
        {[80, 120, 160].map(y => <path key={y} d={`M20 ${y} H130`} />)}
        {[[28, 52, 28], [70, 58, 22], [34, 94, 26], [82, 100, 20], [40, 136, 24]].map(([x, y, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={32} height={h} fill={tint} />)}
        <rect x={200} y={128} width={96} height={36} />
        <path d="M296 128 L308 104" />
        <circle cx={212} cy={172} r={7} /><circle cx={284} cy={172} r={7} />
        <rect x={250} y={106} width={38} height={22} fill={tint} />
        <rect x={174} y={94} width={34} height={20} fill={tint} />
      </g>
      <Humanoid x={160} />
    </g>
  );
}

function Cafe() {
  return (
    <g>
      <g {...ink}>
        <rect x={20} y={140} width={280} height={40} />
        <rect x={34} y={74} width={74} height={66} rx={4} />
        <path d="M50 74 V64 H92 V74 M60 104 h22 M71 104 v10" />
        <path d="M64 124 h14 l-2 16 h-10 z" fill={tint} />
        <rect x={204} y={118} width={84} height={22} />
        {[214, 226, 238, 250, 262, 274].map(x => <path key={x} d={`M${x} 118 V96`} />)}
        {[0, 1, 2].map(i => <path key={i} d={`M138 ${132 - i * 9} h22 l-3 8 h-16 z`} fill={tint} />)}
      </g>
      <Arm x={184} y={140} tx={236} ty={78} />
    </g>
  );
}

function Laundromat() {
  return (
    <g>
      <g {...ink}>
        {[18, 92].map(x => (
          <g key={x}>
            <rect x={x} y={70} width={68} height={110} rx={4} />
            <path d={`M${x} 92 H${x + 68}`} />
            <circle cx={x + 34} cy={136} r={23} />
            <circle cx={x + 34} cy={136} r={14} fill={tint} />
          </g>
        ))}
        <path d="M222 124 H306 M230 124 V180 M298 124 V180" />
        <rect x={232} y={115} width={34} height={9} fill={tint} />
        <rect x={266} y={110} width={34} height={7} fill={tint} />
        <rect x={266} y={103} width={34} height={7} fill={tint} />
        <rect x={266} y={117} width={34} height={7} fill={tint} />
      </g>
      <WheeledHumanoid x={194} />
    </g>
  );
}

function Factory() {
  return (
    <g>
      <g {...ink}>
        <rect x={22} y={44} width={118} height={136} />
        <rect x={36} y={62} width={70} height={56} fill={tint} />
        <rect x={114} y={62} width={16} height={34} />
        <path d="M56 118 V104 H86 V118" />
        <rect x={204} y={140} width={100} height={12} />
        {[214, 236, 258, 280].map(x => <circle key={x} cx={x} cy={146} r={3} />)}
        <path d="M214 152 V180 M294 152 V180" />
        {[222, 264].map(x => <rect key={x} x={x} y={124} width={24} height={16} fill={tint} />)}
      </g>
      <MobileManipulator x={170} tx={108} ty={92} />
    </g>
  );
}

function Hotel() {
  return (
    <g {...ink}>
      <rect x={24} y={34} width={104} height={146} />
      <path d="M76 52 V180 M24 52 H128" />
      <circle cx={140} cy={104} r={5} />
      <rect x={196} y={104} width={100} height={60} rx={6} />
      {[118, 130, 142].map(y => <path key={y} d={`M206 ${y} H286`} />)}
      <circle cx={210} cy={172} r={7} /><circle cx={282} cy={172} r={7} />
      <rect x={150} y={120} width={36} height={46} rx={6} fill={tint} />
      <rect x={158} y={108} width={20} height={12} rx={3} />
      <circle cx={158} cy={172} r={7} /><circle cx={178} cy={172} r={7} />
      <path d="M186 132 H196" />
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

const ROTATE_MS = 6000;

/** What a site receives: one recommended pilot, shown for a few kinds of site. Examples, not bookings. */
export function PilotPreview() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
  }, []);
  useEffect(() => {
    if (paused || held) return;
    const id = window.setTimeout(() => setActive(i => (i + 1) % examples.length), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [active, paused, held]);

  const example = examples[active];
  const { Art } = example;
  return (
    <section className="ms-pilot-preview" aria-labelledby="pilot-preview-title"
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="ms-pilot-preview-intro">
        <p className="ms-eyebrow">What you get</p>
        <h2 id="pilot-preview-title">One recommended pilot, on one page.</h2>
        <p>The robot team, what the pilot tests, what it costs and when. You decide with one click.</p>
        <svg className="ms-pilot-art" viewBox="0 0 320 196" role="img" aria-label={`Illustration of the ${example.site.toLowerCase()} example`} key={example.site}>
          <path d="M8 180 H312" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <Art />
        </svg>
      </div>
      <div className="ms-pilot-card">
        <div className="ms-pilot-tabs">
          <div role="tablist" aria-label="Example sites">
            {examples.map((item, i) => (
              <button key={item.site} type="button" role="tab" id={`pilot-tab-${i}`} aria-selected={i === active} aria-controls="pilot-example"
                onClick={() => { setActive(i); setPaused(true); }}>{item.site}</button>
            ))}
          </div>
          <button type="button" className="ms-pilot-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? "Play examples" : "Pause examples"}>
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
          <span>No pilot, no fee.</span>
        </div>
      </div>
    </section>
  );
}
