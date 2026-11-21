/**
 * The one box a site ticks when it submits its job (owner decision 2026-11-07,
 * "Confirm at upload"). Consent means the customer agreed to this exact job,
 * so submitting the description with this box ticked is the confirmation of the
 * job description. Nothing else confirms it on the site's behalf.
 *
 * Each version keeps its exact words: a confirmation is recorded under the version the site saw. v1 said "task" and
 * "evaluate"; v2 (launch copy, owner approval in the consent pull request) says what happens: deployment companies look
 * at the job.
 */
export const TASK_CONFIRMATION_STATEMENTS = {
  "2026-11-07.v1": "This is the task I want Blueprint to evaluate.",
  "2026-11-21.v2": "This is the job I want deployment companies to look at.",
} as const;
export type TaskConfirmationVersion = keyof typeof TASK_CONFIRMATION_STATEMENTS;
/** Every version a confirmation may still carry: a page loaded before a release still sends the version it showed. */
export const TASK_CONFIRMATION_VERSIONS = Object.keys(TASK_CONFIRMATION_STATEMENTS) as [TaskConfirmationVersion, ...TaskConfirmationVersion[]];
export const TASK_CONFIRMATION_VERSION: TaskConfirmationVersion = "2026-11-21.v2";
export const TASK_CONFIRMATION_STATEMENT = TASK_CONFIRMATION_STATEMENTS[TASK_CONFIRMATION_VERSION];

export function isTaskConfirmationVersion(value: unknown): value is TaskConfirmationVersion {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TASK_CONFIRMATION_STATEMENTS, value);
}
