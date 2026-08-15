import { z } from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
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

export const parseEnv = (value: unknown) => schema.parse(value);
export const env = parseEnv(process.env);
