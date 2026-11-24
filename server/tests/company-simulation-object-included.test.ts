// @vitest-environment node
/**
 * Round 2 (2026-11-24): the Pipeline may say whether a company's simulation package holds the job's object
 * (`object_included`). It is optional and sealed by the record's digest like every other field; a record without it
 * reads as before.
 */
import { describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));

const { storedCompanySimulation, websiteCompanySimulationSchema } = await import("../utils/websiteCompanySimulation");

const CAPTURE = "walkthrough-job-1";
const record = (change: Record<string, unknown> = {}) => {
  const value = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE, simulation_revision: `sha256:${"a".repeat(64)}`,
    state: "ready", format: "zip_usd_scene_object_success_rule", content_type: "application/zip", digest: `sha256:${"b".repeat(64)}`,
    size_bytes: 1024, files: ["scene.usda", "README.txt"], permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4",
    updated_at_epoch: 1_794_000_000, ...change };
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
};

describe("a company simulation record's object_included", () => {
  it("is read when the Pipeline sends it, sealed by the record's digest", () => {
    expect(storedCompanySimulation({ company_simulation: record({ object_included: false }) }, CAPTURE)?.object_included).toBe(false);
    expect(storedCompanySimulation({ company_simulation: record({ object_included: true }) }, CAPTURE)?.object_included).toBe(true);
    // Changed after sealing: the digest no longer matches, so nothing is served.
    expect(storedCompanySimulation({ company_simulation: { ...record({ object_included: true }), object_included: false } }, CAPTURE)).toBeNull();
  });

  it("is optional, and only a boolean", () => {
    expect(storedCompanySimulation({ company_simulation: record() }, CAPTURE)?.object_included).toBeUndefined();
    expect(websiteCompanySimulationSchema.safeParse(record({ object_included: "no" })).success).toBe(false);
  });
});
