import { expect, type Page } from "@playwright/test";

import { createAvatarSummary } from "./avatar-summary";
import { completeInterview } from "./interview";

/**
 * インタビュー完了・アバター要約作成のあと、`/matching`で複数候補(最大3人)との
 * 会話が終わるまで待ち、`/matches`(マッチ結果一覧)へ到達する。
 *
 * 「n人」の人数はモックプロバイダの応答次第で変わりうるため固定しない
 * (候補者数が変わっても壊れないように正規表現で判定する)。
 */
export async function reachMatchList(page: Page): Promise<void> {
  await completeInterview(page);
  await createAvatarSummary(page);
  await page.goto("/matching");
  await expect(page.getByRole("link", { name: /マッチ結果を見る/u })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: /マッチ結果を見る/u }).click();
  await expect(page).toHaveURL(/\/matches$/);
}

/**
 * マッチ結果一覧から、決定可能な(未決定の)最初の候補の相性レポートへ進む。
 */
export async function reachFirstUndecidedReport(page: Page): Promise<void> {
  await reachMatchList(page);
  await page.getByRole("link", { name: /相性 \d+%/u }).first().click();
  await expect(page.getByRole("button", { name: "承諾する" })).toBeVisible();
}
