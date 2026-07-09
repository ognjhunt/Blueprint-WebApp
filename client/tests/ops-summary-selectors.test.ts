import { describe, expect, it } from "vitest";

import {
  alertSeverityTone,
  formatCents,
  selectOpsMetricTiles,
  type OpsSummaryResponse,
} from "@/components/blueprint/ops/opsSummary";

const wiredSummary: OpsSummaryResponse = {
  ok: true,
  generatedAt: "2026-07-09T00:00:00.000Z",
  operatorEmail: "ops@tryblueprint.io",
  panels: {
    alerts: {
      wired: true,
      total: 3,
      unacknowledged: 2,
      bySeverity: { critical: 1, warning: 1, info: 0 },
      recent: [],
    },
    queue: { wired: true, scanned: 10, open: 5, blocked: 1, recent: [] },
    payouts: {
      wired: true,
      exceptions: 3,
      onHold: 2,
      failed: 1,
      reviewRequired: 0,
      ineligible: 0,
      recent: [],
    },
    captures: {
      wired: true,
      scanned: 4,
      stuck: 2,
      underReview: 1,
      needsRecapture: 0,
      recent: [],
    },
    orders: { wired: true, exceptions: 0, paymentFailed: 0, manualReview: 0, recent: [] },
  },
  notWired: [],
};

describe("selectOpsMetricTiles", () => {
  it("maps live Firestore-backed panels into headline tiles", () => {
    const tiles = selectOpsMetricTiles(wiredSummary);
    const byLabel = Object.fromEntries(tiles.map((t) => [t.label, t]));

    expect(byLabel["Open requests"].value).toBe("5");
    expect(byLabel["Open requests"].wired).toBe(true);
    // blocked requests (1) + unacknowledged alerts (2) = 3
    expect(byLabel["Blocked / alerts"].value).toBe("3");
    expect(byLabel["Payout exceptions"].value).toBe("3");
    expect(byLabel["Stuck captures"].value).toBe("2");
  });

  it("labels panels as not wired instead of showing fabricated numbers", () => {
    const tiles = selectOpsMetricTiles(undefined);
    for (const tile of tiles) {
      expect(tile.value).toBe("—");
      expect(tile.wired).toBe(false);
      expect(tile.caption).toBe("Not yet wired to live data");
    }
  });

  it("degrades a single unavailable panel without faking its value", () => {
    const partial: OpsSummaryResponse = {
      ...wiredSummary,
      panels: {
        ...wiredSummary.panels,
        payouts: { wired: false, reason: "query_failed" },
      },
    };
    const tiles = selectOpsMetricTiles(partial);
    const payoutTile = tiles.find((t) => t.label === "Payout exceptions");
    expect(payoutTile?.value).toBe("—");
    expect(payoutTile?.wired).toBe(false);
  });
});

describe("formatCents", () => {
  it("formats integer cents as whole-dollar USD", () => {
    expect(formatCents(15000)).toBe("$150");
    expect(formatCents(6500)).toBe("$65");
    expect(formatCents(0)).toBe("$0");
  });
});

describe("alertSeverityTone", () => {
  it("maps severities to StatusChip tones", () => {
    expect(alertSeverityTone("critical")).toBe("block");
    expect(alertSeverityTone("warning")).toBe("warn");
    expect(alertSeverityTone("info")).toBe("neutral");
  });
});
