import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  ProductReelInput,
  ProductReelImage,
  RemotionStoryboardFrame,
} from "../utils/creative-pipeline";

export type ProductReelProps = ProductReelInput & Record<string, unknown>;

function sceneImage(images: ProductReelImage[], index: number) {
  if (images.length === 0) {
    return null;
  }

  return images[index % images.length]?.dataUrl || images[0]?.dataUrl || null;
}

function StoryboardScene(props: {
  frameConfig: RemotionStoryboardFrame;
  image: string | null;
  videoUrl?: string | null;
  index: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.8 },
  });
  const drift = interpolate(frame, [0, props.frameConfig.durationFrames], [0, 20], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 38%), linear-gradient(180deg, #020617 0%, #0f172a 52%, #111827 100%)",
        color: "#f8fafc",
        overflow: "hidden",
      }}
    >
      {props.image ? (
        <Img
          src={props.image}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.34,
            transform: `scale(${1.04 + entrance * 0.02}) translateY(${drift}px)`,
          }}
        />
      ) : null}

      {props.videoUrl && props.index === 2 ? (
        <AbsoluteFill
          style={{
            inset: "auto 48px 48px auto",
            width: 320,
            height: 180,
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 24px 60px rgba(2,6,23,0.42)",
          }}
        >
          <OffthreadVideo
            src={props.videoUrl}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(110deg, rgba(2,6,23,0.82) 0%, rgba(2,6,23,0.58) 45%, rgba(2,6,23,0.2) 100%)",
        }}
      />

      <AbsoluteFill style={{ padding: "56px 64px", justifyContent: "space-between" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            alignSelf: "flex-start",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            padding: "12px 18px",
            background: "rgba(15,23,42,0.52)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontSize: 15,
            fontWeight: 700,
            transform: `translateY(${18 - entrance * 18}px)`,
          }}
        >
          Blueprint
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#38bdf8",
            }}
          />
          Exact-Site Offer
        </div>

        <div
          style={{
            maxWidth: 760,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            transform: `translateY(${26 - entrance * 26}px)`,
          }}
        >
          <div
            style={{
              fontSize: 66,
              lineHeight: 0.96,
              letterSpacing: "-0.045em",
              fontWeight: 700,
            }}
          >
            {props.frameConfig.title}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.32,
              color: "rgba(226,232,240,0.92)",
              maxWidth: 720,
            }}
          >
            {props.frameConfig.copy}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              borderRadius: 22,
              padding: "14px 18px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "rgba(226,232,240,0.9)",
              fontSize: 18,
              lineHeight: 1.35,
            }}
          >
            {props.frameConfig.visual}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
            color: "rgba(191,219,254,0.92)",
            fontSize: 18,
            lineHeight: 1.35,
          }}
        >
          <div>Capture-first. Provenance-safe. One exact site at a time.</div>
          <div>{String(props.index + 1).padStart(2, "0")}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const ProductReel = ({
  storyboard,
  images,
  runwayVideoUrl,
}: ProductReelProps) => {
  return (
    <AbsoluteFill>
      {storyboard.map((frameConfig, index) => (
        <Sequence
          key={`${frameConfig.startFrame}-${frameConfig.title}`}
          from={frameConfig.startFrame}
          durationInFrames={frameConfig.durationFrames}
        >
          <StoryboardScene
            frameConfig={frameConfig}
            image={sceneImage(images, index)}
            videoUrl={runwayVideoUrl}
            index={index}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
