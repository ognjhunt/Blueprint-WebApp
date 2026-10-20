import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { COMPANY } from "@/data/company";
import type { AccountDeletionRequest } from "@/types/accountDeletion";

export default function AccountDeletion() {
  const { currentUser } = useAuth();
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const queryKey = ["account-deletion", currentUser?.uid];
  const query = useQuery({
    queryKey, enabled: Boolean(currentUser), retry: false,
    queryFn: async () => {
      const response = await fetch("/api/account-deletion", { credentials: "include", cache: "no-store",
        headers: await withFirebaseAuthHeaders(currentUser) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load your privacy request. Please try again.");
      return body as { request: AccountDeletionRequest | null };
    },
  });
  const passwordSignIn = currentUser?.providerData?.some(provider => provider.providerId === "password");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !currentUser || confirmation !== "DELETE") return;
    lock.current = true; setPending(true); setError("");
    try {
      const token = await currentUser.getIdTokenResult(true);
      const age = Date.now() - Date.parse(token.authTime);
      if (!Number.isFinite(age) || age > 4 * 60 * 1000 || age < -60_000) {
        const { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } = await import("firebase/auth");
        if (passwordSignIn && currentUser.email) {
          if (!password) throw new Error("Enter your current password to confirm this request.");
          await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, password));
        } else if (currentUser.providerData?.some(provider => provider.providerId === "google.com")) {
          await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
        } else {
          throw new Error("Sign out and sign in again, then return to account privacy settings to confirm this request.");
        }
        await currentUser.getIdToken(true);
      }
      const response = await fetch("/api/account-deletion", {
        method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ confirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your request could not be confirmed. Please try again.");
      client.setQueryData(queryKey, { request: body.request });
      setConfirmation("");
    } catch (cause) {
      const firebaseError = typeof (cause as { code?: unknown })?.code === "string" && String((cause as { code: string }).code).startsWith("auth/");
      setError(firebaseError ? "Sign-in confirmation did not finish. Check your password or complete the Google sign-in window, then try again."
        : cause instanceof Error ? cause.message : "Could not confirm your request. Please try again.");
    } finally { setPassword(""); setPending(false); lock.current = false; }
  }

  return <section className="ws-section" aria-labelledby="account-deletion-heading">
    <h2 id="account-deletion-heading">Delete my account and data</h2>
    <p className="ws-muted">Request closure of your Blueprint account and deletion of your personal data. We review linked jobs, shared recordings, provider copies and any legal retention requirements before processing the request.</p>
    <p className="ws-note">Submitting this request does not immediately close your account or erase recordings. You can keep checking its status here. We will confirm what was deleted and explain any information we must retain. <Link href="/privacy" className="ws-link">Read the privacy policy</Link>.</p>
    {!currentUser ? <Link className="ws-link" href="/sign-in?redirect=%2Fsettings%3Fprivacy%3D1">Sign in to request deletion →</Link> : query.isLoading ? <p role="status">Loading privacy request…</p>
      : query.error ? <div role="alert"><p>{query.error.message}</p><button type="button" className="ws-link" onClick={() => query.refetch()}>Try again</button></div>
      : query.data?.request ? <div className="ws-section" role="status">
        <h3>{query.data.request.status === "in_review" ? "Request under review" : "Deletion requested"}</h3>
        <p>{query.data.request.message}</p>
        <p className="ws-note">Reference: <span className="break-all">{query.data.request.id}</span></p>
        <p className="ws-note">Received {new Date(query.data.request.requestedAtIso).toLocaleString()}</p>
        <button type="button" className="ws-link" disabled={query.isFetching} onClick={() => query.refetch()}>Refresh status</button>
      </div> : <form className="ws-form ws-section" onSubmit={submit}>
        <label>Type DELETE to confirm the request<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={pending} /></label>
        {passwordSignIn ? <label>Current password, if you signed in more than a few minutes ago<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={pending} /></label> : <p className="ws-note">We may ask you to confirm your sign-in before accepting the request.</p>}
        {error ? <p role="alert">{error}</p> : null}
        <div className="ws-form-actions"><button type="submit" className="ws-primary" disabled={pending || confirmation !== "DELETE"}>{pending ? "Submitting request…" : "Request account and data deletion"}</button></div>
      </form>}
    <p className="ws-note">If you cannot sign in or need to update a request, email <a className="ws-link" href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a>. Include your request reference if you have one; do not send your password.</p>
  </section>;
}
