import { Composition } from "remotion";
import { BlueprintProofReel } from "./BlueprintProofReel";

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
    </>
  );
};
