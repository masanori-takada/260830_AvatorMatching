import { requireUser } from "@/features/identity/server/session";
import { getCandidateReveal } from "@/features/decision/server/queries";
import { getCurrentConnectedConnection } from "@/features/connection/server/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { ChatCandidateView, ChatMessageView } from "@/components/chat/chat-view";

export type CurrentChat = {
  connectionId: string;
  candidate: ChatCandidateView;
  messages: ChatMessageView[];
};

export async function getCurrentChat(): Promise<CurrentChat | null> {
  const { userId } = await requireUser();
  const connection = await getCurrentConnectedConnection();
  if (!connection) return null;
  const reveal = await getCandidateReveal(connection.matchRunId);
  if (!reveal) return null;

  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("chat_messages")
    .select("id, sender, body, created_at")
    .eq("owner_id", userId)
    .eq("connection_id", connection.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  const messages = (data ?? []).flatMap((row: {
    id?: unknown;
    sender?: unknown;
    body?: unknown;
    created_at?: unknown;
  }) => {
    if (
      typeof row.id !== "string" ||
      (row.sender !== "owner" && row.sender !== "candidate") ||
      typeof row.body !== "string" ||
      typeof row.created_at !== "string"
    ) return [];
    return [{
      id: row.id,
      sender: row.sender,
      body: row.body,
      createdAt: row.created_at,
    } satisfies ChatMessageView];
  });

  return {
    connectionId: connection.id,
    candidate: {
      firstName: reveal.firstName,
      photoPath: reveal.photoPath,
      isAiGenerated: reveal.isAiGenerated,
    },
    messages,
  };
}

