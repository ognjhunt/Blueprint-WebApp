/**
 * The Firebase auth calls the public account steps need, loaded on demand.
 *
 * The capture and plan pages should not pay for auth until the visitor
 * reaches the one step that uses it, so every call here imports
 * Firebase lazily. Keeping them in one module also gives tests a single seam.
 */
import type { User } from "firebase/auth";

export async function watchAuth(listener: (user: User | null) => void): Promise<() => void> {
  const { auth, onAuthStateChanged } = await import("@/lib/firebase");
  return onAuthStateChanged(auth, listener);
}

export async function currentAuthUser(): Promise<User | null> {
  const { auth } = await import("@/lib/firebase");
  return auth.currentUser;
}

export async function signInWithGoogleAccount(): Promise<User> {
  const { signInWithGoogle } = await import("@/lib/firebase");
  return signInWithGoogle();
}

export async function createPasswordAccount(email: string, password: string): Promise<User> {
  const [{ auth }, { createUserWithEmailAndPassword }] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/auth"),
  ]);
  return (await createUserWithEmailAndPassword(auth, email, password)).user;
}

export async function signInPasswordAccount(email: string, password: string): Promise<User> {
  const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/auth"),
  ]);
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function sendAccountVerification(user: User, continueUrl: string): Promise<void> {
  const { sendEmailVerification } = await import("firebase/auth");
  await sendEmailVerification(user, { url: continueUrl });
}

let detachedAuth: Promise<import("firebase/auth").Auth> | null = null;
/**
 * Creates a password account without signing this page in.
 *
 * The start form keys its draft and in-flight upload to the signed-in account,
 * so a sign-in mid-submit would remount it and drop the selected video. A
 * second, in-memory auth instance holds the new account for the submission
 * that creates it; the site signs in normally afterwards.
 */
export async function createDetachedPasswordAccount(email: string, password: string): Promise<User> {
  detachedAuth ??= (async () => {
    const [{ auth }, { getApps, initializeApp }, { initializeAuth, inMemoryPersistence }] = await Promise.all([
      import("@/lib/firebase"),
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    const app = getApps().find(existing => existing.name === "site-intake-account")
      ?? initializeApp(auth.app.options, "site-intake-account");
    return initializeAuth(app, { persistence: inMemoryPersistence });
  })().catch((error) => { detachedAuth = null; throw error; });
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  return (await createUserWithEmailAndPassword(await detachedAuth, email, password)).user;
}

/** The account created above, for retrying its own job while this page stays open. */
export async function detachedAccountUser(): Promise<User | null> {
  return detachedAuth ? (await detachedAuth.catch(() => null))?.currentUser ?? null : null;
}
