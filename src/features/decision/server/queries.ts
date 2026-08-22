import { requireUser } from "@/features/identity/server/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { matchRunIdSchema } from "./schemas";

export type CandidateReveal = { fullName: string; company: string; department: string; bio: string };

export async function getCandidateReveal(matchRunId: string): Promise<CandidateReveal | null> {
  await requireUser();
  if (!matchRunIdSchema.safeParse(matchRunId).success) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("get_candidate_reveal", { p_match_run_id: matchRunId });
  if (error) throw error;
  const row = (data as Array<{ full_name: string; company: string; department: string; bio: string }> | null)?.[0];
  if (!row) return null;
  return { fullName: row.full_name, company: row.company, department: row.department, bio: row.bio };
}

export async function getOwnedDecision(matchRunId: string): Promise<"accept" | "decline" | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("decisions").select("kind")
    .eq("match_run_id", matchRunId).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  return data?.kind === "accept" || data?.kind === "decline" ? data.kind : null;
}

export async function getCurrentCandidateReveal(): Promise<CandidateReveal | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  // 決定はmatch_run単位なのでownerは複数行を持ちうる。最新の1件だけへ絞る。
  const { data, error } = await client.from("decisions").select("match_run_id")
    .eq("owner_id", userId).eq("kind", "accept")
    .order("decided_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getCandidateReveal(data.match_run_id);
}

// 承諾は1利用者につき1件までしか存在しない(decisions_owner_accept_uidx, SC-006)。
// 別の候補のレポート画面で「すでに他の方を承諾済みで選べない」ことを事前に示すために使う。
export async function getOwnedAcceptedMatchRunId(): Promise<string | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("decisions").select("match_run_id")
    .eq("owner_id", userId).eq("kind", "accept").maybeSingle();
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
