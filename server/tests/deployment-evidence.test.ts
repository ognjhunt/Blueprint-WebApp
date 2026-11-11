// @vitest-environment node
/**
 * Deployment evidence (`deployment_evidence.v2`): a row attaches only to what its source names. Every row
 * applies to catalog models of its own maker, says whether its source names the model or its family, and
 * carries an end customer exactly when its level needs one. A row that breaks a rule is dropped; the rest
 * rank strongest first, a source naming the model before one naming its family.
 */
import { describe, expect, it } from "vitest";

import shippedFile from "../data/deploymentEvidence.v2.json";
import { deploymentEvidence, evidenceFor, evidenceLookup, parseDeploymentEvidence } from "../utils/deploymentEvidence";
import { robotSpecCatalog } from "../utils/robotSpecCatalog";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "ur-pal-1", manufacturer: "Universal Robots", applies_to: ["universal_robots_ur10e"], names: "model", family: null,
  customer: "A named plant", job_family: "palletizing",
  level: "production", summary: "A named plant runs it on palletizing.", quote: "The UR10e palletizes cases around the clock.",
  source_url: "https://example.com/case", source_title: "Case study", publisher: "Example", published_on: "2025-03-01",
  retrieved_on: "2026-11-11", ...overrides,
});
const file = (rows: unknown[]) => ({ schema_version: "deployment_evidence.v2", retrieved_on: "2026-11-11", rows });

