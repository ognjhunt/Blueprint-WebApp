/**
 * Tells the auth provider when anything has loaded the Firebase client.
 *
 * The provider no longer loads Firebase on every page: a first-time visitor on
 * a marketing page never needs it, and it is the largest download the site
 * has. But a sign-in form, a claim page or a sign-up flow can load it on its
 * own, and the provider has to start listening the moment that happens or a
 * fresh sign-in would never reach the header. This module is tiny and has no
 * dependencies, so the provider can import it eagerly.
 */
let loaded = false;
const listeners = new Set<() => void>();

/** Called once by `@/lib/firebase` when the module evaluates. */
export function markFirebaseClientLoaded() {
  if (loaded) return;
  loaded = true;
  const pending = [...listeners];
  listeners.clear();
  for (const listener of pending) listener();
}

/** Runs `listener` when the client loads, or now if it already has. */
export function onFirebaseClientLoaded(listener: () => void): () => void {
  if (loaded) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam: forget that the client loaded. */
export function resetFirebaseClientLoadedForTests() {
  loaded = false;
  listeners.clear();
}
