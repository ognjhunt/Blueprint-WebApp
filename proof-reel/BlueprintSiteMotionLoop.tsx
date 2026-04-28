import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import proofBoard from "../client/public/generated/editorial/sample-evaluation-proof-board.png";
import aisleLoop from "../client/public/generated/public-capture-2026-04-23/cedar-market-aisle-loop.png";
import everydayPlaces from "../client/public/generated/public-capture-2026-04-23/everyday-places-collage.png";
import hostedRoute from "../client/public/generated/public-capture-2026-04-23/hosted-review-public-route.png";

const sceneAssets = [aisleLoop, proofBoard, hostedRoute, everydayPlaces] as const;

const scenes = [
  {
    eyebrow: "01 / Capture route",
    title: "One public-facing place becomes a route.",
    body: "A lawful walkthrough gives the buyer something concrete to inspect before deeper work starts.",
    phase: "Capture",
  },
  {
    eyebrow: "02 / Provenance packet",
    title: "The evidence stays attached.",
    body: "Manifest, route, rights, restrictions, and observations travel with the site record.",
    phase: "Package",
  },
  {
    eyebrow: "03 / Hosted review",
    title: "The exact site opens as a review room.",
    body: "Setup, run evidence, and export scope stay visible inside one managed session.",
    phase: "Review",
  },
  {
    eyebrow: "04 / Buyer decision",
    title: "Package access or hosted next step.",
    body: "The buyer chooses with the site, limits, and proof shape still in view.",
    phase: "Decision",
  },
] as const;

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function smoothProgress(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function SceneLayer({
  asset,
  activeScene,
  sceneFrames,
}: {
  asset: string;
  activeScene: number;
  sceneFrames: number;
}) {
  const frame = useCurrentFrame();
  const localFrame = frame - activeScene * sceneFrames;
  const drift = interpolate(clamp(localFrame, 0, sceneFrames), [0, sceneFrames], [-18, 18], {
    easing: easeInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(clamp(localFrame, 0, sceneFrames), [0, sceneFrames], [1.05, 1.09], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Img
        src={asset}
        style={{
          height: "100%",
          width: "100%",
          objectFit: "cover",
          filter: "grayscale(0.72) contrast(1.05) brightness(0.86)",
          transform: `translate3d(${drift}px, 0, 0) scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
}

function RoutePulse({ activeScene }: { activeScene: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneFrame = frame - activeScene * 3 * fps;
  const routeDraw = interpolate(sceneFrame, [8, 66], [720, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 0.55 + Math.sin(frame / 8) * 0.25;

  return (
    <svg
      viewBox="0 0 1280 720"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        height: "100%",
        width: "100%",
        opacity: activeScene === 1 ? 0.35 : 0.78,
      }}
    >
      <path
        d="M228 642 C 320 586, 354 520, 432 498 C 532 470, 502 384, 626 356 C 742 330, 728 236, 838 210 C 930 188, 978 144, 1092 118"
        fill="none"
        stroke="rgba(125, 211, 252, 0.9)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="720"
        strokeDashoffset={routeDraw}
        style={{ filter: "drop-shadow(0 0 16px rgba(14, 165, 233, 0.85))" }}
      />
      {[228, 432, 626, 838, 1092].map((cx, markerIndex) => {
        const cy = [642, 498, 356, 210, 118][markerIndex];
        const markerProgress = smoothProgress(sceneFrame, 20 + markerIndex * 10, 38 + markerIndex * 10);
        return (
          <g key={cx} opacity={markerProgress}>
            <circle
              cx={cx}
              cy={cy}
              r={18 + pulse * 10}
              fill="rgba(14, 165, 233, 0.12)"
              stroke="rgba(125, 211, 252, 0.34)"
              strokeWidth="2"
            />
            <circle cx={cx} cy={cy} r="8" fill="rgba(240, 249, 255, 0.96)" />
          </g>
        );
      })}
    </svg>
  );
}

function EvidenceCards({ activeScene }: { activeScene: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - activeScene * 3 * fps;
  const progress = interpolate(localFrame, [18, 54], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visibleProgress = Number.isFinite(progress) ? progress : 1;

  const cards =
    activeScene === 0
      ? ["Walkthrough", "Route trace", "Public area"]
      : activeScene === 1
        ? ["Manifest", "Rights sheet", "Freshness"]
        : activeScene === 2
          ? ["Run evidence", "Observation frames", "Export scope"]
          : ["Package", "Hosted path", "Next step"];

  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        top: 52,
        width: 330,
        transform: `translate3d(${interpolate(visibleProgress, [0, 1], [32, 0])}px, 0, 0)`,
        opacity: visibleProgress,
        zIndex: 6,
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(5, 10, 20, 0.68)",
          boxShadow: "0 26px 70px rgba(0,0,0,0.32)",
          color: "white",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.48)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span>Evidence</span>
          <span>Example</span>
        </div>
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          {cards.map((card, index) => {
            const fill = interpolate(
              smoothProgress(localFrame, 28 + index * 8, 60 + index * 8),
              [0, 1],
              [22, 88 - index * 10],
            );
            return (
              <div
                key={card}
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px 1fr",
                  alignItems: "center",
                  gap: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.055)",
                  padding: "10px 11px",
                }}
              >
                <div
                  style={{
                    height: 22,
                    width: 22,
                    borderRadius: 999,
                    background: index === 2 ? "rgba(245, 158, 11, 0.95)" : "rgba(34, 197, 94, 0.95)",
                    boxShadow: "0 0 18px rgba(56, 189, 248, 0.22)",
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{card}</div>
                  <div
                    style={{
                      marginTop: 7,
                      height: 5,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.13)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${fill}%`,
                        background: index === 2 ? "#fbbf24" : "#38bdf8",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TitlePanel({ activeScene }: { activeScene: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - activeScene * 3 * fps;
  const enter = interpolate(localFrame, [5, 40], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visibleEnter = Number.isFinite(enter) ? enter : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: 52,
        bottom: 54,
        width: 460,
        color: "white",
        opacity: visibleEnter,
        transform: `translate3d(0, ${interpolate(visibleEnter, [0, 1], [28, 0])}px, 0)`,
        zIndex: 6,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.36)",
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.72)",
        }}
      >
        {scenes[activeScene].eyebrow}
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 47,
          fontWeight: 780,
          letterSpacing: "-0.055em",
          lineHeight: 0.94,
          maxWidth: 430,
          textShadow: "0 16px 60px rgba(0,0,0,0.62)",
        }}
      >
        {scenes[activeScene].title}
      </div>
      <div
        style={{
          marginTop: 18,
          maxWidth: 388,
          color: "rgba(255,255,255,0.78)",
          fontSize: 17,
          lineHeight: 1.55,
          textShadow: "0 12px 38px rgba(0,0,0,0.58)",
        }}
      >
        {scenes[activeScene].body}
      </div>
    </div>
  );
}

function PhaseRail({ activeScene }: { activeScene: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneFrames = 3 * fps;
  const localProgress = interpolate(frame - activeScene * sceneFrames, [0, sceneFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 52,
        right: 52,
        top: 34,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}
    >
      {scenes.map((scene, index) => {
        const active = index === activeScene;
        const complete = index < activeScene;
        const fill = complete ? 100 : active ? localProgress * 100 : 0;
        return (
          <div
            key={scene.phase}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: active ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.28)",
              padding: "10px 11px",
            }}
          >
            <div
              style={{
                color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.56)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {scene.phase}
            </div>
            <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.13)" }}>
              <div style={{ height: "100%", width: `${fill}%`, background: "#7dd3fc" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const BlueprintSiteMotionLoop = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sceneFrames = 3 * fps;
  const activeScene = Math.min(scenes.length - 1, Math.floor(frame / sceneFrames));
  const loopFade = interpolate(frame, [durationInFrames - 24, durationInFrames], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#020617", overflow: "hidden", fontFamily: "Inter, Arial, sans-serif" }}>
      <SceneLayer asset={sceneAssets[activeScene]} activeScene={activeScene} sceneFrames={sceneFrames} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(2,6,23,0.18) 0%, rgba(2,6,23,0.12) 36%, rgba(2,6,23,0.04) 66%, rgba(2,6,23,0.16) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.22,
          background:
            "linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: loopFade,
        }}
      >
        <RoutePulse activeScene={activeScene} />
        <PhaseRail activeScene={activeScene} />
        <TitlePanel activeScene={activeScene} />
        <EvidenceCards activeScene={activeScene} />
      </div>
    </AbsoluteFill>
  );
};
