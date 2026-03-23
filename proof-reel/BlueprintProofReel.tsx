import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import presentationReference from "../client/public/siteworld-f5fd54898cfb-presentation-reference.png";
import runtimeReference from "../client/public/siteworld-f5fd54898cfb-runtime-reference.png";
import warehouseThumb from "../client/public/thumbnails/warehouse-pallet-buffer.png";

const framesPerBeat = 60;

function Slide({
  image,
  eyebrow,
  title,
  body,
  accent,
}: {
  image: string;
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const drift = interpolate(frame, [0, framesPerBeat], [0, 18], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(244,244,245,1) 0%, rgba(241,245,249,1) 55%, rgba(226,232,240,1) 100%)",
        color: "#0f172a",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill style={{ padding: 44 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 28,
            height: "100%",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 28,
              border: "1px solid rgba(15,23,42,0.08)",
              transform: `scale(${0.96 + entrance * 0.04}) translateY(${18 - entrance * 18}px)`,
              boxShadow: "0 30px 90px rgba(15,23,42,0.18)",
            }}
          >
            <Img
              src={image}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `translateY(${drift}px) scale(1.03)`,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: 28,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.78)",
              padding: "30px 28px",
              transform: `translateY(${22 - entrance * 22}px)`,
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 999,
                  border: "1px solid rgba(15,23,42,0.08)",
                  padding: "8px 14px",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#475569",
                  background: "#ffffff",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: accent,
                  }}
                />
                {eyebrow}
              </div>
              <div
                style={{
                  marginTop: 22,
                  fontSize: 46,
                  lineHeight: 1.02,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 21,
                  lineHeight: 1.5,
                  color: "#475569",
                }}
              >
                {body}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(15,23,42,0.08)",
                paddingTop: 18,
                fontSize: 16,
                lineHeight: 1.55,
                color: "#334155",
              }}
            >
              Real facility capture. One exact site. A hosted path buyers can actually inspect.
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const BlueprintProofReel = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f8fafc" }}>
      <Sequence from={0} durationInFrames={framesPerBeat}>
        <Slide
          image={presentationReference}
          eyebrow="Real site"
          title="See the product before you read the pitch."
          body="Blueprint turns real indoor capture into a site-specific proof page. Buyers should not have to guess what they are buying."
          accent="#2563eb"
        />
      </Sequence>
      <Sequence from={framesPerBeat} durationInFrames={framesPerBeat}>
        <Slide
          image={runtimeReference}
          eyebrow="Hosted access"
          title="One exact site. One clean next step."
          body="Use the package when your team wants the files. Use hosted access when your team wants to run the site now."
          accent="#0f766e"
        />
      </Sequence>
      <Sequence from={framesPerBeat * 2} durationInFrames={framesPerBeat}>
        <Slide
          image={warehouseThumb}
          eyebrow="Buyer proof"
          title="Ground the review in the real place."
          body="The point is to make the product concrete early: what site this is, what it is good for, what exports exist, and what still needs caution."
          accent="#7c3aed"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
