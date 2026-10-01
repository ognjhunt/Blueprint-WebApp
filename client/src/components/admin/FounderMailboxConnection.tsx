import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { useAuth } from "@/contexts/AuthContext";

const OAUTH_PREFIX = "/api/communications/gmail/oauth";
// Consent must start on the fixed callback host so its host-only cookie returns.
const CALLBACK_ORIGIN = "https://tryblueprint.io";
const PREPARE_URL = `${CALLBACK_ORIGIN}/admin/leads?founder_gmail=prepare`;
type ConnectionPreparation = {
  account: string;
  binding: { state: "missing" | "configured_unverified" | "private_storage_selected_unverified" };
  oauth: { ownerAction: string; initialScopes: string[]; sendScopeAfterSeparateApproval: string; dataAccess: string };
  secretDestination: { provider: string; services: string[]; keys: string[] };
};
type ConsentStatus = { enabled: boolean; state: string; sendsEnabled: false };

/** Explicit owner actions only. No token/secret input or automatic grant/save. */
export function FounderMailboxConnection() {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(() => ["prepare", "returned"].includes(new URLSearchParams(window.location.search).get("founder_gmail") || ""));
  const onCallbackHost = window.location.origin === CALLBACK_ORIGIN;
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const connection = useQuery<ConnectionPreparation>({
    queryKey: ["founder-mailbox-connection-preparation", currentUser?.uid], enabled: expanded && Boolean(currentUser), retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/outbound-prospects/communications/connection", {
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser)),
      });
      if (!response.ok) throw new Error("Founder connection preparation is unavailable.");
      return (await response.json()).connection;
    },
  });
  const status = useQuery<ConsentStatus>({
    queryKey: ["founder-gmail-consent-status", currentUser?.uid], enabled: expanded && Boolean(currentUser), retry: false,
    queryFn: async () => {
      const response = await fetch(`${OAUTH_PREFIX}/status`, { headers: await withFirebaseAuthHeaders(currentUser) });
      if (!response.ok) throw new Error("Founder consent is unavailable.");
      return response.json();
    },
  });
  const decision = useMutation({
    mutationFn: async (action: "start" | "complete") => {
      if (window.location.origin !== CALLBACK_ORIGIN) throw new Error("Continue on the founder callback host first.");
      const response = await fetch(`${OAUTH_PREFIX}/${action}`, { method: "POST", body: "{}",
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" })),
      });
      if (!response.ok) throw new Error("Founder connection needs owner review. No sending was enabled.");
      const result = await response.json();
      if (action === "start") {
        const target = new URL(result.authorizationUrl);
        if (target.origin !== "https://accounts.google.com" || target.pathname !== "/o/oauth2/v2/auth") throw new Error("Founder consent destination is invalid.");
        setAuthorizationUrl(target.href);
      } else { await status.refetch(); }
      return { ...result, action };
    },
  });
  useEffect(() => { setAuthorizationUrl(null); decision.reset(); }, [currentUser?.uid]);
  return <section className="runway-panel p-5">
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm"
      aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Prepare founder mailbox</button>
    {expanded && <div className="mt-3 space-y-3 text-sm text-runway-body">
      {connection.isLoading && <p>Loading connection preparation…</p>}
      {connection.isError && <p role="alert">Founder connection preparation is unavailable.</p>}
      {connection.data && <>
        <p><strong>{connection.data.account}</strong>: {connection.data.binding.state === "missing"
          ? "separate founder binding is missing" : "separate founder storage is selected; current mailbox access is unverified"}.</p>
        <p>{connection.data.oauth.ownerAction}</p>
        <p>{connection.data.oauth.dataAccess}</p>
        <p>Read access: <code>{connection.data.oauth.initialScopes.join(", ")}</code>.</p>
        <p>Sending later requires separate approval for <code>{connection.data.oauth.sendScopeAfterSeparateApproval}</code>.</p>
        <p>The separate founder binding serves {connection.data.secretDestination.services.join(" and ")}. Existing ops credentials remain separate; no secrets belong in this screen.</p>
        {!status.data?.enabled && <p>OAuth initiation is blocked until the existing client, registered callback, owner identity and secure storage are approved and configured.</p>}
        {status.data?.enabled && <>
          <p>Continue as nijel@tryblueprint.io. Google consent grants read access to mailbox messages/settings. Saving the verified connection stores an encrypted refresh credential privately for Blueprint; it grants no sending authority.</p>
          {!onCallbackHost && <a className="underline" href={PREPARE_URL} referrerPolicy="no-referrer">Continue on tryblueprint.io for founder consent</a>}
          {onCallbackHost && <>
          {status.data.state === "idle" && decision.data?.action !== "complete" && !authorizationUrl && <button type="button" disabled={decision.isPending}
            className="runway-cta-ghost px-3 py-2" onClick={() => decision.mutate("start")}>Prepare Google read-only consent</button>}
          {authorizationUrl && <a className="underline" href={authorizationUrl} referrerPolicy="no-referrer">Continue to Google as founder</a>}
          {status.data.state === "awaiting_owner" && decision.data?.action !== "complete" && <button type="button" disabled={decision.isPending}
            className="runway-cta-ghost px-3 py-2" onClick={() => decision.mutate("complete")}>Verify and save founder read-only connection</button>}
          {decision.data?.action === "complete" && <p>Founder identity and accepted sender were verified at consent. The separate read-only connection is saved; sending remains disabled.</p>}
          {!["idle", "awaiting_owner", "connected_readonly"].includes(status.data.state) && decision.data?.action !== "complete" && <p>Connection status: {status.data.state}. Owner review is required before another connection attempt.</p>}
          </>}
        </>}
        {decision.isError && <p role="alert">Founder connection needs owner review. No sending was enabled.</p>}
        <a className="underline" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Inspect the existing Google OAuth client</a>
      </>}
    </div>}
  </section>;
}
