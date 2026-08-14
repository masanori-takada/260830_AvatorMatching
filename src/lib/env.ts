import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  AI_PROVIDER: z.literal("mock"),
});

export const parseEnv = (value: unknown) => schema.parse(value);
export const env = parseEnv(process.env);
