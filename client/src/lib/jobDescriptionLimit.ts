/**
 * How long a site's job description may be: one limit for the start form, the description editor, the "name the job"
 * form and every route that stores the description (stress test, 2026-11-24: the start form took 2,000 characters while
 * the editor and its routes took 300, so a site could not correct its own longer description). A box over the limit
 * says so in a plain sentence; nothing is cut off silently.
 *
 * Everything that reads the description downstream takes this length: the company's job page (2,000 characters,
 * `siteSentenceForCompany`), the Pipeline's task context (`description`, any non-empty text) and the film-link email,
 * which shortens it with an ellipsis for display only (`filmLinkHandoff.ts`).
 */
export const JOB_DESCRIPTION_MAX_LENGTH = 2000;

/** Said under a description box, and by the routes, when the text is longer than the limit. */
export const jobDescriptionTooLong = (length: number) =>
  `Your description is ${length.toLocaleString("en-US")} characters. Shorten it to ${JOB_DESCRIPTION_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`;
/** The routes' sentence, when they do not know the length the site sees. */
export const JOB_DESCRIPTION_TOO_LONG = `Shorten the description to ${JOB_DESCRIPTION_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`;
