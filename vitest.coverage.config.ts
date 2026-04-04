/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // The build-output suite verifies generated files after `npm run build`.
      // Keep it out of the coverage sweep so the test job stays build-free.
      exclude: ['client/tests/build-output.test.ts'],
    },
  }),
)
