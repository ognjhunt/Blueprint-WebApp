import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

function findOpenPort(startPort = 5050) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();
      server.on("error", (error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });
      server.listen(port, "127.0.0.1", () => {
        const address = server.address();
        server.close(() => {
          if (!address || typeof address === "string") {
            reject(new Error("Failed to resolve local smoke port."));
            return;
          }
          resolve(address.port);
        });
      });
    };

    tryPort(startPort);
  });
}

async function waitForHealth(baseUrl, timeoutMs = 60_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`/health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw lastError || new Error("Timed out waiting for local smoke server health.");
}

const port = await findOpenPort(Number(process.env.ALPHA_LOCAL_SMOKE_PORT || 5050));
const baseUrl = `http://127.0.0.1:${port}`;
const distEntryPath = path.join(process.cwd(), "dist", "index.js");
const localFieldEncryptionKey = Buffer.from("blueprint-local-smoke-master-key", "utf8")
  .subarray(0, 32)
  .toString("base64");
const localSmokeEnv = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(port),
  BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: "1",
  BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED: "0",
  BASE_URL: baseUrl,
  ALPHA_SMOKE_TAG: process.env.ALPHA_SMOKE_TAG || "local-launch-smoke",
  FIELD_ENCRYPTION_MASTER_KEY:
    process.env.FIELD_ENCRYPTION_MASTER_KEY || localFieldEncryptionKey,
};

for (const key of [
  "STRIPE_SECRET_KEY",
  "STRIPE_CONNECT_ACCOUNT_ID",
  "STRIPE_WEBHOOK_SECRET",
  "CHECKOUT_ALLOWED_ORIGINS",
  "FIREHOSE_API_TOKEN",
  "FIREHOSE_BASE_URL",
  "BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS",
  "BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS",
]) {
  delete localSmokeEnv[key];
}

if (!fs.existsSync(distEntryPath)) {
  await new Promise((resolve, reject) => {
    const build = spawn("npx", [
      "esbuild",
      "server/index.ts",
      "--platform=node",
      "--packages=external",
      "--bundle",
      "--format=esm",
      "--outdir=dist",
    ], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    build.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Local smoke prerequisite build failed with exit code ${code ?? "unknown"}.`));
    });

    build.on("error", reject);
  });
}

const server = spawn("node", [distEntryPath], {
  cwd: process.cwd(),
  env: localSmokeEnv,
  stdio: ["ignore", "inherit", "inherit"],
});

server.on("exit", (code, signal) => {
  if (code !== null || signal !== null) {
    console.error(
      `Local smoke server exited${code !== null ? ` with code ${code}` : ""}${signal ? ` via ${signal}` : ""}.`,
    );
  }
});

const terminateServer = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

process.on("exit", terminateServer);
process.on("SIGINT", () => {
  terminateServer();
  process.exit(130);
});
process.on("SIGTERM", () => {
  terminateServer();
  process.exit(143);
});

try {
  await waitForHealth(baseUrl);

  await new Promise((resolve, reject) => {
    const smoke = spawn("node", ["scripts/launch-smoke.mjs"], {
      cwd: process.cwd(),
      env: localSmokeEnv,
      stdio: "inherit",
    });

    smoke.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Local launch smoke failed with exit code ${code ?? "unknown"}.`));
    });

    smoke.on("error", reject);
  });
} finally {
  terminateServer();
}
