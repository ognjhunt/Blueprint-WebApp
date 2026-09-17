/**
 * Where we send someone who wants to talk to a person.
 *
 * ## One fact, one place
 *
 * This URL was written out by hand in eight files. That is a maintenance
 * nuisance and, more to the point, it meant nobody could answer "where do we
 * still ask for a call?" without grepping — which is how the funnel ended up
 * asking for one at a moment where a call could not possibly help.
 *
 * ## When a call earns its place
 *
 * A call costs days of calendar latency and two people's synchronous time. It
 * is worth that when the information cannot be got another way, or when the
 * person on the other end wants a human before committing money. It is not
 * worth it to find out what a room looks like: 45 seconds of footage answers
 * that better, because it is the room rather than a description of the room.
 *
 * So a booking link belongs at:
 *
 * - **Reassurance.** Somebody who will not upload footage of their workplace to
 *   a company they have never spoken to. Real, and permanent. This is a door,
 *   not a step.
 * - **Commitment.** After an evaluation exists, when the decision is money and
 *   scope. That email does not exist yet, because nothing emits an
 *   evaluation-complete event to hang it on, and building the hook before the
 *   event produces machinery nobody triggers.
 * - **Questions footage cannot settle.** Access windows and timelines are facts
 *   about an organisation, and no camera answers them.
 *
 * And not at discovery, which is what `buildMatchEmail` was doing.
 */

import { getConfiguredEnvValue } from "../config/env";

const DEFAULT_BOOKING_URL = "https://calendly.com/blueprintar/30min";

/**
 * The booking URL, from config where set.
 *
 * Read per call rather than frozen at module load, so a deployment that sets
 * the variable does not need the process restarted to pick it up, and so tests
 * can set it without import-order games.
 *
 * `BLUEPRINT_VOICE_BOOKING_URL` is honoured because the voice agent and growth
 * lane were already reading it before this module existed; keeping it means
 * this consolidation changes no deployed behaviour.
 */
export function bookingUrl(): string {
  return (
    getConfiguredEnvValue("BLUEPRINT_CALENDLY_URL", "BLUEPRINT_VOICE_BOOKING_URL")
    || DEFAULT_BOOKING_URL
  );
}
