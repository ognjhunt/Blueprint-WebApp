import { useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface RequireAuthOptions {
  /** Custom redirect path after login (defaults to current path) */
  returnTo?: string;
  /** Action identifier to store for post-login handling */
  pendingAction?: string;
  /** Any data to preserve across the auth flow */
  pendingData?: Record<string, unknown>;
}

/**
 * Hook for requiring authentication before performing an action.
 *
 * Returns a function that checks if the user is logged in.
 * If not logged in, it stores the current location and any pending action/data,
 * then redirects to the login page. After successful login, the user is
 * redirected back to where they were.
 *
 * @example
 * const requireAuth = useRequireAuth();
 *
 * const handleBuy = () => {
 *   if (!requireAuth({ pendingAction: 'checkout' })) {
 *     return; // User was redirected to login
 *   }
 *   // User is authenticated, proceed with purchase
 *   processCheckout();
 * };
 */
export function useRequireAuth() {
  const { currentUser, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const requireAuth = useCallback(
    (options: RequireAuthOptions = {}): boolean => {
      // Still loading auth state - assume not authenticated yet
      if (loading) {
        return false;
      }

      // User is authenticated
      if (currentUser) {
        return true;
      }

      // User is not authenticated - store redirect info and navigate to login
      const returnPath = options.returnTo || location;

      try {
        sessionStorage.setItem("redirectAfterAuth", returnPath);

        if (options.pendingAction) {
          sessionStorage.setItem("pendingAction", options.pendingAction);
        }

        if (options.pendingData) {
          sessionStorage.setItem(
            "pendingData",
            JSON.stringify(options.pendingData)
          );
        }
      } catch (error) {
        console.error("Failed to store auth redirect info:", error);
      }

      // Redirect to login
      setLocation("/login");
      return false;
    },
    [currentUser, loading, location, setLocation]
  );

  return requireAuth;
}

/**
 * Retrieves and clears any pending action/data stored before auth redirect.
 * Call this after successful login to resume the user's intended action.
 */
export function getPendingAuthAction(): {
  action: string | null;
  data: Record<string, unknown> | null;
} {
  let action: string | null = null;
  let data: Record<string, unknown> | null = null;

  try {
    action = sessionStorage.getItem("pendingAction");
    const dataStr = sessionStorage.getItem("pendingData");
    if (dataStr) {
      data = JSON.parse(dataStr);
    }

    // Clear after reading
    sessionStorage.removeItem("pendingAction");
    sessionStorage.removeItem("pendingData");
  } catch (error) {
    console.error("Failed to retrieve pending auth action:", error);
  }

  return { action, data };
}

/**
 * Check if user is authenticated (non-hook version for use in callbacks)
 */
export function isAuthenticated(
  currentUser: ReturnType<typeof useAuth>["currentUser"]
): boolean {
  return currentUser !== null;
}
