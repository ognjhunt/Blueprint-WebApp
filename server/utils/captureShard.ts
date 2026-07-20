import { createHash } from "node:crypto";

/**
 * Firestore createdAt hotspot guard: capture records carry a deterministic
 * `createdAtShard` so high-volume createdAt queries can route through the
 * sharded composite indexes on `creatorCaptures` declared in this repo's
 * firestore.indexes.json (creator_id+createdAtShard+created_at and
 * status+createdAtShard+created_at) instead of a monotonically increasing
 * createdAt index. (Round 1 mistakenly pointed here at pipeline Terraform
 * indexes on a `captures` collection nothing writes; those are removed.)
 *
 * Neither the Terraform indexes nor the capacity docs pinned a shard count, so
 * 16 is the canonical choice — pinned alongside the derivation in
 * BlueprintCapturePipeline/docs/BETA_CAPACITY_COST_STORAGE_MODEL_2026-07-08.md
 * ("Firestore CreatedAt Hotspot Guard"). Keep both in sync if this changes.
 */
export const CREATED_AT_SHARD_COUNT = 16;

/**
 * Deterministic shard for a capture id: sha256(capture_id) mod shardCount.
 *
 * Matches the cross-language reference derivation
 * `int(hashlib.sha256(capture_id.encode()).hexdigest(), 16) % shard_count`
 * exactly (full-digest big-integer modulo), so any backfill or reader written
 * in Python produces identical shard values.
 */
export function deriveCreatedAtShard(
  captureId: string,
  shardCount: number = CREATED_AT_SHARD_COUNT,
): number {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error(`Invalid createdAtShard shard count: ${shardCount}`);
  }
  const digestHex = createHash("sha256").update(captureId, "utf8").digest("hex");
  return Number(BigInt(`0x${digestHex}`) % BigInt(shardCount));
}
