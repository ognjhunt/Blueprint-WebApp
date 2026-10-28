// @vitest-environment jsdom
/** Exercise real Firebase initialization; only credential exchanges are substituted. */
import { expect, it, vi } from "vitest";

const exchanges = vi.hoisted(() => ({ google: vi.fn(), password: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ auth: { currentUser: null, app: { options: {
  apiKey: "synthetic-intake-key", projectId: "synthetic-intake", authDomain: "example.invalid",
} } } }));
vi.mock("firebase/auth", async () => ({
  // Vitest otherwise resolves Firebase's Node entry, whose popup APIs are
  // intentionally unavailable. Exercise the SDK entry Vite ships to browsers.
  ...await import("../../../node_modules/@firebase/auth/dist/esm2017/index.js"),
  signInWithPopup: exchanges.google,
  createUserWithEmailAndPassword: exchanges.password,
}));

import { createDetachedGoogleAccount, createDetachedPasswordAccount } from "@/lib/accountAuth";

it("can open Google sign-in on the same detached, in-memory owner used for password intake", async () => {
  const owner = { uid: "synthetic-owner", email: "owner@example.invalid" };
  exchanges.google.mockResolvedValueOnce({ user: owner });
  exchanges.password.mockResolvedValueOnce({ user: owner });
  expect(await createDetachedGoogleAccount()).toBe(owner);
  expect(await createDetachedPasswordAccount(owner.email, "synthetic-password")).toBe(owner);
  const auth = exchanges.google.mock.calls[0][0];
  await auth._initializationPromise;
  expect(auth.app.name).toBe("site-intake-account");
  // signInWithPopup refuses initializeAuth instances without a popup resolver.
  expect(auth._popupRedirectResolver).toBeTruthy();
  expect(auth.persistenceManager.persistence.type).toBe("NONE");
  expect(exchanges.password.mock.calls[0][0]).toBe(auth);
  expect((await import("@/lib/firebase")).auth.currentUser).toBeNull();
});
