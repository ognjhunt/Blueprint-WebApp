import type { StructuredTaskDefinition, AgentTaskKind } from "../types";
import { siteVideoEvidenceTask } from "./site-video-evidence";
import { captureVideoPrivacyTask } from "./capture-video-privacy";
import { siteTaskBriefReadingTask } from "./site-task-brief-reading";
import { captureCoverageTask } from "./capture-coverage";
import { robotFitRankingTask } from "./robot-fit-ranking";
import { siteTaskFollowUpTask } from "./site-task-follow-up";

export const taskDefinitions = {
  site_video_evidence: siteVideoEvidenceTask,
  capture_video_privacy: captureVideoPrivacyTask,
  site_task_brief_reading: siteTaskBriefReadingTask,
  capture_coverage: captureCoverageTask,
  robot_fit_ranking: robotFitRankingTask,
  site_task_follow_up: siteTaskFollowUpTask,
} satisfies Record<AgentTaskKind, StructuredTaskDefinition<any, any>>;

export function getTaskDefinition<TInput = unknown, TOutput = unknown>(
  kind: AgentTaskKind,
): StructuredTaskDefinition<TInput, TOutput> {
  return taskDefinitions[kind] as unknown as StructuredTaskDefinition<TInput, TOutput>;
}
