import { randomUUID } from "node:crypto";

export const COMMUNICATIONS_WORKER_LAP_PATH = "blueprintCommunications/default/intakeState/workerLap";
export const COMMUNICATIONS_WORKER_LAP_SCHEMA = "blueprint.communications-worker-lap.v1";
export const COMMUNICATIONS_WORKER_LAP_LEASE_MS = 180_000;
export const COMMUNICATIONS_WORKER_LAP_RENEW_MS = 60_000;
const RESEARCH_CONTROL = "blueprintDailyResearch/sites-first";
type LapCode = "communications_worker_lap_control_invalid" | "communications_worker_lap_record_invalid"
  | "communications_worker_lap_unsettled" | "communications_worker_lap_claim_unavailable"
  | "communications_worker_lap_ownership_changed" | "communications_worker_lap_expired"
  | "communications_worker_lap_renew_unavailable" | "communications_worker_lap_release_unavailable";
export class CommunicationsWorkerLapError extends Error {
  constructor(readonly code: LapCode) { super(code); }
}
function fail(code: LapCode): never { throw new CommunicationsWorkerLapError(code); }
type LapRecord = { schema_version: typeof COMMUNICATIONS_WORKER_LAP_SCHEMA; phase: "active" | "complete";
  lease: { owner: string; generation: number; until: number }; startedAt: number; renewedAt: number; completedAt: number | null };
export type CommunicationsWorkerLap = {
  readonly owner: string; readonly generation: number;
  canContinue: () => boolean;
  renew: () => Promise<void>;
  release: () => Promise<void>;
};

function record(value: FirebaseFirestore.DocumentData | undefined): LapRecord | undefined {
  if (value === undefined) return undefined;
  if (value.phase === "active" || value.phase === "uncertain") {
    // Expiry never proves drainage and cannot authorize a successor.
    if (value.phase === "uncertain") fail("communications_worker_lap_unsettled");
  }
  if (value.schema_version !== COMMUNICATIONS_WORKER_LAP_SCHEMA || !["active", "complete"].includes(value.phase)
    || typeof value.lease?.owner !== "string" || !/^communications-worker-lap:[a-zA-Z0-9-]{1,80}$/.test(value.lease.owner)
    || !Number.isSafeInteger(value.lease.generation) || value.lease.generation < 1
    || !Number.isSafeInteger(value.lease.until) || value.lease.until < 0
    || !Number.isSafeInteger(value.startedAt) || !Number.isSafeInteger(value.renewedAt)
    || (value.phase === "complete" && (value.lease.until !== 0 || !Number.isSafeInteger(value.completedAt)))
    || (value.phase === "active" && value.completedAt !== null)) fail("communications_worker_lap_record_invalid");
  return value as LapRecord;
}

function releaseHeld(value: FirebaseFirestore.DocumentData | undefined, at: number) {
  const lease = value?.lease;
  if (typeof lease?.owner !== "string" || !lease.owner.startsWith("research-release:")) return false;
  if (!Number.isSafeInteger(lease.expires_at_ms)) fail("communications_worker_lap_control_invalid");
  return lease.expires_at_ms > at;
}

/** The canonical read and durable lap write share one transaction. The release
 * owner must read this same lap in its own pre/under-lease idle inventory.
 * Only this document is written; scanner/job leases and controls are untouched. */
export async function claimCommunicationsWorkerLap(db: Pick<FirebaseFirestore.Firestore, "doc" | "runTransaction">,
  now = () => Date.now(), owner = `communications-worker-lap:${randomUUID()}`): Promise<CommunicationsWorkerLap | null> {
  const controlRef = db.doc(RESEARCH_CONTROL), lapRef = db.doc(COMMUNICATIONS_WORKER_LAP_PATH);
  let held: { generation: number; until: number } | null = null;
  try {
    held = await db.runTransaction(async tx => {
      const [control, lap] = await Promise.all([tx.get(controlRef), tx.get(lapRef)]);
      const at = now();
      if (releaseHeld(control.data(), at)) return null;
      const previous = record(lap.data());
      if (previous?.phase === "active") fail("communications_worker_lap_unsettled");
      const generation = (previous?.lease.generation ?? 0) + 1;
      if (!Number.isSafeInteger(generation) || !Number.isSafeInteger(at)
        || !/^communications-worker-lap:[a-zA-Z0-9-]{1,80}$/.test(owner)) fail("communications_worker_lap_record_invalid");
      const until = at + COMMUNICATIONS_WORKER_LAP_LEASE_MS;
      if (!Number.isSafeInteger(until)) fail("communications_worker_lap_record_invalid");
      const active: LapRecord = { schema_version: COMMUNICATIONS_WORKER_LAP_SCHEMA, phase: "active",
        lease: { owner, generation, until }, startedAt: at, renewedAt: at, completedAt: null };
      tx.set(lapRef, active);
      return { generation, until };
    });
  } catch (error) {
    if (error instanceof CommunicationsWorkerLapError) throw error;
    fail("communications_worker_lap_claim_unavailable");
  }
  if (!held) return null;
  const generation = held.generation;
  let until = held.until;
  const own = (current: LapRecord | undefined): LapRecord => {
    if (!current || current.phase !== "active" || current.lease.owner !== owner || current.lease.generation !== generation) {
      fail("communications_worker_lap_ownership_changed");
    }
    return current;
  };
  return Object.freeze({ owner, generation, canContinue: () => until > now(),
    renew: async () => {
      try {
        until = await db.runTransaction(async tx => {
          const [control, lap] = await Promise.all([tx.get(controlRef), tx.get(lapRef)]);
          const at = now(), current = own(record(lap.data()));
          if (!Number.isSafeInteger(at)) fail("communications_worker_lap_record_invalid");
          if (current.lease.until <= at || releaseHeld(control.data(), at)) fail("communications_worker_lap_expired");
          const renewedUntil = at + COMMUNICATIONS_WORKER_LAP_LEASE_MS;
          if (!Number.isSafeInteger(renewedUntil)) fail("communications_worker_lap_record_invalid");
          tx.set(lapRef, { ...current, lease: { ...current.lease, until: renewedUntil }, renewedAt: at });
          return renewedUntil;
        });
      } catch (error) {
        if (error instanceof CommunicationsWorkerLapError) throw error;
        fail("communications_worker_lap_renew_unavailable");
      }
    },
    release: async () => {
      try {
        await db.runTransaction(async tx => {
          const current = own(record((await tx.get(lapRef)).data()));
          const at = now();
          if (!Number.isSafeInteger(at)) fail("communications_worker_lap_record_invalid");
          // Expired own laps can settle after drainage; expiry cannot steal them.
          tx.set(lapRef, { ...current, phase: "complete", lease: { ...current.lease, until: 0 }, completedAt: at });
        });
        until = 0;
      } catch (error) {
        if (error instanceof CommunicationsWorkerLapError) throw error;
        fail("communications_worker_lap_release_unavailable");
      }
    } });
}
