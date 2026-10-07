import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { hasAnyRole, type AccessRole } from "@/lib/adminAccess";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRoles?: AccessRole[];
}

export default function ProtectedRoute({ children, requireRoles }: ProtectedRouteProps) {
  const { currentUser, userData, tokenClaims, loading } = useAuth();
  const [, setLocation] = useLocation();
  // Derive visibility from this render's authority. A sticky ready flag can
  // keep private children mounted after sign-out or role revocation while
  // the navigation effect runs.
  const isCapturer = userData?.role === "capturer" || userData?.roles?.includes("capturer") === true;
  const isReady = !loading && Boolean(currentUser && userData) && !isCapturer
    && (!requireRoles?.length || hasAnyRole(requireRoles, userData, tokenClaims));

  useEffect(() => {
    // Only proceed when loading is complete
    if (!loading) {
      if (!currentUser) {
        // Store the current location to redirect back after auth
        const currentPath =
          window.location.pathname +
          window.location.search +
          window.location.hash;
        sessionStorage.setItem("redirectAfterAuth", currentPath);
        setLocation("/sign-in");
      } else if (!userData) {
        // Wait for user data to be loaded
        return;
      } else if (
        userData.role === "capturer" ||
        userData.roles?.includes("capturer") === true
      ) {
        sessionStorage.removeItem("redirectAfterAuth");
        setLocation("/capture-app");
      } else if (
        requireRoles &&
        requireRoles.length > 0 &&
        !hasAnyRole(requireRoles, userData, tokenClaims)
      ) {
        sessionStorage.removeItem("redirectAfterAuth");
        setLocation("/");
      }
    }
  }, [currentUser, userData, tokenClaims, loading, setLocation, requireRoles]);

  if (loading || (!loading && currentUser && !userData)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isReady) {
    return null;
  }

  return (
    <ErrorBoundary
      fallback={<div>Something went wrong. Please try again.</div>}
    >
      {children}
    </ErrorBoundary>
  );
}
