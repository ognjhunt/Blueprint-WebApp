import { useEffect } from "react";
import { useLocation } from "wouter";

interface MarketingRedirectProps {
  to: string;
}

export function MarketingRedirect({ to }: MarketingRedirectProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    setLocation(`${to}${search}${hash}`, { replace: true });
  }, [setLocation, to]);

  return null;
}
