import { processOwnedMatch } from "@/features/matching/server/process";

// Gemini呼び出しはGEMINI_TIMEOUT_MS(20秒)まで待つ設計で、
// スキーマ違反時は1回だけ作り直すため最悪約40秒かかりうる。
// Vercelの既定の実行時間上限（10〜15秒）では途中で打ち切られて
// 会話生成が必ず失敗するため、明示的に上限を延長する。
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const status = await processOwnedMatch(id);
    return Response.json({ status }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.includes("INVALID_OUTPUT")
      ? 422
      : /STATE_CONFLICT|MATCH_NOT_FOUND|RETRY_LIMIT/u.test(message) ? 409 : 500;
    return Response.json({ status: "failed" }, { status });
  }
}
