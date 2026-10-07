// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const config = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, config.firestore.indexes), "utf8"));

describe("qualification daily action limit's deployed Firestore index", () => {
  it("supports the observed lane equality, status in and created_at range query", () => {
    // countTodayAutoSends in action-executor.ts failed with Firestore code 9 in
    // production. The server requested precisely this COLLECTION composite.
    // __name__ ASCENDING is implicit because created_at is ASCENDING.
    expect(manifest.indexes).toContainEqual({
      collectionGroup: "action_ledger",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "lane", order: "ASCENDING" },
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "created_at", order: "ASCENDING" },
      ],
    });
  });
});
