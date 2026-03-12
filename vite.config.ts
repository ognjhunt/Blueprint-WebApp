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
          if (packageName === "three" || packageName === "three-stdlib") {
            return "vendor-3d";
          }
          if (packageName === "@googlemaps/js-api-loader") {
            return "vendor-google-maps";
          }
          if (["openai", "@anthropic-ai/sdk", "@google/generative-ai", "@google-cloud/aiplatform", "lumaai"].includes(packageName)) {
            return "vendor-ai";
          }
          if (packageName === "firebase" || packageName === "firebase-admin") {
            return "vendor-firebase";
          }
          if (packageName === "reactflow") {
            return "vendor-flow";
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
            packageName === "react-datepicker" ||
            packageName === "date-fns" ||
            packageName === "react-transition-group"
          ) {
            return "vendor-react-datepicker";
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
