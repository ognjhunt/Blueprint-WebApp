import Stripe from "stripe";
import { logger } from "../logger";

const PLACEHOLDER_VALUES = new Set(["PLACEHOLDER", "DUMMY"]);

declare global {
  // Used for runtime diagnostics when critical third-party services are unavailable.
  var blockedServices: Set<string> | undefined;
}

const isPlaceholderValue = (value: string | undefined) =>
  Boolean(value && PLACEHOLDER_VALUES.has(value.trim().toUpperCase()));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const stripeSecretIsPlaceholder = isPlaceholderValue(STRIPE_SECRET_KEY);

// Enhanced Stripe availability check with clear unblock path
export const stripeAvailable = Boolean(
  STRIPE_SECRET_KEY && 
  !stripeSecretIsPlaceholder &&
  STRIPE_SECRET_KEY.length > 8 // Basic validation to prevent placeholder values
);

if (!stripeAvailable) {
  const message =
    "STRIPE_SECRET_KEY is not configured. Revenue metrics and checkout functionality are currently blocked. Please provision a valid Stripe secret key to restore full functionality.";
  logger.warn(message);

  // Store the block status for monitoring and unblock path tracking
  if (typeof globalThis.blockedServices === "undefined") {
    globalThis.blockedServices = new Set();
  }
  globalThis.blockedServices.add("stripe-revenue-metrics");
}

export const stripeClient =
  stripeAvailable
    ? new Stripe(STRIPE_SECRET_KEY as string, { apiVersion: "2024-12-18.acacia" })
    : null;

export const STRIPE_CURRENT_PROVIDER = "stripe" as const;
export const STRIPE_API_VERSION = "2024-12-18.acacia" as const;

// Capturer payout, Stripe Connect and Connect onboarding settings were retired
// with capturer payouts (owner, 2026-11-11).
