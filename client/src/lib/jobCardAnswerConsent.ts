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
 */
export const JOB_CARD_ANSWER_STATEMENT_VERSION = "public-task-card-with-answer-v1";
export const JOB_CARD_ANSWER_STATEMENT =
  "This shares an anonymised summary of your job and this answer with deployment companies Blueprint has approved. "
  + "Your video, address and contacts stay private.";

/** Every version under which a stored choice shares the answer, and no other. */
export const JOB_CARD_ANSWER_STATEMENT_VERSIONS = [JOB_CARD_ANSWER_STATEMENT_VERSION] as const;

export function isJobCardAnswerStatementVersion(value: unknown): boolean {
  return typeof value === "string" && (JOB_CARD_ANSWER_STATEMENT_VERSIONS as readonly string[]).includes(value);
}
