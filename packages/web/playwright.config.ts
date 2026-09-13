import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const fixtures = join(import.meta.dirname, "e2e", ".fixtures");
// fake mic input must exist before the browser launches
execFileSync(process.execPath, [join(import.meta.dirname, "e2e", "make-fixtures.ts")], { stdio: "inherit" });

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${join(fixtures, "runes.wav")}`,
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "npx vite build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
