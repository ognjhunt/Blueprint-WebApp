/**
 * HeroPipelineAnimated — Drop-in replacement for HeroPipelineGraphic.
 * Embeds the BlueprintPipelineAnimation Remotion composition via @remotion/player.
 * Loops continuously, auto-plays silently, no controls shown.
 */
import { Player } from "@remotion/player";
import { BlueprintPipelineAnimation } from "./BlueprintPipelineAnimation";

const FPS = 30;
const DURATION_SECONDS = 6;

export function HeroPipelineAnimated() {
  return (
    <div className="relative">
      {/* Glow behind */}
      <div className="absolute -inset-4 rounded-3xl bg-indigo-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-xl backdrop-blur-sm">
        <Player
          component={BlueprintPipelineAnimation}
          compositionWidth={840}
          compositionHeight={200}
          durationInFrames={FPS * DURATION_SECONDS}
          fps={FPS}
          loop
          autoPlay
          controls={false}
          style={{
            width: "100%",
            aspectRatio: "840 / 200",
          }}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          inputProps={{}}
        />
      </div>
    </div>
  );
}
