import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
/** Frontend only; the dedicated recovery spec intercepts every API call. */
export default defineConfig({
  ...base,
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4181",
    url: "http://127.0.0.1:4181",
    reuseExistingServer: false,
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:4181" },
});
