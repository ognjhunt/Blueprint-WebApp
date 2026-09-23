/**
 * Sign the allowlisted ops account in for a cloud agent, so it can do the
 * signed-in robot-team step on https://tryblueprint.io.
 *
 *   npx tsx scripts/cloud/ops-session.ts [--email <addr>]
 *
 * --email defaults to the first entry of BLUEPRINT_CLOUD_OPS_EMAIL, and must
 * match one of its comma-separated entries exactly (case-insensitive);
 * anything else is refused before a credential is touched. The script then
 * resolves the site's public web API key (VITE_FIREBASE_API_KEY, else the
 * first AIza... key in the site's module scripts), looks the user up with the
 * service account (FIREBASE_SERVICE_ACCOUNT_JSON, via
 * client/src/lib/firebaseAdmin.ts), mints a custom token, exchanges it at
 * identitytoolkit accounts:signInWithCustomToken, and writes two files, both
 * 0600 in the 0700 directory ~/.blueprint-cloud:
 *
 *   ops-id-token             the ID token alone (valid for one hour)
 *   ops-storage-state.json   a Playwright storage state carrying the Firebase
 *                            session in IndexedDB and localStorage
 *
 * It prints only the uid, the email, the two paths and the expiry time.
 * Tokens never reach stdout, stderr or error messages.
 *
 * Browser: load the storage state (Playwright `browser.newContext({
 * storageState })`, or the Playwright MCP `--storage-state` option), then open
 * https://tryblueprint.io; the Firebase SDK restores the session. The state
 * holds a refresh token, so it outlives the ID token's hour: treat it like a
 * password.
 *
 * API: WebApp routes take the ID token as a bearer token. State-changing
 * requests (POST/PUT/PATCH/DELETE) also need the native-client header, which
 * server/middleware/csrf.ts exempts from the CSRF cookie check only when a
 * bearer token is present:
 *
 *   curl -sS https://tryblueprint.io/api/<route> \
 *     -H "Authorization: Bearer $(cat ~/.blueprint-cloud/ops-id-token)" \
 *     -H "x-blueprint-native-client: blueprint-capture" \
 *     -H "content-type: application/json" -d '{...}'
 *
 * Rerun this script for a fresh ID token once it expires. When the run is
 * over: rm -f ~/.blueprint-cloud/ops-id-token ~/.blueprint-cloud/ops-storage-state.json
 */
import os from "node:os";
import path from "node:path";
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
  OPS_SITE_ORIGIN,
  parseSignInResponse,
  redactSecrets,
  writeSecretFile,
} from "./ops-session-lib";
import { importFirebaseAdmin, reexecWithEnvProxy } from "./runtime";

const USAGE = "usage: npx tsx scripts/cloud/ops-session.ts [--email <addr>]";
const MAX_SCRIPT_FETCHES = 40;
const MAX_TEXT_BYTES = 8 * 2 ** 20;

// Every secret this process handles, so a failure message can be scrubbed.
const secrets: string[] = [];

function parseArgs(argv: string[]): { email?: string; help: boolean } {
  const args: { email?: string; help: boolean } = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg === "--email") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--email needs a value");
      args.email = value;
      index += 1;
    } else if (arg.startsWith("--email=")) args.email = arg.slice("--email=".length);
    else throw new Error(`unexpected argument ${arg}`);
  }
  return args;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GET ${url} answered HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_TEXT_BYTES) throw new Error(`GET ${url} returned more than ${MAX_TEXT_BYTES} bytes`);
  return text;
}

/** The site's public Firebase web API key: env first, else found in its bundle. */
async function resolveApiKey(origin: string): Promise<string> {
  const fromEnv = process.env.VITE_FIREBASE_API_KEY?.trim();
  if (fromEnv) {
    if (findFirebaseApiKey(fromEnv) !== fromEnv) {
      throw new Error("VITE_FIREBASE_API_KEY is set but is not a Firebase web API key");
    }
    return fromEnv;
  }
  const pageUrl = `${origin}/`;
  const queue = extractScriptUrls(await fetchText(pageUrl), pageUrl);
  const seen = new Set<string>();
  while (queue.length > 0 && seen.size < MAX_SCRIPT_FETCHES) {
    const url = queue.shift() as string;
    if (seen.has(url)) continue;
    seen.add(url);
    const script = await fetchText(url);
    const key = findFirebaseApiKey(script);
    if (key) return key;
    for (const next of extractChunkUrls(script, url)) if (!seen.has(next)) queue.push(next);
  }
  throw new Error(
    `no Firebase web API key in ${seen.size} script(s) from ${origin}; set VITE_FIREBASE_API_KEY`,
  );
}

async function signInWithCustomToken(apiKey: string, customToken: string, origin: string) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    // The site's own key may be restricted to its referrer.
    headers: { "content-type": "application/json", referer: `${origin}/` },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    signal: AbortSignal.timeout(30_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(describeIdentityToolkitError(response.status, body, secrets));
  return parseSignInResponse(body);
}

async function main(): Promise<number> {
  reexecWithEnvProxy();
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`ops-session: ${(error as Error).message}\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  // The allowlist is checked before any credential or network use.
  const allowlist = process.env.BLUEPRINT_CLOUD_OPS_EMAIL;
  const email = assertAllowedEmail(args.email ?? defaultOpsEmail(allowlist), allowlist);
  const origin = OPS_SITE_ORIGIN;
  const apiKey = await resolveApiKey(origin);

  const { authAdmin } = await importFirebaseAdmin();
  if (!authAdmin) throw new Error("Firebase Admin has no credentials; set FIREBASE_SERVICE_ACCOUNT_JSON");
  const record = await authAdmin.getUserByEmail(email);
  if (record.disabled) throw new Error(`${email} is disabled in Firebase Auth`);

  const customToken = await authAdmin.createCustomToken(record.uid);
  secrets.push(customToken);
  const session = await signInWithCustomToken(apiKey, customToken, origin);
  secrets.push(session.idToken, session.refreshToken);

  const now = Date.now();
  const expirationTime = computeExpirationTime(now, session.expiresIn);
  const user = buildPersistedUser({
    uid: record.uid,
    email: record.email ?? email,
    emailVerified: record.emailVerified,
    apiKey,
    idToken: session.idToken,
    refreshToken: session.refreshToken,
    expirationTime,
    createdAt: record.metadata.creationTime,
    lastLoginAt: now,
  });
  const storageState = buildStorageState({ origin, apiKey, user });

  const directory = path.join(os.homedir(), ".blueprint-cloud");
  const tokenPath = path.join(directory, "ops-id-token");
  const statePath = path.join(directory, "ops-storage-state.json");
  await writeSecretFile(tokenPath, session.idToken);
  await writeSecretFile(statePath, `${JSON.stringify(storageState, null, 2)}\n`);

  console.log(`uid=${record.uid}`);
  console.log(`email=${user.email ?? email}`);
  console.log(`id_token_file=${tokenPath}`);
  console.log(`storage_state=${statePath}`);
  console.log(`expires_at=${new Date(expirationTime).toISOString()}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: unknown })?.code;
    const detail = typeof code === "string" && !message.includes(code) ? ` [${code}]` : "";
    console.error(`ops-session: ${redactSecrets(message + detail, secrets)}`);
    process.exit(1);
  });
