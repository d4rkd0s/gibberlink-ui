import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // relative base so the build works on GitHub Pages under /gibberlink-ui/
  base: "./",
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["fonts/*", "icon.svg"],
      manifest: {
        name: "GibberLink UI",
        short_name: "GibberLink",
        description: "Turn text and runes into GibberLink sound, and sound back into text.",
        theme_color: "#0e1116",
        background_color: "#0e1116",
        display: "standalone",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,woff2,svg,txt}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  worker: { format: "es" },
  build: { target: "es2022" },
});
