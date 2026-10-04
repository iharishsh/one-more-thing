import { test, expect } from "@playwright/test";

test.skip("paid change flow", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/One More Thing/i);
});
