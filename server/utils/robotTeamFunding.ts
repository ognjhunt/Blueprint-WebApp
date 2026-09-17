/**
 * A robot team funding its own balance, without an operator.
 *
 * ## Why this is not a pricing decision
 *
 * The rest of this repo is careful about inventing prices, and rightly. This
 * invents none: a top-up is face value. A team asking to add $100 is charged
 * $100 and gets $100 of balance. There is no rate here, no discount, no
 * package — the price of a run lives in `episodePricing` and is applied when
 * the run is quoted, exactly as it was before.
 *
 * That is what makes this buildable as self-serve. A number the team chose,
 * charged at face value, is not a commercial term anybody has to approve.
 *
 * ## Why funding was the last thing an operator had to do
 *
 * An agent could plan, quote and refuse on its own, but the balance it spent
 * against could only be credited by a person running an admin route. So "a team
 * hands its agent $100 a day" began with an email to us. The agent surface was
 * autonomous downstream of a manual step, which is the same shape as the
 * settlement bug: everything worked except the part that needed someone to
 * remember.
 *
 * ## The credit lands on the webhook, not on the redirect
 *
 * Returning from Stripe is not proof of payment — a success URL can be opened
 * by anyone who can read it. `checkout.session.completed` with
 * `payment_status: "paid"` is the proof, and it arrives at the webhook. So this
 * module creates the session and applies the credit; nothing in between grants
 * anything. The checkout session id is the idempotency key, so Stripe replaying
 * an event credits once.
 */

import type Stripe from "stripe";

import { stripeClient } from "../constants/stripe";
import { logger } from "../logger";
import { creditTeam, type TeamBalance } from "./robotTeamBalance";

/** Marks a checkout session as a balance top-up rather than an order. */
export const TOPUP_PURPOSE = "robot_team_balance_topup";

/**
 * The bounds on one top-up.
 *
 * A floor because a $1 balance cannot buy any run we sell, and a session that
 * can only ever end in a refusal is worse than a refusal now. A ceiling because
 * an agent with a decimal-point bug should not be able to move six figures in
 * one call; a team wanting more can top up twice, or talk to us.
 */
export const MIN_TOPUP_USD = 50;
export const MAX_TOPUP_USD = 25_000;

export type TopupRefusal =
  | "stripe_unavailable"
  | "amount_below_minimum"
  | "amount_above_maximum"
  | "session_not_created";

export type TopupResult =
  | { created: true; checkoutUrl: string; sessionId: string; amountUsd: number }
  | { created: false; refusal: TopupRefusal; detail: string };

function resolveOrigin(): string {
  const configured =
    process.env.STRIPE_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.VITE_PUBLIC_APP_URL?.trim() ||
    process.env.BASE_URL?.trim();
  return (configured || "https://www.tryblueprint.io").replace(/\/$/, "");
}

/**
 * Start a top-up and hand back a URL.
 *
 * The URL is all this returns, and nothing is credited by producing it. An
 * agent can create a session, hand the link to whoever holds the card, and poll
 * `GET /api/agent-team/me` until the balance moves — no callback into the
 * agent's own process required, which matters because an agent running in CI
 * has nowhere for Stripe to redirect to.
 */
export async function startBalanceTopup(params: {
  teamId: string;
  amountUsd: number;
  contactEmail?: string | null;
}): Promise<TopupResult> {
  // The amount first, deliberately. An agent asking for $5 has a bug in its own
  // code, and telling it "payments are not configured" would send it looking in
  // the wrong place — a refusal is only useful if it names the real problem.
  const amountUsd = Math.round(params.amountUsd * 100) / 100;
  if (amountUsd < MIN_TOPUP_USD) {
    return {
      created: false,
      refusal: "amount_below_minimum",
      detail: `The smallest top-up is $${MIN_TOPUP_USD}, which is below the cost of any run we sell.`,
    };
  }
  if (amountUsd > MAX_TOPUP_USD) {
    return {
      created: false,
      refusal: "amount_above_maximum",
      detail: `The largest self-serve top-up is $${MAX_TOPUP_USD}. Top up again or contact us for more.`,
    };
  }

  if (!stripeClient) {
    return {
      created: false,
      refusal: "stripe_unavailable",
      detail:
        "Payments are not configured on this deployment, so a balance cannot be funded here.",
    };
  }

  const origin = resolveOrigin();

  try {
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      // Face value, stated as such on the Stripe page, so nobody has to work
      // out what they bought. The quantity is the dollars.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amountUsd * 100),
            product_data: {
              name: "Blueprint evaluation balance",
              description:
                "Prepaid balance for robot-team evaluation runs. Charged at face value; run prices are quoted before each run and unrun episodes are released.",
            },
          },
        },
      ],
      customer_email: params.contactEmail?.trim() || undefined,
      // The webhook reads these. `client_reference_id` is deliberately not used
      // for the team: the buyer-order handler already resolves orders through
      // it, and a top-up is not an order.
      metadata: {
        blueprint_purpose: TOPUP_PURPOSE,
        blueprint_team_id: params.teamId,
        blueprint_amount_usd: amountUsd.toFixed(2),
      },
      success_url: `${origin}/for-robot-teams?funded=1`,
      cancel_url: `${origin}/for-robot-teams?funded=0`,
    });

    if (!session.url) {
      return {
        created: false,
        refusal: "session_not_created",
        detail: "Stripe accepted the session but returned no URL to send anyone to.",
      };
    }

    logger.info(
      { teamId: params.teamId, amountUsd, sessionId: session.id },
      "Robot team balance top-up session created",
    );
    return { created: true, checkoutUrl: session.url, sessionId: session.id, amountUsd };
  } catch (error) {
    logger.error({ error, teamId: params.teamId, amountUsd }, "Balance top-up session failed");
    return {
      created: false,
      refusal: "session_not_created",
      detail: "The payment session could not be created. Nothing was charged.",
    };
  }
}

/**
 * Credit a paid top-up, or do nothing.
 *
 * Returns null for any session that is not one of ours, so the webhook can call
 * this on every completed checkout without caring which kind it is. The two
 * facts that must both hold are the purpose marker and `payment_status`
 * `paid` — an unpaid or asynchronously-pending session credits nothing.
 */
export async function creditPaidTopup(
  session: Stripe.Checkout.Session,
): Promise<{ teamId: string; amountUsd: number; balance: TeamBalance } | null> {
  if (session.metadata?.blueprint_purpose !== TOPUP_PURPOSE) return null;
  if (session.payment_status !== "paid") return null;

  const teamId = String(session.metadata?.blueprint_team_id || "").trim();
  if (!teamId) {
    logger.error({ sessionId: session.id }, "Paid top-up carries no team id; cannot credit");
    return null;
  }

  // What Stripe actually collected, never what the metadata claims. The
  // metadata is what we asked for; `amount_total` is what was paid, and only
  // one of those is a fact about money.
  const amountUsd = Math.round((session.amount_total ?? 0)) / 100;
  if (amountUsd <= 0) {
    logger.error({ sessionId: session.id, teamId }, "Paid top-up collected nothing; not crediting");
    return null;
  }

  const balance = await creditTeam({
    teamId,
    amountUsd,
    reason: `Balance top-up (Stripe ${session.id})`,
    // The session id, so Stripe redelivering the event credits once. The ledger
    // makes the key the document id, which is what actually enforces it.
    idempotencyKey: `stripe-topup:${session.id}`,
  });

  logger.info({ teamId, amountUsd, sessionId: session.id }, "Robot team balance credited");
  return { teamId, amountUsd, balance };
}
