import { spawn } from "node:child_process";
import net from "node:net";

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate local QA port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

const port = await getAvailablePort();

const child = spawn(
  "npx",
  ["playwright", "test", "e2e/operator-surfaces.spec.ts", "--reporter=line"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_PORT: String(port),
      VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH: "1",
      BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER: "1",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
