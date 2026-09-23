/**
 * A first-time visitor on a marketing page never downloads Firebase, and a
 * page that loads it on its own still gets a live auth listener.
 */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMock = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(() => () => {}),
  firebasePersistence: vi.fn(async () => {}),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/pricing", vi.fn()] }));
vi.mock("@/lib/firebase", () => ({
  auth: {},
  browserLocalPersistence: {},
  firebasePersistence: firebaseMock.firebasePersistence,
  onAuthStateChanged: firebaseMock.onAuthStateChanged,
  getUserData: vi.fn(async () => null),
}));

import { AuthProvider } from "@/contexts/AuthContext";
import { markFirebaseClientLoaded, resetFirebaseClientLoadedForTests } from "@/lib/firebaseLoadSignal";

const databases = vi.fn(async () => [] as Array<{ name?: string }>);

beforeEach(() => {
  resetFirebaseClientLoadedForTests();
  firebaseMock.onAuthStateChanged.mockClear();
  firebaseMock.firebasePersistence.mockClear();
  databases.mockReset().mockResolvedValue([]);
  vi.stubGlobal("indexedDB", { databases });
  vi.stubGlobal("requestIdleCallback", (task: () => void) => setTimeout(task, 0));
  vi.stubGlobal("cancelIdleCallback", (id: number) => clearTimeout(id));
  window.localStorage.clear();
});

afterEach(() => {
  // Unmount while the idle-callback stubs still exist.
  cleanup();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("AuthProvider on a public page", () => {
  it("does not load Firebase for a browser with no session", async () => {
    render(<AuthProvider><p>page</p></AuthProvider>);
    await settle();

    expect(databases).toHaveBeenCalled();
    expect(firebaseMock.onAuthStateChanged).not.toHaveBeenCalled();
    expect(firebaseMock.firebasePersistence).not.toHaveBeenCalled();
  });

  it("starts listening as soon as another page loads the client", async () => {
    render(<AuthProvider><p>page</p></AuthProvider>);
    await settle();

    act(() => markFirebaseClientLoaded());

    await waitFor(() => expect(firebaseMock.onAuthStateChanged).toHaveBeenCalledTimes(1));
    expect(firebaseMock.firebasePersistence).toHaveBeenCalledTimes(1);
  });

  it("loads Firebase after page load when the browser holds a session", async () => {
    databases.mockResolvedValue([{ name: "firebaseLocalStorageDb" }]);
    render(<AuthProvider><p>page</p></AuthProvider>);

    await waitFor(() => expect(firebaseMock.onAuthStateChanged).toHaveBeenCalledTimes(1));
  });
});
