export const MINIMUM_PENDING_MS = 1200;

/** サーバー応答が速い場合も、利用者が送信完了を認識できる最低時間を確保する。 */
export async function waitForMinimumPending(startedAt: number, minimumMs = MINIMUM_PENDING_MS): Promise<void> {
  const remaining = Math.max(0, minimumMs - (Date.now() - startedAt));
  if (remaining === 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

