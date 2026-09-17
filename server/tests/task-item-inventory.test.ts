// @vitest-environment node
/**
 * The objects a robot handles, listed and pictured — the pure logic of it.
 *
 * Persistence and the owner/film scope split are exercised at the route level;
 * this covers the parts that are just functions: what we suggest from a
 * description, when an item counts as covered, and where its images land.
 */
import { describe, expect, it } from "vitest";

import {
  MIN_IMAGES_PER_ITEM,
  coverageFor,
  deriveItemInventory,
  presentInventory,
  taskItemImagePath,
  type TaskItem,
} from "../utils/taskItemInventory";

function item(partial: Partial<TaskItem> = {}): TaskItem {
  return {
    itemId: "item_tote",
    label: "Totes",
    locationNote: null,
    quantityHint: null,
    basis: "operator_added",
    images: [],
    assetStatus: "pending",
    assetDetail: null,
    ...partial,
  };
}

function image(id: string) {
  return { imageId: id, storagePath: `scenes/s/items/i/${id}.jpg`, uploadedAtIso: "2026-09-17T00:00:00Z" };
}

describe("we suggest items we can read out of the task, and no more", () => {
  it("proposes known manipulable objects, labelled as suggestions", () => {
    const inv = deriveItemInventory({
      requestId: "req-1",
      taskSummary: "Move sealed cartons from the conveyor into a tote.",
    });
    const labels = inv.items.map((i) => i.label);
    expect(labels).toContain("Cartons");
    expect(labels).toContain("Totes");
    // Fixtures a robot works around, not objects it picks up, are not proposed.
    expect(labels).not.toContain("Conveyors");
    for (const i of inv.items) {
      expect(i.basis).toBe("suggested");
      // We never invent a location or a count we did not see.
      expect(i.locationNote).toBeNull();
      expect(i.quantityHint).toBeNull();
    }
  });

  it("matches whole words and simple plurals, not substrings", () => {
    const inv = deriveItemInventory({ requestId: "r", taskSummary: "Restock boxes on a shelf." });
    expect(inv.items.map((i) => i.label)).toContain("Boxes");

    // "boxed" is a different word and must not propose a box.
    const noMatch = deriveItemInventory({ requestId: "r", taskSummary: "Handle boxed produce." });
    expect(noMatch.items.map((i) => i.label)).not.toContain("Boxes");
  });

  it("returns an empty list when the description names no known objects", () => {
    // An empty result is fine: the operator adds what they actually hold.
    const inv = deriveItemInventory({ requestId: "r", taskSummary: "Inspect the workcell." });
    expect(inv.items).toEqual([]);
  });

  it("does not duplicate an item the description mentions twice", () => {
    const inv = deriveItemInventory({ requestId: "r", taskSummary: "Tote to tote transfer of totes." });
    expect(inv.items.filter((i) => i.label === "Totes")).toHaveLength(1);
  });
});

describe("coverage is ours to judge and separate from the asset", () => {
  it("needs images until it has the minimum, then is covered", () => {
    expect(coverageFor(item({ images: [] })).coverageStatus).toBe("needs_images");
    expect(coverageFor(item({ images: [image("a")] })).imagesStillWanted).toBe(
      MIN_IMAGES_PER_ITEM - 1,
    );
    const covered = coverageFor(item({ images: [image("a"), image("b")] }));
    expect(covered.coverageStatus).toBe("covered");
    expect(covered.imagesStillWanted).toBe(0);
  });

  it("having images never implies a sim-ready asset", () => {
    // Coverage is permission to try; the asset is the Pipeline's to report.
    const covered = item({ images: [image("a"), image("b")], assetStatus: "pending" });
    expect(coverageFor(covered).coverageStatus).toBe("covered");
    expect(covered.assetStatus).toBe("pending");
  });

  it("reports the inventory covered only when every item is", () => {
    const record = {
      requestId: "r",
      updatedAtIso: "2026-09-17T00:00:00Z",
      items: [
        item({ itemId: "a", images: [image("1"), image("2")] }),
        item({ itemId: "b", images: [image("3")] }),
      ],
    };
    expect(presentInventory(record).allItemsCovered).toBe(false);
    record.items[1].images.push(image("4"));
    expect(presentInventory(record).allItemsCovered).toBe(true);
  });

  it("an empty inventory is not 'covered'", () => {
    expect(presentInventory({ requestId: "r", items: [], updatedAtIso: "x" }).allItemsCovered).toBe(
      false,
    );
  });
});

describe("image paths are namespaced and safe", () => {
  it("nests under the scene and the item, and normalizes the extension", () => {
    const path = taskItemImagePath({ sceneId: "site-1", itemId: "item_tote", imageId: "img9", extension: ".JPG" });
    expect(path).toBe("scenes/site-1/items/item_tote/img9.jpg");
  });

  it("strips characters that could climb out of the item folder", () => {
    const path = taskItemImagePath({ sceneId: "site-1", itemId: "../../etc", imageId: "x", extension: "png" });
    expect(path).toBe("scenes/site-1/items/______etc/x.png");
    expect(path).not.toContain("..");
  });
});
