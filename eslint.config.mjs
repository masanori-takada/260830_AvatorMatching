import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  // 入れ子のチェックアウト(.worktrees/**、.claude/**)とビルド生成物は走査しない。
  // 別チェックアウトの.next配下まで対象になると、生成コードの警告でlint全体が落ちる。
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    ".worktrees/**",
    ".claude/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
