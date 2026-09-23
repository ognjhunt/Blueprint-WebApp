/**
 * Process helpers shared by the TypeScript CLIs in scripts/cloud/.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WEBAPP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Node's built-in fetch (and https) ignore HTTPS_PROXY unless the process
 * starts with NODE_USE_ENV_PROXY=1 (Node >= 22.21). When a proxy is set
 * through the environment, run this same script again with that flag, so the
 * CLIs work behind the cloud egress proxy without touching every other Node
 * process in the session. A no-op when no proxy variable is set.
 */
export function reexecWithEnvProxy(): void {
  const env = process.env;
  const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
  if (!proxy || env.NODE_USE_ENV_PROXY === "1") return;
  const child = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: {
      ...env,
      NODE_USE_ENV_PROXY: "1",
      // Node flags the env-proxy agent as experimental on every fetch.
      NODE_OPTIONS: [env.NODE_OPTIONS, "--disable-warning=UNDICI-EHPA"].filter(Boolean).join(" "),
    },
  });
  process.exit(child.status ?? 1);
}

/**
 * The repo's Firebase Admin helper, imported with its init logging sent to
 * stderr so these CLIs keep stdout machine-readable.
 */
export async function importFirebaseAdmin() {
  const log = console.log;
  console.log = (...args: unknown[]) => console.error(...args);
  try {
    return await import("../../client/src/lib/firebaseAdmin");
  } finally {
    console.log = log;
  }
}
