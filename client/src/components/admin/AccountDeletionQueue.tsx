import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import type { AccountDeletionQueueItem } from "@/types/accountDeletion";

/** The privacy review queue, on the admin job list. Mounted when staff open it, so it reads only then. */
export function AccountDeletionQueue() {
  const { currentUser } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["admin-account-deletion", currentUser?.uid], enabled: Boolean(currentUser), retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const response = await fetch(`/api/account-deletion/admin${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`, {
        credentials: "include", cache: "no-store", headers: await withFirebaseAuthHeaders(currentUser),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load privacy requests.");
      return body as { requests: AccountDeletionQueueItem[]; nextCursor: string | null };
    },
    getNextPageParam: page => page.nextCursor,
  });
  async function begin(id: string) {
    if (pending) return;
    setPending(id); setError("");
    try {
      const response = await fetch(`/api/account-deletion/admin/${id}/review`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })), body: "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not start review.");
      await query.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start review."); }
    finally { setPending(null); }
  }
  return <section aria-label="Account and data deletion requests" className="admin-job-tool">
    <p className="bare-helper">Starting a review records who is accountable; it does not delete data. Follow docs/runbooks/account-data-deletion.md, keep the evidence of what was done and confirm the outcome with the person who asked.</p>
    {query.isLoading ? <p className="bare-helper" role="status">Loading privacy requests…</p> : null}
    {query.error || error ? <p className="bare-notice" role="alert">{error || query.error?.message}</p> : null}
    {query.data?.pages.flatMap(page => page.requests).length ? <ul className="admin-job-list">
      {query.data.pages.flatMap(page => page.requests).map(request => <li key={request.id}>
        <strong>{request.accountEmail || "Email not recorded"}</strong>
        <span className="bare-helper"> Received {new Date(request.requestedAtIso).toLocaleString()}. {request.status === "in_review" ? `Under review by ${request.reviewerUid}.` : "Waiting for review."} Request {request.id}, account {request.accountUid}.</span>
        {request.status === "requested" ? <> <button type="button" className="bare-quiet-button" disabled={Boolean(pending)} onClick={() => void begin(request.id)}>{pending === request.id ? "Saving…" : "Start privacy review"}</button></> : null}
      </li>)}
    </ul> : null}
    {query.data && query.data.pages.every(page => page.requests.length === 0) ? <p>No deletion requests recorded.</p> : null}
    {query.hasNextPage ? <button type="button" className="bare-quiet-button" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Show more privacy requests</button> : null}
    {query.data || query.error ? <button type="button" className="bare-quiet-button" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh privacy requests</button> : null}
  </section>;
}
