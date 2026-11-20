"use client";

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { BROWSE_JOBS_PATH, isApprovedDeploymentCompany } from "@/lib/robotTeamAccess";

/**
 * `/onboarding` used to be a setup checklist in intake terms. It is retired (2026-11-20): nothing is left to finish, so
 * the route only forwards. A site goes to its jobs, an approved deployment company to Find jobs, and any other account
 * to `/app`, which never sends an account back here.
 */
export default function OnboardingChecklist() {
  const { userData, currentUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let active = true;
    (async () => {
      const company = userData?.buyerType !== "site_operator" && currentUser
        ? await isApprovedDeploymentCompany(currentUser)
        : false;
      if (active) setLocation(company ? BROWSE_JOBS_PATH : "/app", { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [userData?.buyerType, currentUser, setLocation]);

  return (
    <p className="ws-loading" role="status">
      Loading…
    </p>
  );
}
