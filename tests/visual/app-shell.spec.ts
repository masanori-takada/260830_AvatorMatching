import { expect, test } from "@playwright/test";

test.describe("@visual AppShell", () => {
  test("320px幅で横スクロールせず端末面を表示する", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto("/");

    await expect(page.locator('[aria-label="アプリ画面"]')).toHaveScreenshot(
      "app-shell-320.png",
      { animations: "disabled" },
    );
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(320);
  });

  test("PCでは390pxの端末面を中央に表示する", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const phone = page.locator('[aria-label="アプリ画面"]');
    await expect(phone).toHaveScreenshot("app-shell-desktop.png", {
      animations: "disabled",
    });

    const phoneBox = await phone.boundingBox();
    expect(phoneBox?.width).toBe(390);
    expect(phoneBox?.x).toBe(525);
  });
});
