import Stripe from "stripe";

const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY?.trim() ||
  process.env.STRIPE_LIVE_SECRET_KEY?.trim() ||
  "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";

export const stripeClient = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-11-20" })
  : null;

export const STRIPE_CONNECT_ACCOUNT_ID =
  process.env.STRIPE_CONNECT_ACCOUNT_ID?.trim() || "acct_1OE1ptPrtLGHqzOG";

const DEFAULT_BASE_URL =
  process.env.STRIPE_PUBLIC_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
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
