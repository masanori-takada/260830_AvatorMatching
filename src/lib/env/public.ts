import { z } from "zod";

/**
 * クライアントバンドルに含めてよい公開設定。
 *
 * Next.jsは`process.env.NEXT_PUBLIC_XXX`という「個別の静的なプロパティ参照」だけを
 * ビルド時にインライン展開する。`process.env`をオブジェクトごと関数へ渡すと展開されず、
 * ブラウザ側では常にundefinedになるため、ここでは必ず1つずつ静的に参照してから検証する。
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const parsePublicEnv = (value: unknown) => schema.parse(value);

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
