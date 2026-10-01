import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";

type ConnectionPreparation = {
  account: string;
  binding: { state: "missing" | "configured_unverified" };
  oauth: { ownerAction: string; initialScopes: string[]; sendScopeAfterSeparateApproval: string; dataAccess: string };
  secretDestination: { provider: string; services: string[]; keys: string[] };
};

/** Shows the owner handoff. It cannot initiate OAuth or accept credentials. */
export function FounderMailboxConnection() {
  const [expanded, setExpanded] = useState(false);
  const connection = useQuery<ConnectionPreparation>({
    queryKey: ["founder-mailbox-connection-preparation"],
    enabled: expanded,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/outbound-prospects/communications/connection", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Founder connection preparation is unavailable.");
      return (await response.json()).connection;
    },
  });
  return <section className="runway-panel p-5">
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm"
      aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Prepare founder mailbox</button>
    {expanded && <div className="mt-3 space-y-3 text-sm text-runway-body">
      {connection.isLoading && <p>Loading connection preparation…</p>}
      {connection.isError && <p role="alert">Founder connection preparation is unavailable.</p>}
      {connection.data && <>
        <p><strong>{connection.data.account}</strong>: {connection.data.binding.state === "missing"
          ? "separate founder binding is missing" : "founder fields are present; mailbox access is unverified"}.</p>
        <p>{connection.data.oauth.ownerAction}</p>
        <p>{connection.data.oauth.dataAccess}</p>
        <p>Read access: <code>{connection.data.oauth.initialScopes.join(", ")}</code>.</p>
        <p>Sending later requires separate approval for <code>{connection.data.oauth.sendScopeAfterSeparateApproval}</code>.</p>
        <p>The shared vault owner must confirm the secure credential-entry route. The separate founder binding serves {connection.data.secretDestination.services.join(" and ")} on {connection.data.secretDestination.provider}; its server fields are <code>{connection.data.secretDestination.keys.join(", ")}</code>.</p>
        <p>The existing ops mailbox binding stays separate. OAuth initiation is blocked until the existing client and registered callback are verified.</p>
        <a className="underline" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Inspect the existing Google OAuth client</a>
      </>}
    </div>}
  </section>;
}
