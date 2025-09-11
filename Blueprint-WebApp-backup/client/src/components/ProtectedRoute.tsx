import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userData, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isReady, setIsReady] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const isTestMode =
    urlParams.get("resetOnboarding") === "true" ||
    urlParams.get("test") === "true";

  // If in test mode, bypass auth check
  if (isTestMode) {
    return children; // or whatever your component normally returns when authenticated
  }

  useEffect(() => {
    // Only proceed when loading is complete
    if (!loading) {
      if (!currentUser) {
        // Store the current location to redirect back after auth
        const currentPath = window.location.pathname;
        sessionStorage.setItem("redirectAfterAuth", currentPath);
        setLocation("/sign-in");
      } else if (!userData) {
        // Wait for user data to be loaded
        return;
      } else {
        setIsReady(true);
      }
    }
  }, [currentUser, userData, loading, setLocation]);

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
