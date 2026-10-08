import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "node:path";
import { realpathSync } from "node:fs";

const apiPort = Number(process.env.RELIABILITY_API_PORT);
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65535) throw new Error("Local reliability API port required");
const root = import.meta.dirname;
export default defineConfig({
  root: path.join(root, "client"),
  envDir: path.join(root, "output/reliability-program/no-env"),
  cacheDir: path.join(root, "output/reliability-program/vite-cache"),
  plugins: [react(), themePlugin()],
  resolve: { alias: { "@": path.join(root, "client/src") } },
  server: { host: "127.0.0.1", strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    fs: { allow: [root, realpathSync(path.join(root, "node_modules"))] },
  },
});
