import { useEffect } from "react";
import { useLocation } from "wouter";

interface MarketingRedirectProps {
  to: string;
}

export function MarketingRedirect({ to }: MarketingRedirectProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const incomingHash = typeof window !== "undefined" ? window.location.hash : "";
    // Split the target so a forwarded query lands BEFORE any hash in `to`
    // (e.g. `/for-robot-teams#intake` or `/#how-it-works`); appending the
    // query after the hash would bury it in the fragment and break the anchor.
    const [toBase, toHashRaw] = to.split("#");
    const toHash = toHashRaw ? `#${toHashRaw}` : "";
    const query = search.replace(/^\?/, "");
    const separator = query ? (toBase.includes("?") ? "&" : "?") : "";
    setLocation(`${toBase}${separator}${query}${toHash || incomingHash}`, {
      replace: true,
    });
  }, [setLocation, to]);

  return null;
}
