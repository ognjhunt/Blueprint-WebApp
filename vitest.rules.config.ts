import { defineConfig } from "vitest/config";

// Firebase security-rules emulator suite. Run via `npm run test:rules`, which
// wraps this config in `firebase emulators:exec` so the Firestore and Storage
// emulators are up before the tests execute. Kept out of the default vitest
// include so `npm run test` stays emulator-free.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/rules/**/*.{test,spec}.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Rules assertions share one emulator instance; run files serially so
    // clearFirestore()/clearStorage() in one file cannot race another.
    fileParallelism: false,
  },
});
