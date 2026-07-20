// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * SCALE2-07: the round-1 `createdAtShard` write on `creatorCaptures`
 * (server/routes/creator.ts + utils/captureShard.ts) is only useful if this
 * repo — the owner of the webapp Firestore database's index manifest —
 * actually declares the sharded composite indexes readers will fan out
 * through. Round 1 shipped the write but the matching composites lived (as
 * phantoms) in BlueprintCapturePipeline Terraform against a nonexistent
 * `captures` collection. These assertions keep the real indexes pinned here.
 */

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };
type IndexEntry = { collectionGroup: string; queryScope: string; fields: IndexField[] };

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "firestore.indexes.json"), "utf8"),
) as { indexes: IndexEntry[] };

function hasIndex(collection: string, fields: Array<[string, string]>): boolean {
  return manifest.indexes.some(
    (index) =>
      index.collectionGroup === collection &&
      index.fields.length === fields.length &&
      index.fields.every(
        (field, i) => field.fieldPath === fields[i][0] && field.order === fields[i][1],
      ),
  );
}

describe("firestore.indexes.json creatorCaptures shard composites", () => {
  it("keeps the base creator_id + created_at composite", () => {
    expect(
      hasIndex("creatorCaptures", [
        ["creator_id", "ASCENDING"],
        ["created_at", "DESCENDING"],
      ]),
    ).toBe(true);
  });

  it("declares the per-creator sharded composite (creator_id + createdAtShard + created_at)", () => {
    expect(
      hasIndex("creatorCaptures", [
        ["creator_id", "ASCENDING"],
        ["createdAtShard", "ASCENDING"],
        ["created_at", "DESCENDING"],
      ]),
    ).toBe(true);
  });

  it("declares the status-scan sharded composite (status + createdAtShard + created_at)", () => {
    expect(
      hasIndex("creatorCaptures", [
        ["status", "ASCENDING"],
        ["createdAtShard", "ASCENDING"],
        ["created_at", "ASCENDING"],
      ]),
    ).toBe(true);
  });

  it("declares no indexes for a literal `captures` collection (nothing writes one)", () => {
    expect(manifest.indexes.filter((index) => index.collectionGroup === "captures")).toEqual([]);
  });
});
