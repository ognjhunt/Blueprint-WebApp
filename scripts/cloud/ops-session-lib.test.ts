// @vitest-environment node
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAllowedEmail,
  buildPersistedUser,
  buildStorageState,
  computeExpirationTime,
  defaultOpsEmail,
  describeIdentityToolkitError,
  extractChunkUrls,
  extractScriptUrls,
  findFirebaseApiKey,
  firebaseAuthUserKey,
  parseEmailAllowlist,
  parseSignInResponse,
  redactSecrets,
  writeSecretFile,
} from "./ops-session-lib";

// Fixture values only; none of these is a real credential.
const API_KEY = `AIza${"S".repeat(35)}`;
const ID_TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvcHMtdWlkIn0.c2lnbmF0dXJlLWZvci10ZXN0cw";
const REFRESH_TOKEN = "AMf-vBx-refresh-token-fixture-0123456789";
const CUSTOM_TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJ1aWQiOiJvcHMtdWlkIn0.Y3VzdG9tLXRva2VuLXNpZ25hdHVyZQ";
const TOKENS = [ID_TOKEN, REFRESH_TOKEN, CUSTOM_TOKEN];

function user(overrides: Partial<Parameters<typeof buildPersistedUser>[0]> = {}) {
  return buildPersistedUser({
    uid: "ops-uid",
    email: "ops@tryblueprint.io",
    emailVerified: true,
    apiKey: API_KEY,
    idToken: ID_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expirationTime: 1_700_000_000_000,
    createdAt: "Tue, 01 Aug 2023 00:00:00 GMT",
    lastLoginAt: 1_700_000_000_000,
    ...overrides,
  });
}

function thrownMessage(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the action to throw");
}

describe("ops email allowlist", () => {
  it("parses a comma-separated list", () => {
    expect(parseEmailAllowlist(" Ops@TryBlueprint.io, second@example.com,,ops@tryblueprint.io ")).toEqual([
      "ops@tryblueprint.io",
      "second@example.com",
    ]);
    expect(parseEmailAllowlist(undefined)).toEqual([]);
    expect(parseEmailAllowlist(" , ")).toEqual([]);
  });

  it("accepts only exact, case-insensitive matches", () => {
    const allowlist = "ops@tryblueprint.io, second@example.com";
    expect(assertAllowedEmail("OPS@tryblueprint.io ", allowlist)).toBe("ops@tryblueprint.io");
    expect(assertAllowedEmail("second@example.com", allowlist)).toBe("second@example.com");
    for (const email of [
      "xops@tryblueprint.io",
      "ops@tryblueprint.io.evil.com",
      "ops@tryblueprint.i",
      "ops",
      "tryblueprint.io",
      "*@tryblueprint.io",
      "",
    ]) {
      expect(() => assertAllowedEmail(email, allowlist)).toThrow(/refusing/);
    }
  });

  it("refuses everything when the allowlist is empty, without echoing it", () => {
    expect(() => assertAllowedEmail("ops@tryblueprint.io", undefined)).toThrow(/BLUEPRINT_CLOUD_OPS_EMAIL is not set/);
    expect(() => assertAllowedEmail("ops@tryblueprint.io", " , ")).toThrow(/not set/);
    const message = thrownMessage(() => assertAllowedEmail("intruder@example.com", "secret-ops@tryblueprint.io"));
    expect(message).toContain("intruder@example.com");
    expect(message).not.toContain("secret-ops");
  });

  it("defaults to the first entry", () => {
    expect(defaultOpsEmail("First@Example.com, second@example.com")).toBe("first@example.com");
    expect(() => defaultOpsEmail("")).toThrow(/not set/);
  });
});

