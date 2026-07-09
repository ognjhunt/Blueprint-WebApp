import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { hasAnyRole } from "@/lib/adminAccess";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * R036: route gate for admin/ops-only surfaces (the operator console, /ops/*).
 *
 * Requires an authenticated user AND an admin/ops role (via Firebase custom
 * claims or the user doc, resolved by `hasAnyRole`). Unauthenticated users are
 * bounced to sign-in (remembering the destination); signed-in users without the
 * role see an explicit "Access denied" instead of any operational data.
 *
 * This is defense-in-depth on top of the server gate — the /api/ops route
 * enforces the same admin/ops claim, so hiding the UI is never the only guard.
 * The `VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH` dev bypass populates an admin/ops
 * context, so local operator QA passes this gate unchanged.
 */
export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { currentUser, userData, tokenClaims, loading } = useAuth();
  const [, setLocation] = useLocation();

  const isAuthorized = hasAnyRole(["admin", "ops"], userData, tokenClaims);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!currentUser) {
      const currentPath =
        window.location.pathname + window.location.search + window.location.hash;
      try {
        sessionStorage.setItem("redirectAfterAuth", currentPath);
      } catch {
        /* sessionStorage may be unavailable; sign-in still works without it */
      }
      setLocation("/sign-in");
    }
  }, [currentUser, loading, setLocation]);

  // Still resolving auth, or signed in but user doc/claims not loaded yet.
  if (loading || (currentUser && !userData && !tokenClaims)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    // Redirect is in flight from the effect above.
    return null;
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-ink-900">
            Admin access required
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink-500">
            The operator console is limited to Blueprint admin and ops accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<div>Something went wrong. Please try again.</div>}>
      {children}
    </ErrorBoundary>
  );
}
