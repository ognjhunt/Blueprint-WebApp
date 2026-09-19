import type { StructuredTaskDefinition, AgentTaskKind } from "../types";
import { externalHarnessThreadTask } from "./external-harness-thread";
import { inboundQualificationTask } from "./inbound-qualification";
import { operatorThreadTask } from "./operator-thread";
import { payoutExceptionTriageTask } from "./payout-exception-triage";
import { previewDiagnosisTask } from "./preview-diagnosis";
import { postSignupSchedulingTask } from "./post-signup-scheduling";
import { supportTriageTask } from "./support-triage";
import { waitlistTriageTask } from "./waitlist-triage";
import { adpRunOperatorTask } from "./adp-run-operator";
import { siteVideoEvidenceTask } from "./site-video-evidence";
import { siteTaskBriefReadingTask } from "./site-task-brief-reading";
import { captureCoverageTask } from "./capture-coverage";
import { robotCapabilityExtractionTask } from "./robot-capability-extraction";
import { captureDispatchTask } from "./capture-dispatch";
import { outboundOutreachTask } from "./outbound-outreach";

export const taskDefinitions = {
  waitlist_triage: waitlistTriageTask,
  inbound_qualification: inboundQualificationTask,
  post_signup_scheduling: postSignupSchedulingTask,
  support_triage: supportTriageTask,
  payout_exception_triage: payoutExceptionTriageTask,
  preview_diagnosis: previewDiagnosisTask,
  operator_thread: operatorThreadTask,
  external_harness_thread: externalHarnessThreadTask,
  adp_run_operator: adpRunOperatorTask,
  site_video_evidence: siteVideoEvidenceTask,
  site_task_brief_reading: siteTaskBriefReadingTask,
  capture_coverage: captureCoverageTask,
  robot_capability_extraction: robotCapabilityExtractionTask,
  capture_dispatch: captureDispatchTask,
  outbound_outreach: outboundOutreachTask,
} satisfies Record<AgentTaskKind, StructuredTaskDefinition<any, any>>;

export function getTaskDefinition<TInput = unknown, TOutput = unknown>(
  kind: AgentTaskKind,
): StructuredTaskDefinition<TInput, TOutput> {
  return taskDefinitions[kind] as unknown as StructuredTaskDefinition<TInput, TOutput>;
}
