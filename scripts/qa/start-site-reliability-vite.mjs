import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Never inherit credentials or read dotenv files. These values identify only a
// nonexistent local fixture project; Playwright blocks every external request.
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, {
  RESULT_CONSUMER_QA_OUTPUT: path.join(root, "work/site-reliability"),
  VITE_FIREBASE_API_KEY: "local-fixture-key",
  VITE_FIREBASE_AUTH_DOMAIN: "fixture.invalid",
  VITE_FIREBASE_PROJECT_ID: "local-site-reliability",
  VITE_FIREBASE_STORAGE_BUCKET: "fixture.invalid",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456",
  VITE_FIREBASE_APP_ID: "1:123456:web:fixture",
});
const child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--config", "vite.result-consumer.config.ts", "--host", "127.0.0.1", "--port", "42874", "--strictPort"], { cwd: root, env, stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 0; });
