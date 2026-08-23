import { requireUser } from "@/features/identity/server/session";
import { getOwnedConnection, type ConnectionState } from "@/features/connection/server/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { matchRunIdSchema } from "./schemas";

export type CandidateReveal = {
  matchRunId: string;
  firstName: string;
  ageRange: string;
  interests: string[];
  bio: string;
  photoPath: string;
  isAiGenerated: boolean;
};

type RevealRow = {
  first_name?: unknown;
  age_range?: unknown;
  interests?: unknown;
  bio?: unknown;
  photo_path?: unknown;
  is_ai_generated?: unknown;
};

function parseReveal(matchRunId: string, row: RevealRow | null): CandidateReveal | null {
  if (
    !row ||
    typeof row.first_name !== "string" ||
    typeof row.age_range !== "string" ||
    !Array.isArray(row.interests) ||
    !row.interests.every((interest) => typeof interest === "string") ||
    typeof row.bio !== "string" ||
    typeof row.photo_path !== "string" ||
    typeof row.is_ai_generated !== "boolean"
  ) return null;
  return {
    matchRunId,
    firstName: row.first_name,
    ageRange: row.age_range,
    interests: row.interests,
    bio: row.bio,
    photoPath: row.photo_path,
    isAiGenerated: row.is_ai_generated,
  };
}

export async function getCandidateReveal(matchRunId: string): Promise<CandidateReveal | null> {
  await requireUser();
  if (!matchRunIdSchema.safeParse(matchRunId).success) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("get_candidate_reveal", { p_match_run_id: matchRunId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as RevealRow | null;
  return parseReveal(matchRunId, row);
}

export async function getOwnedDecision(matchRunId: string): Promise<"accept" | "decline" | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("decisions").select("kind")
    .eq("match_run_id", matchRunId).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  return data?.kind === "accept" || data?.kind === "decline" ? data.kind : null;
}

export async function getOwnedConnectionState(matchRunId: string): Promise<ConnectionState | null> {
  const connection = await getOwnedConnection(matchRunId);
  return connection?.state ?? null;
}

export async function getCurrentCandidateReveal(): Promise<CandidateReveal | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("match_connections")
    .select("match_run_id")
    .eq("owner_id", userId)
    .in("state", ["profile_revealed", "contact_pending", "connected"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.match_run_id) return null;
  return getCandidateReveal(data.match_run_id);
}

// 閉じた候補はactive flowに含めないため、別候補の選択を再び許可する。
export async function getOwnedAcceptedMatchRunId(): Promise<string | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("match_connections").select("match_run_id")
    .eq("owner_id", userId)
    .in("state", ["profile_pending", "profile_revealed", "contact_pending", "connected"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.match_run_id ?? null;
}

export async function hasCurrentDecline(): Promise<boolean> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("decisions").select("id")
    .eq("owner_id", userId).eq("kind", "decline")
    .order("decided_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
