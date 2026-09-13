import { useEffect, useState } from "react";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

const LABELS: Record<string, string> = {
  "blueprint:runs:read": "View production runs, progress, logs and results",
  "blueprint:runs:prepare": "Prepare runs without renting a GPU",
  "blueprint:runs:launch":
    "Launch and activate runs within their approved budgets",
  "blueprint:runs:release": "Release stopped GPU resources after a run",
};

export default function ConnectChatGPT() {
  const { currentUser, loading } = useAuth();
  const flow = new URLSearchParams(window.location.search).get("flow") || "";
  const [scopes, setScopes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (loading || !currentUser) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!/^[A-Za-z0-9_-]{43}$/.test(flow))
          throw new Error("Start the connection from ChatGPT to continue.");
        const response = await fetch(`/api/blueprint-work/consent/${flow}`, {
          headers: await withFirebaseAuthHeaders(currentUser),
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "Unable to load the connection request.",
          );
        if (!cancelled) setScopes(result.scopes);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Connection unavailable.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, flow, loading]);
  async function decide(allow: boolean) {
    setBusy(true);
    setError("");
    try {
      const csrfResponse = await fetch("/api/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!csrfResponse.ok) throw new Error("Please reload and try again.");
      const csrf = await csrfResponse.json();
      const response = await fetch(`/api/blueprint-work/consent/${flow}`, {
        method: "POST",
        credentials: "same-origin",
        headers: await withFirebaseAuthHeaders(currentUser, {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf.csrfToken,
        }),
        body: JSON.stringify({ allow }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Connection could not be completed.");
      const redirect = new URL(result.redirect_url);
      if (redirect.origin !== "https://chatgpt.com")
        throw new Error("Invalid connection destination.");
      window.location.assign(redirect.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection unavailable.");
      setBusy(false);
    }
  }
  return (
    <AppShell active="settings" breadcrumb="Connect to ChatGPT">
      <section className="ws-form" aria-labelledby="connect-title">
        <h1 id="connect-title" className="text-3xl font-semibold">
          Connect Blueprint to ChatGPT
        </h1>
        <p className="mt-4 ws-muted">
          Give ChatGPT Work access to your Blueprint production-run tools using
          your operator account.
        </p>
        {currentUser && (
          <p className="mt-4 text-sm ws-muted">
            Signed in as {currentUser.email}
          </p>
        )}
        {error && (
          <p role="alert" className="ws-alert">
            {error}
          </p>
        )}
        {!scopes && !error && (
          <p role="status" className="mt-6">
            Loading connection request…
          </p>
        )}
        {scopes && (
          <>
            <ul className="mt-6 space-y-3">
              {scopes.map((scope) => (
                <li key={scope} className="flex gap-3">
                  <span aria-hidden="true">✓</span>
                  {LABELS[scope] || scope}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed ws-muted">
              Run details, logs and results requested through these tools will
              be shared with ChatGPT. Provider credentials remain on Blueprint’s
              servers. Connecting does not approve a run’s spending; each run
              retains its existing budget and execution checks.
            </p>
            <p className="mt-3 text-sm ws-muted">
              You can revoke the connection from ChatGPT’s plugin settings.
              Access expires after 30 days and also ends if your Blueprint
              operator access is removed.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                disabled={busy}
                onClick={() => void decide(true)}
                className="ws-primary"
              >
                {busy ? "Connecting…" : "Connect to ChatGPT"}
              </button>
              <button
                disabled={busy}
                onClick={() => void decide(false)}
                className="ws-secondary"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
