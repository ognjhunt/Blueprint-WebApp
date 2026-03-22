import type { StructuredTaskDefinition, AgentTaskKind } from "../types";
import { externalHarnessThreadTask } from "./external-harness-thread";
import { inboundQualificationTask } from "./inbound-qualification";
import { operatorThreadTask } from "./operator-thread";
import { payoutExceptionTriageTask } from "./payout-exception-triage";
import { previewDiagnosisTask } from "./preview-diagnosis";
import { postSignupSchedulingTask } from "./post-signup-scheduling";
import { supportTriageTask } from "./support-triage";
import { waitlistTriageTask } from "./waitlist-triage";

export const taskDefinitions = {
  waitlist_triage: waitlistTriageTask,
  inbound_qualification: inboundQualificationTask,
  post_signup_scheduling: postSignupSchedulingTask,
  support_triage: supportTriageTask,
  payout_exception_triage: payoutExceptionTriageTask,
  preview_diagnosis: previewDiagnosisTask,
  operator_thread: operatorThreadTask,
  external_harness_thread: externalHarnessThreadTask,
} satisfies Record<AgentTaskKind, StructuredTaskDefinition<any, any>>;

export function getTaskDefinition<TInput = unknown, TOutput = unknown>(
  kind: AgentTaskKind,
): StructuredTaskDefinition<TInput, TOutput> {
  return taskDefinitions[kind] as unknown as StructuredTaskDefinition<TInput, TOutput>;
}
