import "server-only";
import { z } from "zod";

/**
 * サーバー専用の設定。AI_PROVIDER / GEMINI_API_KEYはクライアントバンドルから
 * 絶対に参照されてはいけないため、`server-only`をimportしてクライアント側からの
 * importをビルド時に検出できるようにする。
 */
const schema = z
  .object({
    AI_PROVIDER: z.enum(["mock", "gemini"]),
    // AI_PROVIDER=geminiのときだけ必須。それ以外(mock)では未設定でよい。
    GEMINI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.AI_PROVIDER === "gemini" && !value.GEMINI_API_KEY) {
      context.addIssue({
        code: "custom",
        message: "AI_PROVIDER=geminiのときはGEMINI_API_KEYが必須です。",
        path: ["GEMINI_API_KEY"],
      });
    }
  });

export const parseServerEnv = (value: unknown) => schema.parse(value);

/**
 * 呼び出し時点のprocess.envを検証して返す。
 * publicEnvと違いモジュール読み込み時の1回だけにしないのは、テストでの
 * `process.env`の動的な差し替え(vi.stubEnvや直接代入)にも追随させるため。
 */
export function getServerEnv() {
  return parseServerEnv({
    AI_PROVIDER: process.env.AI_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
}
