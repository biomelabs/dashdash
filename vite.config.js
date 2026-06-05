import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: ".",
  base: "/dashdash/",
  plugins: [tailwindcss()],
  build: { outDir: "dist" },
});
