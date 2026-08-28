import { formatEventTime } from "./model";
import type { ShipBroadcastApprovalQueueResponse } from "./types";

type ShipBroadcastApprovalQueueQuery = {
  isLoading: boolean;
  isError: boolean;
  data?: ShipBroadcastApprovalQueueResponse;
  refetch: () => unknown;
};

type ApproveMutation = {
  isPending: boolean;
  mutate: (ledgerId: string) => void;
};

type RejectMutation = {
  isPending: boolean;
  mutate: (payload: { ledgerId: string; reason: string }) => void;
};

type ShipBroadcastApprovalQueuePanelProps = {
  query: ShipBroadcastApprovalQueueQuery;
  approveMutation: ApproveMutation;
  rejectMutation: RejectMutation;
  rejectReasons: Record<string, string>;
  onRejectReasonChange: (ledgerId: string, reason: string) => void;
};

export function ShipBroadcastApprovalQueuePanel({
  query,
  approveMutation,
  rejectMutation,
  rejectReasons,
  onRejectReasonChange,
}: ShipBroadcastApprovalQueuePanelProps) {
  return (
    <div className="mt-4 rounded-none border border-runway-line bg-paper-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-runway-faint">
            Ship-broadcast approval queue
          </p>
          <p className="mt-1 text-sm text-runway-mute">
            Fresh SendGrid ship-broadcast drafts already queued for human approval.
          </p>
          <p className="mt-1 text-xs leading-5 text-runway-faint">
            Approving a queued item can dispatch through the configured delivery provider;
            rejecting keeps the item parked with a durable reason.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="rounded-full border border-runway-line px-3 py-1 text-xs text-runway-line-strong"
        >
          Refresh
        </button>
      </div>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-runway-faint">Loading approval queue...</p>
      ) : query.isError ? (
        <p className="mt-4 text-sm text-rose-700">Failed to load ship-broadcast approval queue.</p>
      ) : query.data?.items?.length ? (
        <div className="mt-4 space-y-3">
          {query.data.items.map((item) => (
            <div key={item.id} className="rounded-none border border-runway-line bg-runway-line-soft p-4 text-sm text-runway-line-strong">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-runway-black">{item.name}</p>
                  <p className="mt-1 text-xs text-runway-faint">{item.subject}</p>
                </div>
                <div className="text-right text-xs text-runway-faint">
                  <p>Status: {item.sendStatus}</p>
                  <p>Recipients: {item.recipientCount}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-runway-faint sm:grid-cols-2">
                <p>Created: {formatEventTime(item.createdAt)}</p>
                <p>Ledger: {item.lastLedgerDocId || "none"}</p>
                <p>Asset key: {item.assetKey || "none"}</p>
                <p>Source issues: {item.sourceIssueIds.length ? item.sourceIssueIds.join(", ") : "none"}</p>
              </div>
              {item.lastLedgerDocId ? (
                <div className="mt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => approveMutation.mutate(item.lastLedgerDocId!)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="rounded-full border border-runway-deep bg-runway-deep px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approveMutation.isPending ? "Approving..." : "Approve and Send"}
                    </button>
                    <input
                      type="text"
                      value={rejectReasons[item.lastLedgerDocId] || ""}
                      onChange={(event) => onRejectReasonChange(item.lastLedgerDocId!, event.target.value)}
                      placeholder="Required reject reason"
                      className="min-w-[220px] rounded-full border border-runway-line px-3 py-1 text-xs text-runway-line-strong"
                      aria-label={`Reject reason for ${item.id}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        rejectMutation.mutate({
                          ledgerId: item.lastLedgerDocId!,
                          reason: (rejectReasons[item.lastLedgerDocId!] || "").trim(),
                        })}
                      disabled={
                        approveMutation.isPending
                        || rejectMutation.isPending
                        || !(rejectReasons[item.lastLedgerDocId!] || "").trim()
                      }
                      className="rounded-full border border-rose-300 bg-paper-0 px-3 py-1 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                </div>
              ) : null}
              {item.proofLinks.length ? (
                <div className="mt-3 text-xs text-runway-mute">
                  <p className="font-medium text-runway-panel">Proof links</p>
                  {item.proofLinks.slice(0, 2).map((link) => (
                    <p key={link} className="truncate">{link}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-runway-faint">No ship-broadcast drafts are currently waiting approval.</p>
      )}
    </div>
  );
}
