import { defineConfig } from "@playwright/test";
import resultConsumer from "./playwright.result-consumer.config";

// Reuse the isolated loopback Vite launcher: no backend, dotenv, or live APIs.
export default defineConfig({ ...resultConsumer, testMatch: ["invited-site-beta.spec.ts"] });