describe("web API key discovery", () => {
  it("finds the first Firebase web API key", () => {
    const other = `AIza${"T".repeat(35)}`;
    expect(findFirebaseApiKey(`const c={apiKey:"${API_KEY}",x:"${other}"}`)).toBe(API_KEY);
    expect(findFirebaseApiKey("apiKey:\"AIzaTooShort\"")).toBeNull();
    expect(findFirebaseApiKey("")).toBeNull();
  });

  it("lists same-origin module scripts and modulepreload links", () => {
    const html = `
      <script type="module" crossorigin src="/assets/index-abc.js"></script>
      <script src="/legacy.js"></script>
      <script type="module" src="https://cdn.example.com/evil.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/vendor-1.js">
      <link rel="stylesheet" href="/assets/index.css">
      <script type=module src="assets/relative.js"></script>
      <script type="module" src="/assets/index-abc.js"></script>`;
    expect(extractScriptUrls(html, "https://tryblueprint.io/")).toEqual([
      "https://tryblueprint.io/assets/index-abc.js",
      "https://tryblueprint.io/assets/relative.js",
      "https://tryblueprint.io/assets/vendor-1.js",
    ]);
  });

  it("follows Vite chunk references, same-origin only", () => {
    const js = `import("./firebase-D1.js");const d=["assets/auth-X2.js","assets/style.css"];
      import("/assets/other-Y3.js");import("../up.js");fetch("https://evil.example.com/assets/z.js");
      const s="react.production.min.js";`;
    expect(extractChunkUrls(js, "https://tryblueprint.io/assets/index-abc.js")).toEqual([
      "https://tryblueprint.io/assets/firebase-D1.js",
      "https://tryblueprint.io/assets/auth-X2.js",
      "https://tryblueprint.io/assets/other-Y3.js",
      "https://tryblueprint.io/up.js",
    ]);
  });
});

describe("token expiry", () => {
  it("adds expiresIn seconds to now", () => {
    expect(computeExpirationTime(1_000_000, "3600")).toBe(1_000_000 + 3_600_000);
    expect(computeExpirationTime(0, 60)).toBe(60_000);
  });

  it.each(["", "abc", "0", "-5", "NaN"])("rejects expiresIn %j", (value) => {
    expect(() => computeExpirationTime(1_000, value)).toThrow(/positive/);
  });
});

describe("persisted Firebase user", () => {
  it("matches the Firebase JS SDK's persisted user shape", () => {
    expect(user()).toEqual({
      uid: "ops-uid",
      email: "ops@tryblueprint.io",
      emailVerified: true,
      isAnonymous: false,
      providerData: [],
      stsTokenManager: { refreshToken: REFRESH_TOKEN, accessToken: ID_TOKEN, expirationTime: 1_700_000_000_000 },
      createdAt: String(Date.parse("Tue, 01 Aug 2023 00:00:00 GMT")),
      lastLoginAt: "1700000000000",
      apiKey: API_KEY,
      appName: "[DEFAULT]",
    });
  });

  it("stores createdAt and lastLoginAt as strings, which the SDK requires", () => {
    const built = user({ createdAt: 123, lastLoginAt: "456" });
    expect(built.createdAt).toBe("123");
    expect(built.lastLoginAt).toBe("456");
    expect(user({ createdAt: "not a date", lastLoginAt: null }).createdAt).toBeUndefined();
  });
});

