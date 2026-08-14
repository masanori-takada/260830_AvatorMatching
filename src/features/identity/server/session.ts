import { UnauthenticatedError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireUser(): Promise<{ userId: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    throw new UnauthenticatedError();
  }

  return { userId };
}
