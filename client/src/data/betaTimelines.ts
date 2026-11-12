/**
 * How long a beta step takes, in the words /beta uses. One named constant, so
 * the owner can change it in one place (owner request, 2026-10-18). (The waiting
 * lines of the signed-in job page went with that page on 2026-11-12.)
 *
 * Ranges, never dates, and never a result date: the result follows only when
 * Blueprint's simulation of the job reports it.
 */

/** Our reply to what a site sends: a new job, footage, written answers. */
export const REPLY_TIMELINE = "We usually reply within an hour.";
