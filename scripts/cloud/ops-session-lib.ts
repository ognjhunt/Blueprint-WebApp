/**
 * Helpers for scripts/cloud/ops-session.ts, tested in ops-session-lib.test.ts.
 *
 * Everything here is pure except writeSecretFile. No error thrown here ever
 * carries a token: messages name what is wrong, never the value.
 */
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const OPS_SITE_ORIGIN = "https://tryblueprint.io";
export const FIREBASE_APP_NAME = "[DEFAULT]";
// Firebase JS SDK v9+ indexedDBLocalPersistence layout.
export const FIREBASE_IDB_DATABASE = "firebaseLocalStorageDb";
export const FIREBASE_IDB_VERSION = 1;
export const FIREBASE_IDB_STORE = "firebaseLocalStorage";
export const FIREBASE_IDB_KEY_PATH = "fbase_key";

const FIREBASE_API_KEY = /AIza[0-9A-Za-z_-]{35}/;
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

// --- ops account allowlist ----------------------------------------------

/** BLUEPRINT_CLOUD_OPS_EMAIL: comma-separated, trimmed, lowercased, deduplicated. */
export function parseEmailAllowlist(raw: string | undefined): string[] {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(entries)];
}

export function defaultOpsEmail(raw: string | undefined): string {
  const [first] = parseEmailAllowlist(raw);
  if (!first) throw new Error("BLUEPRINT_CLOUD_OPS_EMAIL is not set; refusing to mint an ops session");
  return first;
}

/**
 * Returns the normalized email when it exactly matches (ignoring case) an
 * allowlist entry; refuses everything else, including an empty allowlist.
 */
export function assertAllowedEmail(email: string, raw: string | undefined): string {
  const allowlist = parseEmailAllowlist(raw);
  if (allowlist.length === 0) {
    throw new Error("BLUEPRINT_CLOUD_OPS_EMAIL is not set; refusing to mint an ops session");
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || !allowlist.includes(normalized)) {
    throw new Error(`refusing to mint a session for ${email.trim() || "(empty email)"}: not in BLUEPRINT_CLOUD_OPS_EMAIL`);
  }
  return normalized;
}

// --- web API key discovery ---------------------------------------------

export function findFirebaseApiKey(text: string): string | null {
  return FIREBASE_API_KEY.exec(text)?.[0] ?? null;
}

function sameOrigin(candidate: string, base: string): string | null {
  try {
    const url = new URL(candidate, base);
    return url.origin === new URL(base).origin && url.protocol.startsWith("http") ? url.toString() : null;
  } catch {
    return null;
  }
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
}

