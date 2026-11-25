import type { StructuredTaskDefinition, AgentTaskKind } from "../types";
import { siteVideoEvidenceTask } from "./site-video-evidence";
import { captureVideoPrivacyTask } from "./capture-video-privacy";
import { siteTaskBriefReadingTask } from "./site-task-brief-reading";
import { captureCoverageTask } from "./capture-coverage";
import { robotFitRankingTask } from "./robot-fit-ranking";
import { siteTaskFollowUpTask } from "./site-task-follow-up";
import { companyWebsiteCheckTask } from "./company-website-check";
import { freeTextRedactionTask } from "./free-text-redaction";
import { jobBriefTask } from "./job-brief";
import { jobBriefLessonTask } from "./job-brief-lesson";

export const taskDefinitions = {
  site_video_evidence: siteVideoEvidenceTask,
  capture_video_privacy: captureVideoPrivacyTask,
  site_task_brief_reading: siteTaskBriefReadingTask,
  capture_coverage: captureCoverageTask,
  robot_fit_ranking: robotFitRankingTask,
  site_task_follow_up: siteTaskFollowUpTask,
  company_website_check: companyWebsiteCheckTask,
  free_text_redaction: freeTextRedactionTask,
  job_brief: jobBriefTask,
  job_brief_lesson: jobBriefLessonTask,
} satisfies Record<AgentTaskKind, StructuredTaskDefinition<any, any>>;

export function getTaskDefinition<TInput = unknown, TOutput = unknown>(
  kind: AgentTaskKind,
): StructuredTaskDefinition<TInput, TOutput> {
  return taskDefinitions[kind] as unknown as StructuredTaskDefinition<TInput, TOutput>;
}
