/**
 * The objects a robot has to handle, listed and pictured — not just the room.
 *
 * ## Why a room is not enough
 *
 * A walkthrough reconstructs the *scene*: where the conveyor is, how much floor
 * there is, where a pallet sits. That is what a robot stands in. It is not what
 * a robot *picks up*. A manipulation task turns on the objects — the tote, the
 * cartons, the bin, the folded shirts — and each of those needs its own
 * sim-ready asset: geometry, a collision mesh, mass and friction. You cannot
 * grasp a room.
 *
 * And the objects are frequently *not in the shot*. An operator films a clean,
 * clear work area — the honest thing to capture, because it is stable — and
 * says "there is normally a tote here and boxes there". The scene is real; the
 * objects that make it a task are absent. So we ask for them directly: a few
 * example photos of each item, from which the Pipeline builds the sim-ready
 * version and places it back in the scene.
 *
 * ## The same shape as the brief
 *
 * This mirrors `siteTaskBrief`: we *suggest* items we can read out of the task
 * description, the operator *corrects and completes* the list, and the list is
 * theirs. A suggestion is labelled as one (`basis: "suggested"`) so it is never
 * mistaken for a fact the operator stated. Declaring an item is an operating
 * statement about the site and belongs to the owner scope; photographing one is
 * capture and a film-only colleague can do it — the routes enforce that split.
 *
 * ## What this module will not claim
 *
 * Whether a sim-ready asset actually exists for an item is the Pipeline's to
 * report, not ours to infer. `assetStatus` defaults to `pending` and is only
 * ever moved by a Pipeline write. Reading "we have images" as "we have a
 * runnable object" would be the same fabricated-readiness mistake the runnable
 * gate exists to prevent, one level down. Coverage — do we have enough pictures
 * to attempt a reconstruction — is ours to judge, and is kept separate.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

export const TASK_ITEM_INVENTORY_COLLECTION = "siteTaskItemInventories";

/** Enough angles to attempt a reconstruction: front, side, and a close-up. */
export const MIN_IMAGES_PER_ITEM = 2;

/** What we ask for, in words an operator can act on rather than "more views". */
export const REQUESTED_ITEM_SHOTS: readonly string[] = [
  "a clear front view",
  "one from the side",
  "a close-up of any handle, label, opening, or seam",
];

/** How an item came to be on the list. A suggestion is never a stated fact. */
export type ItemBasis =
  /** We read it out of the task description. The operator confirms or removes it. */
  | "suggested"
  /** The operator added it themselves. */
  | "operator_added";

/** Do we have enough pictures to attempt a reconstruction. Ours to judge. */
export type ItemCoverageStatus = "needs_images" | "covered";

/**
 * Whether a sim-ready asset exists for this item. The Pipeline's to report.
 *
 * Never inferred from coverage here: having photos is permission to try, not
 * proof of a result.
 */
export type ItemAssetStatus =
  /** No asset yet. The default, and what every item starts as. */
  | "pending"
  /** A stand-in with estimated geometry/collision, not a faithful build. */
  | "proxy"
  /** A faithful, physics-ready asset the Pipeline has proven. */
  | "sim_ready"
  /** The Pipeline could not build a usable asset from what it was given. */
  | "unsupported";

export interface TaskItemImage {
  imageId: string;
  /** Where the bytes live. Set from the signed token's scene, never a request body. */
  storagePath: string;
  uploadedAtIso: string;
}

export interface TaskItem {
  itemId: string;
  /** What it is, in the operator's words: "Tote", "Cardboard boxes". */
  label: string;
  /** Where it typically sits in the scene: "on the pallet by the conveyor". */
  locationNote: string | null;
  /** How many, roughly: "3–5 at a time". Advisory. */
  quantityHint: string | null;
  basis: ItemBasis;
  images: TaskItemImage[];
  /** Pipeline-owned. Defaults to `pending`; only a Pipeline write moves it. */
  assetStatus: ItemAssetStatus;
  /** Pipeline-owned detail, e.g. why an item is `unsupported`. */
  assetDetail: string | null;
}

export interface TaskItemInventoryRecord {
  requestId: string;
  items: TaskItem[];
  updatedAtIso: string;
}

