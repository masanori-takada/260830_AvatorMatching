import { expect, type Page } from "@playwright/test";

/**
 * 完了画面でアバター要約を作成する。
 *
 * 完了画面のフォームはクライアント側で動くため、ハイドレーション完了前に押しても無反応になる
 * (エラーも出ない)。状態が変わるまでクリックを再試行する。要約の生成自体もAIプロバイダ次第で
 * 時間がかかるため、全体に余裕のある上限を置く。
 */
export async function createAvatarSummary(page: Page): Promise<void> {
  const updateButton = page.getByRole("button", { name: "要約を更新する" });

  await expect(async () => {
    await page.getByRole("button", { name: "アバター要約を作成する" }).click({ timeout: 5_000 });
    await expect(updateButton).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}
