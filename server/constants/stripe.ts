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

export const STRIPE_CONNECT_ACCOUNT_ID = process.env.STRIPE_CONNECT_ACCOUNT_ID?.trim();
export const stripeConnectAccountConfigured =
  Boolean(STRIPE_CONNECT_ACCOUNT_ID) && !isPlaceholderValue(STRIPE_CONNECT_ACCOUNT_ID);

export function getStripeConnectAccountId() {
  return stripeConnectAccountConfigured && STRIPE_CONNECT_ACCOUNT_ID
    ? STRIPE_CONNECT_ACCOUNT_ID
    : null;
}

if (!stripeConnectAccountConfigured) {
  const message =
    "STRIPE_CONNECT_ACCOUNT_ID is not set or is a placeholder. Stripe Connect features will be unavailable.";
  logger.warn(message);
}

const DEFAULT_BASE_URL =
  process.env.STRIPE_PUBLIC_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  process.env.VITE_PUBLIC_APP_URL?.trim() ||
  process.env.VITE_PUBLIC_URL?.trim() ||
  process.env.BASE_URL?.trim() ||
  "https://www.tryblueprint.io";

function resolveOnboardingUrl(envValue: string | undefined, defaultPath: string) {
  if (envValue?.trim()) {
    return envValue.trim();
  }

  try {
    return new URL(defaultPath, DEFAULT_BASE_URL).toString();
  } catch {
    return `https://www.tryblueprint.io${defaultPath}`;
  }
}

export const STRIPE_ONBOARDING_REFRESH_URL = resolveOnboardingUrl(
  process.env.STRIPE_ONBOARDING_REFRESH_URL,
  "/stripe/onboarding/refresh",
);

export const STRIPE_ONBOARDING_RETURN_URL = resolveOnboardingUrl(
  process.env.STRIPE_ONBOARDING_RETURN_URL,
  "/stripe/onboarding/return",
);
