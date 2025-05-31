import { defineConfig } from "vite";
import path from "path";

const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      // Adjust aliases if needed for server-side tests, though likely not for this util function
      "@": path.resolve(__dirname, "..", "client", "src"), // Points to client src, might not be needed
      "@server": path.resolve(__dirname), // Alias for server directory
      "@db": path.resolve(__dirname, "..", "db"),
    },
  },
  test: {
    globals: true,
    environment: 'node', // Server tests run in Node.js environment
    include: ['**/*.test.ts'], // Look for .test.ts files within the server directory
    root: __dirname, // Set the root to the server directory
    coverage: { // Add this section
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'], // Added text-summary
      reportsDirectory: './coverage/server', // Optional: specify output directory
      include: [ // Specify files to include in coverage
        'utils/**/*.ts',
        'routes/**/*.ts',
      ],
      exclude: [ // Specify files/patterns to exclude
        'tests/**/*',
        'vitest.config.ts',
        'mocks/**/*',
        'index.ts', // Common entry point, often just exports
        'vite.ts', // Vite specific config for server, if any
      ],
      all: true, // Report coverage for all files matching include, even if not tested
    },
  },
});
