import { test as base, expect, type Page } from "@playwright/test";

export type { Page } from "@playwright/test";

/**
 * E2Eテスト専用の合言葉ダミー値(本番の合言葉ではない)。
 *
 * この定数が値の「唯一の定義箇所」。`.claude/launch.json`の
 * `avatar-matching-e2e`設定にある`env.ACCESS_CODE`は、サーバー起動プロセスへ
 * JSON経由でしか値を渡せない都合上、文字列を直接書く必要があるが、
 * その値は必ずこの定数と同じにしておくこと(値を変える場合はこの定数を
 * 起点にし、`.claude/launch.json`側にも反映すること)。
 * 本番の合言葉はVercelの環境変数にのみ存在し、ここには書かない。
 */
export const ACCESS_CODE = "e2e-test-passphrase-not-the-real-one";

/**
 * 合言葉ゲート(src/proxy.ts)を通過させる共通処理。
 *
 * 上記`ACCESS_CODE`(テスト専用ダミー値)を使ってゲートを通過する。
 * サーバー側は`.claude/launch.json`経由で同じ値をACCESS_CODEとして
 * 受け取っている前提。
 */
export async function passAccessGate(page: Page): Promise<void> {
  await page.goto("/access-gate");
  await page.getByLabel("合言葉").fill(ACCESS_CODE);
  await page.getByRole("button", { name: "進む" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/access-gate"));
}

/**
 * 全specで共通して使う`test`。標準の`page`フィクスチャを使う前に、必ず合言葉ゲートを
 * 通過させておく。これにより、既存のspecは本ファイルから`test`/`expect`をimportする
 * だけでゲート通過処理を書かずに済む(処理はここ1箇所だけに置く)。
 *
 * `browser.newContext()`で独自にページを作るspec(未通過セッションを検証する場合など)は
 * このフィクスチャの対象外になるため、`passAccessGate`を直接呼び出すこと。
 */
export const test = base.extend({
  // 第2引数名を"use"にすると、react-hooks/rules-of-hooks(eslint-config-next)が
  // React Hookと誤認する(識別子が"use"で始まるため)。Playwrightのfixture APIとしての
  // 意味は変わらないため、誤検知を避けて別名にする。
  page: async ({ page }, runTest) => {
    await passAccessGate(page);
    await runTest(page);
  },
});

export { expect };
