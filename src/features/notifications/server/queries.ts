import { requireUser } from "@/features/identity/server/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  matchRunId: string | null;
  kind: "match_completed" | "report_ready";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export async function getOwnedNotifications(): Promise<NotificationItem[]> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("notifications")
    .select("id, match_run_id, kind, title, body, read_at, created_at")
    .eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: item.id, matchRunId: item.match_run_id, kind: item.kind,
    title: item.title, body: item.body, readAt: item.read_at, createdAt: item.created_at,
  }));
}

export async function markNotificationRead(notificationId: string): Promise<string> {
  await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("mark_notification_read", { p_notification_id: notificationId });
  if (error || typeof data !== "string") throw error ?? new Error("NOTIFICATION_NOT_FOUND");
  return data;
}
