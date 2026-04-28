import { Composition } from "remotion";
import { BlueprintProofReel } from "./BlueprintProofReel";
import { BlueprintSiteMotionLoop } from "./BlueprintSiteMotionLoop";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="BlueprintProofReel"
        component={BlueprintProofReel}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={800}
      />
      <Composition
        id="BlueprintSiteMotionLoop"
        component={BlueprintSiteMotionLoop}
        durationInFrames={360}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
