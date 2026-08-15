import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(currentDirectory, "src"),
      // server-onlyはimportされただけで例外を投げる実装のため、Node上で動くVitestでは
      // 動作しない。テストだけスタブへ差し替える(詳細はtests/stubs/server-only.ts参照)。
      "server-only": resolve(currentDirectory, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