describe("the shipped evidence file", () => {
  it("loads with no row rejected", () => {
    const shipped = deploymentEvidence();
    expect(shipped.retrievedOn).toBe("2026-11-11");
    expect(shipped.rejected).toEqual([]);
    expect(shipped.rows).toHaveLength((shippedFile as { rows: unknown[] }).rows.length);
    expect(shipped.rows.length).toBeGreaterThan(0);
  });

  it("keeps every schema rule on every row", () => {
    const catalog = new Map(robotSpecCatalog().models.map((model) => [model.model_id, model]));
    const ids = new Set<string>();
    for (const entry of deploymentEvidence().rows) {
      expect(ids.has(entry.id), entry.id).toBe(false);
      ids.add(entry.id);
      expect(entry.applies_to.length, entry.id).toBeGreaterThan(0);
      for (const id of entry.applies_to) {
        expect(catalog.get(id)?.manufacturer, `${entry.id}: ${id}`).toBe(entry.manufacturer);
      }
      expect(entry.names === "family", entry.id).toBe(entry.family !== null);
      if (entry.level === "production") expect(entry.customer, entry.id).not.toBeNull();
      if (entry.level === "pilot") expect([null, "unnamed"], entry.id).not.toContain(entry.customer);
      if (entry.level === "offered") expect(entry.customer, entry.id).toBeNull();
      expect(entry.source_url, entry.id).toMatch(/^https?:\/\//);
      expect(entry.quote.trim(), entry.id).not.toBe("");
    }
  });

  it("finds rows for a model and kind of job, and nothing for a model no row names", () => {
    const sample = deploymentEvidence().rows[0];
    expect(evidenceFor(sample.applies_to[0], sample.job_family).map((entry) => entry.sourceUrl)).toContain(sample.source_url);
    expect(evidenceFor("no_such_model", sample.job_family)).toEqual([]);
  });
});

describe("parseDeploymentEvidence", () => {
  it("drops a row missing any required field and keeps its siblings", () => {
    const parsed = parseDeploymentEvidence(file([
      row(), row({ id: "a", source_url: undefined }), row({ id: "b", quote: "" }), row({ id: "c", level: "rumour" }),
      row({ id: "d", job_family: undefined }), row({ id: "e", manufacturer: " " }), "junk",
    ]));
    expect(parsed.rows.map((entry) => entry.id)).toEqual(["ur-pal-1"]);
    expect(parsed.rejected.map((entry) => entry.id)).toEqual(["a", "b", "c", "d", "e", null]);
    expect(() => parseDeploymentEvidence({ schema_version: "deployment_evidence.v1", retrieved_on: "2026-11-11", rows: [] })).toThrow();
  });

  it("refuses a maker-wide row, an id outside the catalog, and a model of another maker", () => {
    const parsed = parseDeploymentEvidence(file([
      row({ id: "maker-wide", applies_to: [] }),
      row({ id: "unknown-id", applies_to: ["universal_robots_ur99"] }),
      row({ id: "other-maker", applies_to: ["universal_robots_ur10e", "fanuc_crx_10ia"] }),
      row({ id: "old-shape", applies_to: undefined, model_ids: ["universal_robots_ur10e"] }),
    ]));
    expect(parsed.rows).toEqual([]);
    expect(Object.fromEntries(parsed.rejected.map((entry) => [entry.id, entry.issue]))).toEqual({
      "maker-wide": expect.stringContaining("applies_to"),
      "unknown-id": expect.stringContaining("not in the robot catalog"),
      "other-maker": expect.stringContaining("not Universal Robots"),
      "old-shape": expect.stringContaining("applies_to"),
    });
  });

  it("ties the family to `names`, and the customer to the level", () => {
    const parsed = parseDeploymentEvidence(file([
      row({ id: "family-ok", names: "family", family: "UR e-Series" }),
      row({ id: "family-missing", names: "family", family: null }),
      row({ id: "model-with-family", names: "model", family: "UR e-Series" }),
      row({ id: "production-unnamed", customer: "unnamed" }),
      row({ id: "production-none", customer: null }),
      row({ id: "pilot-named", level: "pilot", customer: "A named plant" }),
      row({ id: "pilot-unnamed", level: "pilot", customer: "unnamed" }),
      row({ id: "pilot-none", level: "pilot", customer: null }),
      row({ id: "offered-ok", level: "offered", customer: null }),
      row({ id: "offered-with-customer", level: "offered", customer: "A named plant" }),
      row({ id: "blank-customer", customer: " " }),
      row({ id: "names-maker", names: "maker" }),
    ]));
    expect(parsed.rows.map((entry) => entry.id)).toEqual(["family-ok", "production-unnamed", "pilot-named", "offered-ok"]);
    expect(parsed.rejected.map((entry) => entry.id)).toEqual(["family-missing", "model-with-family", "production-none",
      "pilot-unnamed", "pilot-none", "offered-with-customer", "blank-customer", "names-maker"]);
  });

  it("keeps the first of two rows with one id", () => {
    const parsed = parseDeploymentEvidence(file([row(), row({ summary: "Another." })]));
    expect(parsed.rows.map((entry) => entry.summary)).toEqual(["A named plant runs it on palletizing."]);
    expect(parsed.rejected).toEqual([{ index: 1, id: "ur-pal-1", issue: "id: repeated" }]);
  });
});

describe("evidenceLookup", () => {
  it("attaches a row only to the models it applies to, strongest first and model before family", () => {
    const { rows, rejected } = parseDeploymentEvidence(file([
      row({ id: "family-prod", names: "family", family: "UR e-Series", applies_to: ["universal_robots_ur10e", "universal_robots_ur5e"] }),
      row({ id: "model-pilot", level: "pilot" }),
      row({ id: "model-prod" }),
      row({ id: "other-job", job_family: "machine_tending" }),
      row({ id: "other-model", applies_to: ["universal_robots_ur5e"] }),
    ]));
    expect(rejected).toEqual([]);
    const lookup = evidenceLookup(rows);
    const found = lookup("universal_robots_ur10e", "palletizing");
    expect(found.map((entry) => [entry.level, entry.scope, entry.family])).toEqual([
      ["production", "model", null], ["production", "family", "UR e-Series"], ["pilot", "model", null]]);
    expect(found[0]).toMatchObject({ sourceUrl: "https://example.com/case", sourceTitle: "Case study", publisher: "Example",
      publishedOn: "2025-03-01" });
    // A row never reaches a model it does not name, not even one of the same maker.
    expect(lookup("universal_robots_ur20", "palletizing")).toEqual([]);
    expect(lookup("universal_robots_ur5e", "palletizing").map((entry) => entry.scope)).toEqual(["model", "family"]);
  });
});
