// @vitest-environment node
/** The mirrored robot spec catalog loads, validates, and gives each figure with its source. */
import { describe, expect, it } from "vitest";

import {
  BODY_TYPES, HAND_HEIGHT_FIGURES, figureSource, figureValue, parseRobotSpecCatalog, robotSpecCatalog, specFigure,
} from "../utils/robotSpecCatalog";

describe("robot spec catalog", () => {
  it("loads every model once, each with a published figure and its source", () => {
    const catalog = robotSpecCatalog();
    expect(robotSpecCatalog()).toBe(catalog);
    expect(catalog.models.length).toBe(33);
    expect(new Set(catalog.models.map((model) => model.manufacturer)).size).toBe(21);
    const ur10e = catalog.models.find((model) => model.model_id === "universal_robots_ur10e")!;
    expect(figureValue(ur10e, "max_reach_m")).toBe(1.3);
    expect(figureValue(ur10e, "rated_payload_kg")).toBe(12.5);
    expect(figureSource(ur10e, "rated_payload_kg")).toMatch(/^https:\/\//);
    expect(specFigure(ur10e, "rated_payload_kg")?.quote).toBeTruthy();
    expect(figureValue(catalog.default_tool, "length_m")).toBeCloseTo(0.1628);
    expect(figureValue(catalog.default_tool, "mass_kg")).toBe(0.9);
  });

  it("accepts a wheeled humanoid and the hand heights above the floor, the lowest of which may be the floor", () => {
    const catalog = robotSpecCatalog();
    expect(new Set(catalog.models.map((model) => model.body_type))).toEqual(new Set(BODY_TYPES));
    const vega = catalog.models.find((model) => model.model_id === "dexmate_vega_1_pro")!;
    expect(vega.body_type).toBe("wheeled_humanoid");
    expect(figureValue(vega, HAND_HEIGHT_FIGURES.max)).toBe(2.2);
    expect(figureValue(vega, HAND_HEIGHT_FIGURES.min)).toBe(0);
    // A fixed arm leaves them out; a robot that moves without published heights keeps them unknown.
    expect(figureValue(catalog.models[0], HAND_HEIGHT_FIGURES.max)).toBeNull();
    const tiago = catalog.models.find((model) => model.model_id === "pal_robotics_tiago")!;
    expect(specFigure(tiago, HAND_HEIGHT_FIGURES.max)).toBeNull();
    expect(tiago.unknown_figures?.[HAND_HEIGHT_FIGURES.max]).toBeTruthy();
    expect(() => parseRobotSpecCatalog({ ...catalog, models: [{ ...vega, body_type: "rolling_humanoid" }] })).toThrow();
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
