import { readFileSync } from "node:fs";

const fields = ["anon", "file", "kernel", "shmem", "file_mapped", "file_dirty", "file_writeback", "inactive_file", "active_file", "unevictable"] as const;
export function communicationsMemoryCounters(text: string) {
  const values: Record<string, number> = {};
  for (const line of text.trim().split("\n")) {
    const [key, value] = line.trim().split(/\s+/);
    if (!fields.includes(key as any)) continue;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0 || key in values) throw new Error("communications_memory_counters_invalid");
    values[key] = number;
  }
  if (fields.some(key => !(key in values))) throw new Error("communications_memory_counters_incomplete");
  // Diagnostic only: LRU accounting is not a guarantee of bounded reclaim.
  // Neither this estimate nor slab_reclaimable is deducted from memory.current.
  const potentialCleanUnmappedFileCacheBytes = Math.max(0, Math.min(values.file, values.inactive_file + values.active_file)
    - values.shmem - values.file_mapped - values.file_dirty - values.file_writeback - values.unevictable);
  return { ...values, potentialCleanUnmappedFileCacheBytes, certifiedReclaimableBytes: null };
}
export function sampleCommunicationsRecoveryMemory(stage: string) {
  const memory = process.memoryUsage();
  let cgroup: { current: number; limit: number; counters: ReturnType<typeof communicationsMemoryCounters> } | null = null;
  try {
    const current = Number(readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim());
    const limit = Number(readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim());
    if (!Number.isSafeInteger(current) || !Number.isSafeInteger(limit) || current < 0 || limit <= 0) throw new Error();
    cgroup = { current, limit, counters: communicationsMemoryCounters(readFileSync("/sys/fs/cgroup/memory.stat", "utf8")) };
  } catch { /* Unavailable is retained; it cannot authorize a native recovery. */ }
  return { stage, observedAt: new Date().toISOString(), pid: process.pid, rss: memory.rss, heapUsed: memory.heapUsed,
    external: memory.external, processLifetimeMaxRss: process.resourceUsage().maxRSS * 1024, cgroup };
}
export type CommunicationsRecoveryMemorySample = ReturnType<typeof sampleCommunicationsRecoveryMemory>;
export const COMMUNICATIONS_RECOVERY_HEADROOM_BYTES = 24 * 1024 * 1024;
export function assertCommunicationsRecoveryHeadroom(sample: CommunicationsRecoveryMemorySample) {
  if (!sample.cgroup || sample.cgroup.current < sample.rss || sample.rss + COMMUNICATIONS_RECOVERY_HEADROOM_BYTES > sample.cgroup.limit
    || sample.cgroup.current + COMMUNICATIONS_RECOVERY_HEADROOM_BYTES > sample.cgroup.limit) throw new Error("communications_saved_recovery_memory_headroom_unavailable");
}
