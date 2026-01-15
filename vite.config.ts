import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = import.meta.dirname;

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
      "@db": path.resolve(__dirname, "db"),
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
          if (
            id.includes("three") ||
            id.includes("three-stdlib") ||
            id.includes("three-transform-controls")
          ) {
            return "vendor-3d";
          }
          if (id.includes("leaflet") || id.includes("react-leaflet")) {
            return "vendor-maps";
          }
          if (id.includes("@googlemaps/js-api-loader")) {
            return "vendor-google-maps";
          }
          if (
            id.includes("openai") ||
            id.includes("@anthropic-ai") ||
            id.includes("@google/generative-ai") ||
            id.includes("@google/genai") ||
            id.includes("@google-cloud/aiplatform") ||
            id.includes("lumaai")
          ) {
            return "vendor-ai";
          }
          if (id.includes("firebase") || id.includes("firebase-admin")) {
            return "vendor-firebase";
          }
          if (id.includes("reactflow")) {
            return "vendor-flow";
          }
          if (id.includes("@sentry")) {
            return "vendor-sentry";
          }
          if (id.includes("framer-motion")) {
            return "vendor-motion";
          }
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }
          if (
            id.includes("@tanstack") ||
            id.includes("react-router") ||
            id.includes("react-dom") ||
            id.includes("react/jsx-runtime")
          ) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
});
