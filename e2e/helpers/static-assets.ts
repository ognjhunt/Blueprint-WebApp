import type { Page } from "@playwright/test";

// Fixture browser checks must not wait on third-party font downloads. Live
// screenshots separately inspect the deployed typography.
export async function mockExternalFonts({ page }: { page: Page }): Promise<void> {
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", route => route.fulfill({ body: "" }));
}
