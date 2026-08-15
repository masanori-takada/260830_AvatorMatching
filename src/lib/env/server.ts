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
    // 合言葉ゲート(src/proxy.ts)で使う。未設定ならゲートは無効(=誰でもアクセス可能)になる。
    // 「設定し忘れると公開状態になる」ことを意味するため、本番運用では必ず設定すること。
    // .env.example上は値を空のままにする運用のため、空文字列も「未設定」として扱い
    // (min(1)で弾いて例外にはしない)、全体の検証が落ちないようにする。
    ACCESS_CODE: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
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
    ACCESS_CODE: process.env.ACCESS_CODE,
  });
}
