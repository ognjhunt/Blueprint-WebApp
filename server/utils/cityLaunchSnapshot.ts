import {
  listCityLaunchActivations,
  listCityLaunchCandidateSignals,
  listCityLaunchProspects,
  type CityLaunchActivationRecord,
  type CityLaunchCandidateSignalRecord,
  type CityLaunchProspectRecord,
} from "./cityLaunchLedgers";

/**
 * Short-TTL in-process snapshot of the city-shared launch inputs (activations,
 * per-city prospects, under-review candidate signals). These feeds are read on
 * every creator app open; without the snapshot each request fans out one
 * Firestore prospects query per active city. Opportunity data tolerates ~90s
 * staleness, and only city-shared data lives here — never creator-specific
 * state. Errors are captured per source so callers keep their existing
 * partial/unavailable semantics.
 */

const DEFAULT_SNAPSHOT_TTL_MS = 90_000;

export type CityLaunchSnapshot = {
  fetchedAtMs: number;
  activations: CityLaunchActivationRecord[];
  activationsError: unknown;
  prospectsByCitySlug: Map<string, CityLaunchProspectRecord[]>;
  prospectErrorsByCitySlug: Map<string, unknown>;
  candidateSignals: CityLaunchCandidateSignalRecord[];
  candidateSignalsError: unknown;
};

function snapshotTtlMs() {
  const raw = Number(process.env.BLUEPRINT_CITY_LAUNCH_SNAPSHOT_TTL_MS);
  if (Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  // Tests mutate ledger fixtures between calls; default to no caching there.
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return 0;
  }
  return DEFAULT_SNAPSHOT_TTL_MS;
}

let cachedSnapshot: CityLaunchSnapshot | null = null;
let inflightLoad: Promise<CityLaunchSnapshot> | null = null;

async function loadCityLaunchSnapshot(): Promise<CityLaunchSnapshot> {
  let activations: CityLaunchActivationRecord[] = [];
  let activationsError: unknown = null;
  try {
    activations = await listCityLaunchActivations();
  } catch (error) {
    activationsError = error;
  }

  const prospectsByCitySlug = new Map<string, CityLaunchProspectRecord[]>();
  const prospectErrorsByCitySlug = new Map<string, unknown>();
  await Promise.all(
    activations.map(async (activation) => {
      try {
        prospectsByCitySlug.set(
          activation.citySlug,
          await listCityLaunchProspects(activation.city),
        );
      } catch (error) {
        prospectErrorsByCitySlug.set(activation.citySlug, error);
      }
    }),
  );

  let candidateSignals: CityLaunchCandidateSignalRecord[] = [];
  let candidateSignalsError: unknown = null;
  try {
    candidateSignals = await listCityLaunchCandidateSignals({
      statuses: ["queued", "in_review"],
    });
  } catch (error) {
    candidateSignalsError = error;
  }

  return {
    fetchedAtMs: Date.now(),
    activations,
    activationsError,
    prospectsByCitySlug,
    prospectErrorsByCitySlug,
    candidateSignals,
    candidateSignalsError,
  };
}

export async function getCityLaunchSnapshot(): Promise<CityLaunchSnapshot> {
  const ttlMs = snapshotTtlMs();
  if (
    ttlMs > 0
    && cachedSnapshot
    && Date.now() - cachedSnapshot.fetchedAtMs < ttlMs
  ) {
    return cachedSnapshot;
  }
  // Single-flight: concurrent requests during a refresh share one loader.
  if (!inflightLoad) {
    inflightLoad = loadCityLaunchSnapshot()
      .then((snapshot) => {
        cachedSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        inflightLoad = null;
      });
  }
  return inflightLoad;
}

export function __resetCityLaunchSnapshotForTests() {
  cachedSnapshot = null;
  inflightLoad = null;
}
