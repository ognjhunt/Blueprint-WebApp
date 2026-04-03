const EXPERIMENT_ASSIGNMENTS_KEY = "bp.experiment.assignments";
const ANALYTICS_ANONYMOUS_ID_KEY = "bp.analytics.anonymousId";
const EXPERIMENT_OVERRIDES_KEY = "bp.experiment.overrides";

let overridesPromise: Promise<Record<string, string>> | null = null;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAssignments(): Record<string, string> {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(EXPERIMENT_ASSIGNMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAssignments(assignments: Record<string, string>) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(EXPERIMENT_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch {
    // Ignore write failures in private browsing or blocked storage environments.
  }
}

function readOverrides(): Record<string, string> {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(EXPERIMENT_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, string>) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(EXPERIMENT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage failures.
  }
}

function hashValue(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getOrCreateExperimentAnonymousId() {
  if (!canUseStorage()) return "server";

  const existing = window.localStorage.getItem(ANALYTICS_ANONYMOUS_ID_KEY);
  if (existing && existing.trim()) {
    return existing;
  }

  const next =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(ANALYTICS_ANONYMOUS_ID_KEY, next);
  return next;
}

export function assignExperimentVariant(
  experimentKey: string,
  variants: readonly string[],
) {
  const normalizedVariants = variants.filter(Boolean);
  if (normalizedVariants.length === 0) {
    throw new Error(`Experiment ${experimentKey} must provide at least one variant.`);
  }

  const stored = readAssignments();
  if (stored[experimentKey] && normalizedVariants.includes(stored[experimentKey])) {
    return stored[experimentKey];
  }

  const anonymousId = getOrCreateExperimentAnonymousId();
  const slot = hashValue(`${experimentKey}:${anonymousId}`) % normalizedVariants.length;
  const selected = normalizedVariants[slot];

  stored[experimentKey] = selected;
  writeAssignments(stored);
  return selected;
}

export async function fetchExperimentOverrides() {
  if (typeof window === "undefined") {
    return {};
  }

  if (!overridesPromise) {
    overridesPromise = fetch("/api/experiments/assignments")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch experiment overrides");
        }
        const json = (await response.json()) as {
          assignments?: Record<string, string>;
        };
        const assignments =
          json.assignments && typeof json.assignments === "object"
            ? json.assignments
            : {};
        writeOverrides(assignments);
        return assignments;
      })
      .catch(() => readOverrides());
  }

  return overridesPromise;
}

export async function resolveExperimentVariant(
  experimentKey: string,
  variants: readonly string[],
) {
  const overrides = await fetchExperimentOverrides();
  const override = overrides[experimentKey];
  if (override && variants.includes(override)) {
    const assignments = readAssignments();
    assignments[experimentKey] = override;
    writeAssignments(assignments);
    return override;
  }

  return assignExperimentVariant(experimentKey, variants);
}

export function getActiveExperimentAssignments() {
  return readAssignments();
}
