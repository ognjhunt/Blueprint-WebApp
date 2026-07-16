import { loadStripe, type Stripe } from "@stripe/stripe-js";

// WSPEC-05: the only source of the Stripe publishable key. No hard-coded
// fallbacks — a missing/malformed key means payments are unavailable, and
// callers must surface that instead of silently initializing Stripe.js in
// the wrong mode against live server sessions.
export function getStripePublishableKey(): string | null {
  const key = String(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
      import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      "",
  ).trim();
  return key.startsWith("pk_") ? key : null;
}

export const STRIPE_UNCONFIGURED_MESSAGE =
  "Payments are temporarily unavailable. Please try again later or contact team@tryblueprint.io.";

export async function loadStripeClient(): Promise<Stripe | null> {
  const key = getStripePublishableKey();
  if (!key) {
    return null;
  }
  return loadStripe(key);
}
