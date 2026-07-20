// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CREATED_AT_SHARD_COUNT,
  deriveCreatedAtShard,
} from "../utils/captureShard";

describe("deriveCreatedAtShard", () => {
  it("pins the canonical shard count", () => {
    expect(CREATED_AT_SHARD_COUNT).toBe(16);
  });

  it("is deterministic for the same capture id", () => {
    expect(deriveCreatedAtShard("capture-abc-123")).toBe(
      deriveCreatedAtShard("capture-abc-123"),
    );
  });

  it("matches the pinned cross-language reference derivation", () => {
    // Reference values from
    // int(hashlib.sha256(capture_id.encode()).hexdigest(), 16) % 16 — the
    // derivation documented in BlueprintCapturePipeline's
    // BETA_CAPACITY_COST_STORAGE_MODEL doc. These must never change: a stored
    // createdAtShard is only useful if readers/backfills derive the same value.
    expect(deriveCreatedAtShard("cap-1")).toBe(10);
    expect(deriveCreatedAtShard("capture-abc-123")).toBe(10);
    expect(deriveCreatedAtShard("scene-9/capture-77")).toBe(7);
    expect(deriveCreatedAtShard("CAP-1")).toBe(9);
  });

  it("always lands in [0, shardCount)", () => {
    for (let i = 0; i < 200; i += 1) {
      const shard = deriveCreatedAtShard(`capture-${i}`);
      expect(Number.isInteger(shard)).toBe(true);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(CREATED_AT_SHARD_COUNT);
    }
  });

  it("supports explicit shard counts and rejects invalid ones", () => {
    expect(deriveCreatedAtShard("cap-1", 1)).toBe(0);
    const shard = deriveCreatedAtShard("cap-1", 32);
    expect(shard).toBeGreaterThanOrEqual(0);
    expect(shard).toBeLessThan(32);
    expect(() => deriveCreatedAtShard("cap-1", 0)).toThrow();
    expect(() => deriveCreatedAtShard("cap-1", 2.5)).toThrow();
  });
});
