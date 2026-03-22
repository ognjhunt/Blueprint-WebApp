/**
 * BlueprintPipelineAnimation — Remotion composition showing the full
 * Capture → Process → World Model → Robot Deploy pipeline as a looping
 * animated graphic for the homepage hero section.
 *
 * Uses Remotion primitives (useCurrentFrame, interpolate, spring, Sequence)
 * for frame-accurate animation. Rendered via @remotion/player in the browser.
 */
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Sequence,
} from "remotion";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const COLORS = {
  indigo: "#6366f1",
  indigoLight: "#c7d2fe",
  emerald: "#10b981",
  emeraldLight: "#a7f3d0",
  violet: "#8b5cf6",
  violetLight: "#ddd6fe",
  slate: "#475569",
  slateLight: "#cbd5e1",
  white: "#ffffff",
  bg: "#f8fafc",
};

/* ------------------------------------------------------------------ */
/*  Utility: clamp interpolate shorthand                               */
/* ------------------------------------------------------------------ */
function ci(
  frame: number,
  input: [number, number],
  output: [number, number],
) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Stylised person with smart glasses, walking and scanning */
function CaptureScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const personX = ci(frame, [0, 2.5 * fps], [60, 200]);
  const scanOpacity = ci(frame, [0.3 * fps, 0.8 * fps], [0, 1]);

  // Scan lines sweep
  const scanAngle = ci(frame, [0.5 * fps, 2.5 * fps], [-25, 25]);

  // Data particles emerge from scan
  const particles = Array.from({ length: 8 }, (_, i) => {
    const delay = 0.6 * fps + i * 0.2 * fps;
    const p = ci(frame, [delay, delay + 0.6 * fps], [0, 1]);
    const x = 180 + Math.cos((i * Math.PI) / 4) * 40 * p;
    const y = 60 + Math.sin((i * Math.PI) / 4) * 30 * p;
    return { x, y, opacity: ci(frame, [delay, delay + 0.3 * fps], [0, 0.8]) };
  });

  // Walking bob
  const bob = Math.sin(frame * 0.3) * 2;

  return (
    <g>
      {/* Floor / room outline forming */}
      <path
        d="M 20 120 L 80 120 L 120 100 L 240 100 L 260 120"
        fill="none"
        stroke={COLORS.slateLight}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        opacity={ci(frame, [0.5 * fps, 1.5 * fps], [0, 0.6])}
      />

      {/* Person silhouette */}
      <g transform={`translate(${personX}, ${70 + bob})`}>
        {/* Head */}
        <circle cx="0" cy="0" r="8" fill={COLORS.slate} />
        {/* Glasses */}
        <rect x="-10" y="-4" width="20" height="6" rx="2" fill={COLORS.indigo} opacity="0.9" />
        {/* Glasses shine */}
        <rect x="-8" y="-3" width="6" height="4" rx="1" fill={COLORS.indigoLight} opacity="0.5" />
        <rect x="2" y="-3" width="6" height="4" rx="1" fill={COLORS.indigoLight} opacity="0.5" />
        {/* Body */}
        <rect x="-6" y="10" width="12" height="18" rx="3" fill={COLORS.slate} />
        {/* Legs - walking */}
        <rect x="-5" y="28" width="4" height="14" rx="2" fill={COLORS.slate}
          transform={`rotate(${Math.sin(frame * 0.3) * 12}, -3, 28)`} />
        <rect x="1" y="28" width="4" height="14" rx="2" fill={COLORS.slate}
          transform={`rotate(${Math.sin(frame * 0.3 + Math.PI) * 12}, 3, 28)`} />
      </g>

      {/* Scan beam from glasses */}
      <g opacity={scanOpacity}>
        <line
          x1={personX + 10}
          y1={70 + bob - 2}
          x2={personX + 70}
          y2={50 + scanAngle}
          stroke={COLORS.indigo}
          strokeWidth="1"
          opacity="0.4"
        />
        <line
          x1={personX + 10}
          y1={70 + bob + 2}
          x2={personX + 70}
          y2={90 + scanAngle * 0.5}
          stroke={COLORS.indigo}
          strokeWidth="1"
          opacity="0.3"
        />
        {/* Scan arc */}
        <circle
          cx={personX + 50}
          cy={70 + bob}
          r={20 + ci(frame, [0.5 * fps, 2 * fps], [0, 15])}
          fill="none"
          stroke={COLORS.indigoLight}
          strokeWidth="1.5"
          opacity={ci(frame, [0.5 * fps, 2.5 * fps], [0.6, 0])}
        />
      </g>

      {/* Data particles */}
      {particles.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3" fill={COLORS.indigo} opacity={pt.opacity} />
      ))}
    </g>
  );
}

