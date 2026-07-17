import { useEffect, useState } from "react";
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
  const [isReady, setIsReady] = useState(false);

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
      } else {
        setIsReady(true);
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
