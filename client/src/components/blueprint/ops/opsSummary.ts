import { useQuery } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

/**
 * R036: client access to the authenticated operator-console data route.
 *
 * The panels here are backed by real Firestore collections through
 * `GET /api/ops/summary`. Each panel carries a `wired` flag; the server degrades
 * a panel to `{ wired: false }` (rather than fabricating numbers) when its
 * source is unavailable, and lists panels with no real source yet in `notWired`.
 */

export type OpsPanelUnavailable = { wired: false; reason?: string };

export type OpsAlertsPanel =
  | (OpsPanelUnavailable & { wired: false })
  | {
      wired: true;
      total: number;
      unacknowledged: number;
      bySeverity: { critical: number; warning: number; info: number };
      recent: Array<{
        id: string;
        class: string;
        severity: string;
        message: string;
        acknowledged: boolean;
        createdAtIso: string | null;
      }>;
    };

export type OpsQueuePanel =
  | OpsPanelUnavailable
  | {
      wired: true;
      scanned: number;
      open: number;
      blocked: number;
      recent: Array<{
        id: string;
        status: string;
        priority: string;
        rightsStatus: string;
        captureStatus: string;
        createdAtIso: string | null;
      }>;
    };

export type OpsPayoutsPanel =
  | OpsPanelUnavailable
  | {
      wired: true;
      exceptions: number;
      onHold: number;
      failed: number;
      reviewRequired: number;
      ineligible: number;
      recent: Array<{
        id: string;
        creatorId: string;
        status: string;
        amountCents: number;
        failureReason: string | null;
        updatedAtIso: string | null;
      }>;
    };

export type OpsCapturesPanel =
  | OpsPanelUnavailable
  | {
      wired: true;
      scanned: number;
      stuck: number;
      underReview: number;
      needsRecapture: number;
      recent: Array<{
        id: string;
        status: string;
        uploaded: boolean;
        submittedAtIso: string | null;
      }>;
    };

export type OpsOrdersPanel =
  | OpsPanelUnavailable
  | {
      wired: true;
      exceptions: number;
      paymentFailed: number;
      manualReview: number;
      recent: Array<{
        id: string;
        status: string;
        paymentStatus: string;
        fulfillmentStatus: string;
        failureReason: string | null;
      }>;
    };

export type OpsNotWiredPanel = {
  key: string;
  label: string;
  surface: string;
};

export type OpsSummaryResponse = {
  ok: boolean;
  degraded?: boolean;
  generatedAt: string;
  operatorEmail: string | null;
  panels: {
    alerts: OpsAlertsPanel;
    queue: OpsQueuePanel;
    payouts: OpsPayoutsPanel;
    captures: OpsCapturesPanel;
    orders: OpsOrdersPanel;
  };
  notWired: OpsNotWiredPanel[];
};

export async function fetchOpsSummary(
  currentUser: FirebaseUser | null | undefined,
): Promise<OpsSummaryResponse> {
  const response = await fetch("/api/ops/summary", {
    headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to load ops summary (${response.status})`);
  }
  return response.json();
}

export function useOpsSummary(
  currentUser: FirebaseUser | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery<OpsSummaryResponse>({
    queryKey: ["ops-summary"],
    queryFn: () => fetchOpsSummary(currentUser),
    enabled: options.enabled ?? Boolean(currentUser),
    staleTime: 30_000,
  });
}

// --- Pure display selectors (unit-testable, no React / network) ----------------

export type OpsMetricTile = {
  label: string;
  value: string;
  caption: string;
  /** Whether this tile is backed by a live source. */
  wired: boolean;
  /** Signal tone for a delta/emphasis, matching StatusChip tone vocabulary. */
  tone: "proof" | "warn" | "block" | "neutral";
};

const NOT_WIRED_VALUE = "—";

/**
 * Map the summary response into the four headline queue tiles. A panel that is
 * not wired renders a "not yet wired" placeholder rather than a fabricated
 * number — this is what keeps the console honest per the repo's no-fake-state
 * rule.
 */
export function selectOpsMetricTiles(
  summary: OpsSummaryResponse | undefined,
): OpsMetricTile[] {
  const queue = summary?.panels.queue;
  const alerts = summary?.panels.alerts;
  const payouts = summary?.panels.payouts;
  const captures = summary?.panels.captures;

  return [
    {
      label: "Open requests",
      value: queue?.wired ? String(queue.open) : NOT_WIRED_VALUE,
      caption: queue?.wired
        ? "In-flight inbound requests"
        : "Not yet wired to live data",
      wired: Boolean(queue?.wired),
      tone: "neutral",
    },
    {
      label: "Blocked / alerts",
      value: alerts?.wired
        ? String((queue?.wired ? queue.blocked : 0) + alerts.unacknowledged)
        : queue?.wired
          ? String(queue.blocked)
          : NOT_WIRED_VALUE,
      caption:
        alerts?.wired || queue?.wired
          ? "Blocked requests + unacknowledged alerts"
          : "Not yet wired to live data",
      wired: Boolean(alerts?.wired || queue?.wired),
      tone: "block",
    },
    {
      label: "Payout exceptions",
      value: payouts?.wired ? String(payouts.exceptions) : NOT_WIRED_VALUE,
      caption: payouts?.wired
        ? "On hold, failed, or held for review"
        : "Not yet wired to live data",
      wired: Boolean(payouts?.wired),
      tone: "warn",
    },
    {
      label: "Stuck captures",
      value: captures?.wired ? String(captures.stuck) : NOT_WIRED_VALUE,
      caption: captures?.wired
        ? "Upload started, not yet durable"
        : "Not yet wired to live data",
      wired: Boolean(captures?.wired),
      tone: "warn",
    },
  ];
}

export function formatCents(amountCents: number): string {
  const dollars = Math.round(amountCents) / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function alertSeverityTone(
  severity: string,
): "block" | "warn" | "neutral" {
  if (severity === "critical") return "block";
  if (severity === "warning") return "warn";
  return "neutral";
}
