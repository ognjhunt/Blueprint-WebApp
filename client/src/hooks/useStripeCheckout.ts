import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { analyticsEvents } from "@/components/Analytics";
import { withCsrfHeader } from "@/lib/csrf";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_live_51ODuefLAUkK46LtZhLELsrQy3mYGUZdR5v5Br29sJj8yx8rN0mYkzMYQbKXAaL0mSKjUGjT7FHYLbKfEYg9MkCQI00v9xnZ8wT";

const stripePromise = loadStripe(stripePublishableKey);

export interface MarketplaceCheckoutItem {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity?: number;
  itemType: "dataset" | "scene";
}

interface CheckoutState {
  isLoading: boolean;
  error: string | null;
}

interface UseStripeCheckoutReturn extends CheckoutState {
  initiateCheckout: (item: MarketplaceCheckoutItem) => Promise<void>;
  clearError: () => void;
}

export function useStripeCheckout(): UseStripeCheckoutReturn {
  const [state, setState] = useState<CheckoutState>({
    isLoading: false,
    error: null,
  });

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const initiateCheckout = useCallback(async (item: MarketplaceCheckoutItem) => {
    setState({ isLoading: true, error: null });

    try {
      // Track checkout initiation
      analyticsEvents.beginCheckout(item.sku, item.price * (item.quantity || 1));

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sessionType: "marketplace",
          marketplaceItem: {
            sku: item.sku,
            title: item.title,
            description: item.description,
            price: item.price,
            quantity: item.quantity || 1,
            itemType: item.itemType,
          },
          successPath: "/marketplace?checkout=success",
          cancelPath: "/marketplace?checkout=cancel",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const { sessionUrl } = await response.json();

      if (sessionUrl) {
        // Redirect to Stripe Checkout
        window.location.href = sessionUrl;
      } else {
        // Fallback to Stripe.js redirect
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error("Stripe failed to load");
        }

        const { sessionId } = await response.json();
        const { error } = await stripe.redirectToCheckout({ sessionId });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : "Checkout failed. Please try again.",
      });
    }
  }, []);

  return {
    ...state,
    initiateCheckout,
    clearError,
  };
}
