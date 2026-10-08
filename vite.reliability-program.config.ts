import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "node:path";
import { mkdirSync, readdirSync, realpathSync } from "node:fs";

const apiPort = Number(process.env.RELIABILITY_API_PORT);
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65535) throw new Error("Local reliability API port required");
const root = import.meta.dirname;
const noEnv = path.join(root, "output/reliability-program/no-env");
mkdirSync(noEnv, { recursive: true, mode: 0o700 });
if (readdirSync(noEnv).some(name => name.startsWith(".env"))) {
  throw new Error("Reliability Vite env directory must contain no dotenv files");
}
export default defineConfig({
  root: path.join(root, "client"),
  envDir: noEnv,
  cacheDir: path.join(root, `output/reliability-program/vite-cache-${apiPort}`),
  plugins: [react(), themePlugin()],
  resolve: { alias: { "@": path.join(root, "client/src") } },
  server: { host: "127.0.0.1", port: 42878, strictPort: true,
    hmr: { host: "127.0.0.1", port: 42878, clientPort: 42878 }, watch: null,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    fs: { allow: [root, realpathSync(path.join(root, "node_modules"))] },
  },
});
