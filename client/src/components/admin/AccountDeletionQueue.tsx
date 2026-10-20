import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import type { AccountDeletionQueueItem } from "@/types/accountDeletion";

export function AccountDeletionQueue() {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["admin-account-deletion", currentUser?.uid], enabled: open && Boolean(currentUser), retry: false,
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
  return <details className="runway-panel mt-8 p-5" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-semibold text-runway-text">Account and data deletion requests</summary>
    <p className="mt-3 text-sm text-runway-mute">Privacy review queue. Starting a review records the accountable operator; it does not delete data. Follow docs/runbooks/account-data-deletion.md, retain execution evidence and confirm the outcome with the requester.</p>
    {query.isLoading && open ? <p role="status">Loading privacy requests…</p> : null}
    {query.error || error ? <p role="alert">{error || query.error?.message}</p> : null}
    {query.data?.pages.flatMap(page => page.requests).map(request => <article key={request.id} className="mt-4 border-t border-runway-line pt-4 text-sm">
      <h3 className="font-semibold text-runway-text">{request.accountEmail || "Email not recorded"}</h3>
      <p className="break-all text-runway-mute">{request.id} · Account {request.accountUid}</p>
      <p className="text-runway-mute">Received {new Date(request.requestedAtIso).toLocaleString()} · {request.status === "in_review" ? `Under review by ${request.reviewerUid}` : "Awaiting review"}</p>
      {request.status === "requested" ? <button type="button" className="mt-2 underline" disabled={Boolean(pending)} onClick={() => void begin(request.id)}>{pending === request.id ? "Saving…" : "Start privacy review"}</button> : null}
    </article>)}
    {query.data && query.data.pages.every(page => page.requests.length === 0) ? <p className="mt-3">No deletion requests recorded.</p> : null}
    {query.hasNextPage ? <button type="button" className="mt-3 underline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more privacy requests</button> : null}
    {query.data || query.error ? <button type="button" className="ml-4 mt-3 underline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh privacy requests</button> : null}
  </details>;
}
