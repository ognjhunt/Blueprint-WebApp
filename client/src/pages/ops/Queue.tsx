import { Helmet } from "@/lib/helmet";
import { AlertOctagon, RefreshCw } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { hasAnyRole } from "@/lib/adminAccess";
import {
  MetricStat,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import {
  alertSeverityTone,
  formatCents,
  selectOpsMetricTiles,
  useOpsSummary,
} from "@/components/blueprint/ops/opsSummary";

/**
 * Queue — OPS CONSOLE landing surface (/ops).
 *
 * R036: this surface is now behind an admin/ops route gate (AdminProtectedRoute)
 * and its headline panels are backed by real Firestore data through the
 * authenticated /api/ops/summary route:
 *   - Headline tiles (open requests, blocked + alerts, payout exceptions, stuck
 *     captures) — live counts from inboundRequests, operatorAlerts (R037),
 *     creatorPayouts, and capture_submissions.
 *   - Operator alerts, payout exceptions, and open-request panels — live rows.
 * Panels that have no real source yet are listed under "Not yet wired" instead
 * of showing fabricated operational state.
 */
export default function Queue() {
  const { currentUser, userData, tokenClaims } = useAuth();
  const isAdmin = hasAnyRole(["admin", "ops"], userData, tokenClaims);
  const summaryQuery = useOpsSummary(currentUser, { enabled: isAdmin });
  const summary = summaryQuery.data;

  const tiles = selectOpsMetricTiles(summary);
  const alerts = summary?.panels.alerts;
  const payouts = summary?.panels.payouts;
  const queue = summary?.panels.queue;
  const notWired = summary?.notWired ?? [];

  return (
    <OpsShell
      active="queue"
      title="Queue"
      sub={
        summary
          ? `blueprint / ops / queue · ${queue?.wired ? queue.open : 0} open requests`
          : "blueprint / ops / queue"
      }
      actions={
        <button
          type="button"
          onClick={() => summaryQuery.refetch()}
          className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 text-body-s font-semibold text-ink-700 transition-colors hover:bg-inset"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${summaryQuery.isFetching ? "animate-spin" : ""}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    >
      <Helmet>
        <title>Queue · Blueprint Ops</title>
        <meta
          name="description"
          content="Internal ops queue — live open requests, operator alerts, and payout exceptions. Admin/ops access only."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-8">
        {summaryQuery.isError && (
          <ProofBoundary level="block" title="Ops data unavailable" icon={AlertOctagon}>
            The operator data route did not respond. Live panels below may be empty.
            {summaryQuery.error instanceof Error ? ` (${summaryQuery.error.message})` : ""}
          </ProofBoundary>
        )}

        {/* Summary tiles — hairline grid */}
        <section
          aria-label="Queue summary"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-white p-5">
              <MetricStat
                label={tile.label}
                value={summaryQuery.isLoading ? "…" : tile.value}
                caption={tile.caption}
                deltaTone={tile.tone}
              />
            </div>
          ))}
        </section>

        {/* Operator alerts — live from operatorAlerts (R037) */}
        <section aria-label="Operator alerts">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-body font-semibold text-ink-900">Operator alerts</h2>
            {alerts?.wired && (
              <span className="font-mono text-[0.7rem] text-ink-500">
                {alerts.unacknowledged} unacknowledged · {alerts.bySeverity.critical} critical
              </span>
            )}
          </div>
          {alerts?.wired ? (
            alerts.recent.length > 0 ? (
              <ul className="divide-y divide-line-soft overflow-hidden rounded-md border border-line bg-white">
                {alerts.recent.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-3 px-4 py-3">
                    <StatusChip tone={alertSeverityTone(alert.severity)} square>
                      {alert.severity}
                    </StatusChip>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-body-s font-semibold text-ink-900">
                        {alert.class}
                      </span>
                      <span className="truncate text-caption text-ink-500">
                        {alert.message}
                      </span>
                    </div>
                    <span className="ml-auto shrink-0 font-mono text-[0.7rem] text-ink-400">
                      {alert.createdAtIso
                        ? new Date(alert.createdAtIso).toLocaleString()
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-line bg-white px-4 py-6 text-center text-body-s text-ink-500">
                No unacknowledged operator alerts.
              </p>
            )
          ) : (
            <NotWiredCard reason="Operator alert feed is not available." />
          )}
        </section>

        {/* Payout exceptions — live from creatorPayouts */}
        <section aria-label="Payout exceptions">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-body font-semibold text-ink-900">Payout exceptions</h2>
            {payouts?.wired && (
              <span className="font-mono text-[0.7rem] text-ink-500">
                {payouts.onHold} on hold · {payouts.failed} failed · {payouts.reviewRequired} review
              </span>
            )}
          </div>
          {payouts?.wired ? (
            payouts.recent.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-line bg-white">
                <table className="w-full min-w-[40rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Payout
                      </th>
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Creator
                      </th>
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.recent.map((payout) => (
                      <tr
                        key={payout.id}
                        className="border-b border-line-soft last:border-b-0"
                      >
                        <td className="px-4 py-3 font-mono text-[13px] text-ink-900">
                          {payout.id}
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] text-ink-700">
                          {payout.creatorId || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip
                            tone={payout.status === "on_hold" ? "warn" : "block"}
                            square
                          >
                            {payout.status}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] text-ink-900">
                          {formatCents(payout.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-line bg-white px-4 py-6 text-center text-body-s text-ink-500">
                No payout exceptions.
              </p>
            )
          ) : (
            <NotWiredCard reason="Creator payout feed is not available." />
          )}
        </section>

        {/* Open requests — live from inboundRequests (no PII surfaced) */}
        <section aria-label="Open requests">
          <h2 className="mb-3 text-body font-semibold text-ink-900">Open requests</h2>
          {queue?.wired ? (
            queue.recent.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-line bg-white">
                <table className="w-full min-w-[44rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Request
                      </th>
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                        Rights
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.recent.map((req) => (
                      <tr
                        key={req.id}
                        className="border-b border-line-soft last:border-b-0 hover:bg-inset"
                      >
                        <td className="px-4 py-3 font-mono text-[13px] text-ink-900">
                          {req.id}
                        </td>
                        <td className="px-4 py-3 text-body-s text-ink-700">
                          {req.status}
                        </td>
                        <td className="px-4 py-3 text-body-s text-ink-700">
                          {req.priority}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip
                            tone={req.rightsStatus === "blocked" ? "block" : "neutral"}
                            square
                          >
                            {req.rightsStatus}
                          </StatusChip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-line bg-white px-4 py-6 text-center text-body-s text-ink-500">
                No open requests in the recent window.
              </p>
            )
          ) : (
            <NotWiredCard reason="Inbound request feed is not available." />
          )}
          <p className="mt-3 font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Live counts from Firestore. Request rows show operational fields only —
            no site names or contact PII are surfaced in the console.
          </p>
        </section>

        {/* Panels without a live source yet — labeled, never faked */}
        {notWired.length > 0 && (
          <section aria-label="Not yet wired">
            <h2 className="mb-3 text-body font-semibold text-ink-900">
              Not yet wired to live data
            </h2>
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
              {notWired.map((panel) => (
                <li key={panel.key} className="flex items-center justify-between bg-white px-4 py-3">
                  <span className="text-body-s text-ink-700">{panel.label}</span>
                  <span className="font-mono text-[0.7rem] uppercase tracking-eyebrow text-ink-400">
                    illustrative
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </OpsShell>
  );
}

function NotWiredCard({ reason }: { reason: string }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-inset px-4 py-6 text-center">
      <p className="text-body-s font-semibold text-ink-700">Not yet wired to live data</p>
      <p className="mt-1 text-caption text-ink-500">{reason}</p>
    </div>
  );
}
