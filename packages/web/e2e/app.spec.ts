import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixtures = join(import.meta.dirname, ".fixtures");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("compose shows runes and their reading, with a byte budget", async ({ page }) => {
  await page.getByRole("textbox", { name: "Message" }).fill("odin");
  await expect(page.getByRole("img", { name: "Runes, read as: odin" }).first()).toBeVisible();
  await expect(page.getByText("12 / 140 bytes")).toBeVisible();
});

test("text over the limit cannot be transmitted", async ({ page }) => {
  await page.getByRole("textbox", { name: "Message" }).fill("a".repeat(50));
  await expect(page.getByText("Too long for one GibberLink message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Transmit" })).toBeDisabled();
});

test("rune keyboard inserts real runes", async ({ page }) => {
  await page.getByText("Rune keyboard").click();
  await page.getByRole("button", { name: "*fehu, f" }).click();
  await page.getByRole("button", { name: "*ūruz, u" }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("ᚠᚢ");
});

test("transmitting flies runes across the sky", async ({ page }) => {
  await page.getByRole("textbox", { name: "Message" }).fill("hail odin");
  await page.getByRole("button", { name: "Transmit" }).click();
  await expect(page.getByRole("status")).toContainText("Transmitting");
  await page.waitForTimeout(1500);
  const inked = await page.locator(".sky canvas").evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 40) n++;
    return n;
  });
  expect(inked).toBeGreaterThan(200);
});

test("decodes a GibberLink recording from a file", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "text.wav"));
  const transcript = page.getByTestId("transcript");
  await expect(transcript).toContainText("hello gibberlink", { timeout: 15_000 });
});

test("decodes runes live from the microphone", async ({ page }) => {
  await page.getByRole("button", { name: "Listen with microphone" }).click();
  const transcript = page.getByTestId("transcript");
  await expect(transcript).toContainText("Read as: hail odin", { timeout: 20_000 });
  await expect(transcript.getByRole("img", { name: "Runes, read as: hail odin" })).toBeVisible();
});

test("no serious accessibility violations", async ({ page }) => {
  await page.getByRole("textbox", { name: "Message" }).fill("odin");
  await page.getByText("Rune keyboard").click();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