/** Data flows into processing, quality check, world model forms */
function ProcessScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Flowing particles from left to center
  const flowParticles = Array.from({ length: 6 }, (_, i) => {
    const t = ((frame * 0.02 + i * 0.16) % 1);
    return {
      x: interpolate(t, [0, 1], [30, 140]),
      y: 75 + Math.sin(t * Math.PI * 2 + i) * 15,
      opacity: Math.sin(t * Math.PI) * 0.7,
      color: COLORS.indigo,
    };
  });

  // Central processing node
  const processScale = spring({ frame, fps, config: { damping: 15 }, delay: 0.3 * fps });
  const spinAngle = frame * 1.5;

  // Quality checkmark
  const checkProgress = ci(frame, [1.2 * fps, 1.8 * fps], [0, 1]);

  // Globe forming
  const globeScale = spring({ frame, fps, config: { damping: 12 }, delay: 1.5 * fps });
  const globeRotation = frame * 0.8;

  // Output particles flowing right
  const outParticles = Array.from({ length: 4 }, (_, i) => {
    const delay = 1.8 * fps;
    const t = ci(frame, [delay + i * 0.15 * fps, delay + (i * 0.15 + 0.8) * fps], [0, 1]);
    return {
      x: interpolate(t, [0, 1], [190, 270]),
      y: 75 + Math.sin(t * Math.PI + i * 1.5) * 10,
      opacity: Math.sin(t * Math.PI) * 0.6,
    };
  });

  return (
    <g>
      {/* Incoming flow particles */}
      {flowParticles.map((pt, i) => (
        <circle key={`in-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill={pt.color} opacity={pt.opacity} />
      ))}

      {/* Processing node */}
      <g transform={`translate(160, 75) scale(${processScale})`}>
        {/* Outer ring - spinning */}
        <g transform={`rotate(${spinAngle})`}>
          <circle cx="0" cy="0" r="22" fill="none" stroke={COLORS.emeraldLight} strokeWidth="2" />
          {[0, 90, 180, 270].map((angle) => (
            <circle
              key={angle}
              cx={Math.cos((angle * Math.PI) / 180) * 22}
              cy={Math.sin((angle * Math.PI) / 180) * 22}
              r="3"
              fill={COLORS.emerald}
            />
          ))}
        </g>

        {/* Inner shield / check */}
        <circle cx="0" cy="0" r="14" fill={COLORS.emeraldLight} opacity="0.3" />

        {/* Checkmark */}
        <path
          d="M -6 0 L -2 4 L 7 -5"
          fill="none"
          stroke={COLORS.emerald}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="20"
          strokeDashoffset={interpolate(checkProgress, [0, 1], [20, 0])}
        />
      </g>

      {/* Globe / world model forming */}
      <g transform={`translate(160, 75) scale(${globeScale})`} opacity={ci(frame, [1.5 * fps, 2 * fps], [0, 1])}>
        {/* Globe outline */}
        <circle cx="0" cy="0" r="28" fill="none" stroke={COLORS.violet} strokeWidth="1.5" opacity="0.5" />
        {/* Latitude lines */}
        <ellipse cx="0" cy="-8" rx="26" ry="6" fill="none" stroke={COLORS.violetLight} strokeWidth="0.8"
          transform={`rotate(${globeRotation * 0.3})`} />
        <ellipse cx="0" cy="8" rx="26" ry="6" fill="none" stroke={COLORS.violetLight} strokeWidth="0.8"
          transform={`rotate(${-globeRotation * 0.2})`} />
        {/* Meridian */}
        <ellipse cx="0" cy="0" rx={10 + Math.sin(globeRotation * 0.02) * 8} ry="28" fill="none"
          stroke={COLORS.violetLight} strokeWidth="0.8" />
      </g>

      {/* Outgoing flow particles */}
      {outParticles.map((pt, i) => (
        <circle key={`out-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill={COLORS.violet} opacity={pt.opacity} />
      ))}
    </g>
  );
}

