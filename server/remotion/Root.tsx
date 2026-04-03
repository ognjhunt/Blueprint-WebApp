import { Composition, type CalculateMetadataFunction } from "remotion";
import { ProductReel, type ProductReelProps } from "./ProductReel";

function defaultStoryboard() {
  return [
    {
      startFrame: 0,
      durationFrames: 90,
      title: "Blueprint product reel",
      copy: "Placeholder storyboard scene.",
      visual: "Placeholder visual treatment.",
    },
    {
      startFrame: 90,
      durationFrames: 90,
      title: "Why this matters",
      copy: "Placeholder proof-driven scene.",
      visual: "Placeholder proof artifact.",
    },
    {
      startFrame: 180,
      durationFrames: 90,
      title: "What the buyer gets",
      copy: "Placeholder hosted-review scene.",
      visual: "Placeholder product artifact.",
    },
    {
      startFrame: 270,
      durationFrames: 90,
      title: "Next step",
      copy: "Placeholder CTA scene.",
      visual: "Placeholder CTA frame.",
    },
  ];
}

const calculateMetadata: CalculateMetadataFunction<ProductReelProps> = async ({ props }) => {
  const durationInFrames = (props.storyboard || []).reduce((max, scene) => {
    return Math.max(max, scene.startFrame + scene.durationFrames);
  }, 360);

  return {
    durationInFrames,
    fps: props.fps,
    width: props.width,
    height: props.height,
  };
};

export const ProductReelRoot = () => {
  return (
    <Composition
      id="BlueprintProductReel"
      component={ProductReel}
      durationInFrames={360}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{
        storyboard: defaultStoryboard(),
        images: [],
        runwayVideoUrl: null,
        fps: 30,
        width: 1280,
        height: 720,
      }}
      calculateMetadata={calculateMetadata}
    />
  );
};
