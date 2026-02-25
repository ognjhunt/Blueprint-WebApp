import Stripe from "stripe";
import { logger } from "../logger";

const PLACEHOLDER_VALUES = new Set(["PLACEHOLDER", "DUMMY"]);

const isPlaceholderValue = (value: string | undefined) =>
  Boolean(value && PLACEHOLDER_VALUES.has(value.trim().toUpperCase()));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const stripeSecretIsPlaceholder = isPlaceholderValue(STRIPE_SECRET_KEY);

if (!STRIPE_SECRET_KEY || stripeSecretIsPlaceholder) {
  const message =
    "STRIPE_SECRET_KEY is not set or is a placeholder. Stripe routes will be unavailable.";
  logger.warn(message);
}

export const stripeClient =
  STRIPE_SECRET_KEY && !stripeSecretIsPlaceholder
    ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
    : null;

export const STRIPE_CONNECT_ACCOUNT_ID = process.env.STRIPE_CONNECT_ACCOUNT_ID?.trim();
export const stripeConnectAccountConfigured =
  Boolean(STRIPE_CONNECT_ACCOUNT_ID) && !isPlaceholderValue(STRIPE_CONNECT_ACCOUNT_ID);

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
