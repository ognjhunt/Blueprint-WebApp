/**
 * Outbox statuses whose email went out, or may have: `sent`, a dispatch under way (`dispatching`), and an `unknown`
 * provider outcome. One definition for every check that asks whether an email reached the site (the window and
 * no-grant sweeps, the scene outcome notices, the answer slots).
 */
export const OUTBOX_WENT_OUT: ReadonlySet<string> = new Set(["dispatching", "unknown", "sent"]);