/** Robot receiving and using the world model */
function DeployScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // World model globe (received)
  const globeEnter = spring({ frame, fps, config: { damping: 12 }, delay: 0.2 * fps });
  const globeRotation = frame * 0.6;

  // Robot approaching
  const robotX = ci(frame, [0.5 * fps, 1.5 * fps], [250, 190]);
  const robotBob = Math.sin(frame * 0.15) * 1.5;

  // Connection lines from globe to robot
  const connectionOpacity = ci(frame, [1.2 * fps, 1.8 * fps], [0, 0.7]);
  const connectionPulse = Math.sin(frame * 0.2) * 0.3 + 0.7;

  // Policy/grounding lines
  const groundingProgress = ci(frame, [1.5 * fps, 2.5 * fps], [0, 1]);

  // Success glow
  const successGlow = ci(frame, [2.2 * fps, 3 * fps], [0, 1]);

  return (
    <g>
      {/* World model globe */}
      <g transform={`translate(100, 75) scale(${globeEnter})`}>
        <circle cx="0" cy="0" r="25" fill={COLORS.violetLight} opacity="0.2" />
        <circle cx="0" cy="0" r="25" fill="none" stroke={COLORS.violet} strokeWidth="1.5" />
        {/* Spinning internal structure */}
        <g transform={`rotate(${globeRotation})`}>
          <ellipse cx="0" cy="0" rx={15} ry="25" fill="none" stroke={COLORS.violetLight} strokeWidth="0.8" />
          <ellipse cx="0" cy="0" rx="25" ry="8" fill="none" stroke={COLORS.violetLight} strokeWidth="0.8" />
        </g>
        {/* Site marker */}
        <circle cx="8" cy="-5" r="3" fill={COLORS.violet} opacity={ci(frame, [0.5 * fps, 1 * fps], [0, 1])} />
      </g>

      {/* Connection lines */}
      <g opacity={connectionOpacity * connectionPulse}>
        <line x1="125" y1="68" x2={robotX - 15} y2={70 + robotBob} stroke={COLORS.violet}
          strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="125" y1="82" x2={robotX - 15} y2={80 + robotBob} stroke={COLORS.violet}
          strokeWidth="1" strokeDasharray="3 4" />
        {/* Data flowing along connection */}
        {[0, 0.33, 0.66].map((offset, i) => {
          const t = ((frame * 0.03 + offset) % 1);
          const cx = interpolate(t, [0, 1], [125, robotX - 15]);
          const cy = interpolate(t, [0, 1], [75, 75 + robotBob]);
          return (
            <circle key={i} cx={cx} cy={cy} r="2" fill={COLORS.violet}
              opacity={Math.sin(t * Math.PI) * connectionOpacity} />
          );
        })}
      </g>

      {/* Robot */}
      <g transform={`translate(${robotX}, ${62 + robotBob})`}>
        {/* Head */}
        <rect x="-9" y="-6" width="18" height="14" rx="3" fill={COLORS.slate} />
        {/* Eyes */}
        <circle cx="-4" cy="1" r="2.5" fill={COLORS.emerald} opacity={0.6 + Math.sin(frame * 0.15) * 0.4} />
        <circle cx="4" cy="1" r="2.5" fill={COLORS.emerald} opacity={0.6 + Math.sin(frame * 0.15) * 0.4} />
        {/* Antenna */}
        <line x1="0" y1="-6" x2="0" y2="-12" stroke={COLORS.slate} strokeWidth="1.5" />
        <circle cx="0" cy="-13" r="2" fill={COLORS.emerald}
          opacity={ci(frame, [1.5 * fps, 2 * fps], [0.3, 1])} />
        {/* Body */}
        <rect x="-11" y="10" width="22" height="22" rx="4" fill={COLORS.slate} />
        {/* Chest indicator */}
        <rect x="-5" y="14" width="10" height="5" rx="1.5"
          fill={successGlow > 0.5 ? COLORS.emerald : COLORS.slateLight}
          opacity={0.5 + successGlow * 0.5} />
        {/* Arms */}
        <rect x="-16" y="12" width="4" height="16" rx="2" fill={COLORS.slate} />
        <rect x="12" y="12" width="4" height="16" rx="2" fill={COLORS.slate} />
        {/* Legs */}
        <rect x="-8" y="33" width="5" height="10" rx="2" fill={COLORS.slate} />
        <rect x="3" y="33" width="5" height="10" rx="2" fill={COLORS.slate} />
      </g>

      {/* Grounding / policy visualization */}
      <g opacity={groundingProgress}>
        {/* Floor grid under robot representing grounded understanding */}
        {Array.from({ length: 5 }, (_, i) => {
          const gx = robotX - 30 + i * 15;
          return (
            <line key={i} x1={gx} y1="110" x2={gx} y2="125" stroke={COLORS.violetLight}
              strokeWidth="0.8" opacity={groundingProgress * 0.5} />
          );
        })}
        <line x1={robotX - 35} y1="115" x2={robotX + 35} y2="115"
          stroke={COLORS.violetLight} strokeWidth="0.8" opacity={groundingProgress * 0.5} />
      </g>

      {/* Success pulse */}
      <circle cx={robotX} cy="80" r={15 + successGlow * 20}
        fill="none" stroke={COLORS.emerald} strokeWidth="1"
        opacity={(1 - successGlow) * 0.4} />
    </g>
  );
}

