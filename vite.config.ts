import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  plugins: [],
  nitro: {
    preset: "cloudflare-module",
    compatibilityDate: "2025-03-20",
    cloudflare: {
      nodeCompat: true,
      compatibilityFlags: ["nodejs_compat_v2"],
    },
  },
  build: {
    rolldownOptions: {
      external: ["mongodb", "bson"],
    },
  },
});
