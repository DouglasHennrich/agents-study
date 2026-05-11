import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    exclude: ["**/*.e2e.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/**/*.module.ts", "src/**/*.entity.ts"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "./src/@shared"),
      "@database": resolve(__dirname, "./src/@database"),
    },
  },
});
