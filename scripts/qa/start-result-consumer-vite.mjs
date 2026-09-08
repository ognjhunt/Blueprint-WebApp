import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const environment = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(environment, {
  VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH: "1",
  RESULT_CONSUMER_QA_OUTPUT: process.env.RESULT_CONSUMER_QA_OUTPUT || path.join(root, "output/qa/result-consumer"),
});
const port = process.env.RESULT_CONSUMER_QA_PORT || "42873";
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid local QA port");
const child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--config", "vite.result-consumer.config.ts", "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: root, env: environment, stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1); });
