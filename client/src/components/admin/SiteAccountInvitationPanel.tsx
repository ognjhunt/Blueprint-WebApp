import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";

export function SiteAccountInvitationPanel({ requestId }: { requestId: string }) {
  const { currentUser } = useAuth();
  const [reviewed, setReviewed] = useState(false);
  async function request(method: "GET" | "POST", revoke = false) {
    const response = await fetch(`/api/admin/leads/${requestId}/account-invitation${revoke ? "/revoke" : ""}`, { method, credentials: "include",
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
      ...(method === "POST" ? { body: JSON.stringify({ prerequisitesReviewed: reviewed }) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not check the invitation.");
    return data as { missing?: string[]; invitationUrl?: string; enqueued?: boolean; approved?: boolean };
  }
  const status = useQuery({ queryKey: ["site-account-invitation", requestId], enabled: Boolean(currentUser), queryFn: () => request("GET") });
  const invite = useMutation({ mutationFn: () => request("POST"), onSuccess: () => status.refetch() });
  const revoke = useMutation({ mutationFn: () => request("POST", true), onSuccess: () => { invite.reset(); setReviewed(false); void status.refetch(); } });
  return <section className="border border-runway-line p-4" aria-label="Site account invitation">
    <h3 className="font-semibold">Site account invitation</h3>
    <p className="mt-2 text-sm text-runway-mute">Review the confirmed brief, completed screening, terms, recording consent, and operator authority before approving account access.</p>
    {status.data?.approved && <p className="mt-2 text-sm">This site's account invitation is approved.</p>}
    {status.data?.missing?.length ? <ul className="mt-3 list-disc pl-5 text-sm">{status.data.missing.map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
    <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the prerequisites and approve this site's account invitation.</label>
    <button className="runway-cta-ghost mt-3 px-4 py-2 text-sm" type="button" disabled={!reviewed || !status.data || Boolean(status.data.missing?.length) || invite.isPending} onClick={() => invite.mutate()}>{invite.isPending ? "Saving…" : "Approve and invite site"}</button>
    {status.data?.approved && <button className="runway-cta-ghost ml-2 px-4 py-2 text-sm" type="button" disabled={revoke.isPending || invite.isPending} onClick={() => { if (window.confirm("Revoke this account invitation? All existing invitation links will stop working.")) revoke.mutate(); }}>Revoke invitation</button>}
    {(status.error || invite.error || revoke.error) && <p role="alert" className="mt-3 text-sm">{(invite.error || revoke.error || status.error)?.message}</p>}
    {invite.data?.invitationUrl && <div role="status" className="mt-3 text-sm"><p>Approved. {invite.data.enqueued ? "Invitation email queued." : "The existing invitation email is already queued."} This link is valid for seven days.</p><a className="break-all underline" href={invite.data.invitationUrl}>Open approved account invitation</a></div>}
  </section>;
}
