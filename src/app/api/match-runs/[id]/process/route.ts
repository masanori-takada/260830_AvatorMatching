import { processOwnedMatch } from "@/features/matching/server/process";

// OpenAI生成1回の既定待ち時間は60秒で、Vercel側の実行時間上限も60秒。
// 今回はユーザー指定によりmaxDurationを変更せず、この条件で実測する。
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