/** Same-origin module scripts and modulepreload links of a page, in order. */
export function extractScriptUrls(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    const src = attribute(tag, "src");
    if (src && /\btype\s*=\s*["']?module\b/i.test(tag)) urls.push(src);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const href = attribute(tag, "href");
    if (href && /\brel\s*=\s*["']?modulepreload\b/i.test(tag)) urls.push(href);
  }
  const resolved = urls.map((url) => sameOrigin(url, pageUrl)).filter((url): url is string => url !== null);
  return [...new Set(resolved)];
}

/**
 * JavaScript chunk URLs referenced by a Vite bundle: `./x.js` and `../x.js`
 * resolve against the script, `/assets/x.js` against the origin, and the
 * base-relative `assets/x.js` entries of Vite's preload map against the
 * origin root. Same-origin only.
 */
export function extractChunkUrls(js: string, scriptUrl: string): string[] {
  const origin = new URL(scriptUrl).origin;
  const urls: string[] = [];
  for (const match of js.matchAll(/["'`]((?:\.{1,2}\/|\/?assets\/)[\w@./-]*?\.js)["'`]/g)) {
    const reference = match[1];
    const base = reference.startsWith(".") ? scriptUrl : `${origin}/`;
    const url = sameOrigin(reference, base);
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

// --- session material ----------------------------------------------------

/** Milliseconds since the epoch when a token with `expiresIn` seconds expires. */
export function computeExpirationTime(nowMs: number, expiresIn: string | number): number {
  const seconds = typeof expiresIn === "number" ? expiresIn : Number(String(expiresIn).trim());
  if (!Number.isFinite(nowMs) || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("expiresIn must be a positive number of seconds");
  }
  return nowMs + seconds * 1000;
}

export type SignInResult = { idToken: string; refreshToken: string; expiresIn: string };

/** Validates an Identity Toolkit accounts:signInWithCustomToken response body. */
export function parseSignInResponse(body: unknown): SignInResult {
  if (!body || typeof body !== "object") throw new Error("signInWithCustomToken returned no JSON object");
  const { idToken, refreshToken, expiresIn } = body as Record<string, unknown>;
  if (typeof idToken !== "string" || !idToken) throw new Error("signInWithCustomToken response has no idToken");
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new Error("signInWithCustomToken response has no refreshToken");
  }
  if (typeof expiresIn !== "string" && typeof expiresIn !== "number") {
    throw new Error("signInWithCustomToken response has no expiresIn");
  }
  computeExpirationTime(0, expiresIn);
  return { idToken, refreshToken, expiresIn: String(expiresIn) };
}

/** Replaces every given secret, and anything shaped like a JWT, with a marker. */
export function redactSecrets(text: string, secrets: Array<string | undefined | null>): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) result = result.split(secret).join("<redacted>");
  }
  return result.replace(JWT_SHAPE, "<redacted-jwt>");
}

/** A readable failure for a non-2xx Identity Toolkit response. */
export function describeIdentityToolkitError(status: number, body: unknown, secrets: string[] = []): string {
  const error = (body as { error?: { message?: unknown } } | null)?.error;
  const code = typeof error?.message === "string" ? error.message : "no error message";
  return redactSecrets(`signInWithCustomToken failed: HTTP ${status} ${code}`.slice(0, 300), secrets);
}

export type PersistedUserInput = {
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
  apiKey: string;
  idToken: string;
  refreshToken: string;
  expirationTime: number;
  createdAt?: string | number | null;
  lastLoginAt?: string | number | null;
};

/** What the Firebase JS SDK stores for a signed-in user (UserImpl.toJSON). */
export type PersistedFirebaseUser = {
  uid: string;
  email?: string;
  emailVerified: boolean;
  isAnonymous: false;
  providerData: never[];
  stsTokenManager: { refreshToken: string; accessToken: string; expirationTime: number };
  createdAt?: string;
  lastLoginAt?: string;
  apiKey: string;
  appName: string;
};

// The SDK rejects a persisted user whose createdAt/lastLoginAt are not strings.
const epochMsString = (value: string | number | null | undefined): string | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const ms = typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : Date.parse(value);
  return Number.isFinite(ms) ? String(Math.trunc(ms)) : undefined;
};

export function buildPersistedUser(input: PersistedUserInput): PersistedFirebaseUser {
  if (typeof input.uid !== "string" || !input.uid) throw new Error("uid is required");
  if (!findFirebaseApiKey(input.apiKey ?? "")) throw new Error("apiKey is not a Firebase web API key");
  if (typeof input.idToken !== "string" || !input.idToken) throw new Error("idToken is required");
  if (typeof input.refreshToken !== "string" || !input.refreshToken) throw new Error("refreshToken is required");
  if (!Number.isFinite(input.expirationTime) || input.expirationTime <= 0) {
    throw new Error("expirationTime must be milliseconds since the epoch");
  }
  return {
    uid: input.uid,
    ...(input.email ? { email: input.email } : {}),
    emailVerified: Boolean(input.emailVerified),
    isAnonymous: false,
    providerData: [],
    stsTokenManager: {
      refreshToken: input.refreshToken,
      accessToken: input.idToken,
      expirationTime: input.expirationTime,
    },
    createdAt: epochMsString(input.createdAt),
    lastLoginAt: epochMsString(input.lastLoginAt),
    apiKey: input.apiKey,
    appName: FIREBASE_APP_NAME,
  };
}

export function firebaseAuthUserKey(apiKey: string, appName = FIREBASE_APP_NAME): string {
  return `firebase:authUser:${apiKey}:${appName}`;
}

type IndexedDbRecord = { key?: unknown; value?: unknown };

/** The Playwright (>= 1.51) storage-state shape, including IndexedDB. */
export type OpsStorageState = {
  cookies: never[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
    indexedDB: Array<{
      name: string;
      version: number;
      stores: Array<{
        name: string;
        autoIncrement: boolean;
        keyPath?: string;
        records: IndexedDbRecord[];
        indexes: never[];
      }>;
    }>;
  }>;
};

/**
 * A Playwright storage state that signs the Firebase JS SDK in as `user` on
 * `origin`: the user sits in the SDK's IndexedDB store (its default
 * persistence) and, under the same key, in localStorage (the persistence the
 * WebApp switches to). The store uses an inline key path, so records carry no
 * separate key.
 */
export function buildStorageState(input: {
  origin: string;
  apiKey: string;
  user: PersistedFirebaseUser;
}): OpsStorageState {
  let origin: string;
  try {
    const url = new URL(input.origin);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) throw new Error("scheme");
    origin = url.origin;
  } catch {
    throw new Error("origin must be an https:// origin (or a loopback http:// origin)");
  }
  if (!findFirebaseApiKey(input.apiKey ?? "")) throw new Error("apiKey is not a Firebase web API key");
  if (!input.user || input.user.apiKey !== input.apiKey || input.user.appName !== FIREBASE_APP_NAME) {
    throw new Error("user was not built for this apiKey and the default Firebase app");
  }
  const key = firebaseAuthUserKey(input.apiKey);
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [{ name: key, value: JSON.stringify(input.user) }],
        indexedDB: [
          {
            name: FIREBASE_IDB_DATABASE,
            version: FIREBASE_IDB_VERSION,
            stores: [
              {
                name: FIREBASE_IDB_STORE,
                autoIncrement: false,
                keyPath: FIREBASE_IDB_KEY_PATH,
                records: [{ value: { [FIREBASE_IDB_KEY_PATH]: key, value: input.user } }],
                indexes: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Atomically writes a credential file with mode 0600 inside a 0700
 * directory (created when missing).
 */
export async function writeSecretFile(filePath: string, contents: string): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  const handle = await fs.open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
  try {
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
