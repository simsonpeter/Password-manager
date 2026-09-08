import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [
    react(),
    {
      name: "spa-github-pages",
      closeBundle() {
        try {
          copyFileSync(resolve("dist/index.html"), resolve("dist/404.html"));
        } catch {
          /* ignore if dist is missing */
        }
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
