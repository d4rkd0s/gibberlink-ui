import { expect, test } from "@playwright/test";

// Not a regression test: captures screenshots for docs and visual review. Run with SCREENS=1.
test.skip(!process.env.SCREENS, "set SCREENS=1 to capture screenshots");

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["phone", { width: 400, height: 860 }],
] as const) {
  test(`flock mid-flight (${name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message" }).fill("hail odin allfather of the old runes");
    await page.getByRole("button", { name: "Transmit" }).click();
    await expect(page.getByRole("status")).toContainText("Transmitting");
    for (const t of [1200, 2600, 4200]) {
      await page.waitForTimeout(t === 1200 ? 1200 : 1400);
      await page.screenshot({ path: `e2e/.screens/${name}-${t}.png`, fullPage: name === "phone" && t === 4200 });
    }
  });
}
