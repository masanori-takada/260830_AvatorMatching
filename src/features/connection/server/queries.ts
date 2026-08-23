import { requireUser } from "@/features/identity/server/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { connectionIdSchema } from "./schemas";

export const CONNECTION_STATES = [
  "profile_pending",
  "profile_revealed",
  "contact_pending",
  "connected",
  "closed",
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export type OwnedConnection = {
  id: string;
  matchRunId: string;
  state: ConnectionState;
  contactDecision: "accept" | "decline" | null;
};

function parseConnection(row: {
  id?: unknown;
  match_run_id?: unknown;
  state?: unknown;
  contact_decision?: unknown;
} | null): OwnedConnection | null {
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.match_run_id !== "string" ||
    !CONNECTION_STATES.includes(row.state as ConnectionState) ||
    (row.contact_decision !== null && row.contact_decision !== "accept" && row.contact_decision !== "decline")
  ) return null;
  return {
    id: row.id,
    matchRunId: row.match_run_id,
    state: row.state as ConnectionState,
    contactDecision: row.contact_decision as "accept" | "decline" | null,
  };
}

export async function getOwnedConnection(matchRunId: string): Promise<OwnedConnection | null> {
  const { userId } = await requireUser();
  if (!connectionIdSchema.safeParse(matchRunId).success) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("match_connections")
    .select("id, match_run_id, state, contact_decision")
    .eq("owner_id", userId)
    .eq("match_run_id", matchRunId)
    .maybeSingle();
  if (error) throw error;
  return parseConnection(data);
}

export async function getCurrentConnectedConnection(): Promise<OwnedConnection | null> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("match_connections")
    .select("id, match_run_id, state, contact_decision")
    .eq("owner_id", userId)
    .eq("state", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return parseConnection(data);
}

