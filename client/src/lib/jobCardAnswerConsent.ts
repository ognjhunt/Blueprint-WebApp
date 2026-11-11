/**
 * The sentence a site reads under "Find a deployment company for this job",
 * and the version id its choice is recorded under. One click on that button is
 * the site's explicit choice to share what this sentence says: the anonymised
 * job card AND Blueprint's answer for the job.
 *
 * The job page renders the sentence from this constant (`SiteAnswer.tsx`), and
 * `POST /api/site-task-brief/:token/introduction-request` stores both on
 * `introduction_request` (`statement_version`, `statement_text`). Approved
 * deployment companies see the answer on the card only when the stored version
 * is this one (`server/utils/jobCardAnswer.ts`). The older card checkbox
 * ("public-task-card-v1", "Manage opportunity sharing" and the intake box) does
 * not mention the answer and never shares it.
 *
 * Changing a word means a new version, added to the set below.
 *
 * v2 (2026-11-11) says v1 in plainer words, with the same four facts: what is shared (a summary of the job and
 * this answer), that it does not say who the site is, who receives it (companies Blueprint has approved, the
 * ones the button asks to set the robot up), and what stays private (the video, address and contacts). A choice
 * recorded under v1 still shares the answer; the page now shows v2 and the route records only v2.
 */
export const JOB_CARD_ANSWER_STATEMENT_V1_VERSION = "public-task-card-with-answer-v1";
export const JOB_CARD_ANSWER_STATEMENT_V1 =
  "This shares an anonymised summary of your job and this answer with deployment companies Blueprint has approved. "
  + "Your video, address and contacts stay private.";
export const JOB_CARD_ANSWER_STATEMENT_VERSION = "public-task-card-with-answer-v2";
export const JOB_CARD_ANSWER_STATEMENT =
  "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. "
  + "Your video, address and contacts stay private.";

/** Every version under which a stored choice shares the answer, and no other. */
export const JOB_CARD_ANSWER_STATEMENT_VERSIONS = [JOB_CARD_ANSWER_STATEMENT_VERSION, JOB_CARD_ANSWER_STATEMENT_V1_VERSION] as const;
/** The exact sentence of each version, as the route recorded it. */
export const JOB_CARD_ANSWER_STATEMENTS: Readonly<Record<(typeof JOB_CARD_ANSWER_STATEMENT_VERSIONS)[number], string>> = {
  [JOB_CARD_ANSWER_STATEMENT_VERSION]: JOB_CARD_ANSWER_STATEMENT,
  [JOB_CARD_ANSWER_STATEMENT_V1_VERSION]: JOB_CARD_ANSWER_STATEMENT_V1,
};

export function isJobCardAnswerStatementVersion(value: unknown): boolean {
  return typeof value === "string" && (JOB_CARD_ANSWER_STATEMENT_VERSIONS as readonly string[]).includes(value);
}
