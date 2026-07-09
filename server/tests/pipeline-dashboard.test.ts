// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  sceneDashboardSchema,
  type SceneDashboardSummary,
} from "../utils/pipeline-dashboard";

const legacyWholeHomeSummary = {
  schema_version: "v1",
  scene: "scene-1",
  whole_home: {
    capture_id: "cap-1",
    status: "qualified_ready",
    confidence: 0.9,
    memo_path: "/tmp/memo.md",
    memo_uri: "gs://bucket/memo.md",
  },
  categories: {
    pick: {
      counts: { ready: 1, risky: 0, not_ready_yet: 0 },
      tasks: [
        {
          task_text: "Pick a mug from the counter",
          capture_id: "cap-1",
          status: "qualified_ready",
          next_action: "advance to human signoff",
          themes: ["reachability"],
          memo_path: "/tmp/pick.md",
          memo_uri: "gs://bucket/pick.md",
        },
      ],
    },
    open_close: { counts: { ready: 0, risky: 0, not_ready_yet: 0 }, tasks: [] },
    navigate: { counts: { ready: 0, risky: 0, not_ready_yet: 0 }, tasks: [] },
  },
  theme_counts: { reachability: 1 },
  action_counts: { "advance to human signoff": 1 },
  deployment_summary: {
    total_tasks: 1,
    ready_now: 1,
    needs_redesign: 0,
    outside_robot_envelope: 0,
  },
};

const warehouseSummary = {
  schema_version: "v1",
  scene: "warehouse-durham-1",
  site_type: "warehouse",
  site_capture: {
    capture_id: "cap-wh-1",
    status: "qualified_ready",
    confidence: 0.72,
    memo_path: "/tmp/wh-memo.md",
    memo_uri: "gs://bucket/wh-memo.md",
  },
  site_summary: {
    tote_transfer: {
      counts: { ready: 2, risky: 1, not_ready_yet: 0 },
      tasks: [
        {
          task_text: "Transfer tote from conveyor to cart",
          capture_id: "cap-wh-1",
          status: "qualified_ready",
          next_action: "advance to human signoff",
          themes: ["reach_envelope"],
          memo_path: "/tmp/tote.md",
          memo_uri: "gs://bucket/tote.md",
        },
      ],
    },
    palletize: {
      counts: { ready: 0, risky: 1, not_ready_yet: 1 },
      tasks: [
        {
          task_text: "Palletize cartons at end of line",
          capture_id: "cap-wh-2",
          status: "qualified_risky",
          next_action: "recapture",
          themes: ["payload", "cycle_time"],
          memo_path: "/tmp/pallet.md",
          memo_uri: "gs://bucket/pallet.md",
        },
      ],
    },
    line_side_delivery: {
      counts: { ready: 0, risky: 0, not_ready_yet: 0 },
      tasks: [],
    },
    aisle_navigation: {
      counts: { ready: 0, risky: 0, not_ready_yet: 0 },
      tasks: [],
    },
  },
  theme_counts: { reach_envelope: 1, payload: 1, cycle_time: 1 },
  action_counts: { "advance to human signoff": 1, recapture: 1 },
  deployment_summary: {
    total_tasks: 2,
    ready_now: 1,
    needs_redesign: 0,
    outside_robot_envelope: 1,
  },
};

describe("sceneDashboardSchema (R015 generalization)", () => {
  it("still validates and round-trips the legacy whole_home / home-keyed shape", () => {
    const result = sceneDashboardSchema.safeParse(legacyWholeHomeSummary);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Round-trip: parsed data preserves the residential contract exactly.
    expect(result.data).toEqual(legacyWholeHomeSummary);
    expect(result.data.whole_home?.status).toBe("qualified_ready");
    expect(result.data.categories?.pick.tasks[0]?.next_action).toBe(
      "advance to human signoff",
    );
    // Generalized fields are absent on the legacy shape.
    expect(result.data.site_type).toBeUndefined();
    expect(result.data.site_summary).toBeUndefined();
  });

  it("validates and round-trips a warehouse (site_type + industrial task groups) shape", () => {
    const result = sceneDashboardSchema.safeParse(warehouseSummary);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual(warehouseSummary);
    expect(result.data.site_type).toBe("warehouse");
    // Arbitrary, open-ended industrial category ids surface.
    expect(Object.keys(result.data.site_summary ?? {})).toEqual([
      "tote_transfer",
      "palletize",
      "line_side_delivery",
      "aisle_navigation",
    ]);
    expect(result.data.site_summary?.palletize.tasks[0]?.next_action).toBe(
      "recapture",
    );
    expect(result.data.site_capture?.capture_id).toBe("cap-wh-1");
    // The generalized shape carries no home-specific anchor.
    expect(result.data.whole_home).toBeUndefined();
    expect(result.data.categories).toBeUndefined();
  });

  it("accepts a hybrid payload carrying both legacy and generalized taxonomies", () => {
    const hybrid = {
      ...legacyWholeHomeSummary,
      site_type: "mixed_use",
      site_summary: warehouseSummary.site_summary,
    };
    const result = sceneDashboardSchema.safeParse(hybrid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.categories?.pick).toBeDefined();
    expect(result.data.site_summary?.tote_transfer).toBeDefined();
  });

  it("rejects a payload that carries no task taxonomy at all", () => {
    const taxonomyless = {
      schema_version: "v1",
      scene: "scene-1",
      theme_counts: {},
      action_counts: {},
      deployment_summary: {
        total_tasks: 0,
        ready_now: 0,
        needs_redesign: 0,
        outside_robot_envelope: 0,
      },
    };
    const result = sceneDashboardSchema.safeParse(taxonomyless);
    expect(result.success).toBe(false);
  });

  it("rejects the malformed minimal artifact (missing required summary blocks)", () => {
    const result = sceneDashboardSchema.safeParse({
      schema_version: "v1",
      scene: "scene-1",
    });
    expect(result.success).toBe(false);
  });

  it("infers a contract type that accepts a generalized warehouse summary", () => {
    // Compile-time guard: the inferred contract type accepts a site_type +
    // site_summary shape with no home-specific whole_home/categories present.
    const typed: SceneDashboardSummary = {
      schema_version: "v1",
      scene: "warehouse-durham-2",
      site_type: "warehouse",
      site_summary: {
        aisle_navigation: {
          counts: { ready: 1, risky: 0, not_ready_yet: 0 },
          tasks: [
            {
              task_text: "Navigate main receiving aisle",
              capture_id: "cap-wh-3",
              status: "qualified_ready",
              next_action: "advance to human signoff",
              themes: ["traversability"],
              memo_path: "/tmp/aisle.md",
              memo_uri: "gs://bucket/aisle.md",
            },
          ],
        },
      },
      theme_counts: { traversability: 1 },
      action_counts: { "advance to human signoff": 1 },
      deployment_summary: {
        total_tasks: 1,
        ready_now: 1,
        needs_redesign: 0,
        outside_robot_envelope: 0,
      },
    };
    expect(sceneDashboardSchema.safeParse(typed).success).toBe(true);
  });
});
