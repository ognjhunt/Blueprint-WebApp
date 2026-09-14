import { EvaluationWalkthrough } from "./EvaluationWalkthrough";
import { EvaluationEpisodePreview } from "./EvaluationEpisodePreview";

// Research recordings are an explicit local-development preview only.
// A production build always renders the standalone public walkthrough.
export function EvaluationExample() {
  const internalPreview = import.meta.env?.DEV
    && import.meta.env.VITE_BLUEPRINT_INTERNAL_EPISODE_PREVIEW === "1";
  return internalPreview ? <EvaluationEpisodePreview /> : <EvaluationWalkthrough />;
}