/** An item with the coverage judgement computed, for a client to render. */
export interface PresentedTaskItem extends TaskItem {
  imageCount: number;
  coverageStatus: ItemCoverageStatus;
  /** How many more images we would like before attempting a reconstruction. */
  imagesStillWanted: number;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * The vocabulary we will suggest from.
 *
 * Deliberately small, common, and manipulable — objects a robot picks, not
 * fixtures it works around. Kept transparent on purpose: a suggestion the
 * operator cannot understand the source of is one they cannot correct. Matching
 * is whole-word, so "carton" in the description proposes "Carton" and "cartons"
 * does too, while "recartoned" does not.
 */
const SUGGESTABLE_ITEM_NOUNS: readonly string[] = [
  "tote", "bin", "box", "carton", "crate", "case", "tray", "pallet",
  "bag", "sack", "pouch", "envelope", "parcel", "package",
  "bottle", "can", "jar", "jug", "cup", "container", "bucket", "basket",
  "shirt", "garment", "towel", "napkin", "cloth", "rag", "glove", "sock",
  "part", "component", "bracket", "clip", "fastener", "bolt", "nut",
  "pipe", "rod", "tube", "plate", "panel", "board", "block", "brick",
  "bowl", "dish", "utensil", "tool", "roll", "sheet", "spool", "reel",
];

/** Turn a matched noun into a label: "carton" -> "Cartons". */
function labelForNoun(noun: string): string {
  const plural = noun.endsWith("s") || noun.endsWith("x") ? `${noun}es` : `${noun}s`;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

/**
 * Read candidate items out of the task description.
 *
 * Conservative by design. It proposes only nouns from a known manipulable-object
 * vocabulary, each labelled `suggested`, and it never fills in a location or a
 * count it did not see — those are the operator's to add. An empty result is a
 * fine result: the operator adds the items themselves, which is the truth of
 * what they hold anyway.
 */
export function deriveItemInventory(params: {
  requestId: string;
  taskSummary: string | null | undefined;
}): TaskItemInventoryRecord {
  const text = String(params.taskSummary ?? "").toLowerCase();
  const seen = new Set<string>();
  const items: TaskItem[] = [];

  for (const noun of SUGGESTABLE_ITEM_NOUNS) {
    if (seen.has(noun)) continue;
    // Whole-word or simple plural, so "box"/"boxes" match and "boxed" does not
    // sneak in as a different word.
    const pattern = new RegExp(`\\b${noun}(?:s|es)?\\b`, "i");
    if (pattern.test(text)) {
      seen.add(noun);
      items.push({
        itemId: `item_${noun}`,
        label: labelForNoun(noun),
        locationNote: null,
        quantityHint: null,
        basis: "suggested",
        images: [],
        assetStatus: "pending",
        assetDetail: null,
      });
    }
  }

  return { requestId: params.requestId, items, updatedAtIso: nowIso() };
}

async function writeInventory(record: TaskItemInventoryRecord): Promise<void> {
  if (!db) return;
  await db
    .collection(TASK_ITEM_INVENTORY_COLLECTION)
    .doc(record.requestId)
    .set(
      { ...record, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: false },
    );
}

/** Persist a whole inventory. Used to seed a derived one, or overwrite. */
export async function saveItemInventory(record: TaskItemInventoryRecord): Promise<void> {
  await writeInventory(record);
}

export async function getItemInventory(
  requestId: string,
): Promise<TaskItemInventoryRecord | null> {
  if (!db) return null;
  const snapshot = await db.collection(TASK_ITEM_INVENTORY_COLLECTION).doc(requestId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Partial<TaskItemInventoryRecord>;
  return {
    requestId,
    items: Array.isArray(data.items) ? data.items.map(normalizeItem) : [],
    updatedAtIso: String(data.updatedAtIso || nowIso()),
  };
}

/** Fill defaults for a stored item, so an older or partial doc reads cleanly. */
function normalizeItem(raw: Partial<TaskItem>): TaskItem {
  return {
    itemId: String(raw.itemId || `item_${Math.random().toString(36).slice(2, 10)}`),
    label: String(raw.label || "Item"),
    locationNote: raw.locationNote ?? null,
    quantityHint: raw.quantityHint ?? null,
    basis: raw.basis === "operator_added" ? "operator_added" : "suggested",
    images: Array.isArray(raw.images) ? raw.images : [],
    // Unknown or absent asset status reads as `pending`. A stored value we do
    // not recognise is not trusted into a readiness claim.
    assetStatus:
      raw.assetStatus === "proxy" ||
      raw.assetStatus === "sim_ready" ||
      raw.assetStatus === "unsupported"
        ? raw.assetStatus
        : "pending",
    assetDetail: raw.assetDetail ?? null,
  };
}

/** Read the inventory, or start an empty one so the first write has somewhere to go. */
async function loadOrEmpty(requestId: string): Promise<TaskItemInventoryRecord> {
  return (
    (await getItemInventory(requestId)) ?? {
      requestId,
      items: [],
      updatedAtIso: nowIso(),
    }
  );
}

/**
 * Add an item, or update the label/location/quantity of an existing one.
 *
 * An operator statement about the site, so the route restricts this to the
 * owner scope. Editing keeps the item's images and its Pipeline-owned
 * `assetStatus` — renaming "Boxes" to "Cartons" does not throw away the photos
 * or reset a build.
 */
export async function upsertItem(
  requestId: string,
  input: {
    itemId?: string;
    label: string;
    locationNote?: string | null;
    quantityHint?: string | null;
  },
): Promise<TaskItemInventoryRecord> {
  const record = await loadOrEmpty(requestId);
  const label = input.label.trim();
  const locationNote = input.locationNote?.trim() || null;
  const quantityHint = input.quantityHint?.trim() || null;

  const existing = input.itemId
    ? record.items.find((item) => item.itemId === input.itemId)
    : undefined;

  if (existing) {
    existing.label = label;
    existing.locationNote = locationNote;
    existing.quantityHint = quantityHint;
    // A suggestion the operator has edited is now theirs.
    existing.basis = "operator_added";
  } else {
    record.items.push({
      itemId: input.itemId?.trim() || `item_${Math.random().toString(36).slice(2, 10)}`,
      label,
      locationNote,
      quantityHint,
      basis: "operator_added",
      images: [],
      assetStatus: "pending",
      assetDetail: null,
    });
  }

  record.updatedAtIso = nowIso();
  await writeInventory(record);
  return record;
}

/** Remove an item and its image references. The bytes are cleaned up separately. */
export async function removeItem(
  requestId: string,
  itemId: string,
): Promise<TaskItemInventoryRecord> {
  const record = await loadOrEmpty(requestId);
  record.items = record.items.filter((item) => item.itemId !== itemId);
  record.updatedAtIso = nowIso();
  await writeInventory(record);
  return record;
}

/**
 * Record that an example image was stored for an item.
 *
 * Called after the bytes land, so the inventory and storage do not disagree
 * about what exists. Returns null when the item is not on the list — an image
 * for an item nobody declared has nowhere to belong.
 */
export async function recordItemImage(
  requestId: string,
  itemId: string,
  image: TaskItemImage,
): Promise<TaskItemInventoryRecord | null> {
  const record = await loadOrEmpty(requestId);
  const item = record.items.find((candidate) => candidate.itemId === itemId);
  if (!item) return null;
  item.images.push(image);
  record.updatedAtIso = nowIso();
  await writeInventory(record);
  return record;
}

/**
 * Where an item's example image lands in storage.
 *
 * Namespaced under the scene and the item, so one item's photos do not collide
 * with another's and none collide with the walkthrough. The scene comes from
 * the signed token, never from a request body.
 */
export function taskItemImagePath(params: {
  sceneId: string;
  itemId: string;
  imageId: string;
  extension: string;
}): string {
  const extension = params.extension.replace(/^\./, "").toLowerCase();
  const safeItem = params.itemId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `scenes/${params.sceneId}/items/${safeItem}/${params.imageId}.${extension}`;
}

/** The coverage judgement for one item. Ours to make; distinct from asset status. */
export function coverageFor(item: TaskItem): {
  imageCount: number;
  coverageStatus: ItemCoverageStatus;
  imagesStillWanted: number;
} {
  const imageCount = item.images.length;
  return {
    imageCount,
    coverageStatus: imageCount >= MIN_IMAGES_PER_ITEM ? "covered" : "needs_images",
    imagesStillWanted: Math.max(0, MIN_IMAGES_PER_ITEM - imageCount),
  };
}

/** The inventory as a client should see it, with coverage computed per item. */
export function presentInventory(record: TaskItemInventoryRecord): {
  requestId: string;
  items: PresentedTaskItem[];
  /** True when every declared item has enough images to attempt a build. */
  allItemsCovered: boolean;
  updatedAtIso: string;
} {
  const items: PresentedTaskItem[] = record.items.map((item) => ({
    ...item,
    ...coverageFor(item),
  }));
  return {
    requestId: record.requestId,
    items,
    allItemsCovered: items.length > 0 && items.every((item) => item.coverageStatus === "covered"),
    updatedAtIso: record.updatedAtIso,
  };
}
