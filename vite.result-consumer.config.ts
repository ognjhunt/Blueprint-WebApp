import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "node:path";
import { realpathSync } from "node:fs";

const root = import.meta.dirname;
const output = path.resolve(process.env.RESULT_CONSUMER_QA_OUTPUT || path.join(root, "output/qa/result-consumer"));

// Real client application, dev-only fixture identity, no backend and no dotenv files.
export default defineConfig({
  root: path.join(root, "client"),
  envDir: path.join(output, "no-env"),
  cacheDir: path.join(output, "vite-cache"),
  plugins: [react(), themePlugin()],
  resolve: { alias: { "@": path.join(root, "client/src") } },
  server: {
    host: "127.0.0.1",
    strictPort: true,
    fs: { allow: [root, realpathSync(path.join(root, "node_modules"))] },
  },
});
