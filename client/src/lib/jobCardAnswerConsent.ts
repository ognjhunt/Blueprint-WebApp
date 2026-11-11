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
 * recorded under v1 still shares the answer.
 *
 * v3 (2026-11-11) adds that the answer shared includes later test results. Since the simulation test became the
 * answer's headline, what a card carries follows what the site agreed to: a choice recorded under v1 or v2 puts the
 * paper check on the card and never a test result; only v3 lets the card carry the test result, including one that
 * arrives after the choice. The page shows v3 and the route records only v3.
 */
export const JOB_CARD_ANSWER_STATEMENT_V1_VERSION = "public-task-card-with-answer-v1";
export const JOB_CARD_ANSWER_STATEMENT_V1 =
  "This shares an anonymised summary of your job and this answer with deployment companies Blueprint has approved. "
  + "Your video, address and contacts stay private.";
export const JOB_CARD_ANSWER_STATEMENT_V2_VERSION = "public-task-card-with-answer-v2";
export const JOB_CARD_ANSWER_STATEMENT_V2 =
  "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. "
  + "Your video, address and contacts stay private.";
export const JOB_CARD_ANSWER_STATEMENT_VERSION = "public-task-card-with-answer-v3";
export const JOB_CARD_ANSWER_STATEMENT =
  "Shares a summary of your job and your answer, including later test results, without saying who you are, with companies we've approved. "
  + "Your video, address and contacts stay private.";

/** Every version under which a stored choice shares an answer, and no other. */
export const JOB_CARD_ANSWER_STATEMENT_VERSIONS = [JOB_CARD_ANSWER_STATEMENT_VERSION, JOB_CARD_ANSWER_STATEMENT_V2_VERSION,
  JOB_CARD_ANSWER_STATEMENT_V1_VERSION] as const;
/** The exact sentence of each version, as the route recorded it. */
export const JOB_CARD_ANSWER_STATEMENTS: Readonly<Record<(typeof JOB_CARD_ANSWER_STATEMENT_VERSIONS)[number], string>> = {
  [JOB_CARD_ANSWER_STATEMENT_VERSION]: JOB_CARD_ANSWER_STATEMENT,
  [JOB_CARD_ANSWER_STATEMENT_V2_VERSION]: JOB_CARD_ANSWER_STATEMENT_V2,
  [JOB_CARD_ANSWER_STATEMENT_V1_VERSION]: JOB_CARD_ANSWER_STATEMENT_V1,
};

export function isJobCardAnswerStatementVersion(value: unknown): boolean {
  return typeof value === "string" && (JOB_CARD_ANSWER_STATEMENT_VERSIONS as readonly string[]).includes(value);
}

/** Only v3 names later test results, so only a choice under v3 lets a card carry a test result. */
export function jobCardStatementSharesTestResults(value: unknown): boolean {
  return value === JOB_CARD_ANSWER_STATEMENT_VERSION;
}