describe("storage state", () => {
  it("puts the user in the SDK's IndexedDB store and localStorage under the same key", () => {
    const persisted = user();
    const state = buildStorageState({ origin: "https://tryblueprint.io/some/path", apiKey: API_KEY, user: persisted });
    const key = firebaseAuthUserKey(API_KEY);
    expect(key).toBe(`firebase:authUser:${API_KEY}:[DEFAULT]`);
    expect(state.cookies).toEqual([]);
    expect(state.origins).toHaveLength(1);
    const [origin] = state.origins;
    expect(origin.origin).toBe("https://tryblueprint.io");
    expect(origin.localStorage).toEqual([{ name: key, value: JSON.stringify(persisted) }]);
    expect(JSON.parse(origin.localStorage[0].value)).toEqual(persisted);
    expect(origin.indexedDB).toEqual([
      {
        name: "firebaseLocalStorageDb",
        version: 1,
        stores: [
          {
            name: "firebaseLocalStorage",
            autoIncrement: false,
            keyPath: "fbase_key",
            records: [{ value: { fbase_key: key, value: persisted } }],
            indexes: [],
          },
        ],
      },
    ]);
    // Inline key path: a separate record key would make IndexedDB reject the add.
    expect(origin.indexedDB[0].stores[0].records[0]).not.toHaveProperty("key");
  });

  it("survives a JSON round trip, as the state file does", () => {
    const state = buildStorageState({ origin: "https://tryblueprint.io", apiKey: API_KEY, user: user() });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("accepts loopback http origins for local runs and refuses other plain http", () => {
    expect(buildStorageState({ origin: "http://127.0.0.1:4173", apiKey: API_KEY, user: user() }).origins[0].origin).toBe(
      "http://127.0.0.1:4173",
    );
    expect(() => buildStorageState({ origin: "http://tryblueprint.io", apiKey: API_KEY, user: user() })).toThrow(
      /origin/,
    );
  });

  it("refuses a user built for another API key", () => {
    const otherKey = `AIza${"U".repeat(35)}`;
    expect(() => buildStorageState({ origin: "https://tryblueprint.io", apiKey: otherKey, user: user() })).toThrow(
      /apiKey/,
    );
  });
});

describe("Identity Toolkit responses", () => {
  it("parses a signInWithCustomToken response", () => {
    expect(parseSignInResponse({ idToken: ID_TOKEN, refreshToken: REFRESH_TOKEN, expiresIn: "3600", isNewUser: false })).toEqual({
      idToken: ID_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresIn: "3600",
    });
  });

  it("describes an error response by its code", () => {
    expect(describeIdentityToolkitError(400, { error: { message: "INVALID_CUSTOM_TOKEN" } })).toBe(
      "signInWithCustomToken failed: HTTP 400 INVALID_CUSTOM_TOKEN",
    );
    expect(describeIdentityToolkitError(503, null)).toBe("signInWithCustomToken failed: HTTP 503 no error message");
  });
});

describe("token hygiene", () => {
  const leaks = (message: string) => TOKENS.filter((token) => message.includes(token));

  it("keeps tokens out of every error the helpers throw", () => {
    const messages = [
      thrownMessage(() => user({ uid: "" })),
      thrownMessage(() => user({ apiKey: "not-a-key" })),
      thrownMessage(() => user({ idToken: "" })),
      thrownMessage(() => user({ refreshToken: "" })),
      thrownMessage(() => user({ expirationTime: Number.NaN })),
      thrownMessage(() => buildStorageState({ origin: `https://${ID_TOKEN}:${REFRESH_TOKEN}@`, apiKey: API_KEY, user: user() })),
      thrownMessage(() => buildStorageState({ origin: "ftp://tryblueprint.io", apiKey: API_KEY, user: user() })),
      thrownMessage(() => buildStorageState({ origin: "https://tryblueprint.io", apiKey: ID_TOKEN, user: user() })),
      thrownMessage(() => parseSignInResponse({ idToken: ID_TOKEN, refreshToken: REFRESH_TOKEN, expiresIn: "soon" })),
      thrownMessage(() => parseSignInResponse({ idToken: ID_TOKEN, expiresIn: "3600" })),
      thrownMessage(() => parseSignInResponse({ refreshToken: REFRESH_TOKEN, expiresIn: "3600" })),
      thrownMessage(() => computeExpirationTime(0, REFRESH_TOKEN)),
    ];
    for (const message of messages) expect(leaks(message)).toEqual([]);
  });

  it("scrubs tokens an upstream error echoes back", () => {
    const body = { error: { message: `INVALID_CUSTOM_TOKEN: ${CUSTOM_TOKEN}` } };
    const described = describeIdentityToolkitError(400, body, [CUSTOM_TOKEN]);
    expect(described).toContain("INVALID_CUSTOM_TOKEN");
    expect(leaks(described)).toEqual([]);
    // JWT-shaped values are scrubbed even when the caller did not list them.
    expect(leaks(describeIdentityToolkitError(400, { error: { message: `bad ${ID_TOKEN}` } }))).toEqual([]);
  });

  it("redacts listed secrets and anything shaped like a JWT", () => {
    const text = `id=${ID_TOKEN} refresh=${REFRESH_TOKEN} custom=${CUSTOM_TOKEN}`;
    const redacted = redactSecrets(text, [REFRESH_TOKEN, undefined, "", "short"]);
    expect(leaks(redacted)).toEqual([]);
    expect(redacted).toContain("refresh=<redacted>");
    expect(redacted).toContain("id=<redacted-jwt>");
  });
});

describe("writeSecretFile", () => {
  let directory = "";
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")("writes 0600 files inside a 0700 directory, atomically", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "ops-session-test-"));
    const target = path.join(directory, "nested", "ops-id-token");
    await writeSecretFile(target, ID_TOKEN);
    await writeSecretFile(target, `${ID_TOKEN}-rotated`);
    expect(await readFile(target, "utf8")).toBe(`${ID_TOKEN}-rotated`);
    expect((await stat(target)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(target))).mode & 0o777).toBe(0o700);
  });
});
