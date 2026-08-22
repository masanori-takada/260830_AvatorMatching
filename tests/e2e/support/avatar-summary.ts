import { expect, type Page } from "@playwright/test";

/**
 * 旧テスト呼び出しとの互換ヘルパー。
 */
export async function createAvatarSummary(page: Page): Promise<void> {
  // 要約機能は廃止済み。最終回答後に自動で/matchingへ進んだことだけを確認する。
  await expect(page).toHaveURL(/\/matching$/);
}
