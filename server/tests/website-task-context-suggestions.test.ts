import { expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { countsTowardTask, projectWebsiteTaskContext } from "../utils/websiteTaskContext";

// SYNTHETIC: the dishwasher brief that read "dishes" and seeded a suggestion on the job page's first item read.
const brief = { requestId: "one", summary: "Open and close a dishwasher door. The video does not demonstrate loading dishes.",
  confirmedAtIso: null, operatorAnswers: {}, operatorUnknown: [], unresolved: [] } as any;
const item = (overrides: Record<string, unknown> = {}) => ({ itemId: "item_dish", label: "Dishs", locationNote: null,
  quantityHint: null, basis: "suggested", images: [], assetStatus: "pending", assetDetail: null, ...overrides }) as any;
const inventory = (items: any[]) => ({ requestId: "one", items, updatedAtIso: "2026-10-12T20:35:08.000Z" });
const photo = { imageId: "img-1", storagePath: "scenes/site-one/items/item_dish/img-1.jpg", uploadedAtIso: "2026-10-12T20:40:00.000Z" };

it("a suggestion seeded mid-run does not redefine the task a preparation grant is bound to", () => {
  const atGrant = projectWebsiteTaskContext(brief, undefined, { purpose: "scene_preparation" });
  const seeded = projectWebsiteTaskContext(brief, undefined, { purpose: "scene_preparation", inventory: inventory([item()]) });
  expect(seeded.context_digest).toBe(atGrant.context_digest);
  expect(seeded).not.toHaveProperty("task_items");
  expect(projectWebsiteTaskContext(brief, undefined, { purpose: "scene_preparation", inventory: inventory([]) }).context_digest)
    .toBe(atGrant.context_digest);
});

it("owner photos or an operator-added item make an item part of the task", () => {
  expect(countsTowardTask(item())).toBe(false);
  expect(countsTowardTask(item({ images: [photo] }))).toBe(true);
  expect(countsTowardTask(item({ basis: "operator_added" }))).toBe(true);
  const photographed = projectWebsiteTaskContext(brief, undefined, { inventory: inventory([item({ images: [photo] })]) }) as any;
  expect(photographed.task_items.map((row: any) => row.item_id)).toEqual(["item_dish"]);
  const mixed = projectWebsiteTaskContext(brief, undefined, { inventory: inventory([
    item({ itemId: "item_tote", label: "Tote", basis: "operator_added" }), item()]) }) as any;
  expect(mixed.task_items.map((row: any) => row.item_id)).toEqual(["item_tote"]);
});
