// @vitest-environment node
/** The mirrored robot spec catalog loads, validates, and gives each figure with its source. */
import { describe, expect, it } from "vitest";

import {
  figureSource, figureValue, parseRobotSpecCatalog, robotSpecCatalog, specFigure,
} from "../utils/robotSpecCatalog";

describe("robot spec catalog", () => {
  it("loads every model once, each with a published figure and its source", () => {
    const catalog = robotSpecCatalog();
    expect(robotSpecCatalog()).toBe(catalog);
    expect(catalog.models.length).toBe(22);
    expect(new Set(catalog.models.map((model) => model.manufacturer)).size).toBe(13);
    const ur10e = catalog.models.find((model) => model.model_id === "universal_robots_ur10e")!;
    expect(figureValue(ur10e, "max_reach_m")).toBe(1.3);
    expect(figureValue(ur10e, "rated_payload_kg")).toBe(12.5);
    expect(figureSource(ur10e, "rated_payload_kg")).toMatch(/^https:\/\//);
    expect(specFigure(ur10e, "rated_payload_kg")?.quote).toBeTruthy();
    expect(figureValue(catalog.default_tool, "length_m")).toBeCloseTo(0.1628);
    expect(figureValue(catalog.default_tool, "mass_kg")).toBe(0.9);
  });

  it("keeps a missing or two-number figure unknown", () => {
    const catalog = robotSpecCatalog();
    const fanuc = catalog.models.find((model) => model.model_id === "fanuc_m710ic_45m")!;
    expect(figureValue(fanuc, "max_tcp_speed_m_s")).toBeNull();
    expect(figureSource(fanuc, "max_tcp_speed_m_s")).toBeNull();
    const gofa = catalog.models.find((model) => model.model_id === "abb_gofa_crb15000_5_95")!;
    expect(figureValue(gofa, "base_footprint_l_w_m")).toBeNull();
    expect(figureValue(gofa, "not_a_figure")).toBeNull();
  });

  it("refuses a malformed catalog", () => {
    const catalog = structuredClone(robotSpecCatalog()) as any;
    expect(() => parseRobotSpecCatalog({ ...catalog, schema_version: "other" })).toThrow();
    catalog.models[0].figures.max_reach_m.source_url = "not a url";
    expect(() => parseRobotSpecCatalog(catalog)).toThrow();
    const twice = structuredClone(robotSpecCatalog()) as any;
    twice.models.push(twice.models[0]);
    expect(() => parseRobotSpecCatalog(twice)).toThrow();
  });
});
