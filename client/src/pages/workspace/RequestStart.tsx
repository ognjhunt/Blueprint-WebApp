import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
export default function RequestStart() {
  const { userData, loading } = useAuth(),
    [, navigate] = useLocation();
  useEffect(() => {
    if (!loading)
      navigate(
        userData?.buyerType === "site_operator"
          ? "/app/tasks/new"
          : "/app/opportunities",
        { replace: true },
      );
  }, [loading, userData?.buyerType, navigate]);
  return <p role="status">Opening your workspace…</p>;
}
