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
    const query = search.replace(/^\?/, "");
    const separator = query ? (to.includes("?") ? "&" : "?") : "";
    setLocation(`${to}${separator}${query}${hash}`, { replace: true });
  }, [setLocation, to]);

  return null;
}
