import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // Keep the browser bundle parseable by iOS Safari versions that support
  // ES modules but predate the newest Vite baseline. This also lowers syntax
  // such as nullish assignment/private fields in the framework chunks.
  build: {
    target: "es2020",
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
