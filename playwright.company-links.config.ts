import { defineConfig } from "@playwright/test";
import journey from "./playwright.answer-journey.config";
/**
 * The deployment company's emailed links (e2e/outreach-company-links.spec.ts) on the core-journey harness. Its own
 * config: it approves companies, and the core journey (playwright.answer-journey.config.ts) needs a run with none.
 */
export default defineConfig({ ...journey, testMatch: ["outreach-company-links.spec.ts"], timeout: 420_000 });
