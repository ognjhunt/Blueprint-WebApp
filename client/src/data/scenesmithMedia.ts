export type SceneSmithMediaKind = "image" | "video";

export interface SceneSmithMediaItem {
  id: string;
  title: string;
  summary: string;
  kind: SceneSmithMediaKind;
  src: string;
  fallbackPoster: string;
  sourceHref: string;
  sourceLabel: string;
  attribution: string;
}

export const SCENESMITH_REPO_URL = "https://github.com/nepfaff/scenesmith";
export const SCENESMITH_PROJECT_URL = "https://scenesmith.github.io/";
export const SCENESMITH_PAPER_URL = "https://arxiv.org/abs/2507.17192";

const sharedAttribution =
  "SceneSmith project visuals. Externally hosted and subject to source availability.";

export const scenesmithMedia: SceneSmithMediaItem[] = [
  {
    id: "teaser-loop",
    title: "SceneSmith pipeline teaser",
    summary:
      "End-to-end visual summary of 3D scene generation and policy-focused simulation outputs.",
    kind: "image",
    src: "https://scenesmith.github.io/static/images/teaser.webp",
    fallbackPoster: "https://scenesmith.github.io/social-preview.png",
    sourceHref: "https://scenesmith.github.io/static/images/teaser.webp",
    sourceLabel: "Open source media",
    attribution: sharedAttribution,
  },
  {
    id: "robot-eval-loop",
    title: "Robot evaluation loop",
    summary:
      "Policy evaluation examples highlighting affordance interactions and simulation-driven benchmarking.",
    kind: "image",
    src: "https://scenesmith.github.io/static/images/robot_eval.webp",
    fallbackPoster: "https://scenesmith.github.io/social-preview.png",
    sourceHref: "https://scenesmith.github.io/static/images/robot_eval.webp",
    sourceLabel: "Open source media",
    attribution: sharedAttribution,
  },
  {
    id: "project-preview",
    title: "SceneSmith project overview",
    summary:
      "High-level project preview used in the official SceneSmith project page and repository metadata.",
    kind: "image",
    src: "https://scenesmith.github.io/social-preview.png",
    fallbackPoster: "https://scenesmith.github.io/social-preview.png",
    sourceHref: "https://scenesmith.github.io/",
    sourceLabel: "Open project page",
    attribution: sharedAttribution,
  },
];
