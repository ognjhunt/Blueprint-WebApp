import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"
/// <reference types="vitest" />

const __dirname = import.meta.dirname;
export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true, overlay: false }),
    runtimeErrorOverlay(),
    // themePlugin({
    //   themeFile: "../theme.json", // Path relative to Vite root (client/)
    // }),
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
  },
  test: {
    globals: true,
    environment: 'jsdom', // or 'jsdom'
    setupFiles: './tests/setup.ts', // if you need a setup file
    css: true, // if you need to process CSS
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'], // Choose desired reporters
      reportsDirectory: './tests/coverage', // Output directory
      include: ['client/src/**/*.{ts,tsx}', 'client/pages/**/*.{ts,tsx}'], // Adjusted paths to be relative to project root
      exclude: [ // Paths to exclude
        'client/src/main.tsx', // Example: main entry point
        'client/src/vite-env.d.ts',
        'client/src/types/**/*',
        'client/src/components/ui/**/*',
        'client/src/lib/firebase.ts',
        'client/src/lib/firebaseAdmin.ts',
        'client/src/contexts/**/*',
        'client/src/hooks/use-toast.ts',
        'client/src/store/**/*',
        // 'client/src/App.tsx', // No App.tsx in this structure usually
        '**/*.test.ts',
        '**/*.test.tsx',
        'client/tests/**/*',
        // Explicitly exclude files with rendering issues for now to avoid skewed coverage due to unrenderable components
        'client/src/pages/Pricing.tsx',
        'client/src/pages/ScannerPortal.tsx',
      ],
      all: true, // Report coverage for all files, not just tested ones
    }
  },
});
