// @vitest-environment node
/** Deployment evidence: rows without a source, quote, level, job family or maker are dropped; the rest rank strongest first. */
import { describe, expect, it } from "vitest";

import { deploymentEvidence, evidenceFor, evidenceLookup, parseDeploymentEvidence } from "../utils/deploymentEvidence";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "ur-pal-1", manufacturer: "Universal Robots", model_ids: ["universal_robots_ur10e"], job_family: "palletizing",
  level: "production", summary: "A named plant runs it on palletizing.", quote: "The UR10e palletizes cases around the clock.",
  source_url: "https://example.com/case", source_title: "Case study", publisher: "Example", published_on: "2025-03-01",
  retrieved_on: "2026-11-11", ...overrides,
});

describe("deployment evidence", () => {
  it("ships a valid file", () => {
    const shipped = deploymentEvidence();
    expect(shipped.retrievedOn).toBe("2026-11-11");
    expect(shipped.rejected).toEqual([]);
    expect(evidenceFor("universal_robots_ur10e", "Universal Robots", "fixed_arm", "palletizing")).toEqual(
      shipped.rows.length ? expect.any(Array) : []);
  });

  it("drops a row missing any required field and keeps its siblings", () => {
    const parsed = parseDeploymentEvidence({ schema_version: "deployment_evidence.v1", retrieved_on: "2026-11-11", rows: [
      row(), row({ id: "a", source_url: undefined }), row({ id: "b", quote: "" }), row({ id: "c", level: "rumour" }),
      row({ id: "d", job_family: undefined }), row({ id: "e", manufacturer: " " }), "junk",
    ] });
    expect(parsed.rows.map((entry) => entry.id)).toEqual(["ur-pal-1"]);
    expect(parsed.rejected.map((entry) => entry.id)).toEqual(["a", "b", "c", "d", "e", null]);
    expect(() => parseDeploymentEvidence({ schema_version: "v0", rows: [] })).toThrow();
  });

  it("matches model rows to that model and maker rows to the maker, strongest and model-named first", () => {
    const { rows } = parseDeploymentEvidence({ schema_version: "deployment_evidence.v1", retrieved_on: "2026-11-11", rows: [
      row({ id: "maker-prod", model_ids: [] }),
      row({ id: "model-pilot", level: "pilot" }),
      row({ id: "model-prod" }),
      row({ id: "other-family", job_family: "machine_tending" }),
      row({ id: "other-model", model_ids: ["universal_robots_ur5e"] }),
      row({ id: "maker-mobile", model_ids: [], body_type: "mobile_manipulator", level: "offered" }),
    ] });
    const lookup = evidenceLookup(rows);
    const found = lookup("universal_robots_ur10e", "universal robots", "fixed_arm", "palletizing");
    expect(found.map((entry) => [entry.level, entry.scope, entry.summary !== ""])).toEqual([
      ["production", "model", true], ["production", "maker", true], ["pilot", "model", true]]);
    expect(found[0]).toMatchObject({ sourceUrl: "https://example.com/case", sourceTitle: "Case study", publisher: "Example",
      publishedOn: "2025-03-01" });
    expect(lookup("universal_robots_ur10e", "FANUC", "fixed_arm", "palletizing")).toEqual([]);
  });
});
