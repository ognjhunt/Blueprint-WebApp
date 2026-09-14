import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = import.meta.dirname;

function packageNameFromId(id: string) {
  const [, modulePath = ""] = id.split(/node_modules\//);
  const [scopeOrName = "", maybeName = ""] = modulePath.split("/");
  if (!scopeOrName) return null;
  return scopeOrName.startsWith("@") ? `${scopeOrName}/${maybeName}` : scopeOrName;
}

export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true, overlay: false }),
    runtimeErrorOverlay(),
    themePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          const packageName = packageNameFromId(id);
          if (!packageName) return;
          if (packageName === "@googlemaps/js-api-loader") {
            return "vendor-google-maps";
          }
          if (["openai", "@anthropic-ai/sdk", "@google/generative-ai"].includes(packageName)) {
            return "vendor-ai";
          }
          if (
            packageName === "firebase" ||
            packageName === "firebase-admin" ||
            packageName.startsWith("@firebase/")
          ) {
            // Firestore alone pushes a single firebase chunk past the 500 kB
            // warning line; keep the SDK split by feature so each route only
            // pays for what it actually imports.
            if (id.includes("firestore")) return "vendor-firebase-firestore";
            if (id.includes("auth")) return "vendor-firebase-auth";
            if (id.includes("storage")) return "vendor-firebase-storage";
            return "vendor-firebase";
          }
          if (packageName.startsWith("@sentry/")) {
            return "vendor-sentry";
          }
          if (packageName === "framer-motion") {
            return "vendor-motion";
          }
          if (packageName.startsWith("@radix-ui/")) {
            return "vendor-radix";
          }
          if (
            packageName === "react" ||
            packageName === "react-dom" ||
            packageName === "scheduler" ||
            packageName === "wouter" ||
            packageName.startsWith("@tanstack/")
          ) {
            return "vendor-react";
          }
          if (
            packageName === "recharts" ||
            packageName === "react-smooth" ||
            packageName === "lodash" ||
            packageName === "victory-vendor" ||
            packageName.startsWith("d3-")
          ) {
            return "vendor-recharts";
          }
          if (packageName === "lucide-react") {
            return "vendor-icons";
          }
        },
      },
    },
  },
});
