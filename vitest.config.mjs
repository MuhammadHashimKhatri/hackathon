import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real package throws outside Next's react-server build
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
