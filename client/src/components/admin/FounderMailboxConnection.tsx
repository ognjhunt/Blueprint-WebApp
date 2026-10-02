import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
type ConsentStatus = { enabled: boolean; state: string; sendsEnabled: false; failureStage?: string;
  purpose?: "send_upgrade" | "draft_upgrade"; sendScopeGranted?: boolean; sendUpgradeAvailable?: boolean; draftScopeGranted?: boolean; draftUpgradeAvailable?: boolean };
type ConsentAction = "start" | "complete" | "send-upgrade/start" | "send-upgrade/complete" | "draft-upgrade/start" | "draft-upgrade/complete";
const FAILURE_STEP_LABELS: Record<string, string> = {
  secret_open: "opening the protected consent attempt", token_exchange: "Google token exchange",
  token_validation: "scope grant validation", mailbox_verification: "founder mailbox and sender verification",
  owner_recheck: "owner authorization recheck", storage_readiness: "private storage readiness",
  credential_persistence: "saving the private founder connection", connection_acknowledgement: "confirming the saved connection",
};

/** Explicit owner actions only. No token/secret input or automatic grant/save. */
export function FounderMailboxConnection() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
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
    mutationFn: async (action: ConsentAction) => {
      if (window.location.origin !== CALLBACK_ORIGIN) throw new Error("Continue on the founder callback host first.");
      const response = await fetch(`${OAUTH_PREFIX}/${action}`, { method: "POST", body: "{}",
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" })),
      });
      if (!response.ok) throw new Error("Founder connection needs owner review. No sending was enabled.");
      const result = await response.json();
      if (action.endsWith("start")) {
        const target = new URL(result.authorizationUrl);
        if (target.origin !== "https://accounts.google.com" || target.pathname !== "/o/oauth2/v2/auth") throw new Error("Founder consent destination is invalid.");
        setAuthorizationUrl(target.href);
      } else { await status.refetch(); }
      return { ...result, action };
    },
    onSuccess: async result => {
      if (result.action.endsWith("complete")) await queryClient.invalidateQueries({ queryKey: ["admin-action-queue", currentUser?.uid] });
    },
    onError: async () => { setAuthorizationUrl(null); await status.refetch(); },
  });
  const completed = decision.data?.action.endsWith("complete");
  const completeFailed = decision.isError && decision.variables?.endsWith("complete");
  const failureStep = status.data?.failureStage && Object.hasOwn(FAILURE_STEP_LABELS, status.data.failureStage)
    ? FAILURE_STEP_LABELS[status.data.failureStage] : undefined;
  const savedConnection = !status.isError && ["connected_readonly", "connected_send_capable", "connected_draft_capable"].includes(status.data?.state ?? "");
  useEffect(() => { setAuthorizationUrl(null); decision.reset(); }, [currentUser?.uid]);
  return <section className="runway-panel p-5">
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm"
      aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Prepare founder mailbox</button>
    {expanded && <div className="mt-3 space-y-3 text-sm text-runway-body">
      {connection.isLoading && <p>Loading connection preparation…</p>}
      {connection.isError && <p role="alert">Founder connection preparation is unavailable.</p>}
      {status.isError && <p role="alert">Founder consent status is unavailable. Owner review is required before another connection attempt.</p>}
      {connection.data && <>
        {savedConnection ? <p><strong>{connection.data.account}</strong>: {status.data?.draftScopeGranted
          ? "Founder Gmail is connected with saved draft access" : "Founder Gmail connection is saved"}.</p> : <p><strong>{connection.data.account}</strong>: {connection.data.binding.state === "missing"
          ? "separate founder binding is missing" : "separate founder storage is selected; current mailbox access is unverified"}.</p>
        }
        {!savedConnection && <p>{connection.data.oauth.ownerAction}</p>}
        <p>{connection.data.oauth.dataAccess}</p>
        <p>Read access: <code>{connection.data.oauth.initialScopes.join(", ")}</code>.</p>
        <p>Sending later requires separate approval for <code>{connection.data.oauth.sendScopeAfterSeparateApproval}</code>.</p>
        <p>The separate founder binding serves {connection.data.secretDestination.services.join(" and ")}. Existing ops credentials remain separate; no secrets belong in this screen.</p>
        {!status.data?.enabled && <p>OAuth initiation is blocked until the existing client, registered callback, owner identity and secure storage are approved and configured.</p>}
        {status.data?.enabled && <>
          <p>Continue as nijel@tryblueprint.io. Initial Google consent grants read access to mailbox messages/settings. A separate send upgrade adds Gmail send access only after explicit owner consent. Verified refresh credentials are stored encrypted and privately for Blueprint; message policy remains separate.</p>
          {!onCallbackHost && <a className="underline" href={PREPARE_URL} referrerPolicy="no-referrer">Continue on tryblueprint.io for founder consent</a>}
          {onCallbackHost && <>
          {status.data.state === "idle" && !completeFailed && !status.isError && !completed && !authorizationUrl && <button type="button" disabled={decision.isPending}
            className="runway-cta-ghost px-3 py-2" onClick={() => decision.mutate("start")}>Prepare Google read-only consent</button>}
          {authorizationUrl && <a className="underline" href={authorizationUrl} referrerPolicy="no-referrer">Continue to Google as founder</a>}
          {status.data.state === "awaiting_owner" && !completeFailed && !status.isError && !completed && <button type="button" disabled={decision.isPending}
            className="runway-cta-ghost px-3 py-2" onClick={() => decision.mutate(status.data.purpose === "draft_upgrade" ? "draft-upgrade/complete" : status.data.purpose === "send_upgrade" ? "send-upgrade/complete" : "complete")}>{status.data.purpose === "draft_upgrade" ? "Verify and save founder draft-capability upgrade" : status.data.purpose === "send_upgrade"
              ? "Verify and save founder send-capability upgrade" : "Verify and save founder read-only connection"}</button>}
          {decision.data?.action === "complete" && <p>Founder identity and accepted sender were verified at consent. The separate read-only connection is saved; sending remains disabled.</p>}
          {status.data.sendUpgradeAvailable && <p>The saved read-only binding remains in place until an explicitly consented send-capability upgrade is verified and saved. The upgrade requests only gmail.readonly and gmail.send. Outbound policy and runtime controls still apply.</p>}
          {status.data.sendUpgradeAvailable && status.data.state === "connected_readonly" && !completeFailed && !status.isError && !authorizationUrl && <button type="button" disabled={decision.isPending}
            className="runway-cta-ghost px-3 py-2" onClick={() => decision.mutate("send-upgrade/start")}>Prepare Google send-capability consent</button>}
          {(status.data.sendScopeGranted || decision.data?.action === "send-upgrade/complete") && <p>The founder read-and-send scope grant is saved. This does not authorize a message by itself; outbound policy, suppression and duplicate-send controls remain enforced.</p>}
          {!status.data.draftScopeGranted && <p>Gmail draft access needs separate approved compose consent. Google's compose scope also permits sending; Blueprint keeps sending separately controlled.</p>}
          {status.data.draftUpgradeAvailable && ["connected_readonly","connected_send_capable"].includes(status.data.state) && !completeFailed && !status.isError && !authorizationUrl && <button type="button" disabled={decision.isPending}
            className="runway-cta-ghost px-3 py-2" onClick={() => decision.mutate("draft-upgrade/start")}>Prepare Google draft-capability consent</button>}
          {(status.data.draftScopeGranted || decision.data?.action === "draft-upgrade/complete") && <p>The founder compose grant is saved. Use Save to Gmail Drafts on the approved saved revision in Approvals. Sending review checkboxes apply only to sending.</p>}
          {!["idle", "awaiting_owner", "connected_readonly", "connected_send_capable", "connected_draft_capable"].includes(status.data.state) && !completed && <p>Connection status: {status.data.state}. Owner review is required before another connection attempt.</p>}
          </>}
        </>}
        {(completeFailed || status.data?.state === "failed_requires_new_owner_consent") && <p role="alert">This connection attempt failed and cannot be retried. Owner review and new Google consent are required. No sending was enabled.{failureStep ? ` Failed step: ${failureStep}.` : ""}</p>}
        {decision.isError && !completeFailed && <p role="alert">Founder connection needs owner review. No sending was enabled.</p>}
        <a className="underline" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Inspect the existing Google OAuth client</a>
      </>}
    </div>}
  </section>;
}
