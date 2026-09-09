import { expect, test } from "@playwright/test";

test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1", "Requires isolated local fake auth");
const flow = "a".repeat(43);
test("shows the exact connection permissions and requires an explicit consent click", async ({ page }) => {
  let decisions = 0;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "csrf-test" } });
    if (url.pathname === `/api/blueprint-work/consent/${flow}`) {
      if (route.request().method() === "POST") {
        decisions++;
        expect(route.request().postDataJSON()).toEqual({ allow: true });
        expect(route.request().headers()["x-csrf-token"]).toBe("csrf-test");
        return route.fulfill({ status: 409, json: { error: "Connection request expired. Start again from ChatGPT." } });
      }
      return route.fulfill({ json: { client_name: "ChatGPT Blueprint Work", scopes: ["blueprint:runs:read", "blueprint:runs:launch"], expires_at: 9999999999 } });
    }
    return route.fulfill({ status: 200, json: {} });
  });
  await page.goto(`/app/connect/chatgpt?flow=${flow}`);
  await expect(page.getByRole("heading", { name: "Connect Blueprint to ChatGPT" })).toBeVisible();
  await expect(page.getByText("Launch and activate runs within their approved budgets")).toBeVisible();
  expect(decisions).toBe(0);
  await page.getByRole("button", { name: "Connect to ChatGPT", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Connection request expired");
  expect(decisions).toBe(1);
});

test("rejects a missing connection handle without submitting anything", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: {} }));
  await page.goto("/app/connect/chatgpt");
  await expect(page.getByRole("alert")).toContainText("Start the connection from ChatGPT");
  await expect(page.getByRole("button", { name: "Connect to ChatGPT", exact: true })).toHaveCount(0);
});