/** Flowing transition particles between scenes */
function TransitionParticles({
  color,
  fromX,
  toX,
  y,
  count = 4,
}: {
  color: string;
  fromX: number;
  toX: number;
  y: number;
  count?: number;
}) {
  const frame = useCurrentFrame();

  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const t = ((frame * 0.025 + i / count) % 1);
        const x = interpolate(t, [0, 1], [fromX, toX]);
        const py = y + Math.sin(t * Math.PI * 2 + i) * 8;
        const opacity = Math.sin(t * Math.PI) * 0.5;
        return <circle key={i} cx={x} cy={py} r="2" fill={color} opacity={opacity} />;
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Composition                                                   */
/* ------------------------------------------------------------------ */

export const BlueprintPipelineAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Overall fade in/out for seamless loop
  const fadeIn = ci(frame, [0, 0.5 * fps], [0, 1]);
  const fadeOut = ci(frame, [durationInFrames - 0.5 * fps, durationInFrames], [1, 0]);
  const opacity = Math.min(fadeIn, fadeOut);

  // Stage labels
  const labelY = 148;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #ede9fe 100%)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ width: "100%", height: "100%", opacity, position: "relative" }}>
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "#94a3b8",
            textTransform: "uppercase" as const,
          }}
        >
          How It Works
        </div>

        <svg viewBox="0 0 840 170" style={{ width: "100%", height: "100%", marginTop: 8 }}>
          {/* Scene 1: Capture */}
          <Sequence from={0} durationInFrames={3 * fps} layout="none">
            <g transform="translate(0, 0)">
              <CaptureScene />
            </g>
          </Sequence>

          {/* Transition particles: Capture → Process */}
          <TransitionParticles color={COLORS.indigo} fromX={260} toX={310} y={75} />

          {/* Scene 2: Process & World Model */}
          <Sequence from={0.8 * fps} durationInFrames={3 * fps} layout="none">
            <g transform="translate(280, 0)">
              <ProcessScene />
            </g>
          </Sequence>

          {/* Transition particles: Process → Deploy */}
          <TransitionParticles color={COLORS.violet} fromX={540} toX={590} y={75} />

          {/* Scene 3: Robot Deploy */}
          <Sequence from={2 * fps} durationInFrames={3.5 * fps} layout="none">
            <g transform="translate(560, 0)">
              <DeployScene />
            </g>
          </Sequence>

          {/* Stage labels */}
          <g>
            <text x="140" y={labelY} textAnchor="middle" fontSize="11" fontWeight="700"
              fill={COLORS.slate} opacity={ci(frame, [0.3 * fps, 0.8 * fps], [0, 1])}>
              Capture
            </text>
            <text x="140" y={labelY + 14} textAnchor="middle" fontSize="9"
              fill="#94a3b8" opacity={ci(frame, [0.4 * fps, 0.9 * fps], [0, 1])}>
              Walk &amp; scan real spaces
            </text>

            <text x="440" y={labelY} textAnchor="middle" fontSize="11" fontWeight="700"
              fill={COLORS.slate} opacity={ci(frame, [1.2 * fps, 1.7 * fps], [0, 1])}>
              Qualify &amp; Package
            </text>
            <text x="440" y={labelY + 14} textAnchor="middle" fontSize="9"
              fill="#94a3b8" opacity={ci(frame, [1.3 * fps, 1.8 * fps], [0, 1])}>
              Auto-verify &amp; build world model
            </text>

            <text x="700" y={labelY} textAnchor="middle" fontSize="11" fontWeight="700"
              fill={COLORS.slate} opacity={ci(frame, [2.5 * fps, 3 * fps], [0, 1])}>
              Deploy
            </text>
            <text x="700" y={labelY + 14} textAnchor="middle" fontSize="9"
              fill="#94a3b8" opacity={ci(frame, [2.6 * fps, 3.1 * fps], [0, 1])}>
              Robot teams use exact-site models
            </text>
          </g>
        </svg>

        {/* Bottom stats bar */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 16,
            right: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(248, 250, 252, 0.9)",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "8px 16px",
            opacity: ci(frame, [1.5 * fps, 2 * fps], [0, 1]),
          }}
        >
          {[
            { bold: "15-30 min", sub: "capture session" },
            { bold: "Auto-scored", sub: "quality gates" },
            { bold: "Robot-ready", sub: "world models" },
          ].map((stat, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.slate }}>{stat.bold}</span>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>{stat.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
